import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistSnapshot,
  RecentPlaylist,
  Song,
  SongAvailability
} from '@shared/types'
import {
  PLAYLIST_REFRESH_RETRY_MS,
  RECENT_PLAYLIST_LIMIT,
  RECENT_PLAYLIST_VALIDATE_MS
} from '@shared/constants'
import { IpcCallError, unwrap } from '../api'
import { useAuthStore } from './auth'
import { filterQueueSnapshot } from '../utils/queue'
import { usePlayerStore } from './player'

export interface PlaylistFeed {
  meta: PlaylistMeta | null
  songs: Song[]
  total: number
  /** 上游声明的曲目总数，用于轮询比较；展示总数以实际 songs 为准。 */
  sourceTotal?: number
  status: 'idle' | 'loading' | 'partial' | 'complete' | 'error'
  stale: boolean
  error: string
  loadToken: number
}

export const usePlaylistStore = defineStore('playlist', () => {
  const feed = ref<PlaylistFeed | null>(null)
  const recent = ref<RecentPlaylist[]>([])
  const availability = ref<Record<string, SongAvailability>>({})
  const availabilityLoading = ref(false)
  let requestedId = ''
  let generation = 0
  // idle → temporary（未加载/未探测完时只顶替一次）→ final（完整歌单与元数据就绪后替换）。
  let cachedSnapshot: PlaylistCacheEntry | null = null
  let queueSourceId = ''
  let queuePhase: 'idle' | 'temporary' | 'final' = 'idle'
  let temporarySignature = ''
  let temporaryMids = new Set<string>()
  let savingCache = false
  let cachePending = false
  let polling = false
  let refreshSeq = 0
  let activeRefresh: { id: string; seq: number } | null = null
  let retryTimer: number | null = null

  function recentKey(): string {
    const auth = useAuthStore()
    return `lychee:recent-playlists:${auth.musicid ?? 'anonymous'}`
  }

  function persistRecent(): void {
    try {
      localStorage.setItem(recentKey(), JSON.stringify(recent.value))
    } catch {
      // localStorage 不可用时仅保留当前会话。
    }
  }

  function loadRecent(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(recentKey()) ?? '[]') as RecentPlaylist[]
      recent.value = Array.isArray(raw)
        ? raw
            .filter((item) => item && typeof item.id === 'string' && item.id)
            .slice(0, RECENT_PLAYLIST_LIMIT)
        : []
    } catch {
      recent.value = []
    }
  }

  function visit(meta: PlaylistMeta): void {
    if (!meta.id || meta.kind === 'favorites') return
    const next = recent.value.filter((item) => item.id !== meta.id)
    next.unshift({ ...meta, visitedAtMs: Date.now() })
    recent.value = next.slice(0, RECENT_PLAYLIST_LIMIT)
    persistRecent()
  }

  let validating = false
  let lastValidatedAt = 0

  /** 登录后与每次展开侧栏校验最近歌单；节流 + 单飞，删除项不补位。 */
  async function validateRecent(force = false): Promise<void> {
    const now = Date.now()
    if (validating) return
    if (!force && now - lastValidatedAt < RECENT_PLAYLIST_VALIDATE_MS) return
    if (recent.value.length === 0) return
    validating = true
    lastValidatedAt = now
    try {
      const kept: RecentPlaylist[] = []
      for (const item of recent.value) {
        let cachedMeta: PlaylistMeta | null = null
        try {
          cachedMeta = unwrap(await window.lychee.playlist.getCached(item.id))?.meta ?? null
        } catch {
          cachedMeta = null
        }
        try {
          const page = unwrap(await window.lychee.playlist.get(item.id, { offset: 0 }))
          kept.push({ ...page.meta, visitedAtMs: item.visitedAtMs, stale: false })
        } catch (err) {
          if (
            err instanceof IpcCallError &&
            (err.code === 'NO_PERMISSION' ||
              err.code === 'AUTH_EXPIRED' ||
              err.code === 'UPSTREAM_CHANGED')
          ) {
            // 歌单已删除或无权限：移除条目，不用第 6 条补位。
            continue
          }
          // 网络等临时失败保留条目并标记 stale，避免误删。
          kept.push({ ...(cachedMeta ?? item), visitedAtMs: item.visitedAtMs, stale: true })
        }
      }
      recent.value = kept
      persistRecent()
    } finally {
      validating = false
    }
  }

  function clearRecent(): void {
    recent.value = []
    try {
      localStorage.removeItem(recentKey())
    } catch {
      // 忽略。
    }
  }

  function clearRetry(): void {
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function cancelActiveRefresh(): void {
    const active = activeRefresh
    if (!active) return
    activeRefresh = null
    refreshSeq += 1
    void window.lychee.playlist
      .cancelSnapshot(active.id, active.seq)
      .catch(() => undefined)
  }

  function reset(): void {
    clearRetry()
    cancelActiveRefresh()
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
    polling = false
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

  function applyQueueSnapshot(final: boolean): void {
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
      applyQueueSnapshot(true)
      return
    }
    if (queuePhase === 'idle') applyQueueSnapshot(false)
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

  /** IPC 使用结构化克隆，响应式 Proxy 会导致 DataCloneError，缓存快照必须是纯对象。 */
  function plainSong(song: Song): Song {
    return {
      ...song,
      singers: song.singers.map((singer) => ({ ...singer })),
      album: { ...song.album },
      pay: { ...song.pay }
    }
  }

  /** 完整歌单成功后写整份缓存；写入串行化，避免旧快照覆盖新快照。 */
  async function persistCache(): Promise<void> {
    const current = feed.value
    if (!current?.meta || current.status !== 'complete' || current.stale) return
    if (savingCache) {
      cachePending = true
      return
    }
    savingCache = true
    const snapshot: PlaylistSnapshot = {
      meta: { ...current.meta },
      songs: current.songs.map(plainSong),
      total: current.total,
      sourceTotal: current.sourceTotal
    }
    try {
      unwrap(await window.lychee.playlist.saveCache(current.meta.id, snapshot, true))
      cachedSnapshot = { ...snapshot, complete: true, fetchedAtMs: Date.now() }
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

  /** 完整快照一次性替换当前歌单；这是唯一会改变浏览内容的入口。 */
  function replaceFeed(snapshot: PlaylistSnapshot): void {
    const songs = snapshot.songs.slice()
    const sourceTotal = snapshot.sourceTotal ?? snapshot.total
    const meta = { ...snapshot.meta, songCount: songs.length }
    feed.value = {
      meta,
      songs,
      total: songs.length,
      sourceTotal,
      status: 'complete',
      stale: false,
      error: '',
      loadToken: generation
    }
    cachedSnapshot = {
      meta,
      songs: songs.slice(),
      total: songs.length,
      sourceTotal,
      complete: true,
      fetchedAtMs: Date.now()
    }
    maybeFinalizeQueue()
    void persistCache()
  }

  function showCached(cached: PlaylistCacheEntry): void {
    feed.value = {
      meta: cached.meta,
      songs: cached.songs.slice(),
      total: cached.total,
      sourceTotal: cached.sourceTotal,
      status: cached.complete ? 'complete' : 'partial',
      stale: true,
      error: '',
      loadToken: generation
    }
    cachedSnapshot = cached
    maybeFinalizeQueue()
  }

  function scheduleRetry(id: string): void {
    clearRetry()
    const seq = refreshSeq
    retryTimer = window.setTimeout(() => {
      retryTimer = null
      if (requestedId === id && refreshSeq === seq) void refresh(id)
    }, PLAYLIST_REFRESH_RETRY_MS)
  }

  /** 后台完整刷新：成功才一次性替换 feed，失败保持旧内容并安排 5 分钟后重试。 */
  async function refresh(id: string): Promise<void> {
    if (!id || requestedId !== id) return
    cancelActiveRefresh()
    const seq = ++refreshSeq
    activeRefresh = { id, seq }
    clearRetry()
    const token = generation
    try {
      const snapshot = unwrap(await window.lychee.playlist.getSnapshot(id, seq))
      if (seq !== refreshSeq || token !== generation || requestedId !== id) return
      replaceFeed(snapshot)
    } catch (err) {
      if (seq !== refreshSeq || token !== generation || requestedId !== id) return
      const current = feed.value
      if (current) {
        current.stale = true
        if (current.songs.length === 0 || current.status === 'partial') {
          current.status = 'error'
          current.error = err instanceof Error ? err.message : String(err)
        }
      }
      scheduleRetry(id)
    } finally {
      if (activeRefresh?.seq === seq) activeRefresh = null
    }
  }

  /** 进入歌单页：立即展示缓存并触发一次后台完整刷新。 */
  async function load(id: string): Promise<void> {
    if (!id) return
    const same = feed.value?.meta?.id === id
    if (same && activeRefresh?.id === id) {
      requestedId = id
      return
    }
    if (same) {
      requestedId = id
      await refresh(id)
      return
    }
    clearRetry()
    cancelActiveRefresh()
    generation += 1
    const token = generation
    requestedId = id
    cachedSnapshot = null
    feed.value = {
      meta: null,
      songs: [],
      total: 0,
      status: 'loading',
      stale: false,
      error: '',
      loadToken: token
    }
    let cached: PlaylistCacheEntry | null = null
    try {
      cached = unwrap(await window.lychee.playlist.getCached(id))
    } catch {
      cached = null
    }
    if (token !== generation || requestedId !== id) return
    if (cached) showCached(cached)
    await refresh(id)
  }

  /** 离开歌单页：终止进行中的拉取与 5 分钟重试，未完成的快照不会落盘。 */
  function stop(id?: string): void {
    const target = id ?? requestedId
    if (!target) return
    if (requestedId === target) requestedId = ''
    clearRetry()
    if (activeRefresh?.id === target) cancelActiveRefresh()
  }

  /** 每 15 秒轮询一次首页，检测歌单名称 / 顺序 / 数量变化；变化时整份刷新。 */
  async function poll(id: string): Promise<void> {
    const before = feed.value
    if (!id || !before?.meta || before.meta.id !== id) return
    if (activeRefresh?.id === id) return
    if (polling) return
    if (before.stale) {
      await refresh(id)
      return
    }
    polling = true
    const token = generation
    try {
      const result = unwrap(await window.lychee.playlist.get(id, { offset: 0 }))
      if (token !== generation || requestedId !== id) return
      const current = feed.value
      if (!current?.meta || current.meta.id !== id) return
      const sourceTotal = current.sourceTotal ?? current.meta.songCount
      const tolerance = Math.max(10, Math.ceil(sourceTotal * 0.02))
      const changed =
        result.meta.name !== current.meta.name ||
        result.meta.coverUrl !== current.meta.coverUrl ||
        Math.abs(result.meta.songCount - sourceTotal) > tolerance ||
        result.songs.some(
          (song, index) => song.songMid !== current.songs[index]?.songMid
        )
      if (changed || current.status === 'error') {
        await refresh(id)
      }
    } catch {
      // 轮询失败保持当前内容，等下一次或 5 分钟重试。
    } finally {
      polling = false
    }
  }

  /** 从歌单移除成员后的本地更新：行、计数与缓存；失败由调用方回滚。 */
  function removeMembers(id: string, mids: string[]): void {
    const current = feed.value
    if (!current?.meta || current.meta.id !== id) return
    const removed = new Set(mids)
    const before = current.songs.length
    current.songs = current.songs.filter((song) => !removed.has(song.songMid))
    const delta = before - current.songs.length
    current.total = Math.max(0, current.total - delta)
    current.meta = {
      ...current.meta,
      songCount: Math.max(0, current.meta.songCount - delta)
    }
    if (current.sourceTotal !== undefined) {
      current.sourceTotal = Math.max(0, current.sourceTotal - delta)
    }
    void persistCache()
  }

  /** 收藏等外部写操作后，让已打开的歌单在下次进入时重新验证。 */
  function invalidate(id: string): void {
    if (feed.value?.meta?.id === id) feed.value.stale = true
  }

  async function retry(): Promise<void> {
    const current = feed.value
    const id = current?.meta?.id ?? requestedId
    if (!id) return
    clearRetry()
    if (current && current.status === 'error') current.error = ''
    await refresh(id)
  }

  return {
    feed,
    recent,
    loadRecent,
    visit,
    validateRecent,
    clearRecent,
    load,
    stop,
    retry,
    poll,
    refresh,
    invalidate,
    removeMembers,
    reset,
    requestedId,
    beginQueueBuild,
    setProbeState
  }
})
