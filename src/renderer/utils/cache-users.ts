import type { UserCacheInfo } from '@shared/types'
import {
  PLAY_HISTORY_STORAGE_PREFIX,
  RECENT_PLAYLIST_STORAGE_PREFIX
} from '@shared/constants'

export interface UserCacheRow extends UserCacheInfo {
  localBytes: number
  localEntries: number
}

const LOCAL_PREFIXES = [RECENT_PLAYLIST_STORAGE_PREFIX, PLAY_HISTORY_STORAGE_PREFIX]

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

function storageKeys(): string[] {
  try {
    const keys: string[] = []
    const length = typeof localStorage.length === 'number' ? localStorage.length : 0
    for (let index = 0; index < length; index += 1) {
      const key = localStorage.key(index)
      if (key) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

/** 统计 localStorage 中按账号隔离的最近歌单与播放历史占用。 */
export function localCacheUsage(): Map<string, { bytes: number; entries: number }> {
  const usage = new Map<string, { bytes: number; entries: number }>()
  for (const key of storageKeys()) {
    const prefix = LOCAL_PREFIXES.find((item) => key.startsWith(item))
    if (!prefix) continue
    const musicid = key.slice(prefix.length)
    if (!musicid) continue
    const value = localStorage.getItem(key) ?? ''
    const item = usage.get(musicid) ?? { bytes: 0, entries: 0 }
    item.bytes += byteLength(key) + byteLength(value)
    item.entries += 1
    usage.set(musicid, item)
  }
  return usage
}

/** 合并主进程缓存统计与渲染层本地记录，供设置页弹窗展示。 */
export function mergeUserCaches(remote: UserCacheInfo[]): UserCacheRow[] {
  const rows = new Map<string, UserCacheRow>()
  for (const item of remote) {
    rows.set(item.musicid, { ...item, localBytes: 0, localEntries: 0 })
  }
  for (const [musicid, usage] of localCacheUsage()) {
    const row =
      rows.get(musicid) ??
      {
        musicid,
        audioBytes: 0,
        audioFiles: 0,
        playlistBytes: 0,
        playlistFiles: 0,
        localBytes: 0,
        localEntries: 0
      }
    row.localBytes += usage.bytes
    row.localEntries += usage.entries
    rows.set(musicid, row)
  }
  const total = (row: UserCacheRow): number =>
    row.audioBytes + row.playlistBytes + row.localBytes
  return [...rows.values()].sort(
    (a, b) => total(b) - total(a) || a.musicid.localeCompare(b.musicid)
  )
}

/** 删除指定账号的最近歌单与播放历史；其他账号与全局设置不受影响。 */
export function clearLocalUserCache(musicid: string): void {
  for (const prefix of LOCAL_PREFIXES) {
    try {
      localStorage.removeItem(`${prefix}${musicid}`)
    } catch {
      // localStorage 不可用时忽略。
    }
  }
}
