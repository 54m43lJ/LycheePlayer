import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Credential } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock, vipMock, tripBlockMock, credentialState, downloadedState } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  vipMock: vi.fn(),
  tripBlockMock: vi.fn(),
  credentialState: { value: null as Credential | null },
  downloadedState: {
    value: null as { filePath: string; quality: '128k' | '320k' | 'flac' } | null
  }
}))

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
    tripUpstreamBlock: tripBlockMock,
    getGuid: () => 'test-guid',
    upstreamRequest: vi.fn(),
    mapUpstreamCode: (code: number, context: string) =>
      new UpstreamError(
        code === 104003 ? 'NO_STREAM' : 'UPSTREAM_NETWORK',
        `上游返回错误码 ${code}（${context}）`,
        false,
        code
      )
  }
})

vi.mock('../../src/main/api/user', () => ({
  getVipStatus: async () => {
    const isVip = await vipMock()
    return {
      state: 'known',
      isVip,
      level: isVip ? 'vip' : 'none',
      expiresAtMs: null
    }
  }
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => credentialState.value
}))

vi.mock('../../src/main/download/registry', () => ({
  resolveDownloadedAudio: async () => downloadedState.value
}))

vi.mock('../../src/main/media/audio-protocol', () => ({
  audioStreamUrl: (url: string, songMid: string) => `lychee-audio://stream/${songMid}`
}))

function vkeyResult(result: number, purl = ''): unknown {
  return {
    midurlinfo: [{ songmid: 'song-mid', purl, result }]
  }
}

beforeEach(async () => {
  const { resetVkeyGate } = await import('../../src/main/api/vkey')
  resetVkeyGate()
  musicuMock.mockReset()
  vipMock.mockReset()
  tripBlockMock.mockReset()
  credentialState.value = {
    method: 'qq',
    musicid: '42',
    musickey: 'key',
    expiredAtMs: null
  }
  downloadedState.value = null
  musicuMock.mockImplementation(async (module: string) => {
    if (module === 'music.trackInfo.UniformRuleCtrl') {
      return {
        tracks: [
          {
            mid: 'song-mid',
            id: 1,
            name: 'song',
            interval: 180,
            file: { media_mid: 'media-mid' },
            pay: { pay_play: 0, price_album: 0 }
          }
        ]
      }
    }
    return vkeyResult(104003)
  })
})

describe('api/song stream failures', () => {
  it('uses an already downloaded local file without requesting an upstream url', async () => {
    downloadedState.value = { filePath: '/tmp/song.flac', quality: 'flac' }
    const { getStreamUrls } = await import('../../src/main/api/song')

    const result = await getStreamUrls(['song-mid'], 'flac')

    expect(result[0]).toMatchObject({
      songMid: 'song-mid',
      url: 'lychee-audio://stream/song-mid',
      quality: 'flac'
    })
    expect(musicuMock).not.toHaveBeenCalled()
  })

  it('reports 104003 as an authorization problem instead of removal for a VIP account', async () => {
    vipMock.mockResolvedValue(true)
    const { getStreamUrls } = await import('../../src/main/api/song')

    await expect(getStreamUrls(['song-mid'], 'flac')).rejects.toMatchObject({
      code: 'NO_STREAM',
      message: expect.stringContaining('104003')
    })
  })

  it('maps vkey 104004 to a retryable upstream error', async () => {
    musicuMock.mockImplementation(async (module: string) => {
      if (module === 'music.pf_song_detail_svr') {
        return {
          track_info: {
            mid: 'song-mid',
            id: 1,
            name: 'song',
            interval: 180,
            file: { media_mid: 'media-mid' },
            pay: { pay_play: 0, price_album: 0 }
          }
        }
      }
      return vkeyResult(104004)
    })
    const { getStreamUrls } = await import('../../src/main/api/song')

    await expect(getStreamUrls(['song-mid'], '128k')).rejects.toMatchObject({
      code: 'UPSTREAM_NETWORK',
      message: expect.stringContaining('104004')
    })
  })

  it('falls back to music.vkey.GetVkey when the legacy endpoint rejects with 104009', async () => {
    const { UpstreamError } = await import('../../src/main/api/client')
    musicuMock.mockImplementation(async (module: string) => {
      if (module === 'music.pf_song_detail_svr') {
        return {
          track_info: {
            mid: 'song-mid',
            id: 1,
            name: 'song',
            interval: 180,
            file: { media_mid: 'media-mid' },
            pay: { pay_play: 0, price_album: 0 }
          }
        }
      }
      if (module === 'vkey.GetVkeyServer') {
        throw new UpstreamError(
          'UPSTREAM_NETWORK',
          'QQ 音乐拒绝了播放链接请求（104009）',
          false,
          104009
        )
      }
      return vkeyResult(0, 'M500media-mid.mp3?vkey=test')
    })
    const { getStreamUrls } = await import('../../src/main/api/song')

    const result = await getStreamUrls(['song-mid'], '128k')

    expect(result[0]).toMatchObject({
      songMid: 'song-mid',
      url: 'lychee-audio://stream/song-mid',
      quality: '128k'
    })
    expect(musicuMock.mock.calls.map((call) => call[0])).toContain('music.vkey.GetVkey')
    expect(tripBlockMock).not.toHaveBeenCalled()
  })

  it('reports 104009 from both vkey endpoints as a network / proxy problem', async () => {
    const { UpstreamError } = await import('../../src/main/api/client')
    musicuMock.mockImplementation(async (module: string) => {
      if (module === 'music.pf_song_detail_svr') {
        return {
          track_info: {
            mid: 'song-mid',
            id: 1,
            name: 'song',
            interval: 180,
            file: { media_mid: 'media-mid' },
            pay: { pay_play: 0, price_album: 0 }
          }
        }
      }
      throw new UpstreamError(
        'UPSTREAM_NETWORK',
        'QQ 音乐拒绝了播放链接请求（104009）',
        false,
        104009
      )
    })
    const { getStreamUrls } = await import('../../src/main/api/song')

    await expect(getStreamUrls(['song-mid'], '128k')).rejects.toMatchObject({
      code: 'UPSTREAM_NETWORK',
      message: expect.stringContaining('104009')
    })
    expect(tripBlockMock).toHaveBeenCalledTimes(1)
  })

  it('requests vkey one song per call instead of batching', async () => {
    const mids = ['mid-a', 'mid-b']
    const vkeyParams: Array<{ songmid: string[]; filename: string[] }> = []
    musicuMock.mockImplementation(
      async (module: string, _method: string, param: Record<string, unknown>) => {
        if (module === 'music.trackInfo.UniformRuleCtrl') {
          const batch = param.mids as string[]
          return {
            tracks: batch.map((mid) => ({
              mid,
              id: 1,
              name: mid,
              interval: 100,
              file: { media_mid: `media-${mid}` },
              pay: { pay_play: 0, price_album: 0 }
            }))
          }
        }
        if (module === 'vkey.GetVkeyServer') {
          const query = param as { songmid: string[]; filename: string[] }
          vkeyParams.push(query)
          return {
            midurlinfo: query.songmid.map((mid) => ({
              songmid: mid,
              purl: `purl-${mid}`,
              result: 0
            }))
          }
        }
        throw new Error(`unexpected module ${module}`)
      }
    )
    const { getStreamUrls } = await import('../../src/main/api/song')

    const results = await getStreamUrls(mids, 'flac')

    expect(results).toHaveLength(mids.length)
    expect(vkeyParams).toHaveLength(mids.length)
    expect(vkeyParams.every((query) => query.songmid.length === 1)).toBe(true)
    expect(vkeyParams.every((query) => query.filename.length === 1)).toBe(true)
    expect(vkeyParams.map((query) => query.songmid[0]).sort()).toEqual(mids)
    expect(results.every((result) => result.url !== null)).toBe(true)
  })
})
