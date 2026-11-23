import type { PayInfo, Quality, Song, UrlResult } from '../../shared/types'
import { IPC_SONG_MIDS_MAX, SONG_DETAIL_BATCH, SONG_DETAIL_CONCURRENCY } from '../../shared/constants'
import { getCredential } from '../credential'
import { resolveDownloadedAudio } from '../download/registry'
import { audioStreamUrl } from '../media/audio-protocol'
import { UpstreamError, musicu } from './client'
import { fetchVkey } from './vkey'
import { getVipStatus } from './user'

interface RawSong {
  id?: number | string
  mid?: string
  name?: string
  title?: string
  interval?: number
  status?: number
  vid?: string
  mv?: { id?: number | string; vid?: string; name?: string; title?: string }
  singer?: Array<{ mid?: string; name?: string }>
  album?: { mid?: string; name?: string }
  pay?: {
    pay_play?: number
    pay_month?: number
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

interface TrackMeta {
  mediaMid: string
  pay: PayInfo
  mvId: string
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

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** 曲库最高音质：只说明存在哪一档文件，不代表当前账号可取流。 */
function libraryMaxQuality(file: RawSong['file']): Song['maxQuality'] {
  if ((file?.size_flac ?? 0) > 0) return 'flac'
  if ((file?.size_320mp3 ?? 0) > 0) return '320k'
  if ((file?.size_128mp3 ?? 0) > 0) return '128k'
  return null
}

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
    },
    status: numberOrNull(raw.status),
    pay_play: numberOrNull(pay.pay_play),
    pay_month: numberOrNull(pay.pay_month),
    pay_status: numberOrNull(pay.pay_status),
    maxQuality: libraryMaxQuality(raw.file),
    mvId: (raw.mv?.vid ?? raw.vid ?? '').trim()
  }
}

function trackMeta(raw: RawTrackInfo, fallbackMid: string): TrackMeta {
  const song = toSong(raw)
  return {
    mediaMid: raw.file?.media_mid ?? fallbackMid,
    pay: song.pay,
    mvId: song.mvId
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
    trackMetaCache.set(mid, trackMeta(data.track_info, mid))
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
    const fallback = await mapLimit(missing, SONG_DETAIL_CONCURRENCY, fetchTrack)
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

/**
 * 查询歌曲绑定的 MV vid；优先复用播放取流已缓存的详情，未命中时单曲补拉。
 * 无绑定或上游未提供时返回空字符串。
 */
export async function getMvId(mid: string): Promise<string> {
  const id = mid.trim()
  if (!id) return ''
  const cached = trackMetaCache.get(id)
  if (cached) return cached.mvId
  const tracks = await fetchTracksById([id])
  const raw = tracks.get(id)
  if (!raw) return ''
  const meta = trackMeta(raw, id)
  trackMetaCache.set(id, meta)
  return meta.mvId
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
  const uin = getCredential()?.musicid ?? '0'
  // 一次 vkey 请求只取一首歌；串行与 300ms 间隔由 api/vkey 统一保证。
  for (const track of tracks) {
    const { purl, result } = await fetchVkey({
      songMid: track.songMid,
      filename: `${prefix}${track.mediaMid}${ext}`,
      uin
    })
    if (purl) urls.set(track.songMid, purl)
    if (result !== null) results.set(track.songMid, result)
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
      const vip = await getVipStatus()
      if (vip.state === 'known' && vip.isVip) {
        throw new UpstreamError(
          'NO_STREAM',
          '播放授权异常（104003）：登录可能已失效或触发风控，请重新登录后重试'
        )
      }
      if (vip.state === 'unknown') {
        throw new UpstreamError(
          'NO_STREAM',
          '当前内容无法播放（104003）：账号权益状态未知，可能需要 VIP / 购买或已下架'
        )
      }
      throw new UpstreamError('NO_STREAM', '当前内容需要 VIP 或购买（104003）')
    }
    const vip = await getVipStatus()
    if (vip.state === 'unknown') {
      throw new UpstreamError(
        'NO_STREAM',
        '无法获取播放链接（可能已下架、需要 VIP 或登录授权异常）'
      )
    }
    throw new UpstreamError(
      'NO_STREAM',
      vip.isVip
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
