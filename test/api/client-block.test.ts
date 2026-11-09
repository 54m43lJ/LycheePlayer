import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/opencode', getAppPath: () => '/tmp/opencode' },
  safeStorage: { isEncryptionAvailable: () => false }
}))

const notifier = vi.fn()

async function client() {
  return import('../../src/main/api/client')
}

beforeEach(async () => {
  const { resetUpstreamBlock, setUpstreamBlockNotifier } = await client()
  resetUpstreamBlock()
  setUpstreamBlockNotifier(notifier)
  notifier.mockReset()
})

afterEach(async () => {
  const { resetUpstreamBlock, setUpstreamBlockNotifier } = await client()
  resetUpstreamBlock()
  setUpstreamBlockNotifier(null)
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('api/client 104009 global block', () => {
  it('trips the block on 104009 and cuts off every following upstream request', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      calls.push(String(url))
      return new Response(JSON.stringify({ code: 0, req_0: { code: 104009, data: {} } }), {
        status: 200
      })
    })
    const { musicu, upstreamRequest, upstreamBlockRemainingMs } = await client()

    await expect(musicu('vkey.GetVkeyServer', 'CgiGetVkey', {})).rejects.toMatchObject({
      code: 'UPSTREAM_NETWORK',
      upstreamCode: 104009
    })
    expect(notifier).toHaveBeenCalledTimes(1)
    expect(upstreamBlockRemainingMs()).toBeGreaterThan(0)

    const before = calls.length
    await expect(
      upstreamRequest({ host: 'https://u.y.qq.com', path: '/cgi-bin/musicu.fcg', params: {} })
    ).rejects.toMatchObject({
      code: 'UPSTREAM_NETWORK',
      message: expect.stringContaining('已暂停')
    })
    // 截断窗口内不再发起网络请求，直接失败。
    expect(calls).toHaveLength(before)
  })

  it('does not notify twice while already blocked', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const { tripUpstreamBlock, upstreamBlockRemainingMs } = await client()

    tripUpstreamBlock()
    tripUpstreamBlock()

    expect(notifier).toHaveBeenCalledTimes(1)
    expect(upstreamBlockRemainingMs()).toBe(60_000)

    vi.setSystemTime(new Date('2026-01-01T00:01:01Z'))
    expect(upstreamBlockRemainingMs()).toBe(0)
  })

  it('can defer the block while vkey tries its fallback endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ code: 0, req_0: { code: 104009, data: {} } }), {
          status: 200
        })
    )
    const { musicu, upstreamBlockRemainingMs } = await client()

    await expect(
      musicu('vkey.GetVkeyServer', 'CgiGetVkey', {}, { deferBlock: true })
    ).rejects.toMatchObject({ upstreamCode: 104009 })

    expect(notifier).not.toHaveBeenCalled()
    expect(upstreamBlockRemainingMs()).toBe(0)
  })
})
