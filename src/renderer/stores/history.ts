import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Song } from '@shared/types'
import { PLAY_HISTORY_LIMIT, PLAY_HISTORY_STORAGE_PREFIX } from '@shared/constants'
import { useAuthStore } from './auth'

/** 播放历史条目：歌曲快照与最近一次实际开始播放的时间。 */
export interface PlayHistoryEntry {
  song: Song
  playedAtMs: number
}

function isSong(value: unknown): value is Song {
  if (!value || typeof value !== 'object') return false
  const song = value as Record<string, unknown>
  return (
    typeof song.songMid === 'string' &&
    song.songMid.length > 0 &&
    typeof song.songId === 'string' &&
    typeof song.name === 'string' &&
    Array.isArray(song.singers) &&
    Boolean(song.album) &&
    typeof song.album === 'object' &&
    typeof song.durationMs === 'number' &&
    Boolean(song.pay) &&
    typeof song.pay === 'object'
  )
}

function isEntry(value: unknown): value is PlayHistoryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return isSong(entry.song) && typeof entry.playedAtMs === 'number'
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

  /** 按当前账号读取本地历史；损坏条目直接丢弃。 */
  function load(): void {
    loadedScope = scope()
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? '[]')
      entries.value = Array.isArray(raw)
        ? raw.filter(isEntry).slice(0, PLAY_HISTORY_LIMIT)
        : []
    } catch {
      entries.value = []
    }
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
