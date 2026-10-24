import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PlaylistMeta, Song } from '@shared/types'
import {
  PLAYLIST_PAGE_RETRY_ATTEMPTS,
  PLAYLIST_PAGE_RETRY_BACKOFF_MS
} from '@shared/constants'
import { unwrap } from '../api'
import { usePlayerStore } from './player'

export interface PlaylistFeed {
  meta: PlaylistMeta | null
  songs: Song[]
  total: number
  status: 'idle' | 'loading' | 'partial' | 'complete' | 'error'
  stale: boolean
  error: string
  loadToken: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const usePlaylistStore = defineStore('playlist', () => {
  const feed = ref<PlaylistFeed | null>(null)
  let requestedId = ''
  let generation = 0

  function reset(): void {
    feed.value = null
    requestedId = ''
    generation += 1
  }

  /** 已载入歌曲变化时，若当前播放来自该歌单，则自动补齐/更新队列。 */
  function syncQueue(): void {
    const current = feed.value
    const player = usePlayerStore()
    if (!current || !current.meta || current.songs.length === 0) return
    if (!player.current || player.queueSource?.id !== current.meta.id) return
    player.appendPlaylistQueue(player.current, current.songs)
  }

  async function loadPage(id: string, offset: number, force: boolean, token: number): Promise<void> {
    const result = unwrap(await window.lychee.playlist.get(id, { offset, force }))
    if (token !== generation) return
    const current = feed.value
    if (!current) return
    current.meta = result.page.meta
    current.total = result.page.total
    current.stale = result.stale
    if (result.page.offset === 0) current.songs = result.page.songs.slice()
    else current.songs.push(...result.page.songs)
    current.status = result.page.hasMore ? 'partial' : 'complete'
    syncQueue()
  }

  async function complete(id: string, startOffset: number, token: number): Promise<void> {
    let offset = startOffset
    for (;;) {
      if (token !== generation) return
      const current = feed.value
      if (!current || !current.meta || current.meta.id !== id) return
      if (offset >= current.total && current.status === 'complete') return
      let attempt = 0
      for (;;) {
        try {
          await loadPage(id, offset, false, token)
          break
        } catch (err) {
          attempt += 1
          if (attempt >= PLAYLIST_PAGE_RETRY_ATTEMPTS) {
            current.error = err instanceof Error ? err.message : String(err)
            current.status = 'error'
            return
          }
          await sleep(PLAYLIST_PAGE_RETRY_BACKOFF_MS * 2 ** (attempt - 1))
        }
      }
      const next = feed.value
      if (!next || next.meta?.id !== id) return
      if (next.status === 'complete' || next.songs.length >= next.total) return
      if (next.songs.length === offset) {
        next.status = 'error'
        next.error = '歌单加载停滞'
        return
      }
      offset = next.songs.length
    }
  }

  async function load(id: string): Promise<void> {
    if (!id) return
    const same = feed.value?.meta?.id === id
    if (same && feed.value?.status === 'complete') return
    if (!same) {
      generation += 1
      requestedId = id
      feed.value = {
        meta: null,
        songs: [],
        total: 0,
        status: 'loading',
        stale: false,
        error: '',
        loadToken: generation
      }
    }
    const token = generation
    try {
      await loadPage(id, 0, false, token)
      if (token !== generation) return
      const current = feed.value
      if (!current) return
      if (current.stale) {
        await loadPage(id, 0, true, token)
      }
      current.status = current.songs.length >= current.total ? 'complete' : 'partial'
      syncQueue()
      if (current.status !== 'complete') {
        void complete(id, current.songs.length, token)
      }
    } catch (err) {
      const current = feed.value
      if (current && token === generation) {
        current.status = current.songs.length > 0 ? 'partial' : 'error'
        current.error = err instanceof Error ? err.message : String(err)
      }
    }
  }

  let polling = false

  /** 每 15 秒轮询一次首页，检测歌单名称 / 数量 / 顺序是否变化。 */
  async function poll(id: string): Promise<void> {
    const before = feed.value
    if (polling || !before?.meta || before.meta.id !== id) return
    polling = true
    const token = generation
    try {
      const result = unwrap(await window.lychee.playlist.get(id, { offset: 0, force: true }))
      if (token !== generation) return
      const current = feed.value
      if (!current || current.meta?.id !== id) return
      const changed =
        result.page.total !== current.total ||
        result.page.meta.songCount !== current.meta.songCount ||
        result.page.songs.some(
          (song, index) => song.songMid !== current.songs[index]?.songMid
        )
      current.meta = result.page.meta
      current.total = result.page.total
      current.stale = result.stale
      if (changed) {
        current.songs = result.page.songs.slice()
        current.status = result.page.hasMore ? 'partial' : 'complete'
        current.error = ''
        if (result.page.hasMore) void complete(id, current.songs.length, generation)
      } else if (current.status === 'error') {
        current.status = current.songs.length >= current.total ? 'complete' : 'partial'
        current.error = ''
      }
      syncQueue()
    } catch {
      // 轮询失败保持当前内容，等下一次。
    } finally {
      polling = false
    }
  }

  async function retry(): Promise<void> {
    const current = feed.value
    if (!current?.meta) return
    const id = current.meta.id
    current.error = ''
    if (current.songs.length > 0 && current.status === 'error') {
      current.status = 'partial'
      await complete(id, current.songs.length, generation)
      return
    }
    await load(id)
  }

  return { feed, load, retry, poll, reset, requestedId }
})
