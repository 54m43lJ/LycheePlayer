import type { Quality, Song, UrlResult } from '../../shared/types'
import { getCredential } from '../credential'
import { UpstreamError, getGuid, musicu } from './client'

interface RawSong {
  id?: number | string
  mid?: string
  name?: string
  title?: string
  interval?: number
  singer?: Array<{ mid?: string; name?: string }>
  album?: { mid?: string; name?: string }
  pay?: {
    pay_play?: number
    price_album?: number
    pay_status?: number
  }
  file?: { media_mid?: string }
}

interface RawTrackInfo extends RawSong {
  file?: { media_mid?: string }
}

interface VkeyData {
  midurlinfo?: Array<{
    songmid?: string
    purl?: string
    result?: number
  }>
}

const QUALITY_FILE: Record<Quality, { prefix: string; ext: string }> = {
  '128k': { prefix: 'M500', ext: '.mp3' },
  '320k': { prefix: 'M800', ext: '.mp3' },
  flac: { prefix: 'F000', ext: '.flac' }
}

const QUALITY_CHAIN: Record<Quality, Quality[]> = {
  flac: ['flac', '320k', '128k'],
  '320k': ['320k', '128k'],
  '128k': ['128k']
}

const mediaMidCache = new Map<string, string>()

function toSong(raw: RawSong): Song {
  const pay = raw.pay ?? {}
  const albumOnly = Number(pay.price_album ?? 0) > 0
  const vip = pay.pay_play === 1 && !albumOnly
  return {
    songMid: raw.mid ?? '',
    songId: String(raw.id ?? ''),
    name: raw.name ?? raw.title ?? '',
    singers: (raw.singer ?? [])
      .filter((singer) => Boolean(singer.mid))
      .map((singer) => ({ mid: singer.mid ?? '', name: singer.name ?? '' })),
    album: { mid: raw.album?.mid ?? '', name: raw.album?.name ?? '' },
    durationMs: Math.max(0, Number(raw.interval ?? 0)) * 1000,
    pay: {
      free: pay.pay_play === 0 && !albumOnly,
      vip,
      album: albumOnly
    }
  }
}

async function fetchTrack(mid: string): Promise<RawTrackInfo> {
  const data = await musicu<{ track_info?: RawTrackInfo }>(
    'music.pf_song_detail_svr',
    'get_song_detail_yqq',
    { song_mid: mid }
  )
  if (!data.track_info) {
    throw new UpstreamError('UPSTREAM_CHANGED', `歌曲详情缺少 track_info：${mid}`)
  }
  const mediaMid = data.track_info.file?.media_mid
  if (mediaMid) mediaMidCache.set(mid, mediaMid)
  return data.track_info
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return results
}

/** 按 songMid 批量取详情，供歌单/播放器补齐非搜索来源的歌曲。 */
export async function getDetail(mids: string[]): Promise<Song[]> {
  const unique = [...new Set(mids.filter(Boolean))]
  const tracks = await mapLimit(unique, 4, (mid) => fetchTrack(mid))
  return tracks.map(toSong)
}

interface PendingTrack {
  songMid: string
  mediaMid: string
}

function buildStreamUrl(purl: string): string {
  if (/^https?:\/\//i.test(purl)) return purl

  // vkey 与查询参数（尤其是 fromtag）绑定，必须整体复用上游返回的 purl；
  // 按前缀重新拼装会导致 403。
  return `https://ws.stream.qqmusic.qq.com/${purl}`
}

async function requestQuality(
  tracks: PendingTrack[],
  quality: Quality
): Promise<Map<string, string>> {
  const { prefix, ext } = QUALITY_FILE[quality]
  const data = await musicu<VkeyData>(
    'vkey.GetVkeyServer',
    'CgiGetVkey',
    {
      guid: getGuid(),
      songmid: tracks.map((track) => track.songMid),
      songtype: tracks.map(() => 0),
      filename: tracks.map((track) => `${prefix}${track.mediaMid}${ext}`),
      uin: getCredential()?.musicid ?? '0',
      loginflag: 1,
      platform: '20'
    }
  )

  const resolved = new Map<string, string>()
  for (const info of data.midurlinfo ?? []) {
    if (info.songmid && info.purl) {
      resolved.set(info.songmid, info.purl)
    }
  }
  return resolved
}

/**
 * 获取播放链接：flac → 320k → 128k 单向降档，逐个 songMid 记录实际音质。
 * 全批量在所有档位都无链接时抛 NO_STREAM。
 */
export async function getStreamUrls(mids: string[], quality: Quality): Promise<UrlResult[]> {
  const unique = [...new Set(mids.filter(Boolean))]
  if (unique.length === 0) return []

  const tracks: PendingTrack[] = []
  await mapLimit(unique, 4, async (mid) => {
    let mediaMid = mediaMidCache.get(mid)
    if (!mediaMid) {
      const track = await fetchTrack(mid)
      mediaMid = track.file?.media_mid ?? mid
      mediaMidCache.set(mid, mediaMid)
    }
    tracks.push({ songMid: mid, mediaMid })
  })

  const actualQuality = new Map<string, Quality>()
  const urls = new Map<string, string>()
  let pending = tracks

  for (const step of QUALITY_CHAIN[quality]) {
    if (pending.length === 0) break
    const resolved = await requestQuality(pending, step)
    for (const track of pending) {
      const purl = resolved.get(track.songMid)
      if (!purl) continue
      urls.set(track.songMid, buildStreamUrl(purl))
      actualQuality.set(track.songMid, step)
    }
    pending = pending.filter((track) => !urls.has(track.songMid))
  }

  const results = unique.map<UrlResult>((mid) => ({
    songMid: mid,
    url: urls.get(mid) ?? null,
    quality: actualQuality.get(mid) ?? QUALITY_CHAIN[quality][QUALITY_CHAIN[quality].length - 1]
  }))

  if (results.every((result) => result.url === null)) {
    throw new UpstreamError('NO_STREAM', '没有可用的播放链接（可能需要 VIP 或已下架）')
  }
  return results
}

/** 搜索/歌单响应里的原始歌曲直接转 IPC 模型。 */
export function rawSongToSong(raw: unknown): Song {
  return toSong(raw as RawSong)
}
