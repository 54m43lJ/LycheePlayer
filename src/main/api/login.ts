import type { Credential, QrSession, QrStatus } from '../../shared/types'
import { getCredential, saveCredential } from '../credential'
import { mapUpstreamCode, UpstreamError, upstreamRequest } from './client'
import { hash33 } from './hash'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const QR_TTL_MS = 2 * 60_000
const MAX_POLL_ERRORS = 6

interface LoginEvents {
  onStatus: (status: QrStatus) => void
  onCredential: (credential: Credential) => Promise<void>
}

interface QrState {
  qrsig: string
  timer: NodeJS.Timeout | null
  lastStatus: QrStatus['stage'] | null
  errors: number
  stopped: boolean
  expiresAt: number
}

interface PollResult {
  stage: 'waiting' | 'scanned' | 'expired' | 'ok'
  redirect?: string
}

let events: LoginEvents | null = null
let state: QrState | null = null

export function initLoginEvents(next: LoginEvents): void {
  events = next
}

function emitStatus(stage: QrStatus['stage'], message?: string): void {
  if (state?.lastStatus === stage && !message) return
  if (state) state.lastStatus = stage
  events?.onStatus(message ? { stage, message } : { stage })
}

export function stopPolling(): void {
  if (!state) return
  state.stopped = true
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  state = null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function setCookies(headers: Headers, jar: Record<string, string>): void {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  const combined = headers.get('set-cookie')
  const raw =
    withSetCookie.getSetCookie?.() ??
    (combined ? combined.split(/,\s*(?=[A-Za-z0-9_-]+=)/) : [])
  for (const item of raw) {
    const pair = item.split(';', 1)[0]
    const index = pair.indexOf('=')
    if (index <= 0) continue
    jar[pair.slice(0, index).trim()] = pair.slice(index + 1).trim()
  }
}

function cookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join('; ')
}

function parseQuotedArgs(text: string): string[] {
  return [...text.matchAll(/'((?:\\.|[^'])*)'/g)].map((match) => match[1])
}

async function getQrImage(): Promise<{ imageDataUrl: string; qrsig: string }> {
  const url = new URL('https://ssl.ptlogin2.qq.com/ptqrshow')
  const params: Record<string, string> = {
    appid: '716027609',
    e: '2',
    l: 'M',
    s: '3',
    d: '72',
    v: '4',
    t: String(Math.random()),
    daid: '383',
    pt_3rd_aid: '100497308'
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/'
    },
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) {
    throw new UpstreamError('UPSTREAM_NETWORK', `获取二维码失败：HTTP ${response.status}`)
  }
  const jar: Record<string, string> = {}
  setCookies(response.headers, jar)
  const qrsig = jar.qrsig
  if (!qrsig) {
    throw new UpstreamError('UPSTREAM_CHANGED', '二维码响应缺少 qrsig')
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  return {
    imageDataUrl: `data:image/png;base64,${buffer.toString('base64')}`,
    qrsig
  }
}

async function poll(qrsig: string): Promise<PollResult> {
  const url = new URL('https://ssl.ptlogin2.qq.com/ptqrlogin')
  const params: Record<string, string> = {
    u1: 'https://graph.qq.com/oauth2.0/login_jump',
    ptqrtoken: String(hash33(qrsig)),
    ptredirect: '0',
    h: '1',
    t: '1',
    g: '1',
    from_ui: '1',
    ptlang: '2052',
    action: `0-0-${Date.now()}`,
    js_ver: '20102616',
    js_type: '1',
    pt_uistyle: '40',
    aid: '716027609',
    daid: '383',
    pt_3rd_aid: '100497308',
    has_onekey: '1'
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/',
      Cookie: `qrsig=${qrsig}`
    },
    signal: AbortSignal.timeout(15_000)
  })
  const text = await response.text()
  const callback = [...text.matchAll(/ptuiCB\(([\s\S]*?)\)/g)].at(-1)
  const args = callback ? parseQuotedArgs(callback[1]) : []
  if (args.length < 3 || !/^\d+$/.test(args[0])) {
    throw new UpstreamError('UPSTREAM_CHANGED', '无法解析二维码轮询响应')
  }

  switch (args[0]) {
    case '0':
      return { stage: 'ok', redirect: args[2] }
    case '65':
    case '68':
      return { stage: 'expired' }
    case '67':
      return { stage: 'scanned' }
    case '66':
    default:
      return { stage: 'waiting' }
  }
}

function readParam(url: URL, key: string): string | null {
  const value = url.searchParams.get(key)
  return value && value.length > 0 ? value : null
}

interface CheckSigResult {
  jar: Record<string, string>
  status: number
}

async function fetchCheckSig(url: URL): Promise<CheckSigResult> {
  const jar: Record<string, string> = {}
  let current = url
  let status = 0

  // check_sig 成功时通常直接 302 并在 Set-Cookie 中带 p_skey；
  // 少数情况下 p_skey 会出现在后续跳转的响应上，因此手动跟随有限跳转并累积 cookie。
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, {
      redirect: 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://xui.ptlogin2.qq.com/',
        ...(cookieHeader(jar) ? { Cookie: cookieHeader(jar) } : {})
      },
      signal: AbortSignal.timeout(15_000)
    })
    status = response.status
    setCookies(response.headers, jar)

    const location = response.headers.get('location')
    if (!jar.p_skey && status >= 300 && status < 400 && location) {
      current = new URL(location, current)
      continue
    }
    break
  }

  return { jar, status }
}

async function requestOAuthCode(redirect: string): Promise<string> {
  const redirectUrl = new URL(redirect)
  console.info(`[login] 扫码成功，回调 ${redirectUrl.host}${redirectUrl.pathname}`)

  // 优先直接访问 ptqrlogin 返回的回调地址（与网页登录一致）。
  // 注意：不要携带 qrsig 等二维码 Cookie，回调地址本身已经绑定 ptsigx。
  let check = await fetchCheckSig(redirectUrl)

  if (!check.jar.p_skey) {
    const uin = readParam(redirectUrl, 'uin')
    const sigx = readParam(redirectUrl, 'ptsigx')
    if (!uin || !sigx) {
      throw new UpstreamError('UPSTREAM_CHANGED', '登录跳转缺少 uin / ptsigx')
    }

    const checkUrl = new URL('https://ssl.ptlogin2.graph.qq.com/check_sig')
    const checkParams: Record<string, string> = {
      uin,
      pttype: '1',
      service: 'ptqrlogin',
      nodirect: '0',
      ptsigx: sigx,
      s_url: 'https://graph.qq.com/oauth2.0/login_jump',
      ptlang: '2052',
      ptredirect: '100',
      aid: '716027609',
      daid: '383',
      j_later: '0',
      low_login_hour: '0',
      regmaster: '0',
      pt_login_type: '3',
      pt_aid: '0',
      pt_aaid: '16',
      pt_light: '0',
      pt_3rd_aid: '100497308'
    }
    for (const [key, value] of Object.entries(checkParams)) checkUrl.searchParams.set(key, value)
    check = await fetchCheckSig(checkUrl)
  }

  if (!check.jar.p_skey) {
    const cookieSummary = Object.entries(check.jar)
      .map(([key, value]) => `${key}(${value.length})`)
      .join(', ')
    if (check.jar.p_skey_forbid !== undefined) {
      throw new UpstreamError(
        'AUTH_EXPIRED',
        'QQ 安全校验未通过（p_skey_forbid）。请先在官方 QQ 音乐网页完成登录/设备验证，或使用 Cookie 登录'
      )
    }
    throw new UpstreamError(
      'AUTH_EXPIRED',
      `QQ 登录未返回 p_skey（check_sig HTTP ${check.status}；cookies: ${
        cookieSummary || 'none'
      }）`
    )
  }
  console.info(
    `[login] check_sig 完成：HTTP ${check.status}，cookies=[${Object.entries(check.jar)
      .map(([key, value]) => `${key}(${value.length})`)
      .join(',')}]`
  )

  return requestOAuthCodeWithCookies(check.jar)
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
    signal: AbortSignal.timeout(15_000)
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

async function authorizeQqQr(redirect: string): Promise<Credential> {
  const code = await requestOAuthCode(redirect)
  return exchangeQqLoginCode(code)
}

async function authorizeWithRetry(redirect: string): Promise<Credential> {
  try {
    return await authorizeQqQr(redirect)
  } catch (error) {
    if (error instanceof UpstreamError && error.code === 'UPSTREAM_NETWORK') {
      return authorizeQqQr(redirect)
    }
    throw error
  }
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
      : Date.now() + 6 * 60 * 60_000

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
      ? current.expiredAtMs - now <= 10 * 60_000
      : now - lastRefreshAt >= 6 * 60 * 60_000)
  if (!due) return Promise.resolve()
  return refreshSession()
    .then(() => undefined)
    .catch((error) => {
      console.warn(`[login] 会话续期失败：${errorMessage(error)}`)
    })
}

function schedulePoll(delay: number): void {
  if (!state || state.stopped) return
  state.timer = setTimeout(() => {
    void runPoll()
  }, delay)
}

function failLogin(error: unknown): void {
  const message = errorMessage(error)
  console.error(`[login] 登录失败：${message}`)
  emitStatus('failed', message)
  stopPolling()
}

async function runPoll(): Promise<void> {
  const snapshot = state
  if (!snapshot || snapshot.stopped) return
  try {
    const result = await poll(snapshot.qrsig)
    if (state !== snapshot || snapshot.stopped) return
    snapshot.errors = 0

    if (result.stage === 'ok') {
      emitStatus('scanned')
      try {
        const credential = await authorizeWithRetry(result.redirect!)
        if (state !== snapshot) return
        await events?.onCredential(credential)
        if (state !== snapshot) return
        emitStatus('ok')
        stopPolling()
      } catch (error) {
        failLogin(error)
      }
      return
    }

    if (result.stage === 'expired') {
      emitStatus('expired')
      stopPolling()
      return
    }

    emitStatus(result.stage)
    schedulePoll(result.stage === 'scanned' ? 1000 : 1800)
  } catch (error) {
    if (!state || state !== snapshot || snapshot.stopped) return
    snapshot.errors += 1
    console.warn(
      `[login] 二维码轮询失败（${snapshot.errors}/${MAX_POLL_ERRORS}）：${errorMessage(error)}`
    )
    if (Date.now() >= snapshot.expiresAt || snapshot.errors >= MAX_POLL_ERRORS) {
      emitStatus('expired')
      stopPolling()
      return
    }
    schedulePoll(2500)
  }
}

/** 创建 QQ 手机扫码登录会话，返回二维码图片并开始主进程轮询。 */
export async function createQrKey(): Promise<QrSession> {
  stopPolling()
  const { imageDataUrl, qrsig } = await getQrImage()
  const expiresAt = Date.now() + QR_TTL_MS
  state = {
    qrsig,
    timer: null,
    lastStatus: null,
    errors: 0,
    stopped: false,
    expiresAt
  }
  emitStatus('waiting')
  schedulePoll(800)
  return { imageDataUrl, expiresAtMs: expiresAt }
}

function parseCookieString(cookie: string): { uin: string; key: string } {
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
  return { uin, key }
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
  const { uin, key } = parseCookieString(cookie)
  if (!/^\d+$/.test(uin) || !key) {
    throw new UpstreamError('AUTH_EXPIRED', 'Cookie 缺少有效的 uin 或 qm_keyst')
  }
  const credential: Credential = { musicid: uin, musickey: key, expiredAtMs: null }
  const probe = await probeCredential(credential)
  if (probe !== 'ok') {
    throw new UpstreamError('AUTH_EXPIRED', 'Cookie 已失效，请重新获取')
  }
  return credential
}
