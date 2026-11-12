import { beforeEach, describe, expect, it, vi } from 'vitest'

const { musicuMock, upstreamRequestMock } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  upstreamRequestMock: vi.fn()
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
    upstreamRequest: upstreamRequestMock
  }
})

beforeEach(() => {
  musicuMock.mockReset()
  upstreamRequestMock.mockReset()
})

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

describe('歌词接口', () => {
  it('优先使用 PlayLyricInfo，并同时拿到原文与译文', async () => {
    musicuMock.mockResolvedValue({
      lyric: encode('[00:12.34]Hello'),
      trans: encode('[00:12.34]你好')
    })
    const { getLyric } = await import('../../src/main/api/lyric')

    const lyric = await getLyric('002OTO4x3lXP2C', '5010383')

    expect(musicuMock).toHaveBeenCalledWith(
      'music.musichallSong.PlayLyricInfo',
      'GetPlayLyricInfo',
      expect.objectContaining({ songID: 5010383, trans: 1, qrc: 0 })
    )
    expect(lyric.format).toBe('lrc')
    expect(lyric.text).toContain('Hello')
    expect(lyric.trans).toContain('你好')
    expect(upstreamRequestMock).not.toHaveBeenCalled()
  })

  it('新版接口失败时回退旧接口', async () => {
    musicuMock.mockRejectedValue(new Error('new endpoint failed'))
    upstreamRequestMock.mockResolvedValue({
      code: 0,
      retcode: 0,
      lyric: '[00:12.34]Hello',
      trans: '[00:12.34]你好'
    })
    const { getLyric } = await import('../../src/main/api/lyric')

    const lyric = await getLyric('002OTO4x3lXP2C', '5010383')

    expect(upstreamRequestMock).toHaveBeenCalledTimes(1)
    expect(lyric.text).toContain('Hello')
    expect(lyric.trans).toContain('你好')
  })

  it('没有数字 songId 时直接走旧接口', async () => {
    upstreamRequestMock.mockResolvedValue({
      code: 0,
      retcode: 0,
      lyric: '[00:12.34]Hello',
      trans: null
    })
    const { getLyric } = await import('../../src/main/api/lyric')

    const lyric = await getLyric('002OTO4x3lXP2C')

    expect(musicuMock).not.toHaveBeenCalled()
    expect(lyric.trans).toBeNull()
  })
})
