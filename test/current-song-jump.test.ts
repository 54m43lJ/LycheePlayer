import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
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

function song(id: string): Song {
  return {
    songMid: id,
    songId: id,
    name: id,
    singers: [{ mid: 's', name: 'S' }],
    album: { mid: 'a', name: 'A' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false },
    status: null,
    pay_play: null,
    pay_month: null,
    pay_status: null,
    maxQuality: null,
    mvId: ''
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: noop
  })
  vi.stubGlobal('window', {
    lychee: {
      player: { sendState: noop, onCommand: () => noop },
      song: { getUrls: () => Promise.resolve({ ok: true, data: [] }) },
      settings: { set: () => Promise.resolve({ ok: true, data: null }) }
    },
    setTimeout
  })
  vi.stubGlobal('document', { documentElement: { dataset: {} } })
})

describe('useCurrentSongJump', () => {
  it('shows the button whenever the current song is in the list, regardless of queue source', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const { useCurrentSongJump } = await import(
      '../src/renderer/composables/current-song-jump'
    )
    const player = usePlayerStore()
    const songs = ref([song('1'), song('2')])
    const { showCurrent } = useCurrentSongJump(ref(null), songs)

    expect(player.queueSource).toBeNull()
    expect(showCurrent.value).toBe(false)

    player.current = song('1')
    expect(player.queueSource).toBeNull()
    expect(showCurrent.value).toBe(true)

    player.current = song('3')
    expect(showCurrent.value).toBe(false)
  })

  it('re-evaluates when the visible list changes', async () => {
    const { usePlayerStore } = await import('../src/renderer/stores/player')
    const { useCurrentSongJump } = await import(
      '../src/renderer/composables/current-song-jump'
    )
    const player = usePlayerStore()
    const songs = ref([song('1')])
    const { showCurrent } = useCurrentSongJump(ref(null), songs)
    player.current = song('2')
    expect(showCurrent.value).toBe(false)

    songs.value = [song('2')]
    expect(showCurrent.value).toBe(true)
  })
})
