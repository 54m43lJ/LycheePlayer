import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  current: { musicid: '100', musickey: 'old-key' } as Record<string, unknown> | null
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => store.current
}))

async function client() {
  return import('../../src/main/api/client')
}

function respond(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

beforeEach(() => {
  store.current = { musicid: '100', musickey: 'old-key' }
  vi.unstubAllGlobals()
})

afterEach(async () => {
  const { setCredentialRefresher } = await client()
  setCredentialRefresher(null)
  vi.unstubAllGlobals()
})

describe('api/client 登录失效自动续期', () => {
  it('refreshes once and retries the request with the new credential', async () => {
    const headers: string[] = []
    let calls = 0
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      headers.push(new Headers(init?.headers).get('cookie') ?? '')
      calls += 1
      if (calls === 1) return respond({ code: 0, req_0: { code: 1000, data: {} } })
      return respond({ code: 0, req_0: { code: 0, data: { ok: true } } })
    })
    const { musicu, setCredentialRefresher } = await client()
    const refresh = vi.fn(async () => {
      store.current = { musicid: '100', musickey: 'new-key' }
    })
    setCredentialRefresher(refresh)

    await expect(musicu<{ ok: boolean }>('test.Module', 'Test', {})).resolves.toEqual({
      ok: true
    })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(calls).toBe(2)
    expect(headers[1]).toContain('qm_keyst=new-key')
  })

  it('does not refresh when the caller supplied an explicit credential', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return respond({ code: 0, req_0: { code: 1000, data: {} } })
    })
    const { musicu, setCredentialRefresher } = await client()
    const refresh = vi.fn(async () => undefined)
    setCredentialRefresher(refresh)

    await expect(
      musicu('test.Module', 'Test', {}, { credential: null })
    ).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
    expect(refresh).not.toHaveBeenCalled()
    expect(calls).toBe(1)
  })

  it('keeps the original error when the refresh fails', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({ code: 0, req_0: { code: 1000, data: {} } })
    )
    const { musicu, setCredentialRefresher } = await client()
    const refresh = vi.fn(async () => {
      throw new Error('refresh failed')
    })
    setCredentialRefresher(refresh)

    await expect(musicu('test.Module', 'Test', {})).rejects.toMatchObject({
      code: 'AUTH_EXPIRED'
    })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('retries callers that hold their own credential', async () => {
    const { UpstreamError, setCredentialRefresher, withCredentialRefresh } =
      await client()
    const refresh = vi.fn(async () => {
      store.current = { musicid: '100', musickey: 'new-key' }
    })
    setCredentialRefresher(refresh)

    const result = await withCredentialRefresh(async (credential) => {
      if (credential.musickey === 'old-key') {
        throw new UpstreamError('AUTH_EXPIRED', 'expired')
      }
      return credential.musickey
    })

    expect(result).toBe('new-key')
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
