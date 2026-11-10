import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
  IpcResult,
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistPage,
  PlaylistSnapshot,
  Song,
  SongAvailability,
  UrlResult
} from '../src/shared/types'
import { PLAYLIST_REFRESH_RETRY_MS } from '../src/shared/constants'

const noop = (): void => undefined

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: noop },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

vi.mock('../src/renderer/audio/engine', () => ({
  createAudioEngine: () => ({
    loadAndPlay: () => Promise.resolve(),
    play: () => Promise.resolve(),
    pause: noop,
    stop: noop,
    seek: noop,
    setVolume: noop,
    positionMs: 0,
    sourceUrl: null
  })
}))

vi.mock('../src/renderer/audio/remote-engine', () => ({
  createRemoteEngine: () => ({
    loadAndPlay: () => Promise.resolve(),
    play: () => Promise.resolve(),
    pause: noop,
    stop: noop,
    seek: noop,
    setVolume: noop,
    positionMs: 0,
    sourceUrl: null
  })
}))

const meta: PlaylistMeta = {
  id: 'liked',
  name: '我喜欢',
  coverUrl: '',
  songCount: 100,
  kind: 'favorites',
  editable: true
}

function song(id: string): Song {
  return {
    songMid: id,
    songId: id,
    name: id,
    singers: [],
    album: { mid: '', name: '' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false }
  }
}

function page(offset: number, total = 100): PlaylistPage {
  const songs = Array.from({ length: 50 }, (_, index) => song(String(offset + index)))
  return {
    meta: { ...meta, songCount: total },
    songs,
    offset,
    total,
    hasMore: offset + songs.length < total
  }
}

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function snapshot(songs: Song[], sourceTotal = songs.length): PlaylistSnapshot {
  return {
    meta: { ...meta, songCount: songs.length },
    songs,
    total: songs.length,
    sourceTotal
  }
}

function songs(count: number): Song[] {
  return Array.from({ length: count }, (_, index) => song(String(index)))
}

function state(mid: string, playable: boolean): SongAvailability {
  return { songMid: mid, playable, maxQuality: playable ? '320k' : null, checkedAtMs: 1 }
}

function pendingUrls(): Promise<IpcResult<UrlResult[]>> {
  return new Promise(() => undefined)
}

let getMock: ReturnType<typeof vi.fn>
let getCachedMock: ReturnType<typeof vi.fn>
let getSnapshotMock: ReturnType<typeof vi.fn>
let cancelSnapshotMock: ReturnType<typeof vi.fn>
let saveCacheMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setActivePinia(createPinia())
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value)
  })
  getMock = vi.fn()
  getCachedMock = vi.fn(() => Promise.resolve(ok(null)))
  getSnapshotMock = vi.fn()
  cancelSnapshotMock = vi.fn(() => Promise.resolve(ok(null)))
  saveCacheMock = vi.fn(() => Promise.resolve(ok(null)))
  vi.stubGlobal('window', {
    lychee: {
      playlist: {
        get: getMock,
        getCached: getCachedMock,
        getSnapshot: getSnapshotMock,
        cancelSnapshot: cancelSnapshotMock,
        saveCache: saveCacheMock
      },
      player: { sendState: noop, onCommand: () => noop },
      song: { getUrls: () => Promise.resolve(ok([])) },
      mpv: { getState: () => Promise.resolve(ok({ available: false })) }
    },
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (timer: number) => clearTimeout(timer)
  })
})

describe('playlist feed refresh', () => {
  it('loads the full snapshot once and writes the whole cache', async () => {
    getSnapshotMock.mockResolvedValueOnce(ok(snapshot(songs(100))))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')

    expect(getSnapshotMock).toHaveBeenCalledTimes(1)
    expect(getMock).not.toHaveBeenCalled()
    expect(store.feed?.status).toBe('complete')
    expect(store.feed?.songs).toHaveLength(100)
    expect(store.feed?.total).toBe(100)

    await vi.waitFor(() => expect(saveCacheMock).toHaveBeenCalled())
    const lastSave = saveCacheMock.mock.calls.at(-1)
    expect(lastSave?.[0]).toBe('liked')
    expect(lastSave?.[1].songs).toHaveLength(100)
    expect(lastSave?.[1].total).toBe(100)
    expect(lastSave?.[2]).toBe(true)
    store.stop('liked')
  })

  it('retries from scratch after the first full load fails', async () => {
    getSnapshotMock.mockRejectedValueOnce(new Error('network down'))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')
    expect(store.feed?.status).toBe('error')
    expect(store.feed?.meta).toBeNull()

    getSnapshotMock.mockResolvedValueOnce(ok(snapshot(songs(100))))
    await store.retry()
    expect(store.feed?.status).toBe('complete')
    expect(store.feed?.songs).toHaveLength(100)
    expect(store.feed?.error).toBe('')
    store.stop('liked')
  })

  it('keeps the current snapshot when a background refresh fails', async () => {
    getSnapshotMock.mockResolvedValueOnce(ok(snapshot([song('1'), song('2'), song('3')])))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()
    await store.load('liked')

    getSnapshotMock.mockRejectedValueOnce(new Error('offline'))
    await store.refresh('liked')

    expect(store.feed?.status).toBe('complete')
    expect(store.feed?.stale).toBe(true)
    expect(store.feed?.songs.map((item) => item.songMid)).toEqual(['1', '2', '3'])
    store.stop('liked')
  })

  it('automatically retries five minutes after a failed refresh', async () => {
    vi.useFakeTimers()
    try {
      getSnapshotMock.mockRejectedValueOnce(new Error('offline'))
      const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
      const store = usePlaylistStore()

      await store.load('liked')
      expect(store.feed?.status).toBe('error')
      expect(getSnapshotMock).toHaveBeenCalledTimes(1)

      getSnapshotMock.mockResolvedValueOnce(ok(snapshot(songs(4))))
      await vi.advanceTimersByTimeAsync(PLAYLIST_REFRESH_RETRY_MS)

      expect(getSnapshotMock).toHaveBeenCalledTimes(2)
      expect(store.feed?.status).toBe('complete')
      expect(store.feed?.songs).toHaveLength(4)
      store.stop('liked')
    } finally {
      vi.useRealTimers()
    }
  })

  it('falls back to the whole cached playlist when the refresh fails', async () => {
    const cached: PlaylistCacheEntry = {
      meta: { ...meta, songCount: 3 },
      songs: [song('1'), song('2'), song('3')],
      total: 3,
      complete: true,
      fetchedAtMs: Date.now()
    }
    getCachedMock.mockResolvedValue(ok(cached))
    getSnapshotMock.mockRejectedValue(new Error('offline'))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')

    expect(store.feed?.status).toBe('complete')
    expect(store.feed?.stale).toBe(true)
    expect(store.feed?.songs.map((item) => item.songMid)).toEqual(['1', '2', '3'])
    expect(saveCacheMock).not.toHaveBeenCalled()
    store.stop('liked')
  })

  it('keeps an incomplete cache but marks the feed as interrupted', async () => {
    const cached: PlaylistCacheEntry = {
      meta: { ...meta, songCount: 3 },
      songs: [song('1'), song('2')],
      total: 3,
      complete: false,
      fetchedAtMs: Date.now()
    }
    getCachedMock.mockResolvedValue(ok(cached))
    getSnapshotMock.mockRejectedValue(new Error('offline'))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')

    expect(store.feed?.status).toBe('error')
    expect(store.feed?.stale).toBe(true)
    expect(store.feed?.error).toBe('offline')
    expect(store.feed?.songs).toHaveLength(2)
    store.stop('liked')
  })

  it('triggers a new snapshot fetch every time the page is opened', async () => {
    getSnapshotMock.mockResolvedValueOnce(ok(snapshot([song('1'), song('2'), song('3')])))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()
    await store.load('liked')

    getSnapshotMock.mockResolvedValueOnce(ok(snapshot([song('4'), song('5')])))
    await store.load('liked')

    expect(getSnapshotMock).toHaveBeenCalledTimes(2)
    expect(store.feed?.songs.map((item) => item.songMid)).toEqual(['4', '5'])
    store.stop('liked')
  })

  it('cancels the in-flight snapshot when leaving the page', async () => {
    let resolveSnapshot: (value: IpcResult<PlaylistSnapshot>) => void = () => undefined
    getSnapshotMock.mockReturnValue(
      new Promise<IpcResult<PlaylistSnapshot>>((resolve) => {
        resolveSnapshot = resolve
      })
    )
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    const pending = store.load('liked')
    await vi.waitFor(() => expect(getSnapshotMock).toHaveBeenCalled())
    store.stop('liked')
    expect(cancelSnapshotMock).toHaveBeenCalledWith('liked', expect.any(Number))

    resolveSnapshot(ok(snapshot(songs(1))))
    await pending
    expect(store.feed?.songs).toHaveLength(0)
  })

  it('replaces the feed atomically when polling detects a change', async () => {
    getSnapshotMock.mockResolvedValueOnce(ok(snapshot(songs(3))))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()
    await store.load('liked')

    getMock.mockResolvedValueOnce(ok(page(0)))
    getSnapshotMock.mockResolvedValueOnce(ok(snapshot(songs(100))))
    await store.poll('liked')

    expect(getSnapshotMock).toHaveBeenCalledTimes(2)
    expect(store.feed?.status).toBe('complete')
    expect(store.feed?.songs).toHaveLength(100)
    store.stop('liked')
  })
})

describe('playlist queue snapshot timing', () => {
  async function setup(songs: Song[]): Promise<{
    playlist: ReturnType<typeof import('../src/renderer/stores/playlist')['usePlaylistStore']>
    player: ReturnType<typeof import('../src/renderer/stores/player')['usePlayerStore']>
  }> {
    window.lychee.song.getUrls = pendingUrls
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const playlist = usePlaylistStore()
    const player = usePlayerStore()
    playlist.feed = {
      meta: { ...meta, songCount: songs.length },
      songs,
      total: songs.length,
      status: 'complete',
      stale: false,
      error: '',
      loadToken: 1
    }
    return { playlist, player }
  }

  it('builds the final filtered snapshot when metadata is ready at playback start', async () => {
    const songs = [song('1'), song('2'), song('3')]
    const { playlist, player } = await setup(songs)
    playlist.setProbeState(
      { 1: state('1', true), 2: state('2', true), 3: state('3', false) },
      false
    )
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'liked' })
    playlist.beginQueueBuild()

    expect(player.queue.map((item) => item.songMid)).toEqual(['2'])
  })

  it('uses one temporary snapshot, then replaces it when the final snapshot changes', async () => {
    const songs = [song('1'), song('2'), song('3')]
    const { playlist, player } = await setup(songs)
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'liked' })
    playlist.beginQueueBuild()

    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])

    songs.push(song('4'))
    playlist.feed!.songs = songs
    playlist.feed!.total = songs.length
    playlist.setProbeState({ 1: state('1', true), 2: state('2', true) }, true)
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])

    player.addNext(song('x'))
    expect(player.queue.map((item) => item.songMid)).toEqual(['x', '2', '3'])

    playlist.setProbeState(
      {
        1: state('1', true),
        2: state('2', true),
        3: state('3', false),
        4: state('4', true)
      },
      false
    )

    expect(player.current?.songMid).toBe('1')
    expect(player.queue.map((item) => item.songMid)).toEqual(['x', '2', '4'])
  })

  it('waits for max quality metadata before finalizing', async () => {
    const songs = [song('1'), song('2'), song('3')]
    const { playlist, player } = await setup(songs)
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'liked' })
    playlist.beginQueueBuild()
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])

    playlist.setProbeState(
      {
        1: { songMid: '1', playable: true, maxQuality: null, checkedAtMs: 1 },
        2: { songMid: '2', playable: true, maxQuality: null, checkedAtMs: 1 },
        3: { songMid: '3', playable: false, maxQuality: null, checkedAtMs: 1 }
      },
      false
    )
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])

    playlist.setProbeState(
      { 1: state('1', true), 2: state('2', true), 3: state('3', false) },
      false
    )
    expect(player.queue.map((item) => item.songMid)).toEqual(['2'])
  })

  it('keeps the temporary queue when the final snapshot is unchanged', async () => {
    const songs = [song('1'), song('2'), song('3')]
    const { playlist, player } = await setup(songs)
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'liked' })
    playlist.beginQueueBuild()
    player.addNext(song('x'))

    playlist.setProbeState(
      { 1: state('1', true), 2: state('2', true), 3: state('3', true) },
      false
    )

    expect(player.queue.map((item) => item.songMid)).toEqual(['x', '2', '3'])
  })

  it('keeps the playback snapshot state while browsing another playlist', async () => {
    const songs = [song('1'), song('2'), song('3')]
    const { playlist, player } = await setup(songs)
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'liked' })
    playlist.beginQueueBuild()
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])

    playlist.feed = {
      meta: { ...meta, id: 'other', name: '其它歌单' },
      songs: [song('9')],
      total: 1,
      status: 'complete',
      stale: false,
      error: '',
      loadToken: 2
    }
    playlist.setProbeState({ 9: state('9', true) }, false)
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])

    playlist.feed = {
      meta,
      songs,
      total: songs.length,
      status: 'complete',
      stale: false,
      error: '',
      loadToken: 3
    }
    playlist.setProbeState(
      { 1: state('1', true), 2: state('2', true), 3: state('3', false) },
      false
    )
    expect(player.queue.map((item) => item.songMid)).toEqual(['2'])
  })
})
