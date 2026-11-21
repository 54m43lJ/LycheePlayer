import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  saved: [] as Array<Record<string, unknown>>,
  reauthReason: null as string | null
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => store.current,
  saveCredential: async (credential: Record<string, unknown>) => {
    store.current = credential
    store.saved.push(credential)
    store.reauthReason = null
  },
  setReauthReason: (reason: string | null) => {
    store.reauthReason = reason
  }
}))

function respond(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

function bodyOf(init?: RequestInit): Record<string, any> {
  return JSON.parse(String(init?.body ?? '{}')) as Record<string, any>
}

function baseCredential(): Record<string, unknown> {
  return {
    method: 'qq',
    musicid: '100',
    musickey: 'old-key',
    expiredAtMs: Date.now() + 60_000,
    refreshToken: 'old-refresh'
  }
}

beforeEach(async () => {
  store.current = baseCredential()
  store.saved = []
  store.reauthReason = null
  vi.unstubAllGlobals()
  const { resetRefreshState } = await import('../../src/main/api/login')
  resetRefreshState()
})

afterEach(async () => {
  const { resetRefreshState } = await import('../../src/main/api/login')
  resetRefreshState()
  vi.unstubAllGlobals()
})

describe('api/login 自动续期', () => {
  it('prefers QQLogin refresh with the old musickey', async () => {
    const bodies: Array<Record<string, any>> = []
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      bodies.push(bodyOf(init))
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            musickey: 'qq-new-key',
            keyExpiresIn: 259_200,
            musickeyCreateTime: 1_700_000_000
          }
        }
      })
    })

    const { getRefreshState, refreshSession } = await import('../../src/main/api/login')
    const next = await refreshSession()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.req_0).toMatchObject({
      module: 'QQConnectLogin.LoginServer',
      method: 'QQLogin',
      param: {
        expired_in: 7_776_000,
        musicid: '100',
        musickey: 'old-key'
      }
    })
    expect(next.musickey).toBe('qq-new-key')
    expect(next.expiredAtMs).toBe((1_700_000_000 + 259_200) * 1000)
    expect(store.current?.musickey).toBe('qq-new-key')
    expect(store.saved).toHaveLength(1)
    expect(getRefreshState()).toBe('ok')
    expect(store.reauthReason).toBeNull()
  })

  it('does not fall back to the token flow when QQLogin is rejected', async () => {
    const bodies: Array<Record<string, any>> = []
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      bodies.push(bodyOf(init))
      return respond({ code: 0, req_0: { code: 1000, data: {} } })
    })

    const { getRefreshState, refreshSession } = await import('../../src/main/api/login')
    await expect(refreshSession()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })

    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.req_0?.module).toBe('QQConnectLogin.LoginServer')
    expect(store.current?.musickey).toBe('old-key')
    expect(store.saved).toHaveLength(0)
    expect(getRefreshState()).toBe('auth-failed')
    expect(store.reauthReason).toBe('auth-failed')
  })

  it('uses only the token flow for WeChat credentials', async () => {
    store.current = {
      ...baseCredential(),
      method: 'wechat',
      musickey: 'W_X-old-key'
    }
    const bodies: Array<Record<string, any>> = []
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      bodies.push(bodyOf(init))
      return respond({
        code: 0,
        req_0: { code: 0, data: { musickey: 'wx-new-key' } }
      })
    })

    const { getRefreshState, refreshSession } = await import('../../src/main/api/login')
    const next = await refreshSession()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.req_0?.module).toBe('music.login.LoginServer')
    expect(bodies[0]?.comm?.tmeLoginType).toBe(1)
    expect(bodies[0]?.req_0?.param).toMatchObject({
      refresh_token: 'old-refresh',
      str_musicid: '100'
    })
    expect(next.musickey).toBe('wx-new-key')
    expect(getRefreshState()).toBe('ok')
  })

  it('keeps the credential and reports temp-failed on network errors', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('network down')
    })

    const { getRefreshState, refreshSession } = await import('../../src/main/api/login')
    await expect(refreshSession()).rejects.toMatchObject({ code: 'UPSTREAM_NETWORK' })

    expect(store.current?.musickey).toBe('old-key')
    expect(store.saved).toHaveLength(0)
    expect(getRefreshState()).toBe('temp-failed')
    expect(store.reauthReason).toBeNull()
  })

  it('pauses automatic retry after auth-failed', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return respond({ code: 0, req_0: { code: 1000, data: {} } })
    })

    const { refreshIfNeeded, refreshSession } = await import('../../src/main/api/login')
    await expect(refreshSession()).rejects.toMatchObject({ code: 'AUTH_EXPIRED' })
    expect(calls).toBe(1)

    store.current = { ...baseCredential(), expiredAtMs: Date.now() - 1 }
    await refreshIfNeeded()
    expect(calls).toBe(1)
  })

  it('only refreshes when the expiry window is reached', async () => {
    const fetchMock = vi.fn(async () =>
      respond({
        code: 0,
        req_0: { code: 0, data: { musickey: 'new-key' } }
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    const { refreshIfNeeded } = await import('../../src/main/api/login')

    store.current = { ...baseCredential(), expiredAtMs: Date.now() + 60 * 60_000 }
    await refreshIfNeeded()
    expect(fetchMock).not.toHaveBeenCalled()

    store.current = { ...baseCredential(), expiredAtMs: Date.now() - 1 }
    await refreshIfNeeded()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
