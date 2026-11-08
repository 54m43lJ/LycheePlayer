import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
  IpcResult,
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistPage,
  Song,
  SongAvailability,
  UrlResult
} from '../src/shared/types'

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

function state(mid: string, playable: boolean): SongAvailability {
  return { songMid: mid, playable, maxQuality: playable ? '320k' : null, checkedAtMs: 1 }
}

function pendingUrls(): Promise<IpcResult<UrlResult[]>> {
  return new Promise(() => undefined)
}

let getMock: ReturnType<typeof vi.fn>
let getCachedMock: ReturnType<typeof vi.fn>
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
  saveCacheMock = vi.fn(() => Promise.resolve(ok(null)))
  vi.stubGlobal('window', {
    lychee: {
      playlist: {
        get: getMock,
        getCached: getCachedMock,
        saveCache: saveCacheMock
      },
      player: { sendState: noop, onCommand: () => noop },
      song: { getUrls: () => Promise.resolve(ok([])) },
      mpv: { getState: () => Promise.resolve(ok({ available: false })) }
    },
    setTimeout
  })
})

describe('playlist feed recovery', () => {
  it('retries from scratch when the first page failed', async () => {
    getMock.mockRejectedValueOnce(new Error('network down'))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')
    expect(store.feed?.status).toBe('error')
    expect(store.feed?.meta).toBeNull()

    getMock.mockImplementation(async (_id: string, options: { offset?: number }) =>
      ok(page(options.offset ?? 0))
    )
    await store.retry()
    await vi.waitFor(() => expect(store.feed?.status).toBe('complete'))
    expect(store.feed?.songs).toHaveLength(100)
    expect(saveCacheMock).toHaveBeenCalled()
    const lastSave = saveCacheMock.mock.calls.at(-1)
    expect(lastSave?.[0]).toBe('liked')
    expect(lastSave?.[1].songs).toHaveLength(100)
    expect(lastSave?.[1].total).toBe(100)
    expect(lastSave?.[2]).toBe(true)
  })

  it('persists a partial page snapshot before the playlist finishes', async () => {
    getMock.mockImplementation((_id: string, options: { offset?: number }) => {
      if ((options.offset ?? 0) === 0) return Promise.resolve(ok(page(0)))
      return new Promise(() => undefined)
    })
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')
    await vi.waitFor(() => expect(saveCacheMock).toHaveBeenCalled())

    const lastSave = saveCacheMock.mock.calls.at(-1)
    expect(lastSave?.[0]).toBe('liked')
    expect(lastSave?.[1].songs).toHaveLength(50)
    expect(lastSave?.[1].total).toBe(100)
    expect(lastSave?.[2]).toBe(false)
    expect(store.feed?.status).toBe('partial')
  })

  it('detects a missing page when the reported total is not reached', async () => {
    const truncated: PlaylistPage = {
      meta: { ...meta, songCount: 100 },
      songs: Array.from({ length: 50 }, (_, index) => song(String(index))),
      offset: 0,
      total: 100,
      hasMore: false
    }
    getMock.mockImplementation((_id: string, options: { offset?: number }) => {
      const offset = options.offset ?? 0
      if (offset === 0) return Promise.resolve(ok(truncated))
      return Promise.resolve(
        ok({ ...truncated, songs: [], offset, hasMore: false })
      )
    })
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')
    await vi.waitFor(() => expect(store.feed?.status).toBe('error'))

    expect(store.feed?.songs).toHaveLength(50)
    const lastSave = saveCacheMock.mock.calls.at(-1)
    expect(lastSave?.[2]).toBe(false)
  })

  it('falls back to the whole cached playlist when the fresh load fails', async () => {
    const cached: PlaylistCacheEntry = {
      meta: { ...meta, songCount: 3 },
      songs: [song('1'), song('2'), song('3')],
      total: 3,
      complete: true,
      fetchedAtMs: Date.now()
    }
    getCachedMock.mockResolvedValue(ok(cached))
    getMock.mockRejectedValue(new Error('offline'))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')

    expect(store.feed?.status).toBe('complete')
    expect(store.feed?.stale).toBe(true)
    expect(store.feed?.songs.map((item) => item.songMid)).toEqual(['1', '2', '3'])
  })

  it('falls back to an incomplete cache as an interrupted feed', async () => {
    const cached: PlaylistCacheEntry = {
      meta: { ...meta, songCount: 3 },
      songs: [song('1'), song('2')],
      total: 3,
      complete: false,
      fetchedAtMs: Date.now()
    }
    getCachedMock.mockResolvedValue(ok(cached))
    getMock.mockRejectedValue(new Error('offline'))
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()

    await store.load('liked')

    expect(store.feed?.status).toBe('error')
    expect(store.feed?.stale).toBe(true)
    expect(store.feed?.error).toBe('歌单未完整加载')
    expect(store.feed?.songs).toHaveLength(2)
  })

  it('resumes a stalled feed after polling the unchanged first page', async () => {
    getMock.mockImplementation(async (_id: string, options: { offset?: number }) =>
      ok(page(options.offset ?? 0))
    )
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const store = usePlaylistStore()
    store.feed = {
      meta,
      songs: Array.from({ length: 50 }, (_, index) => song(String(index))),
      total: 100,
      status: 'error',
      stale: false,
      error: 'network down',
      loadToken: 0
    }

    await store.poll('liked')
    await vi.waitFor(() => expect(store.feed?.status).toBe('complete'))
    expect(store.feed?.songs).toHaveLength(100)
    expect(store.feed?.error).toBe('')
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
