import type { Credential, QrSession, QrStatus } from '../../shared/types'
import { musicu, UpstreamError, upstreamRequest } from './client'
import { hash33 } from './hash'

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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
}

let events: LoginEvents | null = null
let state: QrState | null = null

export function initLoginEvents(next: LoginEvents): void {
  events = next
}

function emitStatus(stage: QrStatus['stage']): void {
  if (state?.lastStatus === stage) return
  if (state) state.lastStatus = stage
  events?.onStatus({ stage })
}

export function stopPolling(): void {
  if (!state) return
  state.stopped = true
  if (state.timer) clearTimeout(state.timer)
  state.timer = null
  state = null
}

function setCookies(headers: Headers, jar: Record<string, string>): void {
  const withSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  const raw = withSetCookie.getSetCookie?.() ?? (headers.get('set-cookie') ? [headers.get('set-cookie')!] : [])
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

async function poll(qrsig: string): Promise<{ stage: 'waiting' | 'scanned' | 'expired' | 'ok'; redirect?: string }> {
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
  const args = parseQuotedArgs(text)
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

function readCookieValue(url: URL, key: string): string | null {
  const value = url.searchParams.get(key)
  return value && value.length > 0 ? value : null
}

async function authorizeQqQr(redirect: string): Promise<Credential> {
  const redirectUrl = new URL(redirect)
  const uin = readCookieValue(redirectUrl, 'uin')
  const sigx = readCookieValue(redirectUrl, 'ptsigx')
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

  const checkResponse = await fetch(checkUrl, {
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://xui.ptlogin2.qq.com/'
    },
    signal: AbortSignal.timeout(15_000)
  })
  const jar: Record<string, string> = {}
  setCookies(checkResponse.headers, jar)
  if (!jar.p_skey) {
    throw new UpstreamError('UPSTREAM_CHANGED', 'QQ 登录未返回 p_skey')
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
      Referer: 'https://graph.qq.com/',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar)
    },
    body: form.toString(),
    signal: AbortSignal.timeout(15_000)
  })

  const location = authorizeResponse.headers.get('location') ?? ''
  const code = new URL(location, 'https://graph.qq.com').searchParams.get('code')
  if (!code) {
    throw new UpstreamError('UPSTREAM_CHANGED', 'QQ 授权未返回 code')
  }

  const data = await musicu<Record<string, unknown>>(
    'QQConnectLogin.LoginServer',
    'QQLogin',
    { code },
    { comm: { tmeLoginType: 2 }, credential: null }
  )
  return parseLoginCredential(data)
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
  const expiredAtMs =
    createdAt > 0 && expiresIn > 0 ? (createdAt + expiresIn) * 1000 : null

  return { musicid, musickey, expiredAtMs }
}

function schedulePoll(delay: number): void {
  if (!state || state.stopped) return
  state.timer = setTimeout(() => {
    void runPoll()
  }, delay)
}

async function runPoll(): Promise<void> {
  if (!state || state.stopped) return
  try {
    const result = await poll(state.qrsig)
    if (state.stopped) return
    state.errors = 0
    if (result.stage === 'ok') {
      emitStatus('scanned')
      const credential = await authorizeQqQr(result.redirect!)
      await events?.onCredential(credential)
      emitStatus('ok')
      stopPolling()
      return
    }
    if (result.stage === 'expired') {
      emitStatus('expired')
      stopPolling()
      return
    }
    emitStatus(result.stage)
    schedulePoll(result.stage === 'scanned' ? 1000 : 1800)
  } catch {
    if (!state || state.stopped) return
    state.errors += 1
    if (state.errors >= 3) {
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
  state = {
    qrsig,
    timer: null,
    lastStatus: null,
    errors: 0,
    stopped: false
  }
  emitStatus('waiting')
  schedulePoll(800)
  return { imageDataUrl, expiresAtMs: Date.now() + 2 * 60_000 }
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
