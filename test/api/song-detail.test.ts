import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SONG_DETAIL_BATCH } from '../../src/shared/constants'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock } = vi.hoisted(() => ({ musicuMock: vi.fn() }))

vi.mock('../../src/main/api/client', () => {
  class UpstreamError extends Error {
    readonly code: string
    readonly retryable: boolean
    readonly upstreamCode?: number

    constructor(code: string, message: string, retryable = false, upstreamCode?: number) {
      super(message)
      this.name = 'UpstreamError'
      this.code = code
      this.retryable = retryable
      this.upstreamCode = upstreamCode
    }
  }
  return {
    UpstreamError,
    musicu: musicuMock,
    getGuid: () => 'test-guid',
    upstreamRequest: vi.fn(),
    mapUpstreamCode: (code: number) =>
      new UpstreamError('UPSTREAM_NETWORK', `上游返回错误码 ${code}`, false, code)
  }
})

vi.mock('../../src/main/download/registry', () => ({
  resolveDownloadedAudio: async () => null
}))

vi.mock('../../src/main/media/audio-protocol', () => ({
  audioStreamUrl: (_url: string, songMid: string) => `lychee-audio://stream/${songMid}`
}))

vi.mock('../../src/main/api/user', () => ({
  isVipUser: async () => false
}))

beforeEach(() => {
  musicuMock.mockReset()
})

function rawTrack(mid: string): Record<string, unknown> {
  return {
    mid,
    id: 1,
    name: mid,
    title: mid,
    interval: 100,
    singer: [{ mid: '', name: 'singer' }],
    album: { mid: 'album', name: 'album' },
    file: { media_mid: `media-${mid}` },
    pay: { pay_play: 0, price_album: 0 }
  }
}

describe('api/song batch detail', () => {
  it('fetches multiple songs in one batch request and restores request order', async () => {
    musicuMock.mockResolvedValue({ tracks: [rawTrack('m2'), rawTrack('m1')] })
    const { getDetail } = await import('../../src/main/api/song')

    const songs = await getDetail(['m1', 'm2'])

    expect(musicuMock).toHaveBeenCalledTimes(1)
    const [module, method, param] = musicuMock.mock.calls[0]
    expect(module).toBe('music.trackInfo.UniformRuleCtrl')
    expect(method).toBe('CgiGetTrackInfo')
    expect(param).toMatchObject({
      ctx: 0,
      client: 1,
      mids: ['m1', 'm2'],
      types: [0, 0],
      modify_stamp: [0, 0]
    })
    expect(songs.map((song) => song.songMid)).toEqual(['m1', 'm2'])
  })

  it('splits large batches by SONG_DETAIL_BATCH', async () => {
    const mids = Array.from({ length: SONG_DETAIL_BATCH + 1 }, (_, index) => `m${index}`)
    musicuMock.mockImplementation(
      async (_module: string, _method: string, param: { mids: string[] }) => ({
        tracks: param.mids.map((mid) => rawTrack(mid))
      })
    )
    const { getDetail } = await import('../../src/main/api/song')

    const songs = await getDetail(mids)

    expect(musicuMock).toHaveBeenCalledTimes(2)
    expect((musicuMock.mock.calls[0][2] as { mids: string[] }).mids).toHaveLength(
      SONG_DETAIL_BATCH
    )
    expect((musicuMock.mock.calls[1][2] as { mids: string[] }).mids).toEqual([
      `m${SONG_DETAIL_BATCH}`
    ])
    expect(songs).toHaveLength(SONG_DETAIL_BATCH + 1)
  })

  it('sends two full 50-song batches sequentially with rate-limit spacing', async () => {
    const mids = Array.from({ length: SONG_DETAIL_BATCH * 2 }, (_, index) => `n${index}`)
    const simulatedLatencyMs = 300
    const callTimes: number[] = []
    musicuMock.mockImplementation(
      async (_module: string, _method: string, param: { mids: string[] }) => {
        callTimes.push(Date.now())
        await new Promise((resolve) => setTimeout(resolve, simulatedLatencyMs))
        // 模拟真实上游：响应顺序与请求顺序不同，批次之间必须串行等待。
        return { tracks: [...param.mids].reverse().map((mid) => rawTrack(mid)) }
      }
    )
    const { getDetail } = await import('../../src/main/api/song')

    const songs = await getDetail(mids)

    expect(musicuMock).toHaveBeenCalledTimes(2)
    const first = musicuMock.mock.calls[0][2] as { mids: string[] }
    const second = musicuMock.mock.calls[1][2] as { mids: string[] }
    expect(first.mids).toEqual(mids.slice(0, SONG_DETAIL_BATCH))
    expect(second.mids).toEqual(mids.slice(SONG_DETAIL_BATCH))
    expect(callTimes[1] - callTimes[0]).toBeGreaterThanOrEqual(simulatedLatencyMs - 50)
    expect(songs.map((song) => song.songMid)).toEqual(mids)
  })

  it('falls back to a single detail request when the batch omits a song', async () => {
    musicuMock.mockImplementation(async (module: string) => {
      if (module === 'music.trackInfo.UniformRuleCtrl') {
        return { tracks: [rawTrack('a')] }
      }
      return { track_info: rawTrack('b') }
    })
    const { getDetail } = await import('../../src/main/api/song')

    const songs = await getDetail(['a', 'b'])

    expect(musicuMock.mock.calls.map((call) => call[0])).toEqual([
      'music.trackInfo.UniformRuleCtrl',
      'music.pf_song_detail_svr'
    ])
    expect(songs.map((song) => song.songMid)).toEqual(['a', 'b'])
  })
})
