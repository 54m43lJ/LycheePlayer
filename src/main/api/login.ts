import type { Credential, LoginMethod, RefreshState } from '../../shared/types'
import {
  OAUTH_TIMEOUT_MS,
  SESSION_REFRESH_AHEAD_MS,
  SESSION_REFRESH_EXPIRED_IN,
  SESSION_REFRESH_FALLBACK_MS,
  SESSION_REFRESH_RETRY_BASE_MS,
  SESSION_REFRESH_RETRY_MAX_MS,
  WECHAT_LOGIN_APP_ID
} from '../../shared/constants'
import { getCredential, saveCredential, setReauthReason } from '../credential'
import {
  assertUpstreamAvailable,
  mapUpstreamCode,
  setCredentialRefresher,
  throttleUpstream,
  UpstreamError,
  upstreamRequest
} from './client'
import { hash33 } from './hash'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

let authStatusNotifier: (() => void) | null = null

/** 由 ipc 注册登录态广播；login 模块不直接依赖窗口层。 */
export function setAuthStatusNotifier(notifier: (() => void) | null): void {
  authStatusNotifier = notifier
}

function notifyAuthStatus(): void {
  authStatusNotifier?.()
}

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

  await throttleUpstream()
  assertUpstreamAvailable()
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
  return parseLoginCredential(node.data, 'qq')
}

/**
 * 微信扫码登录换证：官方网页 wx_redirect 使用同一接口，参数为 strAppid + code。
 * code 来自 open.weixin.qq.com 的回调 URL，单次有效。
 */
export async function exchangeWechatLoginCode(code: string): Promise<Credential> {
  const payload = {
    comm: { tmeAppID: 'qqmusic', tmeLoginType: '1' },
    req: {
      module: 'music.login.LoginServer',
      method: 'Login',
      param: { strAppid: WECHAT_LOGIN_APP_ID, code }
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
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
      Referer: 'https://y.qq.com/',
      Origin: 'https://y.qq.com',
      Cookie: 'login_type=2'
    },
    body: JSON.stringify(payload),
    credential: null,
    stringFields: ['musicid', 'str_musicid']
  })

  const node = response.req ?? response.req_0
  if (response.code !== 0) {
    throw mapUpstreamCode(response.code, 'music.login.LoginServer.Login(wx)')
  }
  if (!node) {
    throw new UpstreamError('UPSTREAM_CHANGED', '微信登录响应缺少 req')
  }
  if (node.code !== 0) {
    throw mapUpstreamCode(node.code, 'music.login.LoginServer.Login(wx)')
  }
  if (!node.data) {
    throw new UpstreamError('UPSTREAM_CHANGED', '微信登录响应缺少 data')
  }
  console.info('[login] 微信 Login 成功，正在解析凭证')
  return parseLoginCredential(node.data, 'wechat')
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

/** 解析登录响应；微信响应的到期字段可能是 expired_at，而不是 QQ 的 keyExpiresIn。 */
function parseLoginCredential(data: unknown, method: LoginMethod): Credential {
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
  let expiredAtMs =
    createdAtMs > 0 && expiresIn > 0 ? createdAtMs + expiresIn * 1000 : null
  if (expiredAtMs === null) {
    const rawExpiry = Number(payload.expired_at ?? payload.expiredAt ?? 0)
    if (Number.isFinite(rawExpiry) && rawExpiry > 0) {
      expiredAtMs =
        rawExpiry > 1_000_000_000_000
          ? rawExpiry
          : rawExpiry > 1_000_000_000
            ? rawExpiry * 1000
            : Date.now() + rawExpiry * 1000
    }
  }

  return {
    method,
    musicid,
    musickey,
    expiredAtMs,
    refreshKey: typeof payload.refresh_key === 'string' ? payload.refresh_key : undefined,
    refreshToken:
      typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    accessToken: typeof payload.access_token === 'string' ? payload.access_token : undefined,
    openid: typeof payload.openid === 'string' ? payload.openid : undefined,
    unionid: typeof payload.unionid === 'string' ? payload.unionid : undefined
  }
}

interface RefreshResponse {
  code?: number
  req_0?: { code?: number; data?: Record<string, unknown> }
  req?: { code?: number; data?: Record<string, unknown> }
}

function refreshResponseData(
  response: RefreshResponse,
  context: string
): Record<string, unknown> {
  const node = response.req_0 ?? response.req
  if ((response.code ?? 0) !== 0) {
    throw mapUpstreamCode(response.code ?? 0, context)
  }
  if (!node) {
    throw new UpstreamError('UPSTREAM_CHANGED', '续期响应缺少 req_0')
  }
  if ((node.code ?? 0) !== 0) {
    throw mapUpstreamCode(node.code ?? 0, context)
  }
  if (!node.data) {
    throw new UpstreamError('UPSTREAM_CHANGED', '续期响应缺少 data')
  }
  return node.data
}

/** 把续期响应合并回当前凭证；缺失的续期字段沿用旧值。 */
function mergeRefreshedCredential(
  current: Credential,
  data: Record<string, unknown>
): Credential {
  const payload = findCredentialPayload(data)
  if (!payload) {
    throw new UpstreamError('UPSTREAM_CHANGED', '续期响应缺少 musickey')
  }
  const musickey = String(payload.musickey ?? '')
  if (!musickey) {
    throw new UpstreamError('UPSTREAM_CHANGED', '续期响应缺少 musickey')
  }

  const createdAt = Number(payload.musickeyCreateTime ?? 0)
  const expiresIn = Number(payload.keyExpiresIn ?? 0)
  const createdAtMs = createdAt > 1_000_000_000_000 ? createdAt : createdAt * 1000
  const expiredAtMs =
    createdAtMs > 0 && expiresIn > 0
      ? createdAtMs + expiresIn * 1000
      : Date.now() + SESSION_REFRESH_FALLBACK_MS

  const merged: Credential = {
    ...current,
    musickey,
    expiredAtMs
  }
  const rawId = payload.str_musicid ?? payload.musicid ?? payload.uin ?? payload.qq
  const musicid = String(rawId ?? '').replace(/^o/, '')
  if (/^\d+$/.test(musicid)) merged.musicid = musicid
  if (typeof payload.refresh_token === 'string' && payload.refresh_token.length > 0) {
    merged.refreshToken = payload.refresh_token
  }
  if (typeof payload.access_token === 'string' && payload.access_token.length > 0) {
    merged.accessToken = payload.access_token
  }
  if (typeof payload.openid === 'string' && payload.openid.length > 0) {
    merged.openid = payload.openid
  }
  if (typeof payload.unionid === 'string' && payload.unionid.length > 0) {
    merged.unionid = payload.unionid
  }
  if (typeof payload.refresh_key === 'string' && payload.refresh_key.length > 0) {
    merged.refreshKey = payload.refresh_key
  }
  return merged
}

/** 上游 comm.tmeLoginType：QQ 网页登录为 2，微信登录为 1。 */
function tmeLoginType(method: LoginMethod): number {
  return method === 'wechat' ? 1 : 2
}

/**
 * QQ 网页登录的主续期路径：QQConnectLogin.LoginServer/QQLogin 接收旧 musickey，
 * 返回新的 musickey。它不依赖 refresh_token，旧 key 已过期时仍可尝试恢复。
 */
async function refreshViaQqLogin(current: Credential): Promise<Credential> {
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
      comm: { tmeLoginType: tmeLoginType('qq') },
      req_0: {
        module: 'QQConnectLogin.LoginServer',
        method: 'QQLogin',
        param: {
          expired_in: SESSION_REFRESH_EXPIRED_IN,
          musicid: current.musicid,
          musickey: current.musickey
        }
      }
    }),
    credential: current
  })
  return mergeRefreshedCredential(
    current,
    refreshResponseData(response, 'QQConnectLogin.LoginServer.QQLogin(refresh)')
  )
}

/**
 * 微信登录的续期路径：music.login.LoginServer/Login（loginMode=2）
 * 用 refresh_token 换新 musickey。
 */
async function refreshViaToken(current: Credential): Promise<Credential> {
  if (!current.refreshToken) {
    throw new UpstreamError('AUTH_EXPIRED', '当前凭证缺少 refresh_token，请重新登录')
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
        tmeLoginType: tmeLoginType(current.method),
        ct: 11,
        cv: 20_090_008,
        tmeAppID: 'qqmusic'
      },
      req_0: {
        module: 'music.login.LoginServer',
        method: 'Login',
        param: {
          openid: current.openid ?? '',
          unionid: current.unionid ?? '',
          access_token: current.accessToken ?? '',
          refresh_token: current.refreshToken,
          expired_in: current.expiredAtMs ? Math.floor(current.expiredAtMs / 1000) : 0,
          musicid: Number(current.musicid),
          str_musicid: current.musicid,
          musickey: current.musickey,
          refresh_key: current.refreshKey ?? '',
          loginMode: 2
        }
      }
    }),
    credential: current
  })
  return mergeRefreshedCredential(
    current,
    refreshResponseData(response, 'music.login.LoginServer.Login(refresh)')
  )
}

/** 按 method 严格分流：QQ 只走 QQLogin，微信只走 token 续期，不跨方式回退。 */
async function refreshMusickey(current: Credential): Promise<Credential> {
  if (current.method === 'wechat') {
    return refreshViaToken(current)
  }
  return refreshViaQqLogin(current)
}

let lastRefreshAt = 0
let refreshPromise: Promise<Credential> | null = null
let refreshState: RefreshState = 'ok'
let refreshRetryTimer: NodeJS.Timeout | null = null
let refreshRetryDelayMs = SESSION_REFRESH_RETRY_BASE_MS

export function getRefreshState(): RefreshState {
  return refreshState
}

function isAuthFailure(error: unknown): boolean {
  return error instanceof UpstreamError && error.code === 'AUTH_EXPIRED'
}

function clearRefreshRetry(): void {
  if (refreshRetryTimer) clearTimeout(refreshRetryTimer)
  refreshRetryTimer = null
}

function scheduleRefreshRetry(): void {
  if (refreshRetryTimer) return
  const delay = refreshRetryDelayMs
  refreshRetryDelayMs = Math.min(refreshRetryDelayMs * 2, SESSION_REFRESH_RETRY_MAX_MS)
  refreshRetryTimer = setTimeout(() => {
    refreshRetryTimer = null
    void refreshIfNeeded(true)
  }, delay)
  refreshRetryTimer.unref?.()
}

/** 登录成功或退出后重置续期状态；v1 清空不调用该入口。 */
export function resetRefreshState(): void {
  clearRefreshRetry()
  refreshState = 'ok'
  refreshRetryDelayMs = SESSION_REFRESH_RETRY_BASE_MS
  setReauthReason(null)
  notifyAuthStatus()
}

/** 立即用当前 musicid + musickey 续期并写回凭证。 */
export function refreshSession(): Promise<Credential> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    const current = getCredential()
    if (!current) {
      throw new UpstreamError('AUTH_EXPIRED', '未登录，无法续期')
    }
    try {
      const refreshed = await refreshMusickey(current)
      await saveCredential(refreshed)
      lastRefreshAt = Date.now()
      refreshState = 'ok'
      refreshRetryDelayMs = SESSION_REFRESH_RETRY_BASE_MS
      clearRefreshRetry()
      setReauthReason(null)
      notifyAuthStatus()
      console.info(
        `[login] 会话已自动续期，新 musickey ${refreshed.musickey.length} 字符`
      )
      return refreshed
    } catch (error) {
      if (isAuthFailure(error)) {
        refreshState = 'auth-failed'
        clearRefreshRetry()
        setReauthReason('auth-failed')
      } else if (refreshState !== 'auth-failed') {
        refreshState = 'temp-failed'
        scheduleRefreshRetry()
      }
      notifyAuthStatus()
      console.warn(
        `[login] 会话续期失败（${refreshState}）：${errorMessage(error)}`
      )
      throw error
    }
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

/**
 * 到期前 10 分钟或每 6 小时续期一次；无过期时间时启动后先续期一次。
 * auth-failed 暂停自动续期，temp-failed 由退避定时器静默重试；两者都保留旧凭证。
 */
export function refreshIfNeeded(force = false): Promise<void> {
  const current = getCredential()
  if (!current) return Promise.resolve()
  if (!force && refreshState === 'auth-failed') return Promise.resolve()
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

// 上游返回登录失效时，client 通过该入口自动续期一次并重试原请求。
setCredentialRefresher(refreshSession)
