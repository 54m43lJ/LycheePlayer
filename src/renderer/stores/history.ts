import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Song } from '@shared/types'
import { PLAY_HISTORY_LIMIT, PLAY_HISTORY_STORAGE_PREFIX } from '@shared/constants'
import { isSong } from '@shared/validation'
import { readPersistedJson } from '../utils/persisted-cache'
import { useAuthStore } from './auth'

/** 播放历史条目：歌曲快照与最近一次实际开始播放的时间。 */
export interface PlayHistoryEntry {
  song: Song
  playedAtMs: number
}

function isEntry(value: unknown): value is PlayHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    isSong(entry.song) &&
    typeof entry.playedAtMs === 'number' &&
    Number.isFinite(entry.playedAtMs)
  )
}

function isEntryList(value: unknown): value is PlayHistoryEntry[] {
  return Array.isArray(value) && value.every(isEntry)
}

export const useHistoryStore = defineStore('history', () => {
  const auth = useAuthStore()
  const entries = ref<PlayHistoryEntry[]>([])
  let loadedScope = ''

  function scope(): string {
    return auth.musicid ?? 'anonymous'
  }

  function storageKey(): string {
    return `${PLAY_HISTORY_STORAGE_PREFIX}${scope()}`
  }

  function persist(): void {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(entries.value))
    } catch {
      // localStorage 不可用时仅保留当前会话。
    }
  }

  /** 按当前账号读取本地历史；结构不符时视为缓存失效，整份清除。 */
  function load(): void {
    loadedScope = scope()
    const stored = readPersistedJson(storageKey(), isEntryList)
    entries.value = stored ? stored.slice(0, PLAY_HISTORY_LIMIT) : []
  }

  function ensureLoaded(): void {
    if (loadedScope !== scope()) load()
  }

  /** 歌曲实际开始播放时记录；同一首移回顶部，总数不超过上限。 */
  function record(song: Song): void {
    if (!song.songMid) return
    ensureLoaded()
    const next = entries.value.filter((entry) => entry.song.songMid !== song.songMid)
    next.unshift({ song, playedAtMs: Date.now() })
    entries.value = next.slice(0, PLAY_HISTORY_LIMIT)
    persist()
  }

  function clear(): void {
    ensureLoaded()
    entries.value = []
    try {
      localStorage.removeItem(storageKey())
    } catch {
      // 忽略。
    }
  }

  return {
    entries,
    load,
    record,
    clear
  }
})
