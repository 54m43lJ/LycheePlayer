import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAY_HISTORY_STORAGE_PREFIX, RECENT_PLAYLIST_STORAGE_PREFIX } from '../src/shared/constants'

let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    key: (index: number) => [...storage.keys()][index] ?? null,
    get length() {
      return storage.size
    }
  })
  storage.set(`${RECENT_PLAYLIST_STORAGE_PREFIX}123`, 'recent-123')
  storage.set(`${PLAY_HISTORY_STORAGE_PREFIX}123`, 'history-123')
  storage.set(`${PLAY_HISTORY_STORAGE_PREFIX}456`, 'history-456')
  storage.set('lychee.theme', 'dark')
  storage.set('lychee.volume', '0.8')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('cache-users', () => {
  it('merges main-process usage with per-account local records', async () => {
    const { mergeUserCaches } = await import('../src/renderer/utils/cache-users')
    const rows = mergeUserCaches([
      {
        musicid: '123',
        audioBytes: 100,
        audioFiles: 2,
        playlistBytes: 50,
        playlistFiles: 1
      },
      {
        musicid: 'anonymous',
        audioBytes: 0,
        audioFiles: 0,
        playlistBytes: 10,
        playlistFiles: 1
      }
    ])

    const account = rows.find((row) => row.musicid === '123')
    expect(account).toMatchObject({ localEntries: 2, localBytes: expect.any(Number) })
    expect(account?.localBytes).toBeGreaterThan(0)

    const localOnly = rows.find((row) => row.musicid === '456')
    expect(localOnly).toMatchObject({
      audioBytes: 0,
      playlistBytes: 0,
      localEntries: 1
    })

    const anonymous = rows.find((row) => row.musicid === 'anonymous')
    expect(anonymous).toMatchObject({ localEntries: 0, localBytes: 0 })
  })

  it('removes only the selected account local keys', async () => {
    const { clearLocalUserCache } = await import('../src/renderer/utils/cache-users')

    clearLocalUserCache('123')

    expect(storage.has(`${RECENT_PLAYLIST_STORAGE_PREFIX}123`)).toBe(false)
    expect(storage.has(`${PLAY_HISTORY_STORAGE_PREFIX}123`)).toBe(false)
    expect(storage.has(`${PLAY_HISTORY_STORAGE_PREFIX}456`)).toBe(true)
    expect(storage.has('lychee.theme')).toBe(true)
    expect(storage.has('lychee.volume')).toBe(true)
  })
})
