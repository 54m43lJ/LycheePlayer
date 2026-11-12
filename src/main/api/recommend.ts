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

const cache = new Map<RecommendSection['id'], RecommendSection>()

const TITLES = RECOMMEND_SECTION_TITLES

function emptySection(id: RecommendSection['id']): RecommendSection {
  const now = Date.now()
  return {
    id,
    title: TITLES[id],
    songs: [],
    playlists: [],
    refreshedAtMs: now,
    expiresAtMs: id === 'daily' ? nextShanghaiMidnight(now) : now + RECOMMEND_CACHE_TTL_MS
  }
}

/** 上海自然日键；每日推荐按该键判断跨日，而不是按抓取后 24 小时。 */
function dayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(ms))
}

/** 当前上海自然日的下一个 0 点（Unix 毫秒）。 */
function nextShanghaiMidnight(ms: number): number {
  return Date.parse(`${dayKey(ms)}T00:00:00+08:00`) + 24 * 60 * 60_000
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
  const finishedAt = Date.now()
  section.title = card.title || TITLES.daily
  section.songs = page.songs.slice(0, 30)
  section.playlists = [page.meta]
  section.refreshedAtMs = finishedAt
  // 读歌单期间若跨过 0 点，立即标记过期，避免把昨天的日推缓存到今天。
  section.expiresAtMs =
    dayKey(finishedAt) === today ? nextShanghaiMidnight(finishedAt) : finishedAt
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
  const now = Date.now()
  return {
    ...emptySection('radar'),
    songs: deduped,
    refreshedAtMs: now,
    expiresAtMs: now + RECOMMEND_CACHE_TTL_MS
  }
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
  const now = Date.now()
  return {
    ...emptySection('guess'),
    songs,
    refreshedAtMs: now,
    expiresAtMs: now + RECOMMEND_CACHE_TTL_MS
  }
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
    // 每日推荐按上海自然日过期，force 不能绕过仍在有效期内的当天日推。
    const forceThisSection = force && id !== 'daily'
    if (!forceThisSection && hit && Date.now() < hit.expiresAtMs) {
      sections.push(hit)
      continue
    }
    try {
      const section = await loadSection(id, signal)
      cache.set(id, section)
      sections.push(section)
    } catch (err) {
      // 页面取消后不再吞掉中止错误，避免继续填充占位分区。
      if (signal?.aborted) throw err
      // 上游只支持全局刷新时退化为全量；这里保留其他分区的可缓存结果。
      if (err instanceof UpstreamError && err.code === 'AUTH_EXPIRED') throw err
      sections.push(hit ?? emptySection(id))
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
