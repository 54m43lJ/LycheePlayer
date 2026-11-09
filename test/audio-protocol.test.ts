import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  handler: null as ((request: Request) => Promise<Response> | Response) | null
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/lychee-audio-test' },
  BrowserWindow: { getAllWindows: () => [] },
  net: { fetch: vi.fn() },
  protocol: {
    registerSchemesAsPrivileged: () => undefined,
    handle: (_scheme: string, handler: (request: Request) => Promise<Response> | Response) => {
      state.handler = handler
    }
  }
}))

vi.mock('../src/main/settings', () => ({
  getSettings: () => ({ audioCacheEnabled: false })
}))

vi.mock('../src/main/cache/audio', () => ({
  getCachedAudio: () => null,
  putCachedAudio: async () => undefined
}))

const unhandled: unknown[] = []
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason)
}

beforeEach(() => {
  unhandled.length = 0
  process.on('unhandledRejection', onUnhandled)
})

afterEach(() => {
  process.off('unhandledRejection', onUnhandled)
})

describe('audio protocol', () => {
  it('swallows reader.cancel rejection after the upstream connection closes', async () => {
    const { net } = await import('electron')
    const fetchMock = vi.mocked(net.fetch)
    const upstream = new ReadableStream<Uint8Array>({
      pull: () => undefined,
      cancel: () => Promise.reject(new Error('net::ERR_CONNECTION_CLOSED'))
    })
    fetchMock.mockResolvedValue(
      new Response(upstream, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'content-length': '1000' }
      })
    )

    const { audioStreamUrl, registerAudioProtocol } = await import(
      '../src/main/media/audio-protocol'
    )
    registerAudioProtocol()
    expect(state.handler).not.toBeNull()
    const response = await state.handler!(
      new Request(audioStreamUrl('https://example.test/audio', 'mid', '128k'))
    )
    expect(response.body).not.toBeNull()

    await response.body!.cancel('seek')
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(unhandled).toEqual([])
  })
})
