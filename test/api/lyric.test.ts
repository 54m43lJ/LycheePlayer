import { beforeEach, describe, expect, it, vi } from 'vitest'

const { musicuMock } = vi.hoisted(() => ({ musicuMock: vi.fn() }))

vi.mock('../../src/main/api/client', () => ({
  musicu: musicuMock
}))

beforeEach(() => {
  musicuMock.mockReset()
})

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64')
}

describe('歌词接口', () => {
  it('通过 PlayLyricInfo 同时返回原文与译文', async () => {
    musicuMock.mockResolvedValue({
      lyric: encode('[00:12.34]Hello'),
      trans: encode('[00:12.34]你好')
    })
    const { getLyric } = await import('../../src/main/api/lyric')

    const lyric = await getLyric('5010383')

    expect(musicuMock).toHaveBeenCalledWith(
      'music.musichallSong.PlayLyricInfo',
      'GetPlayLyricInfo',
      expect.objectContaining({ songID: 5010383, trans: 1, qrc: 0 })
    )
    expect(lyric.format).toBe('lrc')
    expect(lyric.text).toContain('Hello')
    expect(lyric.trans).toContain('你好')
  })

  it('译文为空时返回 null', async () => {
    musicuMock.mockResolvedValue({ lyric: encode('[00:12.34]Hello'), trans: '' })
    const { getLyric } = await import('../../src/main/api/lyric')

    const lyric = await getLyric('5010383')

    expect(lyric.trans).toBeNull()
  })

  it('非数字歌曲 ID 不请求上游', async () => {
    const { getLyric } = await import('../../src/main/api/lyric')

    const lyric = await getLyric('not-a-number')

    expect(musicuMock).not.toHaveBeenCalled()
    expect(lyric).toEqual({ format: 'lrc', text: '', trans: null })
  })
})
