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
  UpstreamError: class UpstreamError extends Error {
    readonly code: string

    constructor(code: string, message: string) {
      super(message)
      this.code = code
    }
  },
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

  it('marks normal playlists editable only when the upstream says the account owns them', async () => {
    const { fetchPlaylistPage } = await import('../../src/main/api/playlist')

    musicuMock.mockResolvedValueOnce({
      dirinfo: { id: '123', dirid: 456, title: '我的歌单', songnum: 1, owndir: 1 },
      songlist: []
    })
    await expect(fetchPlaylistPage('123', 0)).resolves.toMatchObject({
      meta: { editable: true, dirId: 456 }
    })

    musicuMock.mockResolvedValueOnce({
      dirinfo: { id: '456', title: '公开歌单', songnum: 1, owndir: 0, creator: { musicid: 99 } },
      songlist: []
    })
    await expect(fetchPlaylistPage('456', 0)).resolves.toMatchObject({
      meta: { editable: false }
    })

    musicuMock.mockResolvedValueOnce({
      dirinfo: { id: '789', title: '缺少 owndir', songnum: 1, creator: { musicid: '42' } },
      songlist: []
    })
    await expect(fetchPlaylistPage('789', 0)).resolves.toMatchObject({
      meta: { editable: true }
    })
  })
})

describe('api/playlist full snapshot', () => {
  it('fetches a large playlist with 2000 songs per request', async () => {
    musicuMock.mockImplementation(
      async (_module: string, _method: string, param: Record<string, unknown>) => {
        const begin = Number(param.song_begin)
        const size = Number(param.song_num)
        const total = 2500
        const count = Math.min(size, total - begin)
        return {
          dirinfo: { id: '123', title: '大歌单', songnum: total },
          songlist: Array.from({ length: count }, (_, index) => rawSong(`s${begin + index}`))
        }
      }
    )
    const { fetchPlaylistSnapshot } = await import('../../src/main/api/playlist')
    const result = await fetchPlaylistSnapshot('123')

    expect(musicuMock).toHaveBeenCalledTimes(2)
    expect(musicuMock.mock.calls[0][2]).toMatchObject({ song_begin: 0, song_num: 2000 })
    expect(musicuMock.mock.calls[1][2]).toMatchObject({ song_begin: 2000, song_num: 2000 })
    expect(result.songs).toHaveLength(2500)
    expect(result.total).toBe(2500)
    expect(result.sourceTotal).toBe(2500)
    expect(result.meta.songCount).toBe(2500)
  })

  it('uses one request for playlists that fit in a single page', async () => {
    musicuMock.mockResolvedValue({
      dirinfo: { id: '123', title: '小歌单', songnum: 100 },
      songlist: Array.from({ length: 100 }, (_, index) => rawSong(`s${index}`))
    })
    const { fetchPlaylistSnapshot } = await import('../../src/main/api/playlist')
    const result = await fetchPlaylistSnapshot('123')

    expect(musicuMock).toHaveBeenCalledTimes(1)
    expect(result.songs).toHaveLength(100)
  })

  it('tolerates a small number of tracks omitted by upstream', async () => {
    musicuMock.mockResolvedValue({
      dirinfo: { id: '123', title: '缺歌歌单', songnum: 1000 },
      songlist: Array.from({ length: 990 }, (_, index) => rawSong(`s${index}`))
    })
    const { fetchPlaylistSnapshot } = await import('../../src/main/api/playlist')
    const result = await fetchPlaylistSnapshot('123')

    expect(result.songs).toHaveLength(990)
    expect(result.sourceTotal).toBe(1000)
    expect(result.total).toBe(990)
  })

  it('rejects a silently truncated playlist', async () => {
    musicuMock.mockResolvedValue({
      dirinfo: { id: '123', title: '被截断', songnum: 10000 },
      songlist: Array.from({ length: 50 }, (_, index) => rawSong(`s${index}`))
    })
    const { fetchPlaylistSnapshot } = await import('../../src/main/api/playlist')
    await expect(fetchPlaylistSnapshot('123')).rejects.toThrow('歌单拉取不完整')
  })

  it('rejects an empty middle page instead of replacing with partial content', async () => {
    musicuMock.mockImplementation(
      async (_module: string, _method: string, param: Record<string, unknown>) => {
        const begin = Number(param.song_begin)
        return begin === 0
          ? {
              dirinfo: { id: '123', title: '中间空页', songnum: 3000 },
              songlist: Array.from({ length: 2000 }, (_, index) => rawSong(`s${index}`))
            }
          : {
              dirinfo: { id: '123', title: '中间空页', songnum: 3000 },
              songlist: []
            }
      }
    )
    const { fetchPlaylistSnapshot } = await import('../../src/main/api/playlist')
    await expect(fetchPlaylistSnapshot('123')).rejects.toThrow('歌单分页为空')
  })

  it('stops immediately when the caller aborts', async () => {
    const controller = new AbortController()
    controller.abort()
    const { fetchPlaylistSnapshot } = await import('../../src/main/api/playlist')
    await expect(fetchPlaylistSnapshot('123', controller.signal)).rejects.toThrow()
    expect(musicuMock).not.toHaveBeenCalled()
  })
})
