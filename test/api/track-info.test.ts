import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRACK_INFO_BATCH_MAX } from '../../src/shared/constants'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock } = vi.hoisted(() => ({ musicuMock: vi.fn() }))

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

function raw(mid: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { mid, id: 1, type: 0, name: mid, ...extra }
}

beforeEach(() => {
  musicuMock.mockReset()
})

describe('api/track-info', () => {
  it('returns an empty map for empty input without requesting upstream', async () => {
    const { fetchTrackInfoByMids } = await import('../../src/main/api/track-info')

    const result = await fetchTrackInfoByMids(['', '  '])

    expect(result.size).toBe(0)
    expect(musicuMock).not.toHaveBeenCalled()
  })

  it('dedupes mids and indexes the response by mid regardless of response order', async () => {
    musicuMock.mockResolvedValue({ tracks: [raw('b'), raw('a')] })
    const { fetchTrackInfoByMids } = await import('../../src/main/api/track-info')

    const result = await fetchTrackInfoByMids(['a', 'b', 'a'])

    expect(musicuMock).toHaveBeenCalledTimes(1)
    expect((musicuMock.mock.calls[0][2] as { mids: string[] }).mids).toEqual(['a', 'b'])
    expect([...result.keys()].sort()).toEqual(['a', 'b'])
  })

  it('splits any number of mids into fixed 100-song batches', async () => {
    const mids = Array.from({ length: TRACK_INFO_BATCH_MAX + 1 }, (_, index) => `m${index}`)
    musicuMock.mockImplementation(
      async (_module: string, _method: string, param: { mids: string[] }) => ({
        tracks: param.mids.map((mid) => raw(mid))
      })
    )
    const { fetchTrackInfoByMids } = await import('../../src/main/api/track-info')

    const result = await fetchTrackInfoByMids(mids)

    expect(TRACK_INFO_BATCH_MAX).toBe(100)
    expect(musicuMock).toHaveBeenCalledTimes(2)
    expect((musicuMock.mock.calls[0][2] as { mids: string[] }).mids).toHaveLength(100)
    expect((musicuMock.mock.calls[1][2] as { mids: string[] }).mids).toEqual([
      `m${TRACK_INFO_BATCH_MAX}`
    ])
    expect(result.size).toBe(TRACK_INFO_BATCH_MAX + 1)
  })

  it('falls back to a single detail request for songs omitted by the batch', async () => {
    musicuMock.mockImplementation(async (module: string, _method: string, param: { mids?: string[]; song_mid?: string }) => {
      if (module === 'music.trackInfo.UniformRuleCtrl') {
        return { tracks: (param.mids ?? []).filter((mid) => mid !== 'missing').map((mid) => raw(mid)) }
      }
      return { track_info: raw(String(param.song_mid)) }
    })
    const { fetchTrackInfoByMids } = await import('../../src/main/api/track-info')

    const result = await fetchTrackInfoByMids(['a', 'missing'])

    expect(musicuMock).toHaveBeenCalledTimes(2)
    expect(musicuMock.mock.calls[1][0]).toBe('music.pf_song_detail_svr')
    expect((musicuMock.mock.calls[1][2] as { song_mid: string }).song_mid).toBe('missing')
    expect(result.get('missing')?.mid).toBe('missing')
  })

  it('fails the whole batch when the response has no tracks array', async () => {
    musicuMock.mockResolvedValue({})
    const { fetchTrackInfoByMids } = await import('../../src/main/api/track-info')

    await expect(fetchTrackInfoByMids(['a'])).rejects.toThrow('批量歌曲详情响应缺少 tracks')
  })

  it('omits songs missing from both the batch and the single fallback', async () => {
    musicuMock.mockImplementation(async (module: string) =>
      module === 'music.trackInfo.UniformRuleCtrl' ? { tracks: [] } : {}
    )
    const { fetchTrackInfoByMids } = await import('../../src/main/api/track-info')

    const result = await fetchTrackInfoByMids(['gone'])

    expect(result.has('gone')).toBe(false)
  })
})
