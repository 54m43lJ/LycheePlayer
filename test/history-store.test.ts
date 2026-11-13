import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { Song } from '../src/shared/types'
import { PLAY_HISTORY_LIMIT, PLAY_HISTORY_STORAGE_PREFIX } from '../src/shared/constants'

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

let storage: Map<string, string>

beforeEach(() => {
  setActivePinia(createPinia())
  storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key)
  })
})

describe('play history store', () => {
  it('records newest first and moves a repeated song back to the top', async () => {
    const { useHistoryStore } = await import('../src/renderer/stores/history')
    const history = useHistoryStore()

    history.record(song('1'))
    history.record(song('2'))
    history.record(song('1'))

    expect(history.entries.map((entry) => entry.song.songMid)).toEqual(['1', '2'])
    expect(history.entries[0]?.playedAtMs).toBeTypeOf('number')
  })

  it(`keeps at most ${PLAY_HISTORY_LIMIT} songs`, async () => {
    const { useHistoryStore } = await import('../src/renderer/stores/history')
    const history = useHistoryStore()

    for (let index = 0; index <= PLAY_HISTORY_LIMIT; index += 1) {
      history.record(song(String(index)))
    }

    expect(history.entries).toHaveLength(PLAY_HISTORY_LIMIT)
    expect(history.entries[0]?.song.songMid).toBe(String(PLAY_HISTORY_LIMIT))
    expect(history.entries.some((entry) => entry.song.songMid === '0')).toBe(false)
  })

  it('isolates history by account and keeps an anonymous scope', async () => {
    const { useAuthStore } = await import('../src/renderer/stores/auth')
    const { useHistoryStore } = await import('../src/renderer/stores/history')
    const auth = useAuthStore()
    const history = useHistoryStore()

    history.record(song('anonymous'))
    auth.musicid = '10001'
    history.load()
    expect(history.entries).toEqual([])

    history.record(song('account'))
    expect(storage.has(`${PLAY_HISTORY_STORAGE_PREFIX}10001`)).toBe(true)

    auth.musicid = null
    history.load()
    expect(history.entries.map((entry) => entry.song.songMid)).toEqual(['anonymous'])
  })

  it('drops malformed entries when loading', async () => {
    const { useHistoryStore } = await import('../src/renderer/stores/history')
    const key = `${PLAY_HISTORY_STORAGE_PREFIX}anonymous`
    storage.set(
      key,
      JSON.stringify([{ nope: true }, { song: song('ok'), playedAtMs: 1 }])
    )

    const history = useHistoryStore()
    history.load()

    expect(history.entries.map((entry) => entry.song.songMid)).toEqual(['ok'])
  })

  it('clears both the list and its stored key', async () => {
    const { useHistoryStore } = await import('../src/renderer/stores/history')
    const history = useHistoryStore()

    history.record(song('1'))
    history.clear()

    expect(history.entries).toEqual([])
    expect(storage.has(`${PLAY_HISTORY_STORAGE_PREFIX}anonymous`)).toBe(false)
  })
})
