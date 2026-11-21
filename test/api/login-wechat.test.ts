import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WECHAT_LOGIN_APP_ID } from '../../src/shared/constants'

vi.mock('../../src/main/credential', () => ({
  getCredential: () => null,
  saveCredential: async () => undefined,
  setReauthReason: () => undefined
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

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('api/login 微信换证', () => {
  it('exchanges the wx code with strAppid and parses the full credential', async () => {
    let requestBody: Record<string, any> = {}
    let headers = new Headers()
    vi.stubGlobal('fetch', async (_url: string | URL, init?: RequestInit) => {
      requestBody = bodyOf(init)
      headers = new Headers(init?.headers)
      return respond({
        code: 0,
        req: {
          code: 0,
          data: {
            musickey: 'W_X-new-key',
            str_musicid: '123456789',
            openid: 'wx-openid',
            unionid: 'wx-unionid',
            access_token: 'wx-access',
            refresh_token: 'wx-refresh',
            refresh_key: 'wx-refresh-key',
            expired_at: 1_893_456_000
          }
        }
      })
    })

    const { exchangeWechatLoginCode } = await import('../../src/main/api/login')
    const credential = await exchangeWechatLoginCode('wx-code-12345678')

    expect(requestBody).toMatchObject({
      comm: { tmeLoginType: '1', tmeAppID: 'qqmusic' },
      req: {
        module: 'music.login.LoginServer',
        method: 'Login',
        param: { strAppid: WECHAT_LOGIN_APP_ID, code: 'wx-code-12345678' }
      }
    })
    expect(headers.get('cookie')).toBe('login_type=2')
    expect(headers.get('content-type')).toBe('application/x-www-form-urlencoded')
    expect(credential).toMatchObject({
      method: 'wechat',
      musicid: '123456789',
      musickey: 'W_X-new-key',
      openid: 'wx-openid',
      unionid: 'wx-unionid',
      accessToken: 'wx-access',
      refreshToken: 'wx-refresh',
      refreshKey: 'wx-refresh-key',
      expiredAtMs: 1_893_456_000_000
    })
  })

  it('maps a rejected wx code to the upstream auth error', async () => {
    vi.stubGlobal('fetch', async () =>
      respond({ code: 0, req: { code: 1000, data: {} } })
    )

    const { exchangeWechatLoginCode } = await import('../../src/main/api/login')
    await expect(exchangeWechatLoginCode('wx-code-12345678')).rejects.toMatchObject({
      code: 'AUTH_EXPIRED'
    })
  })
})
