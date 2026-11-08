import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistPage,
  PlaylistSnapshot,
  Song,
  SongAvailability
} from '@shared/types'
import {
  PLAYLIST_PAGE_RETRY_ATTEMPTS,
  PLAYLIST_PAGE_RETRY_BACKOFF_MS
} from '@shared/constants'
import { unwrap } from '../api'
import { filterQueueSnapshot } from '../utils/queue'
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
  const availability = ref<Record<string, SongAvailability>>({})
  const availabilityLoading = ref(false)
  let requestedId = ''
  let generation = 0
  let completingToken: number | null = null
  // idle → temporary（未加载/未探测完时只顶替一次）→ final（完整歌单与元数据就绪后替换）。
  let cachedSnapshot: PlaylistCacheEntry | null = null
  let queueSourceId = ''
  let queuePhase: 'idle' | 'temporary' | 'final' = 'idle'
  let temporarySignature = ''
  let temporaryMids = new Set<string>()
  let savingCache = false
  let cachePending = false
  let cacheDirty = false
  let cacheVersion = 0
  let loadingId = ''

  function reset(): void {
    feed.value = null
    availability.value = {}
    availabilityLoading.value = false
    requestedId = ''
    generation += 1
    cachedSnapshot = null
    queueSourceId = ''
    queuePhase = 'idle'
    temporarySignature = ''
    temporaryMids = new Set()
    savingCache = false
    cachePending = false
    cacheDirty = false
    cacheVersion += 1
    loadingId = ''
  }

  function currentQueueSong(): Song | null {
    const player = usePlayerStore()
    const current = feed.value
    if (!current?.meta || !player.current) return null
    if (player.queueSource?.id !== current.meta.id) return null
    return player.current
  }

  function snapshotSongs(): Song[] {
    const current = feed.value
    const song = currentQueueSong()
    if (!current || !song || current.songs.length === 0) return []
    return filterQueueSnapshot(current.songs, availability.value, song.songMid)
  }

  /** 临时快照优先使用整份缓存歌单；缓存没有当前曲时退回当前已载入页。 */
  function temporarySnapshotSongs(): Song[] {
    const current = feed.value
    const song = currentQueueSong()
    if (!current || !song) return []
    const feedComplete = current.status === 'complete' && !current.stale
    const cachedSongs =
      !feedComplete &&
      cachedSnapshot &&
      cachedSnapshot.songs.some((item) => item.songMid === song.songMid)
        ? cachedSnapshot.songs
        : null
    return filterQueueSnapshot(cachedSongs ?? current.songs, availability.value, song.songMid)
  }

  /** 歌单页、VIP 与音质/可用性探测都完成后，才允许生成最终快照。 */
  function metadataReady(): boolean {
    const current = feed.value
    if (!current || current.songs.length === 0 || availabilityLoading.value) return false
    return current.songs.every((song) => {
      if (!song.songMid) return true
      const item = availability.value[song.songMid]
      return Boolean(item) && (item.playable === false || item.maxQuality !== null)
    })
  }

  function finalSnapshotReady(): boolean {
    const current = feed.value
    return Boolean(
      current?.meta &&
        current.status === 'complete' &&
        !current.stale &&
        metadataReady()
    )
  }

  function snapshotSignature(songs: Song[]): string {
    return JSON.stringify(songs)
  }

  function applySnapshot(final: boolean): void {
    const song = currentQueueSong()
    const player = usePlayerStore()
    if (!song) return
    const snapshot = final ? snapshotSongs() : temporarySnapshotSongs()
    if (snapshot.length === 0) return
    if (final) {
      if (queuePhase === 'temporary' && snapshotSignature(snapshot) === temporarySignature) {
        queuePhase = 'final'
        return
      }
      player.replacePlaylistQueue(
        song,
        snapshot,
        queuePhase === 'temporary' ? temporaryMids : undefined
      )
      queuePhase = 'final'
    } else {
      if (queuePhase !== 'idle') return
      player.appendPlaylistQueue(song, snapshot)
      queuePhase = 'temporary'
    }
    temporarySignature = snapshotSignature(snapshot)
    temporaryMids = new Set(snapshot.map((item) => item.songMid))
  }

  /** 最终快照就绪前只允许一次临时快照；之后只有最终快照不同才替换队列。 */
  function maybeFinalizeQueue(): void {
    const current = feed.value
    const player = usePlayerStore()
    if (!current?.meta || !player.current) return
    if (player.queueSource?.id !== current.meta.id) return
    if (queueSourceId !== current.meta.id) return
    if (queuePhase === 'final') return
    if (finalSnapshotReady()) {
      applySnapshot(true)
      return
    }
    if (queuePhase === 'idle') applySnapshot(false)
  }

  function beginQueueBuild(): void {
    queueSourceId = usePlayerStore().queueSource?.id ?? ''
    queuePhase = 'idle'
    temporarySignature = ''
    temporaryMids = new Set()
    maybeFinalizeQueue()
  }

  function setProbeState(next: Record<string, SongAvailability>, loading: boolean): void {
    availability.value = next
    availabilityLoading.value = loading
    maybeFinalizeQueue()
  }

  /** 每页加载后都写整份快照；complete 标记是否已完整加载。 */
  async function persistCache(): Promise<void> {
    const current = feed.value
    if (!current?.meta || current.stale) return
    if (current.songs.length === 0 && current.status !== 'complete') return
    if (!cacheDirty) return
    if (savingCache) {
      cachePending = true
      return
    }
    savingCache = true
    const version = cacheVersion
    const complete = current.status === 'complete'
    const snapshot: PlaylistSnapshot = {
      meta: current.meta,
      songs: current.songs.slice(),
      total: current.total
    }
    try {
      unwrap(
        await window.lychee.playlist.saveCache(current.meta.id, snapshot, complete)
      )
      if (version === cacheVersion) {
        cachedSnapshot = { ...snapshot, complete, fetchedAtMs: Date.now() }
        cacheDirty = false
      }
    } catch {
      // 缓存写入失败不阻塞歌单展示。
    } finally {
      savingCache = false
      if (cachePending) {
        cachePending = false
        void persistCache()
      }
    }
  }

  function applyPageStatus(current: PlaylistFeed, page: PlaylistPage): void {
    current.status = page.hasMore ? 'partial' : 'complete'
    if (!page.hasMore && current.total > 0 && current.songs.length < current.total) {
      current.status = 'error'
      current.error = '歌单未完整加载'
    } else if (page.hasMore) {
      current.error = ''
    }
  }

  async function loadPage(id: string, offset: number, token: number): Promise<void> {
    const page: PlaylistPage = unwrap(await window.lychee.playlist.get(id, { offset }))
    if (token !== generation) return
    const current = feed.value
    if (!current) return
    current.meta = page.meta
    current.total = page.total
    if (offset === 0) {
      current.songs = page.songs.slice()
      current.stale = false
    } else {
      current.songs.push(...page.songs)
    }
    applyPageStatus(current, page)
    cacheDirty = true
    cacheVersion += 1
    maybeFinalizeQueue()
    void persistCache()
  }

  async function complete(id: string, startOffset: number, token: number): Promise<void> {
    if (completingToken === token) return
    completingToken = token
    try {
      let offset = startOffset
      for (;;) {
        if (token !== generation) return
        const current = feed.value
        if (!current || !current.meta || current.meta.id !== id) return
        if (offset >= current.total && current.status === 'complete') return
        let attempt = 0
        for (;;) {
          try {
            await loadPage(id, offset, token)
            break
          } catch (err) {
            attempt += 1
            if (attempt >= PLAYLIST_PAGE_RETRY_ATTEMPTS) {
              current.error = err instanceof Error ? err.message : String(err)
              current.status = 'error'
              void persistCache()
              return
            }
            await sleep(PLAYLIST_PAGE_RETRY_BACKOFF_MS * 2 ** (attempt - 1))
          }
        }
        const next = feed.value
        if (!next || next.meta?.id !== id) return
        if (next.songs.length >= next.total) {
          next.status = 'complete'
          next.error = ''
          maybeFinalizeQueue()
          void persistCache()
          return
        }
        if (next.status === 'complete') return
        if (next.songs.length === offset) {
          next.status = 'error'
          next.error = '歌单加载停滞'
          void persistCache()
          return
        }
        offset = next.songs.length
      }
    } finally {
      if (completingToken === token) completingToken = null
    }
  }

  /** 收藏等外部写操作后，让已打开的歌单在下次进入时重新验证。 */
  function invalidate(id: string): void {
    if (feed.value?.meta?.id === id) feed.value.stale = true
  }

  async function load(id: string, options: { force?: boolean } = {}): Promise<void> {
    if (!id) return
    const same = feed.value?.meta?.id === id
    const force = options.force === true || (same && feed.value?.stale === true)
    if (same && completingToken === generation) return
    if (same && feed.value?.status === 'complete' && !feed.value.stale && !force) return
    if (loadingId === id) return
    loadingId = id
    try {
      await runLoad(id)
    } finally {
      if (loadingId === id) loadingId = ''
    }
  }

  async function runLoad(id: string): Promise<void> {
    const same = feed.value?.meta?.id === id
    if (!same) {
      generation += 1
      requestedId = id
      cachedSnapshot = null
      cacheDirty = false
      cacheVersion += 1
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
    let cached: PlaylistCacheEntry | null = null
    try {
      cached = unwrap(await window.lychee.playlist.getCached(id))
    } catch {
      cached = null
    }
    if (token !== generation) return
    cachedSnapshot = cached
    if (cached && (cached.songs.length > 0 || cached.complete)) {
      feed.value = {
        meta: cached.meta,
        songs: cached.songs.slice(),
        total: cached.total,
        status: cached.complete ? 'complete' : 'partial',
        stale: true,
        error: '',
        loadToken: generation
      }
      cacheDirty = false
      maybeFinalizeQueue()
    }
    try {
      await loadPage(id, 0, token)
      if (token !== generation) return
      const current = feed.value
      if (!current) return
      maybeFinalizeQueue()
      if (current.status !== 'complete') {
        void complete(id, current.songs.length, token)
      }
    } catch (err) {
      const current = feed.value
      if (current && token === generation) {
        if (cachedSnapshot) {
          feed.value = {
            meta: cachedSnapshot.meta,
            songs: cachedSnapshot.songs.slice(),
            total: cachedSnapshot.total,
            status: cachedSnapshot.complete ? 'complete' : 'error',
            stale: true,
            error: cachedSnapshot.complete ? '' : '歌单未完整加载',
            loadToken: generation
          }
          maybeFinalizeQueue()
        } else {
          current.status = current.songs.length > 0 ? 'partial' : 'error'
          current.error = err instanceof Error ? err.message : String(err)
          void persistCache()
        }
      }
    }
  }

  let polling = false

  /** 每 15 秒轮询一次首页，检测歌单名称 / 数量 / 顺序是否变化。 */
  async function poll(id: string): Promise<void> {
    const before = feed.value
    if (polling || completingToken === generation || !before?.meta || before.meta.id !== id) return
    polling = true
    if (before.stale) {
      try {
        await load(id, { force: true })
      } finally {
        polling = false
      }
      return
    }
    const token = generation
    try {
      const result = unwrap(await window.lychee.playlist.get(id, { offset: 0 }))
      if (token !== generation) return
      const current = feed.value
      if (!current || current.meta?.id !== id) return
      const changed =
        result.total !== current.total ||
        result.meta.songCount !== current.meta.songCount ||
        result.songs.some(
          (song, index) => song.songMid !== current.songs[index]?.songMid
        )
      current.meta = result.meta
      current.total = result.total
      current.stale = false
      if (changed) {
        current.songs = result.songs.slice()
        applyPageStatus(current, result)
        cacheDirty = true
        cacheVersion += 1
        void persistCache()
        if (result.hasMore) void complete(id, current.songs.length, generation)
      } else if (current.status === 'error' || current.status === 'partial') {
        current.error = ''
        current.status = current.songs.length >= current.total ? 'complete' : 'partial'
        if (current.status === 'partial') {
          void complete(id, current.songs.length, generation)
        } else {
          void persistCache()
        }
      } else if (current.status === 'complete') {
        void persistCache()
      }
      maybeFinalizeQueue()
    } catch {
      // 轮询失败保持当前内容，等下一次。
    } finally {
      polling = false
    }
  }

  async function retry(): Promise<void> {
    const current = feed.value
    const id = current?.meta?.id ?? requestedId
    if (!id) return
    if (current) current.error = ''
    if (current?.meta && current.songs.length > 0 && !current.stale) {
      current.status = 'partial'
      await complete(id, current.songs.length, generation)
      return
    }
    if (current) current.status = current.songs.length > 0 ? 'partial' : 'loading'
    await load(id, { force: true })
  }

  return {
    feed,
    load,
    retry,
    poll,
    invalidate,
    reset,
    requestedId,
    beginQueueBuild,
    setProbeState
  }
})
