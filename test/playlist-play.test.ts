import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { PlaylistCacheEntry, PlaylistMeta, PlaylistPage, Song } from '../src/shared/types'

const noop = (): void => undefined

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
  id: 'pl1',
  name: '测试歌单',
  coverUrl: '',
  songCount: 2,
  kind: 'normal',
  editable: false
}

function song(id: string): Song {
  return {
    songMid: id,
    songId: id,
    name: `song ${id}`,
    singers: [{ mid: 's', name: 'S' }],
    album: { mid: 'a', name: 'A' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false }
  }
}

function cached(songs: Song[]): PlaylistCacheEntry {
  return {
    meta: { ...meta, songCount: songs.length },
    songs,
    total: songs.length,
    sourceTotal: songs.length,
    complete: true,
    fetchedAtMs: Date.now()
  }
}

function page(songs: Song[]): PlaylistPage {
  return {
    meta: { ...meta, songCount: songs.length },
    songs,
    offset: 0,
    total: songs.length,
    hasMore: false
  }
}

const getCached = vi.fn()
const get = vi.fn()

beforeEach(() => {
  setActivePinia(createPinia())
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  })
  vi.stubGlobal('window', {
    lychee: {
      playlist: { getCached, get }
    },
    setTimeout,
    clearTimeout
  })
  getCached.mockReset()
  get.mockReset()
  getCached.mockResolvedValue({ ok: true, data: null })
  get.mockResolvedValue({ ok: true, data: page([song('1'), song('2')]) })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('歌单卡片直接播放', () => {
  it('优先用缓存起播，并在后台加载完整歌单', async () => {
    getCached.mockResolvedValue({ ok: true, data: cached([song('1'), song('2'), song('3')]) })
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const { usePlaylistPlay } = await import('../src/renderer/composables/playlist-play')
    const player = usePlayerStore()
    const playlist = usePlaylistStore()
    const start = vi.spyOn(player, 'startPlaylistPlayback').mockImplementation(noop)
    const append = vi.spyOn(player, 'appendPlaylistQueue').mockImplementation(noop)
    const begin = vi.spyOn(playlist, 'beginQueueBuild').mockImplementation(noop)
    const load = vi.spyOn(playlist, 'load').mockResolvedValue(undefined)

    const { playingId, playPlaylist } = usePlaylistPlay()
    await playPlaylist(meta)

    expect(get).not.toHaveBeenCalled()
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ songMid: '1' }), {
      kind: 'playlist',
      id: 'pl1'
    })
    expect(append).toHaveBeenCalledWith(expect.objectContaining({ songMid: '1' }), [
      expect.objectContaining({ songMid: '1' }),
      expect.objectContaining({ songMid: '2' }),
      expect.objectContaining({ songMid: '3' })
    ])
    expect(begin).toHaveBeenCalled()
    expect(load).toHaveBeenCalledWith('pl1')
    expect(playingId.value).toBeNull()
  })

  it('没有缓存时用第一页起播', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const { usePlaylistPlay } = await import('../src/renderer/composables/playlist-play')
    const player = usePlayerStore()
    const playlist = usePlaylistStore()
    const start = vi.spyOn(player, 'startPlaylistPlayback').mockImplementation(noop)
    vi.spyOn(playlist, 'beginQueueBuild').mockImplementation(noop)
    vi.spyOn(playlist, 'load').mockResolvedValue(undefined)

    const { playPlaylist } = usePlaylistPlay()
    await playPlaylist(meta)

    expect(get).toHaveBeenCalledWith('pl1', { offset: 0 })
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ songMid: '1' }), {
      kind: 'playlist',
      id: 'pl1'
    })
  })

  it('空歌单不入队', async () => {
    getCached.mockResolvedValue({ ok: true, data: cached([]) })
    get.mockResolvedValue({ ok: true, data: page([]) })
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const { usePlaylistStore } = await import('../src/renderer/stores/playlist')
    const { usePlaylistPlay } = await import('../src/renderer/composables/playlist-play')
    const player = usePlayerStore()
    const playlist = usePlaylistStore()
    const start = vi.spyOn(player, 'startPlaylistPlayback').mockImplementation(noop)
    vi.spyOn(playlist, 'beginQueueBuild').mockImplementation(noop)
    vi.spyOn(playlist, 'load').mockResolvedValue(undefined)

    const { playPlaylist } = usePlaylistPlay()
    await playPlaylist(meta)

    expect(start).not.toHaveBeenCalled()
  })
})
