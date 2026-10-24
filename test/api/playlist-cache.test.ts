import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaylistCacheEntry, PlaylistMeta, Song } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock, cacheState } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  cacheState: {
    entry: null as PlaylistCacheEntry | null,
    writes: [] as PlaylistCacheEntry[]
  }
}))

vi.mock('../../src/main/api/client', () => ({
  UpstreamError: class UpstreamError extends Error {},
  musicu: musicuMock
}))

vi.mock('../../src/main/cache/playlist', () => ({
  readPlaylistCache: () => cacheState.entry,
  writePlaylistCache: async (_scope: string, entry: PlaylistCacheEntry) => {
    cacheState.writes.push(entry)
    cacheState.entry = entry
  }
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => ({ musicid: '42' })
}))

const meta: PlaylistMeta = {
  id: 'liked',
  name: '我喜欢',
  coverUrl: '',
  songCount: 100,
  kind: 'favorites',
  editable: true
}

function song(mid: string): Song {
  return {
    songMid: mid,
    songId: mid,
    name: mid,
    singers: [],
    album: { mid: '', name: '' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false }
  }
}

function rawSong(mid: string): unknown {
  return { mid, name: mid, interval: 180 }
}

beforeEach(() => {
  musicuMock.mockReset()
  cacheState.entry = null
  cacheState.writes = []
})

describe('api/playlist cache', () => {
  it('returns whole-playlist cache snapshots, including incomplete ones', async () => {
    const { getCachedPlaylist } = await import('../../src/main/api/playlist')
    expect(getCachedPlaylist('liked')).toBeNull()

    cacheState.entry = {
      meta,
      songs: Array.from({ length: 50 }, (_, index) => song(`cached-${index}`)),
      total: 100,
      complete: false,
      fetchedAtMs: Date.now()
    }
    expect(getCachedPlaylist('liked')?.complete).toBe(false)

    cacheState.entry.complete = true
    cacheState.entry.songs = Array.from({ length: 100 }, (_, index) =>
      song(`cached-${index}`)
    )
    expect(getCachedPlaylist('liked')?.songs).toHaveLength(100)
  })

  it('writes a whole playlist snapshot, not a page', async () => {
    const { savePlaylistSnapshot } = await import('../../src/main/api/playlist')
    const songs = Array.from({ length: 100 }, (_, index) => song(`cached-${index}`))
    await savePlaylistSnapshot('liked', { meta, songs, total: 100 }, true)

    expect(cacheState.writes).toHaveLength(1)
    expect(cacheState.writes[0]).toMatchObject({
      meta,
      total: 100,
      complete: true
    })
    expect(cacheState.writes[0].songs).toHaveLength(100)
    expect(cacheState.entry?.songs).toHaveLength(100)
  })

  it('persists incomplete snapshots with complete=false', async () => {
    const { getCachedPlaylist, savePlaylistSnapshot } = await import(
      '../../src/main/api/playlist'
    )
    const songs = Array.from({ length: 50 }, (_, index) => song(`cached-${index}`))
    await savePlaylistSnapshot('liked', { meta, songs, total: 100 }, false)

    expect(cacheState.entry?.complete).toBe(false)
    expect(getCachedPlaylist('liked')?.complete).toBe(false)
  })

  it('always loads pages from upstream and never slices the playlist cache', async () => {
    cacheState.entry = {
      meta,
      songs: Array.from({ length: 100 }, (_, index) => song(`cached-${index}`)),
      total: 100,
      complete: true,
      fetchedAtMs: Date.now()
    }
    musicuMock.mockResolvedValue({
      dirinfo: { songnum: 100, picurl: '' },
      songlist: Array.from({ length: 50 }, (_, index) => rawSong(`upstream-${index}`))
    })
    const { fetchPlaylistPage } = await import('../../src/main/api/playlist')
    const result = await fetchPlaylistPage('liked', 50)

    expect(musicuMock).toHaveBeenCalledTimes(1)
    expect(result.songs.map((item) => item.songMid)).toEqual(
      Array.from({ length: 50 }, (_, index) => `upstream-${index}`)
    )
    expect(cacheState.writes).toHaveLength(0)
  })
})
