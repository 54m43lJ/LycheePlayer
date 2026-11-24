import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  handler: null as ((request: Request) => Promise<Response> | Response) | null,
  windows: [] as Array<{
    isDestroyed: () => boolean
    webContents: { send: (channel: string, payload: unknown) => void }
  }>,
  audioCacheEnabled: false
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/lychee-audio-test' },
  BrowserWindow: { getAllWindows: () => state.windows },
  net: { fetch: vi.fn() },
  protocol: {
    registerSchemesAsPrivileged: () => undefined,
    handle: (_scheme: string, handler: (request: Request) => Promise<Response> | Response) => {
      state.handler = handler
    }
  }
}))

vi.mock('../src/main/settings', () => ({
  getSettings: () => ({ audioCacheEnabled: state.audioCacheEnabled })
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
  state.windows = []
  state.audioCacheEnabled = false
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

  it('notifies cache stored once a complete response is written', async () => {
    const send = vi.fn()
    state.audioCacheEnabled = true
    state.windows = [{ isDestroyed: () => false, webContents: { send } }]
    const { net } = await import('electron')
    const bytes = new Uint8Array([1, 2, 3, 4])
    vi.mocked(net.fetch).mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'content-type': 'audio/mpeg', 'content-length': String(bytes.length) }
      })
    )

    const { audioStreamUrl, registerAudioProtocol } = await import(
      '../src/main/media/audio-protocol'
    )
    registerAudioProtocol()
    const response = await state.handler!(
      new Request(audioStreamUrl('https://example.test/audio', 'mid', '128k'))
    )
    await response.arrayBuffer()

    await vi.waitFor(() =>
      expect(send).toHaveBeenCalledWith('audioCache:stored', {
        songMid: 'mid',
        quality: '128k'
      })
    )
  })
})
