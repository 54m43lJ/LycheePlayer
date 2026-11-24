import { SONG_DETAIL_CONCURRENCY, TRACK_INFO_BATCH_MAX } from '../../shared/constants'
import { UpstreamError, musicu } from './client'

/** 上游歌曲详情 / 列表共用的原始歌曲模型；只声明本应用消费的字段。 */
export interface RawTrack {
  id?: number | string
  mid?: string
  type?: number
  name?: string
  title?: string
  interval?: number
  status?: number
  vid?: string
  mv?: { id?: number | string; vid?: string; name?: string; title?: string }
  singer?: Array<{ mid?: string; name?: string }>
  album?: { mid?: string; name?: string }
  action?: {
    switch?: number | string
  }
  pay?: {
    pay_play?: number
    pay_down?: number
    price_album?: number
  }
  file?: {
    media_mid?: string
    size_128mp3?: number
    size_320mp3?: number
    size_flac?: number
    size_try?: number
    try_begin?: number
    try_end?: number
  }
}

async function fetchTrackBatch(batch: string[]): Promise<Map<string, RawTrack>> {
  const data = await musicu<{ tracks?: RawTrack[] }>(
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
  const result = new Map<string, RawTrack>()
  for (const track of data.tracks) {
    if (track.mid) result.set(track.mid, track)
  }
  return result
}

async function fetchTrack(mid: string): Promise<RawTrack | null> {
  const data = await musicu<{ track_info?: RawTrack }>(
    'music.pf_song_detail_svr',
    'get_song_detail_yqq',
    { song_mid: mid }
  )
  return data.track_info ?? null
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

/** 批量详情：调用方只传任意数量的 mid，内部分片请求并返回按 mid 索引的原始歌曲。 */
export async function fetchTrackInfoByMids(mids: string[]): Promise<Map<string, RawTrack>> {
  const unique = [...new Set(mids.map((mid) => mid.trim()).filter(Boolean))]
  const result = new Map<string, RawTrack>()
  if (unique.length === 0) return result

  for (let start = 0; start < unique.length; start += TRACK_INFO_BATCH_MAX) {
    const batch = unique.slice(start, start + TRACK_INFO_BATCH_MAX)
    const part = await fetchTrackBatch(batch)
    for (const [mid, track] of part) result.set(mid, track)

    const missing = batch.filter((mid) => !result.has(mid))
    if (missing.length > 0) {
      const fallback = await mapLimit(missing, SONG_DETAIL_CONCURRENCY, fetchTrack)
      missing.forEach((mid, index) => {
        const track = fallback[index]
        if (track) result.set(mid, track)
      })
    }
  }
  return result
}
