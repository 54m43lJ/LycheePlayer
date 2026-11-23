import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

const { musicuMock, tripBlockMock } = vi.hoisted(() => ({
  musicuMock: vi.fn(),
  tripBlockMock: vi.fn()
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
    mapUpstreamCode: (code: number, context: string) =>
      new UpstreamError('UPSTREAM_NETWORK', `上游返回错误码 ${code}（${context}）`, false, code)
  }
})

function vkeyResponse(query: { songmid: string[] }, purl = 'purl'): unknown {
  return {
    midurlinfo: query.songmid.map((songmid) => ({ songmid, purl, result: 0 }))
  }
}

beforeEach(async () => {
  const { resetVkeyGate } = await import('../../src/main/api/vkey')
  resetVkeyGate()
  musicuMock.mockReset()
  tripBlockMock.mockReset()
  musicuMock.mockImplementation(async (_module: string, _method: string, param: unknown) =>
    vkeyResponse(param as { songmid: string[] })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe('api/vkey safe fetch', () => {
  it('sends exactly one song per request', async () => {
    const { fetchVkey } = await import('../../src/main/api/vkey')

    const result = await fetchVkey({ songMid: 'song-mid', filename: 'M500media.mp3', uin: '42' })

    expect(result).toEqual({ purl: 'purl', result: 0 })
    const [, , param] = musicuMock.mock.calls[0] as [
      string,
      string,
      { songmid: string[]; filename: string[]; uin: string; guid: string }
    ]
    expect(musicuMock.mock.calls[0][0]).toBe('vkey.GetVkeyServer')
    expect(param.songmid).toEqual(['song-mid'])
    expect(param.filename).toEqual(['M500media.mp3'])
    expect(param.uin).toBe('42')
    expect(param.guid).toBe('test-guid')
  })

  it('serializes concurrent requests with at least a 300ms gap', async () => {
    vi.useFakeTimers()
    const { fetchVkey } = await import('../../src/main/api/vkey')

    const first = fetchVkey({ songMid: 'a', filename: 'f-a', uin: '42' })
    const second = fetchVkey({ songMid: 'b', filename: 'f-b', uin: '42' })

    await vi.advanceTimersByTimeAsync(0)
    expect(musicuMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(299)
    expect(musicuMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(musicuMock).toHaveBeenCalledTimes(2)

    await Promise.all([first, second])
  })

  it('keeps the gate after a failed request', async () => {
    vi.useFakeTimers()
    const { fetchVkey } = await import('../../src/main/api/vkey')
    const { UpstreamError } = await import('../../src/main/api/client')
    musicuMock.mockRejectedValueOnce(new UpstreamError('UPSTREAM_NETWORK', 'boom', false, 104013))

    await expect(fetchVkey({ songMid: 'a', filename: 'f-a', uin: '42' })).rejects.toMatchObject({
      upstreamCode: 104013
    })

    const next = fetchVkey({ songMid: 'b', filename: 'f-b', uin: '42' })
    await vi.advanceTimersByTimeAsync(0)
    expect(musicuMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(300)
    expect(musicuMock).toHaveBeenCalledTimes(2)
    await next
  })

  it('falls back to UrlGetVkey on 104009 and trips the block only when both fail', async () => {
    const { fetchVkey } = await import('../../src/main/api/vkey')
    const { UpstreamError } = await import('../../src/main/api/client')
    musicuMock.mockImplementation(async (module: string, _method: string, param: unknown) => {
      if (module === 'vkey.GetVkeyServer') {
        throw new UpstreamError('UPSTREAM_NETWORK', '104009', false, 104009)
      }
      return vkeyResponse(param as { songmid: string[] }, 'fallback-purl')
    })

    const result = await fetchVkey({ songMid: 'song-mid', filename: 'M500media.mp3', uin: '42' })

    expect(result).toEqual({ purl: 'fallback-purl', result: 0 })
    expect(musicuMock.mock.calls.map((call) => call[0])).toEqual([
      'vkey.GetVkeyServer',
      'music.vkey.GetVkey'
    ])
    expect(tripBlockMock).not.toHaveBeenCalled()
  })
})
