import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Credential } from '../../src/shared/types'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock, vipMock, credentialState, downloadedState } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  vipMock: vi.fn(),
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

vi.mock('../../src/main/api/user', () => ({ isVipUser: vipMock }))

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

beforeEach(() => {
  musicuMock.mockReset()
  vipMock.mockReset()
  credentialState.value = { musicid: '42', musickey: 'key', expiredAtMs: null }
  downloadedState.value = null
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
  })
})
