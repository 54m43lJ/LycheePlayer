import type { ProbeOptions, Quality, SongAvailability } from '../../shared/types'
import { PROBE_CACHE_TTL_MS, PROBE_MAX_SONGS, PROBE_MIDS_MAX } from '../../shared/constants'
import { getCredential } from '../credential'
import { resolveStreamUrls } from './song'

const cache = new Map<string, Map<string, SongAvailability>>()

function scope(): string {
  return getCredential()?.musicid ?? 'anonymous'
}

function accountCache(): Map<string, SongAvailability> {
  const key = scope()
  let entry = cache.get(key)
  if (!entry) {
    entry = new Map()
    cache.set(key, entry)
  }
  return entry
}

function qualityOf(summary: Map<string, { url: string; quality: Quality }>, mid: string): Quality | null {
  return summary.get(mid)?.quality ?? null
}

/**
 * 探测歌曲可用性与最高可用音质；只返回元数据，不修改播放队列。
 * 未探测到的状态按可播处理由调用方决定。
 */
export async function probeAvailability(
  mids: string[],
  options: ProbeOptions = {}
): Promise<SongAvailability[]> {
  const unique = [...new Set(mids.filter(Boolean))].slice(0, PROBE_MIDS_MAX)
  if (unique.length === 0) return []
  const store = accountCache()
  const now = Date.now()
  const result = new Map<string, SongAvailability>()

  const pending: string[] = []
  for (const mid of unique) {
    const cached = store.get(mid)
    if (!options.force && cached && now - cached.checkedAtMs <= PROBE_CACHE_TTL_MS) {
      result.set(mid, cached)
    } else {
      pending.push(mid)
    }
  }

  if (pending.length > 0) {
    // 逐档探测由 resolveStreamUrls 完成；请求档位固定 flac，返回实际最高档。
    const resolved = await resolveStreamUrls(pending, 'flac')
    for (const mid of pending) {
      const availability: SongAvailability = {
        songMid: mid,
        playable: resolved.has(mid),
        maxQuality: qualityOf(resolved, mid),
        checkedAtMs: Date.now()
      }
      store.set(mid, availability)
      result.set(mid, availability)
    }
    if (store.size > PROBE_MAX_SONGS) {
      const overflow = store.size - PROBE_MAX_SONGS
      let removed = 0
      for (const key of store.keys()) {
        if (removed >= overflow) break
        store.delete(key)
        removed += 1
      }
    }
  }

  return unique.map(
    (mid) =>
      result.get(mid) ?? {
        songMid: mid,
        playable: true,
        maxQuality: null,
        checkedAtMs: now
      }
  )
}

/** 退出登录时清空当前账号或全部可用性缓存。 */
export function clearAvailabilityCache(musicid?: string): void {
  if (musicid) cache.delete(musicid)
  else cache.clear()
}
