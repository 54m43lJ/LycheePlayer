import type { Credential } from '../../shared/types'
import { OAUTH_TIMEOUT_MS, SESSION_REFRESH_AHEAD_MS, SESSION_REFRESH_FALLBACK_MS } from '../../shared/constants'
import { getCredential, saveCredential } from '../credential'
import { mapUpstreamCode, UpstreamError, upstreamRequest } from './client'
import { hash33 } from './hash'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

/**
 * 用已含 p_skey 的 Cookie 完成 OAuth authorize，返回 code。
 * 官方扫码组件在 graph.qq.com/oauth2.0/login_jump 结束后会留下这组 Cookie。
 */
export async function requestOAuthCodeWithCookies(
  jar: Record<string, string>
): Promise<string> {
  if (!jar.p_skey) {
    throw new UpstreamError('AUTH_EXPIRED', '缺少 p_skey，无法完成 QQ 授权')
  }
  const authorizeUrl = new URL('https://graph.qq.com/oauth2.0/authorize')
  const form = new URLSearchParams({
    response_type: 'code',
    client_id: '100497308',
    redirect_uri:
      'https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/',
    scope: 'get_user_info,get_app_friends',
    state: 'state',
    switch: '',
    from_ptlogin: '1',
    src: '1',
    update_auth: '1',
    openapi: '1010_1030',
    g_tk: String(hash33(jar.p_skey, 5381)),
    auth_time: String(Date.now()),
    ui: crypto.randomUUID()
  })

  const authorizeResponse = await fetch(authorizeUrl, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar)
    },
    body: form.toString(),
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS)
  })

  const location = authorizeResponse.headers.get('location') ?? ''
  const code = location
    ? new URL(location, 'https://graph.qq.com').searchParams.get('code')
    : null
  console.info(
    `[login] oauth authorize：HTTP ${authorizeResponse.status}，code ${code ? '已返回' : '缺失'}`
  )
  if (!code) {
    throw new UpstreamError(
      'AUTH_EXPIRED',
      `QQ 授权未返回 code（HTTP ${authorizeResponse.status}）`
    )
  }
  return code
}

export async function exchangeQqLoginCode(code: string): Promise<Credential> {
  const payload = {
    comm: { tmeLoginType: 2 },
    req: {
      module: 'QQConnectLogin.LoginServer',
      method: 'QQLogin',
      param: { code }
    }
  }
  const response = await upstreamRequest<{
    code: number
    req?: { code: number; data?: Record<string, unknown>; message?: string }
    req_0?: { code: number; data?: Record<string, unknown>; message?: string }
  }>({
    host: 'https://u.y.qq.com',
    path: '/cgi-bin/musicu.fcg',
    params: {},
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_0 like Mac OS X)',
      Referer: 'https://y.qq.com/'
    },
    body: JSON.stringify(payload),
    credential: null
  })

  const node = response.req ?? response.req_0
  if (response.code !== 0) {
    throw mapUpstreamCode(response.code, 'QQConnectLogin.LoginServer.QQLogin')
  }
  if (!node) {
    throw new UpstreamError('UPSTREAM_CHANGED', 'QQLogin 响应缺少 req')
  }
  if (node.code !== 0) {
    throw mapUpstreamCode(node.code, 'QQConnectLogin.LoginServer.QQLogin')
  }
  if (!node.data) {
    throw new UpstreamError('UPSTREAM_CHANGED', 'QQLogin 响应缺少 data')
  }
  console.info('[login] QQLogin 成功，正在解析凭证')
  return parseLoginCredential(node.data)
}

function findCredentialPayload(value: unknown, depth = 0): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || depth > 4) return null
  const record = value as Record<string, unknown>
  if (typeof record.musickey === 'string' && record.musickey.length > 0) return record
  for (const key of ['data', 'credential', 'result']) {
    const found = findCredentialPayload(record[key], depth + 1)
    if (found) return found
  }
  return null
}

function parseLoginCredential(data: unknown): Credential {
  const payload = findCredentialPayload(data)
  if (!payload) {
    throw new UpstreamError('UPSTREAM_CHANGED', '登录响应缺少 musickey')
  }
  const rawId = payload.str_musicid ?? payload.musicid ?? payload.uin ?? payload.qq
  const musicid = String(rawId ?? '').replace(/^o/, '')
  const musickey = String(payload.musickey ?? '')
  if (!/^\d+$/.test(musicid) || !musickey) {
    throw new UpstreamError('UPSTREAM_CHANGED', '登录响应凭证字段无效')
  }

  const expiresIn = Number(payload.keyExpiresIn ?? 0)
  const createdAt = Number(payload.musickeyCreateTime ?? 0)
  const createdAtMs = createdAt > 1_000_000_000_000 ? createdAt : createdAt * 1000
  const expiredAtMs =
    createdAtMs > 0 && expiresIn > 0 ? createdAtMs + expiresIn * 1000 : null

  return {
    musicid,
    musickey,
    expiredAtMs,
    refreshKey: typeof payload.refresh_key === 'string' ? payload.refresh_key : undefined,
    refreshToken:
      typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    accessToken: typeof payload.access_token === 'string' ? payload.access_token : undefined,
    openid: typeof payload.openid === 'string' ? payload.openid : undefined,
    unionid: typeof payload.unionid === 'string' ? payload.unionid : undefined,
    loginType: Number.isFinite(Number(payload.loginType))
      ? Number(payload.loginType)
      : undefined
  }
}

interface RefreshResponse {
  code?: number
  req_0?: { code?: number; data?: Record<string, unknown> }
  req?: { code?: number; data?: Record<string, unknown> }
}

/**
 * 用 refresh_token 续期，返回新的完整凭证。
 * 对应 music.login.LoginServer/Login（loginMode=2），musickey 有效期约 72 小时。
 */
async function refreshMusickey(current: Credential): Promise<Credential> {
  if (!current.refreshToken) {
    throw new UpstreamError('AUTH_EXPIRED', '当前凭证缺少 refresh_token，请重新登录')
  }

  const param = {
    openid: current.openid ?? '',
    access_token: current.accessToken ?? '',
    refresh_token: current.refreshToken,
    expired_in: current.expiredAtMs ? Math.floor(current.expiredAtMs / 1000) : 0,
    musicid: Number(current.musicid),
    musickey: current.musickey,
    refresh_key: current.refreshKey ?? '',
    loginMode: 2
  }
  const response = await upstreamRequest<RefreshResponse>({
    host: 'https://u.y.qq.com',
    path: '/cgi-bin/musicu.fcg',
    params: {},
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      Referer: 'https://y.qq.com/'
    },
    body: JSON.stringify({
      comm: {
        tmeLoginType: current.loginType ?? 2,
        ct: 11,
        cv: 20_090_008,
        tmeAppID: 'qqmusic'
      },
      req_0: {
        module: 'music.login.LoginServer',
        method: 'Login',
        param
      }
    }),
    credential: current
  })

  const node = response.req_0 ?? response.req
  if ((response.code ?? 0) !== 0) {
    throw mapUpstreamCode(response.code ?? 0, 'music.login.LoginServer.Login(refresh)')
  }
  if (!node) {
    throw new UpstreamError('UPSTREAM_CHANGED', '续期响应缺少 req_0')
  }
  if ((node.code ?? 0) !== 0) {
    throw mapUpstreamCode(node.code ?? 0, 'music.login.LoginServer.Login(refresh)')
  }
  const data = node.data
  if (!data?.musickey) {
    throw new UpstreamError('UPSTREAM_CHANGED', '续期响应缺少 musickey')
  }

  const createdAt = Number(data.musickeyCreateTime ?? 0)
  const expiresIn = Number(data.keyExpiresIn ?? 0)
  const createdAtMs = createdAt > 1_000_000_000_000 ? createdAt : createdAt * 1000
  const expiredAtMs =
    createdAtMs > 0 && expiresIn > 0
      ? createdAtMs + expiresIn * 1000
      : Date.now() + SESSION_REFRESH_FALLBACK_MS

  const merged: Credential = {
    ...current,
    musickey: String(data.musickey),
    expiredAtMs
  }
  if (typeof data.refresh_token === 'string' && data.refresh_token.length > 0) {
    merged.refreshToken = data.refresh_token
  }
  if (typeof data.access_token === 'string' && data.access_token.length > 0) {
    merged.accessToken = data.access_token
  }
  if (typeof data.openid === 'string' && data.openid.length > 0) merged.openid = data.openid
  if (typeof data.unionid === 'string' && data.unionid.length > 0) merged.unionid = data.unionid
  if (typeof data.refresh_key === 'string' && data.refresh_key.length > 0) {
    merged.refreshKey = data.refresh_key
  }
  if (Number.isFinite(Number(data.loginType))) merged.loginType = Number(data.loginType)
  return merged
}

let lastRefreshAt = 0
let refreshPromise: Promise<Credential> | null = null

/** 立即用当前 musicid + musickey 续期并写回凭证。 */
export function refreshSession(): Promise<Credential> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const current = getCredential()
    if (!current) {
      throw new UpstreamError('AUTH_EXPIRED', '未登录，无法续期')
    }
    const refreshed = await refreshMusickey(current)
    await saveCredential(refreshed)
    lastRefreshAt = Date.now()
    console.info(
      `[login] 会话已自动续期，新 musickey ${refreshed.musickey.length} 字符`
    )
    return refreshed
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/**
 * 到期前 10 分钟或每 6 小时续期一次；无过期时间时启动后先续期一次。
 * 上游若拒绝续期，保留旧凭证并等待下一次重试。
 */
export function refreshIfNeeded(force = false): Promise<void> {
  const current = getCredential()
  if (!current) return Promise.resolve()
  const now = Date.now()
  const due =
    force ||
    (current.expiredAtMs !== null
      ? current.expiredAtMs - now <= SESSION_REFRESH_AHEAD_MS
      : now - lastRefreshAt >= SESSION_REFRESH_FALLBACK_MS)
  if (!due) return Promise.resolve()
  return refreshSession()
    .then(() => undefined)
    .catch((error) => {
      console.warn(`[login] 会话续期失败：${errorMessage(error)}`)
    })
}

function parseCookieString(cookie: string): { uin: string; key: string; jar: Record<string, string> } {
  const jar: Record<string, string> = {}
  for (const chunk of cookie.split(/[\n;]+/)) {
    const pair = chunk.trim()
    const index = pair.indexOf('=')
    if (index <= 0) continue
    const key = pair.slice(0, index).trim()
    let value = pair.slice(index + 1).trim()
    try {
      value = decodeURIComponent(value)
    } catch {
      // 保留原值
    }
    jar[key] = value
  }

  const rawUin = jar.uin ?? jar.qqmusic_uin ?? jar.wxuin ?? jar.p_uin ?? ''
  const uin = rawUin.replace(/^o/, '').replace(/^0+(?=\d)/, '')
  const key = jar.qm_keyst ?? jar.qqmusic_key ?? jar.musickey ?? jar.music_key ?? ''
  return { uin, key, jar }
}

interface ProfileProbe {
  code?: number
  data?: { creator?: unknown }
}

async function probeCredential(credential: Credential): Promise<'ok' | 'expired'> {
  const data = await upstreamRequest<ProfileProbe>({
    host: 'https://c6.y.qq.com',
    path: '/rsc/fcgi-bin/fcg_get_profile_homepage.fcg',
    params: {
      g_tk: String(hash33(credential.musickey, 5381)),
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      notice: '0',
      cid: '205360838',
      needNewCode: '0',
      loginUin: credential.musicid,
      hostUin: '0',
      userid: credential.musicid,
      reqfrom: '1'
    },
    credential
  })
  if ((data.code ?? 0) === 0) return 'ok'
  return 'expired'
}

/** Cookie 兜底登录：解析 uin / qm_keyst 并向资料接口验证。 */
export async function loginWithCookie(cookie: string): Promise<Credential> {
  const { uin, key, jar } = parseCookieString(cookie)
  if (!/^\d+$/.test(uin) || !key) {
    throw new UpstreamError('AUTH_EXPIRED', 'Cookie 缺少有效的 uin 或 qm_keyst')
  }
  const credential: Credential = {
    musicid: uin,
    musickey: key,
    expiredAtMs: null,
    webCookies: jar
  }
  const probe = await probeCredential(credential)
  if (probe !== 'ok') {
    throw new UpstreamError('AUTH_EXPIRED', 'Cookie 已失效，请重新获取')
  }
  return credential
}
