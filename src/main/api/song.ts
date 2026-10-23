import type { Quality, Song, UrlResult } from '../../shared/types'
import { IPC_SONG_MIDS_MAX, PROBE_DETAIL_CONCURRENCY, PROBE_VKEY_BATCH } from '../../shared/constants'
import { getCredential } from '../credential'
import { audioStreamUrl } from '../media/audio-protocol'
import { UpstreamError, getGuid, musicu } from './client'
import { isVipUser } from './user'

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
  file?: {
    media_mid?: string
    size_128mp3?: number
    size_320mp3?: number
    size_flac?: number
  }
}

interface RawTrackInfo extends RawSong {
  file?: RawSong['file']
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

const QUALITY_FALLBACK_ORDER: Quality[] = ['flac', '320k', '128k']

function qualityAttempts(requested: Quality): Quality[] {
  return [requested, ...QUALITY_FALLBACK_ORDER.filter((quality) => quality !== requested)]
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
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
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
  const tracks = await mapLimit(unique, PROBE_DETAIL_CONCURRENCY, (mid) => fetchTrack(mid))
  return tracks.map(toSong)
}

interface PendingTrack {
  songMid: string
  mediaMid: string
}

function buildStreamUrl(purl: string): string {
  if (/^https?:\/\//i.test(purl)) return purl
  // 查询参数（尤其是 fromtag）与 vkey 绑定，必须整体复用上游返回的 purl。
  return `https://ws.stream.qqmusic.qq.com/${purl}`
}

async function requestQuality(
  tracks: PendingTrack[],
  quality: Quality
): Promise<Map<string, string>> {
  const { prefix, ext } = QUALITY_FILE[quality]
  const resolved = new Map<string, string>()
  for (let start = 0; start < tracks.length; start += PROBE_VKEY_BATCH) {
    const batch = tracks.slice(start, start + PROBE_VKEY_BATCH)
    const data = await musicu<VkeyData>('vkey.GetVkeyServer', 'CgiGetVkey', {
      guid: getGuid(),
      songmid: batch.map((track) => track.songMid),
      songtype: batch.map(() => 0),
      filename: batch.map((track) => `${prefix}${track.mediaMid}${ext}`),
      uin: getCredential()?.musicid ?? '0',
      loginflag: 1,
      platform: '20'
    })
    for (const info of data.midurlinfo ?? []) {
      if (info.songmid && info.purl) resolved.set(info.songmid, info.purl)
    }
  }
  return resolved
}

/** 解析各档音质的上游播放地址；不生成协议 URL，也不抛 NO_STREAM。 */
export async function resolveStreamUrls(
  mids: string[],
  requested: Quality
): Promise<Map<string, { url: string; quality: Quality }>> {
  const unique = [...new Set(mids.filter(Boolean))].slice(0, IPC_SONG_MIDS_MAX)
  const result = new Map<string, { url: string; quality: Quality }>()
  if (unique.length === 0) return result

  const tracks = await mapLimit(unique, PROBE_DETAIL_CONCURRENCY, async (mid) => {
    let mediaMid = mediaMidCache.get(mid)
    if (!mediaMid) {
      const track = await fetchTrack(mid)
      mediaMid = track.file?.media_mid ?? mid
      mediaMidCache.set(mid, mediaMid)
    }
    return { songMid: mid, mediaMid }
  })

  let pending = tracks
  for (const quality of qualityAttempts(requested)) {
    if (pending.length === 0) break
    let resolved: Map<string, string>
    try {
      resolved = await requestQuality(pending, quality)
    } catch (err) {
      // 104003：当前账号无该档位权限，继续尝试下一档。
      if (err instanceof UpstreamError && err.code === 'NO_STREAM') continue
      throw err
    }
    for (const track of pending) {
      const purl = resolved.get(track.songMid)
      if (!purl) continue
      result.set(track.songMid, { url: buildStreamUrl(purl), quality })
    }
    pending = pending.filter((track) => !result.has(track.songMid))
  }
  return result
}

/**
 * 获取播放链接：先尝试请求档位，再按 flac → 320k → 128k 兜底；逐个 songMid 记录实际音质。
 * 返回主进程音频代理 URL；全批量在所有档位都无链接时抛 NO_STREAM。
 */
export async function getStreamUrls(mids: string[], quality: Quality): Promise<UrlResult[]> {
  const unique = [...new Set(mids.filter(Boolean))].slice(0, IPC_SONG_MIDS_MAX)
  if (unique.length === 0) return []

  const resolved = await resolveStreamUrls(unique, quality)
  const results = unique.map<UrlResult>((mid) => {
    const item = resolved.get(mid)
    return {
      songMid: mid,
      url: item ? audioStreamUrl(item.url, mid, item.quality) : null,
      quality: item?.quality ?? quality
    }
  })

  if (results.every((result) => result.url === null)) {
    const vip = await isVipUser()
    throw new UpstreamError(
      'NO_STREAM',
      vip ? '当前内容已下架' : '当前内容不可播放（可能需要 VIP 或已下架）'
    )
  }
  return results
}

/** 搜索/歌单响应里的原始歌曲直接转 IPC 模型。 */
export function rawSongToSong(raw: unknown): Song {
  return toSong(raw as RawSong)
}
