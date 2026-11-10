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
  UpstreamError: class UpstreamError extends Error {},
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
      if (module === 'music.pf_song_detail_svr' && method === 'get_song_detail_yqq') {
        return { track_info: { id: 1001, type: 0 } }
      }
      if (module === 'music.musicasset.PlaylistDetailWrite' && method === 'DelSonglist') {
        const info = param.v_songInfo as Array<{ songId: number; songType: number }>
        expect(info).toEqual([{ songId: 1001, songType: 0 }])
        state.members = state.members.filter((mid) => mid !== 'a')
        return { retCode: 0 }
      }
      throw new Error(`unexpected request: ${module}.${method}`)
    }
  )
})

describe('api/playlist-write removeSongs', () => {
  it('writes DelSonglist with numeric identities and confirms the member is gone', async () => {
    const { removeSongs } = await import('../../src/main/api/playlist-write')
    const result = await removeSongs('123', ['a'])

    expect(result).toMatchObject({ id: '123', songCount: 1 })
    expect(state.members).toEqual(['b'])
    const write = musicuMock.mock.calls.find(
      ([module, method]) =>
        module === 'music.musicasset.PlaylistDetailWrite' && method === 'DelSonglist'
    )
    expect(write?.[2]).toMatchObject({
      dirId: 123,
      tid: 0,
      bFmtUtf8: 1,
      dirName: '测试歌单'
    })
  })

  it('skips the write when the song is not currently a member', async () => {
    const { removeSongs } = await import('../../src/main/api/playlist-write')
    const result = await removeSongs('123', ['missing'])

    expect(result).toMatchObject({ id: '123', songCount: 2 })
    expect(
      musicuMock.mock.calls.some(([, method]) => method === 'DelSonglist')
    ).toBe(false)
  })
})
