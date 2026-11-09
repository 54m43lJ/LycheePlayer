import type { PayInfo, Quality, Song, UrlResult } from '../../shared/types'
import {
  IPC_SONG_MIDS_MAX,
  PROBE_DETAIL_CONCURRENCY,
  PROBE_VKEY_BATCH,
  SONG_DETAIL_BATCH
} from '../../shared/constants'
import { getCredential } from '../credential'
import { resolveDownloadedAudio } from '../download/registry'
import { audioStreamUrl } from '../media/audio-protocol'
import { mapUpstreamCode, UpstreamError, getGuid, musicu } from './client'
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
  retcode?: number
  msg?: string
  midurlinfo?: Array<{
    songmid?: string
    purl?: string
    result?: number
  }>
}

interface TrackMeta {
  mediaMid: string
  pay: PayInfo
}

interface PendingTrack extends TrackMeta {
  songMid: string
}

interface StreamFailure {
  result: number
  quality: Quality
  pay: PayInfo
}

interface ResolvedStreams {
  urls: Map<string, { url: string; quality: Quality }>
  failures: Map<string, StreamFailure>
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

const trackMetaCache = new Map<string, TrackMeta>()

function toSong(raw: RawSong): Song {
  const pay = raw.pay ?? {}
  const albumOnly = Number(pay.price_album ?? 0) > 0
  const vip = pay.pay_play === 1 && !albumOnly
  // 标题优先使用 title：官方客户端展示的版本标签（Explicit / Remix 等）在 title 中；
  // name 是去掉标签的基础名，可能带尾部空白，需 trim 后再兜底。
  const name = (raw.title ?? '').trim() || (raw.name ?? '').trim()
  return {
    songMid: raw.mid ?? '',
    songId: String(raw.id ?? ''),
    name,
    // 官方客户端存在“有名字但没有歌手页”的歌手：mid 可为空，名称仍需保留。
    singers: (raw.singer ?? [])
      .map((singer) => ({ mid: singer.mid ?? '', name: (singer.name ?? '').trim() }))
      .filter((singer) => singer.name.length > 0 || singer.mid.length > 0),
    album: { mid: raw.album?.mid ?? '', name: (raw.album?.name ?? '').trim() },
    durationMs: Math.max(0, Number(raw.interval ?? 0)) * 1000,
    pay: {
      free: pay.pay_play === 0 && !albumOnly,
      vip,
      album: albumOnly
    }
  }
}

function trackMeta(raw: RawTrackInfo, fallbackMid: string): TrackMeta {
  return {
    mediaMid: raw.file?.media_mid ?? fallbackMid,
    pay: toSong(raw).pay
  }
}

/** 单曲详情兜底：批量详情缺少某首歌时再单独请求。 */
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
  if (mediaMid) {
    trackMetaCache.set(mid, { mediaMid, pay: toSong(data.track_info).pay })
  }
  return data.track_info
}

/** 一次请求取回多首歌曲详情；按 mid 建立索引，响应顺序不影响结果。 */
async function fetchTrackBatch(mids: string[]): Promise<Map<string, RawTrackInfo>> {
  const result = new Map<string, RawTrackInfo>()
  for (let start = 0; start < mids.length; start += SONG_DETAIL_BATCH) {
    const batch = mids.slice(start, start + SONG_DETAIL_BATCH)
    const data = await musicu<{ tracks?: RawTrackInfo[] }>(
      'music.trackInfo.UniformRuleCtrl',
      'CgiGetTrackInfo',
      {
        types: batch.map(() => 0),
        modify_stamp: batch.map(() => 0),
        ctx: 0,
        client: 1,
        mids: batch
      }
    )
    if (!Array.isArray(data.tracks)) {
      throw new UpstreamError('UPSTREAM_CHANGED', '批量歌曲详情响应缺少 tracks')
    }
    for (const track of data.tracks) {
      if (track.mid) result.set(track.mid, track)
    }
  }
  return result
}

/** 批量详情 + 缺口单曲兜底，返回按 mid 索引的原始歌曲。 */
async function fetchTracksById(mids: string[]): Promise<Map<string, RawTrackInfo>> {
  const unique = [...new Set(mids.filter(Boolean))]
  if (unique.length === 0) return new Map()
  const result = await fetchTrackBatch(unique)
  const missing = unique.filter((mid) => !result.has(mid))
  if (missing.length > 0) {
    const fallback = await mapLimit(missing, PROBE_DETAIL_CONCURRENCY, fetchTrack)
    missing.forEach((mid, index) => result.set(mid, fallback[index]))
  }
  return result
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
  if (unique.length === 0) return []
  const tracks = await fetchTracksById(unique)
  return unique.map((mid) => {
    const raw = tracks.get(mid)
    if (!raw) throw new UpstreamError('UPSTREAM_CHANGED', `歌曲详情缺少 track_info：${mid}`)
    trackMetaCache.set(mid, trackMeta(raw, mid))
    return toSong(raw)
  })
}

function buildStreamUrl(purl: string): string {
  if (/^https?:\/\//i.test(purl)) return purl
  // 查询参数（尤其是 fromtag）与 vkey 绑定，必须整体复用上游返回的 purl。
  return `https://ws.stream.qqmusic.qq.com/${purl}`
}

async function requestQuality(
  tracks: PendingTrack[],
  quality: Quality
): Promise<{ urls: Map<string, string>; results: Map<string, number> }> {
  const { prefix, ext } = QUALITY_FILE[quality]
  const urls = new Map<string, string>()
  const results = new Map<string, number>()
  for (let start = 0; start < tracks.length; start += PROBE_VKEY_BATCH) {
    const batch = tracks.slice(start, start + PROBE_VKEY_BATCH)
    const songmid = batch.map((track) => track.songMid)
    const songtype = batch.map(() => 0)
    const filename = batch.map((track) => `${prefix}${track.mediaMid}${ext}`)
    const uin = getCredential()?.musicid ?? '0'

    let data: VkeyData
    try {
      data = await musicu<VkeyData>('vkey.GetVkeyServer', 'CgiGetVkey', {
        guid: getGuid(),
        songmid,
        songtype,
        filename,
        uin,
        loginflag: 1,
        platform: '20'
      })
      // 有些响应把具体错误放在 data.retcode，而 req_0.code 为 0。
      const retcode = Number(data.retcode)
      if (Number.isFinite(retcode) && retcode !== 0) {
        throw mapUpstreamCode(retcode, 'vkey.GetVkeyServer.CgiGetVkey')
      }
    } catch (err) {
      // 经典接口返回 104009 invalidq 时，尝试当前维护的 UrlGetVkey 接口。
      if (!(err instanceof UpstreamError) || err.upstreamCode !== 104009) throw err
      data = await musicu<VkeyData>('music.vkey.GetVkey', 'UrlGetVkey', {
        uin,
        filename,
        guid: getGuid(),
        songmid,
        songtype,
        ctx: 0
      })
      const retcode = Number(data.retcode)
      if (Number.isFinite(retcode) && retcode !== 0) {
        throw mapUpstreamCode(retcode, 'music.vkey.GetVkey.UrlGetVkey')
      }
    }

    for (const info of data.midurlinfo ?? []) {
      if (!info.songmid) continue
      if (info.purl) urls.set(info.songmid, info.purl)
      const result = Number(info.result)
      if (Number.isFinite(result)) results.set(info.songmid, result)
    }
  }
  return { urls, results }
}

async function resolveStreams(mids: string[], requested: Quality): Promise<ResolvedStreams> {
  const unique = [...new Set(mids.filter(Boolean))].slice(0, IPC_SONG_MIDS_MAX)
  const urls = new Map<string, { url: string; quality: Quality }>()
  const failures = new Map<string, StreamFailure>()
  if (unique.length === 0) return { urls, failures }

  const missing = unique.filter((mid) => !trackMetaCache.has(mid))
  if (missing.length > 0) {
    const fetched = await fetchTracksById(missing)
    for (const mid of missing) {
      const raw = fetched.get(mid)
      if (!raw) throw new UpstreamError('UPSTREAM_CHANGED', `歌曲详情缺少 track_info：${mid}`)
      trackMetaCache.set(mid, trackMeta(raw, mid))
    }
  }
  const tracks: PendingTrack[] = unique.map((mid) => {
    const meta = trackMetaCache.get(mid)
    if (!meta) throw new UpstreamError('UPSTREAM_CHANGED', `歌曲详情缺少 track_info：${mid}`)
    return { songMid: mid, ...meta }
  })

  let pending = tracks
  for (const quality of qualityAttempts(requested)) {
    if (pending.length === 0) break
    let resolved: { urls: Map<string, string>; results: Map<string, number> }
    try {
      resolved = await requestQuality(pending, quality)
    } catch (err) {
      // 104003：当前账号无该档位权限，记录后继续尝试下一档。
      if (err instanceof UpstreamError && err.code === 'NO_STREAM') {
        for (const track of pending) {
          failures.set(track.songMid, { result: 104003, quality, pay: track.pay })
        }
        continue
      }
      throw err
    }
    for (const track of pending) {
      const purl = resolved.urls.get(track.songMid)
      if (purl) {
        urls.set(track.songMid, { url: buildStreamUrl(purl), quality })
        continue
      }
      const result = resolved.results.get(track.songMid)
      if (result !== undefined) {
        failures.set(track.songMid, { result, quality, pay: track.pay })
      }
    }
    pending = pending.filter((track) => !urls.has(track.songMid))
  }
  return { urls, failures }
}

/** 解析各档音质的上游播放地址；不生成协议 URL，也不按失败原因抛错。 */
export async function resolveStreamUrls(
  mids: string[],
  requested: Quality
): Promise<Map<string, { url: string; quality: Quality }>> {
  return (await resolveStreams(mids, requested)).urls
}

/**
 * 获取播放链接：先尝试请求档位，再按 flac → 320k → 128k 兜底；逐个 songMid 记录实际音质。
 * 返回主进程音频代理 URL；全批量无链接时按上游 result 区分权限、链路与下架。
 */
export async function getStreamUrls(mids: string[], quality: Quality): Promise<UrlResult[]> {
  const unique = [...new Set(mids.filter(Boolean))].slice(0, IPC_SONG_MIDS_MAX)
  if (unique.length === 0) return []

  // 已下载到本机的歌曲直接走本地文件，不再请求上游链接。
  const downloaded = new Map<string, { filePath: string; quality: Quality }>()
  const remoteMids: string[] = []
  for (const mid of unique) {
    const local = await resolveDownloadedAudio(mid, quality)
    if (local) downloaded.set(mid, local)
    else remoteMids.push(mid)
  }

  const { urls, failures } = await resolveStreams(remoteMids, quality)
  const results = unique.map<UrlResult>((mid) => {
    const local = downloaded.get(mid)
    if (local) {
      return {
        songMid: mid,
        url: audioStreamUrl('', mid, local.quality, local.filePath),
        quality: local.quality
      }
    }
    const item = urls.get(mid)
    return {
      songMid: mid,
      url: item ? audioStreamUrl(item.url, mid, item.quality) : null,
      quality: item?.quality ?? quality
    }
  })

  if (results.every((result) => result.url === null)) {
    const allFailedWith = (code: number): boolean =>
      unique.every((mid) => failures.get(mid)?.result === code)
    if (allFailedWith(104004)) {
      throw new UpstreamError('UPSTREAM_NETWORK', '播放链接获取失败（104004），请稍后重试')
    }
    if (allFailedWith(104013)) {
      throw new UpstreamError('NO_PERMISSION', '当前设备无法播放该内容（104013）')
    }
    if (allFailedWith(104003)) {
      const credential = getCredential()
      if (!credential) {
        throw new UpstreamError('NO_STREAM', '当前内容不可播放（请先登录；也可能需要 VIP 或已下架）')
      }
      const albumOnly = unique.every((mid) => failures.get(mid)?.pay.album)
      if (albumOnly) {
        throw new UpstreamError('NO_STREAM', '数字专辑需要购买后才能播放')
      }
      const vip = await isVipUser()
      if (vip) {
        throw new UpstreamError(
          'NO_STREAM',
          '播放授权异常（104003）：登录可能已失效或触发风控，请重新登录后重试'
        )
      }
      throw new UpstreamError('NO_STREAM', '当前内容需要 VIP 或购买（104003）')
    }
    const vip = await isVipUser()
    throw new UpstreamError(
      'NO_STREAM',
      vip
        ? '无法获取播放链接（可能已下架或登录授权异常）'
        : '当前内容不可播放（可能需要 VIP 或已下架）'
    )
  }
  return results
}

/** 搜索/歌单响应里的原始歌曲直接转 IPC 模型。 */
export function rawSongToSong(raw: unknown): Song {
  return toSong(raw as RawSong)
}
