import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlaylistMeta, PlaylistPage } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock, state } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  state: {
    members: [] as string[],
    meta: {
      id: '123',
      dirId: 456,
      name: '测试歌单',
      coverUrl: '',
      songCount: 0,
      kind: 'normal',
      editable: true
    } as PlaylistMeta
  }
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => ({ musicid: '42', musickey: 'key' })
}))

vi.mock('../../src/main/api/client', () => ({
  UpstreamError: class UpstreamError extends Error {
    readonly code: string
    readonly retryable: boolean
    readonly upstreamCode?: number

    constructor(code: string, message: string, retryable = false, upstreamCode?: number) {
      super(message)
      this.code = code
      this.retryable = retryable
      this.upstreamCode = upstreamCode
    }
  },
  musicu: musicuMock
}))

vi.mock('../../src/main/api/playlist', () => ({
  fetchPlaylistPage: async (_id: string, offset: number): Promise<PlaylistPage> => ({
    meta: { ...state.meta, songCount: state.members.length },
    songs: state.members.map((mid) => ({
      songMid: mid,
      songId: mid,
      name: mid,
      singers: [],
      album: { mid: '', name: '' },
      durationMs: 0,
      pay: { free: true, vip: false, album: false }
    })),
    offset,
    total: state.members.length,
    hasMore: false
  })
}))

vi.mock('../../src/main/api/song', () => ({
  rawSongToSong: (raw: unknown) => raw
}))

beforeEach(() => {
  musicuMock.mockReset()
  state.members = ['a', 'b']
  musicuMock.mockImplementation(
    async (module: string, method: string, param: Record<string, unknown>) => {
      if (module === 'music.trackInfo.UniformRuleCtrl' && method === 'CgiGetTrackInfo') {
        const mids = param.mids as string[]
        return { tracks: mids.map((mid) => ({ id: 1001, mid, type: 0 })) }
      }
      if (module === 'music.pf_song_detail_svr' && method === 'get_song_detail_yqq') {
        return { track_info: { id: 1001, type: 0 } }
      }
      if (module === 'music.musicasset.PlaylistDetailWrite' && method === 'DelSonglist') {
        const info = param.v_songInfo as Array<{ songId: number; songType: number }>
        expect(info).toEqual([{ songId: 1001, songType: 0 }])
        state.members = state.members.filter((mid) => mid !== 'a')
        return { retCode: 0 }
      }
      if (module === 'music.musicasset.PlaylistDetailWrite' && method === 'AddSonglist') {
        const info = param.v_songInfo as Array<{ songId: number; songType: number }>
        expect(info).toEqual([{ songId: 1001, songType: 0 }])
        state.members = [...state.members, 'a']
        return { retCode: 0 }
      }
      throw new Error(`unexpected request: ${module}.${method}`)
    }
  )
})

describe('api/playlist-write', () => {
  it('uses the directory ID and playlist TID when removing a song', async () => {
    const { removeSongs } = await import('../../src/main/api/playlist-write')
    const result = await removeSongs('123', ['a'])

    expect(result).toMatchObject({ id: '123', dirId: 456, songCount: 1 })
    expect(state.members).toEqual(['b'])
    const write = musicuMock.mock.calls.find(
      ([module, method]) =>
        module === 'music.musicasset.PlaylistDetailWrite' && method === 'DelSonglist'
    )
    expect(write?.[2]).toMatchObject({
      dirId: 456,
      tid: 123,
      bFmtUtf8: 1
    })
    expect(write?.[2]).not.toHaveProperty('dirName')
  })

  it('uses the directory ID and playlist TID when adding a song', async () => {
    state.members = ['b']
    const { addSongs } = await import('../../src/main/api/playlist-write')
    const result = await addSongs('123', ['a'])

    expect(result).toMatchObject({ id: '123', dirId: 456, songCount: 2 })
    expect(state.members).toEqual(['b', 'a'])
    const write = musicuMock.mock.calls.find(
      ([module, method]) =>
        module === 'music.musicasset.PlaylistDetailWrite' && method === 'AddSonglist'
    )
    expect(write?.[2]).toMatchObject({ dirId: 456, tid: 123, bFmtUtf8: 1 })
  })

  it('treats 80092 as success when the write result is confirmed by read-back', async () => {
    state.members = ['b']
    const { UpstreamError } = await import('../../src/main/api/client')
    musicuMock.mockImplementation(
      async (module: string, method: string, param: Record<string, unknown>) => {
        if (module === 'music.trackInfo.UniformRuleCtrl') {
          const mids = param.mids as string[]
          return { tracks: mids.map((mid) => ({ id: 1001, mid, type: 0 })) }
        }
        if (method === 'AddSonglist') {
          state.members = ['b', 'a']
          throw new UpstreamError('UPSTREAM_CHANGED', 'upstream 80092', false, 80092)
        }
        throw new Error(`unexpected request: ${module}.${method}`)
      }
    )

    const { addSongs } = await import('../../src/main/api/playlist-write')
    await expect(addSongs('123', ['a'])).resolves.toMatchObject({ songCount: 2 })
  })

  it('returns the current meta without any write when there is nothing to remove', async () => {
    const { removeSongs } = await import('../../src/main/api/playlist-write')
    const result = await removeSongs('123', [])

    expect(result).toMatchObject({ id: '123', songCount: 2 })
    expect(
      musicuMock.mock.calls.some(([, method]) => method === 'DelSonglist')
    ).toBe(false)
  })

  it('creates a playlist with TID as id and keeps the directory ID', async () => {
    musicuMock.mockResolvedValueOnce({
      retCode: 0,
      result: { dirId: 456, tid: 123, dirName: '新歌单' }
    })
    const { createPlaylist } = await import('../../src/main/api/playlist-write')
    await expect(createPlaylist('新歌单')).resolves.toMatchObject({
      id: '123',
      dirId: 456,
      name: '新歌单'
    })
  })

  it('renames and deletes with the directory ID read from the detail', async () => {
    musicuMock.mockImplementation(
      async (module: string, method: string, param: Record<string, unknown>) => {
        if (module === 'music.pf_song_detail_svr') return { track_info: { id: 1001, type: 0 } }
        if (module === 'music.musicasset.PlaylistBaseWrite') {
          expect(param.dirId).toBe(456)
          return { retCode: 0 }
        }
        throw new Error(`unexpected request: ${module}.${method}`)
      }
    )
    const { renamePlaylist, removePlaylist } = await import('../../src/main/api/playlist-write')
    await expect(renamePlaylist('123', '改名')).resolves.toMatchObject({ id: '123' })
    await expect(removePlaylist('123')).resolves.toBeUndefined()
  })
})
