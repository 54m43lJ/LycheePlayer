import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Song } from '../src/shared/types'
import { defaultSettings } from '../src/renderer/stores/settings'

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
        settings: {
          set: (patch: Record<string, unknown>) =>
            Promise.resolve({ ok: true, data: { ...defaultSettings(), ...patch } })
        },
        mpv: { getState: () => Promise.resolve({ ok: true, data: { available: false } }) }
      },
      setTimeout
    })
    vi.stubGlobal('document', { documentElement: { dataset: {} } })
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

  it('keeps already queued songs when the playlist snapshot grows', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const player = usePlayerStore()
    const songs = [song('1', 'a'), song('2', 'b'), song('3', 'c')]
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'p1' })
    player.appendPlaylistQueue(songs[0], songs.slice(0, 2))
    player.addNext(song('x', 'next'))
    player.appendPlaylistQueue(songs[0], songs)

    expect(player.queue.map((item) => item.songMid)).toEqual(['x', '2', '3'])
  })

  it('does not remove queued songs when a later snapshot omits them', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const player = usePlayerStore()
    const songs = [song('1', 'a'), song('2', 'b'), song('3', 'c')]
    player.startPlaylistPlayback(songs[0], { kind: 'playlist', id: 'p1' })
    player.appendPlaylistQueue(songs[0], songs)
    player.appendPlaylistQueue(songs[0], [songs[0], songs[2]])

    expect(player.queue.map((item) => item.songMid)).toEqual(['2', '3'])
  })

  it('shares the quality preference between the player bar and settings', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const { useSettingsStore } = await import('../src/renderer/stores/settings')
    const player = usePlayerStore()
    const settings = useSettingsStore()

    await player.updateDefaultQuality('flac')
    expect(settings.settings.defaultQuality).toBe('flac')
    expect(player.qualityPreference).toBe('flac')
    expect(player.requestedQuality).toBe('flac')

    await player.updateDefaultQuality('auto')
    expect(settings.settings.defaultQuality).toBe('auto')
    expect(player.qualityPreference).toBe('auto')
    expect(player.requestedQuality).toBe(player.defaultQuality)
  })

  it('cycles play modes in the preset order', async () => {    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const player = usePlayerStore()
    expect(player.mode).toBe('sequence')
    player.cycleMode()
    expect(player.mode).toBe('repeat-all')
    player.cycleMode()
    expect(player.mode).toBe('repeat-one')
    player.cycleMode()
    expect(player.mode).toBe('shuffle')
    player.cycleMode()
    expect(player.mode).toBe('sequence')
  })

  it('stops skipping after ten consecutive NO_STREAM results', async () => {
    const getUrls = vi.fn(() =>
      Promise.resolve({
        ok: false as const,
        error: { code: 'NO_STREAM' as const, message: '当前内容已下架' }
      })
    )
    ;(window as unknown as { lychee: { song: { getUrls: typeof getUrls } } }).lychee.song.getUrls =
      getUrls
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const player = usePlayerStore()
    const songs = Array.from({ length: 15 }, (_, index) => song(`${index + 1}`, `s${index + 1}`))

    player.playList(songs, 0)

    await vi.waitFor(() => {
      expect(player.index).toBe(9)
      expect(player.status).toBe('stopped')
      expect(player.loading).toBe(false)
    })
    expect(getUrls).toHaveBeenCalledTimes(10)
    expect(player.playOrder.map((item) => item.songMid)).toHaveLength(15)
  })
})
