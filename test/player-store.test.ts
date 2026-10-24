import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Song } from '../src/shared/types'

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

function song(id: string, name: string): Song {
  return {
    songMid: id,
    songId: id,
    name,
    singers: [{ mid: 's', name: 'S' }],
    album: { mid: 'a', name: 'A' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false }
  }
}

describe('player queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    })
    vi.stubGlobal('window', {
      lychee: {
        player: { sendState: noop, onCommand: () => noop },
        song: { getUrls: () => Promise.resolve({ ok: true, data: [] }) },
        mpv: { getState: () => Promise.resolve({ ok: true, data: { available: false } }) }
      },
      setTimeout
    })
  })

  it('keeps the remaining songs in the queue after playList', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const player = usePlayerStore()
    const songs = [song('1', 'a'), song('2', 'b'), song('3', 'c')]
    player.playList(songs, 0)
    expect(player.playOrder).toHaveLength(3)
    expect(player.index).toBe(0)
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])
  })

  it('fills the queue after a playlist finishes loading', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const player = usePlayerStore()
    const songs = [song('1', 'a'), song('2', 'b'), song('3', 'c')]
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'p1' })
    expect(player.queue).toHaveLength(0)
    player.appendPlaylistQueue(songs[0], songs)
    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])
  })
})
