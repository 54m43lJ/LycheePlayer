import type { RecommendFeed, RecommendSection, Song } from '../../shared/types'
import { RECOMMEND_CACHE_TTL_MS } from '../../shared/constants'
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

const TITLES: Record<RecommendSection['id'], string> = {
  daily: '每日推荐',
  radar: '专属雷达',
  guess: '猜你喜欢'
}

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

async function loadDaily(): Promise<RecommendSection> {
  const data = await musicu<RecommendFeedData>(
    'music.recommend.RecommendFeed',
    'get_recommend_feed',
    {
      direction: 0,
      page: 1,
      v_cache: [],
      v_uniq: [],
      s_num: 0
    }
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
  const page = await fetchPlaylistPage(card.id, 0)
  section.title = card.title || TITLES.daily
  section.songs = page.songs.slice(0, 30)
  section.playlists = [page.meta]
  section.refreshedAtMs = Date.now()
  return section
}

async function loadRadar(): Promise<RecommendSection> {
  const data = await musicu<RadarData>(
    'music.recommend.TrackRelationServer',
    'GetRadarSong',
    {
      Page: 1,
      NeedNum: 30,
      EntranceSongs: [],
      extra_info: {}
    }
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

async function loadGuess(): Promise<RecommendSection> {
  const data = await musicu<RadioData>('mb_track_radio_svr', 'get_radio_track', {
    id: 99,
    firstplay: 1,
    page: 1,
    pageNo: 1,
    page_num: 1,
    offset: 0,
    num: 30
  })
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

async function loadSection(id: RecommendSection['id']): Promise<RecommendSection> {
  if (id === 'daily') return loadDaily()
  if (id === 'radar') return loadRadar()
  return loadGuess()
}

async function buildFeed(
  force: boolean,
  only?: RecommendSection['id']
): Promise<RecommendFeed> {
  const credential = getCredential()
  if (!credential) {
    const ids: RecommendSection['id'][] = ['daily', 'radar', 'guess']
    const sections: RecommendSection[] = ids.map((id) => emptySection(id))
    return { sections }
  }

  const ids: RecommendSection['id'][] = only ? [only] : ['daily', 'radar', 'guess']
  const sections: RecommendSection[] = []
  for (const id of ids) {
    const hit = cache.get(id)
    if (!force && hit && Date.now() - hit.at <= RECOMMEND_CACHE_TTL_MS) {
      sections.push(hit.section)
      continue
    }
    try {
      const section = await loadSection(id)
      cache.set(id, { section, at: Date.now() })
      sections.push(section)
    } catch (err) {
      // 上游只支持全局刷新时退化为全量；这里保留其他分区的可缓存结果。
      if (err instanceof UpstreamError && err.code === 'AUTH_EXPIRED') throw err
      sections.push(hit?.section ?? emptySection(id))
    }
  }

  if (!only) {
    const order: RecommendSection['id'][] = ['daily', 'radar', 'guess']
    sections.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }
  return { sections }
}

export async function fetchRecommendFeed(
  force = false,
  sectionId?: string
): Promise<RecommendFeed> {
  const only =
    sectionId === 'daily' || sectionId === 'radar' || sectionId === 'guess'
      ? sectionId
      : undefined
  return buildFeed(force, only)
}

export function clearRecommendCache(): void {
  cache.clear()
}
