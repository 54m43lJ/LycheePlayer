import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  saved: [] as Array<Record<string, unknown>>
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => store.current,
  saveCredential: async (credential: Record<string, unknown>) => {
    store.current = credential
    store.saved.push(credential)
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
    musicid: '100',
    musickey: 'old-key',
    expiredAtMs: Date.now() + 60_000,
    refreshToken: 'old-refresh',
    loginType: 2
  }
}

beforeEach(() => {
  store.current = baseCredential()
  store.saved = []
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

    const { refreshSession } = await import('../../src/main/api/login')
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
  })

  it('falls back to the refresh_token flow when QQLogin is rejected', async () => {
    const bodies: Array<Record<string, any>> = []
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      bodies.push(bodyOf(init))
      if (bodies.length === 1) {
        return respond({ code: 0, req_0: { code: 1000, data: {} } })
      }
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            musickey: 'token-new-key',
            refresh_token: 'new-refresh',
            keyExpiresIn: 259_200,
            musickeyCreateTime: 1_700_000_000
          }
        }
      })
    })

    const { refreshSession } = await import('../../src/main/api/login')
    const next = await refreshSession()

    expect(bodies).toHaveLength(2)
    expect(bodies[1]?.req_0).toMatchObject({
      module: 'music.login.LoginServer',
      method: 'Login',
      param: {
        refresh_token: 'old-refresh',
        musickey: 'old-key'
      }
    })
    expect(next.musickey).toBe('token-new-key')
    expect(next.refreshToken).toBe('new-refresh')
  })

  it('uses the token flow first for WeChat credentials', async () => {
    store.current = {
      ...baseCredential(),
      musickey: 'W_X-old-key',
      loginType: 1
    }
    const bodies: Array<Record<string, any>> = []
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      bodies.push(bodyOf(init))
      return respond({
        code: 0,
        req_0: { code: 0, data: { musickey: 'wx-new-key' } }
      })
    })

    const { refreshSession } = await import('../../src/main/api/login')
    const next = await refreshSession()

    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.req_0?.module).toBe('music.login.LoginServer')
    expect(next.musickey).toBe('wx-new-key')
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
