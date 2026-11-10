import type { RecommendFeed, RecommendSection, Song } from '../../shared/types'
import {
  RECOMMEND_CACHE_TTL_MS,
  RECOMMEND_SECTION_IDS,
  RECOMMEND_SECTION_TITLES
} from '../../shared/constants'
import { getCredential } from '../credential'
import { UpstreamError, musicu } from './client'
import { fetchPlaylistPage } from './playlist'
import { rawSongToSong } from './song'

interface RecommendCard {
  id?: string
  title?: string
  subtype?: number
  time?: number
  cover?: string
}

interface RecommendFeedData {
  v_shelf?: Array<{
    id?: number
    v_niche?: Array<{ v_card?: RecommendCard[] }>
  }>
}

interface RadarData {
  VecSongs?: Array<{ Track?: unknown }>
  HasMore?: boolean
}

interface RadioData {
  tracks?: unknown[]
  songlist?: { tracks?: unknown[] } | unknown[]
}

const cache = new Map<RecommendSection['id'], { section: RecommendSection; at: number }>()

const TITLES = RECOMMEND_SECTION_TITLES

function emptySection(id: RecommendSection['id']): RecommendSection {
  return {
    id,
    title: TITLES[id],
    songs: [],
    playlists: [],
    refreshedAtMs: Date.now()
  }
}

function dayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ms))
}

async function loadDaily(signal?: AbortSignal): Promise<RecommendSection> {
  const data = await musicu<RecommendFeedData>(
    'music.recommend.RecommendFeed',
    'get_recommend_feed',
    {
      direction: 0,
      page: 1,
      v_cache: [],
      v_uniq: [],
      s_num: 0
    },
    { signal }
  )
  const cards = (data.v_shelf ?? [])
    .flatMap((shelf) => shelf.v_niche ?? [])
    .flatMap((niche) => niche.v_card ?? [])
  const today = dayKey(Date.now())
  const card = cards.find(
    (item) =>
      item.subtype === 510 &&
      item.id &&
      item.id !== '0' &&
      (typeof item.time !== 'number' || dayKey(item.time * 1000) === today)
  )
  const section = emptySection('daily')
  if (!card?.id) return section
  const page = await fetchPlaylistPage(card.id, 0, signal)
  section.title = card.title || TITLES.daily
  section.songs = page.songs.slice(0, 30)
  section.playlists = [page.meta]
  section.refreshedAtMs = Date.now()
  return section
}

async function loadRadar(signal?: AbortSignal): Promise<RecommendSection> {
  const data = await musicu<RadarData>(
    'music.recommend.TrackRelationServer',
    'GetRadarSong',
    {
      Page: 1,
      NeedNum: 30,
      EntranceSongs: [],
      extra_info: {}
    },
    { signal }
  )
  const songs: Song[] = (data.VecSongs ?? [])
    .map((item) => item.Track)
    .filter((track): track is Record<string, unknown> => Boolean(track))
    .map(rawSongToSong)
  const seen = new Set<string>()
  const deduped = songs.filter((song) => {
    if (!song.songMid || seen.has(song.songMid)) return false
    seen.add(song.songMid)
    return true
  })
  return { ...emptySection('radar'), songs: deduped, refreshedAtMs: Date.now() }
}

async function loadGuess(signal?: AbortSignal): Promise<RecommendSection> {
  const data = await musicu<RadioData>(
    'mb_track_radio_svr',
    'get_radio_track',
    {
      id: 99,
      firstplay: 1,
      page: 1,
      pageNo: 1,
      page_num: 1,
      offset: 0,
      num: 30
    },
    { signal }
  )
  const list = Array.isArray(data.tracks)
    ? data.tracks
    : Array.isArray(data.songlist)
      ? data.songlist
      : Array.isArray((data.songlist as { tracks?: unknown[] } | undefined)?.tracks)
        ? ((data.songlist as { tracks?: unknown[] }).tracks as unknown[])
        : []
  const seen = new Set<string>()
  const songs = list
    .map(rawSongToSong)
    .filter((song) => {
      if (!song.songMid || seen.has(song.songMid)) return false
      seen.add(song.songMid)
      return true
    })
  return { ...emptySection('guess'), songs, refreshedAtMs: Date.now() }
}

async function loadSection(
  id: RecommendSection['id'],
  signal?: AbortSignal
): Promise<RecommendSection> {
  if (id === 'daily') return loadDaily(signal)
  if (id === 'radar') return loadRadar(signal)
  return loadGuess(signal)
}

async function buildFeed(
  force: boolean,
  only?: RecommendSection['id'],
  signal?: AbortSignal
): Promise<RecommendFeed> {
  const credential = getCredential()
  if (!credential) {
    const sections: RecommendSection[] = RECOMMEND_SECTION_IDS.map((id) =>
      emptySection(id)
    )
    return { sections }
  }

  const ids: RecommendSection['id'][] = only ? [only] : [...RECOMMEND_SECTION_IDS]
  const sections: RecommendSection[] = []
  for (const id of ids) {
    const hit = cache.get(id)
    if (!force && hit && Date.now() - hit.at <= RECOMMEND_CACHE_TTL_MS) {
      sections.push(hit.section)
      continue
    }
    try {
      const section = await loadSection(id, signal)
      cache.set(id, { section, at: Date.now() })
      sections.push(section)
    } catch (err) {
      // 页面取消后不再吞掉中止错误，避免继续填充占位分区。
      if (signal?.aborted) throw err
      // 上游只支持全局刷新时退化为全量；这里保留其他分区的可缓存结果。
      if (err instanceof UpstreamError && err.code === 'AUTH_EXPIRED') throw err
      sections.push(hit?.section ?? emptySection(id))
    }
  }

  if (!only) {
    sections.sort(
      (a, b) => RECOMMEND_SECTION_IDS.indexOf(a.id) - RECOMMEND_SECTION_IDS.indexOf(b.id)
    )
  }
  return { sections }
}

export async function fetchRecommendFeed(
  force = false,
  sectionId?: string,
  signal?: AbortSignal
): Promise<RecommendFeed> {
  const only =
    sectionId === 'daily' || sectionId === 'radar' || sectionId === 'guess'
      ? sectionId
      : undefined
  return buildFeed(force, only, signal)
}

export function clearRecommendCache(): void {
  cache.clear()
}
