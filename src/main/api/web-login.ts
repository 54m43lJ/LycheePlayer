import { BrowserWindow, safeStorage, session, WebContentsView } from 'electron'
import type { Event as ElectronEvent, Session, WebContents } from 'electron'
import type { Credential, EmbedRect, LoginMethod } from '../../shared/types'
import { XLOGIN_URL } from '../../shared/xlogin'
import {
  LOGIN_ALLOWED_DOMAINS,
  LOGIN_COOKIE_POLL_MS,
  LOGIN_EMBED_PARTITION,
  LOGIN_EMBED_TIMEOUT_MS,
  WECHAT_LOGIN_APP_ID,
  WECHAT_LOGIN_PARTITION,
  WECHAT_LOGIN_REDIRECT_URI
} from '../../shared/constants'
import { UpstreamError } from './client'
import {
  exchangeQqLoginCode,
  exchangeWechatLoginCode,
  requestOAuthCodeWithCookies
} from './login'

function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return LOGIN_ALLOWED_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    )
  } catch {
    return false
  }
}

export { isAllowedHost }

function readCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    const code =
      parsed.searchParams.get('code') ??
      new URLSearchParams(parsed.hash.slice(1)).get('code')
    return code && code.length >= 8 ? code : null
  } catch {
    return null
  }
}

function extractQqCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    const wechatRedirect =
      parsed.hostname.endsWith('y.qq.com') &&
      parsed.pathname.endsWith('/wx_redirect.html') &&
      parsed.searchParams.get('login_type') === '2'
    if (wechatRedirect) return null
    return readCode(url)
  } catch {
    return null
  }
}

function extractWechatCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('y.qq.com')) return null
    if (!parsed.pathname.endsWith('/wx_redirect.html')) return null
    if (parsed.searchParams.get('login_type') !== '2') return null
    return readCode(url)
  } catch {
    return null
  }
}

function partitionFor(method: LoginMethod): string {
  return method === 'wechat' ? WECHAT_LOGIN_PARTITION : LOGIN_EMBED_PARTITION
}

/** 构建官方微信二维码页；redirect_uri 指向 QQ 音乐自己的换证页。 */
function loginUrlFor(method: LoginMethod): string {
  if (method === 'qq') return XLOGIN_URL
  const params = new URLSearchParams({
    appid: WECHAT_LOGIN_APP_ID,
    redirect_uri: WECHAT_LOGIN_REDIRECT_URI,
    response_type: 'code',
    scope: 'snsapi_login',
    state: crypto.randomUUID(),
    href: 'https://y.gtimg.cn/mediastyle/yqq/popup_wechat.css'
  })
  return `https://open.weixin.qq.com/connect/qrconnect?${params.toString()}#wechat_redirect`
}

async function clearLoginSession(target: Session): Promise<void> {
  try {
    await target.clearStorageData()
  } catch {
    // 清理失败不阻塞登录结果。
  }
}

interface LoginRun {
  method: LoginMethod
  cancelled: boolean
  reject: ((error: unknown) => void) | null
  promise: Promise<Credential>
}

let active: LoginRun | null = null
let embedView: WebContentsView | null = null
let lastBounds: EmbedRect | null = null

function applyBounds(rect: EmbedRect): void {
  embedView?.setBounds({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height))
  })
}

/**
 * 渲染进程上报登录组件占位区域（页面 CSS 坐标）；null 表示离开登录页，摘除视图并取消登录。
 * 视图为 WebContentsView（独立分区、顶级 guest）：cookie 属第一方，尺寸由主进程 setBounds 决定。
 */
export function setEmbedBounds(rect: EmbedRect | null): void {
  if (!rect) {
    lastBounds = null
    cancelActiveLogin()
    disposeEmbedView()
    return
  }
  lastBounds = rect
  applyBounds(rect)
}

/** 摘除并关闭登录视图（登录结束、离开页面或退出应用时）。 */
export function disposeEmbedView(target: WebContentsView | null = embedView): void {
  if (!target) return
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  try {
    win?.contentView.removeChildView(target)
  } catch {
    // 视图可能已被上一次取消移除。
  }
  if (!target.webContents.isDestroyed()) target.webContents.close()
  if (embedView === target) embedView = null
}

function createEmbedView(
  method: LoginMethod,
  onCode: (code: string) => void
): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      partition: partitionFor(method),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  // 微信二维码页按桌面浏览器渲染；避免 Electron UA 被识别为内嵌 WebView。
  if (method === 'wechat') {
    view.webContents.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
  }
  attachCapture(view.webContents, method, onCode)
  return view
}

function attachCapture(
  wc: WebContents,
  method: LoginMethod,
  onCode: (code: string) => void
): void {
  const extract = method === 'wechat' ? extractWechatCode : extractQqCode
  const capture = (event: ElectronEvent, url: string): void => {
    const code = extract(url)
    if (code) {
      event.preventDefault()
      onCode(code)
      return
    }
    if (!isAllowedHost(url)) event.preventDefault()
  }
  wc.on('will-navigate', capture)
  wc.on('will-redirect', capture)
  wc.on('did-navigate', (_event, url) => {
    const code = extract(url)
    if (code) onCode(code)
  })
  // 子窗口（设备锁 / 滑块验证）放行腾讯域名，并落在同一分区 session。
  wc.setWindowOpenHandler(({ url }) => {
    if (!isAllowedHost(url)) return { action: 'deny' }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: { partition: partitionFor(method), sandbox: true }
      }
    }
  })
}

function cancelActiveLogin(): void {
  const run = active
  if (!run) return
  active = null
  run.cancelled = true
  disposeEmbedView()
  void clearLoginSession(session.fromPartition(partitionFor(run.method)))
  run.reject?.(new UpstreamError('INTERNAL', '登录已取消'))
}

/** 官方扫码组件内嵌于登录页；渲染进程挂载组件并上报 bounds 后调用。 */
export function openWebLogin(method: LoginMethod): Promise<Credential> {
  if (!safeStorage.isEncryptionAvailable()) {
    return Promise.reject(
      new UpstreamError('INTERNAL', '系统密钥环不可用，无法保存登录凭证；请解锁密钥环后重试')
    )
  }
  if (active) {
    if (active.method === method) return active.promise
    cancelActiveLogin()
  }

  let resolveLogin!: (credential: Credential) => void
  let rejectLogin!: (error: unknown) => void
  const promise = new Promise<Credential>((resolve, reject) => {
    resolveLogin = resolve
    rejectLogin = reject
  })
  const run: LoginRun = {
    method,
    cancelled: false,
    reject: rejectLogin,
    promise
  }
  active = run
  void promise
    .catch(() => undefined)
    .finally(() => {
      if (active === run) active = null
    })
  void runEmbedLogin(run, resolveLogin, rejectLogin).catch((error) => rejectLogin(error))
  return promise
}

function mergeWechatCookies(
  credential: Credential,
  jar: Record<string, string>
): Record<string, string> {
  const merged = { ...jar }
  const set = (name: string, value: string | undefined): void => {
    if (value && !merged[name]) merged[name] = value
  }
  set('uin', credential.musicid)
  set('wxuin', credential.musicid)
  set('qqmusic_uin', credential.musicid)
  set('qqmusic_key', credential.musickey)
  set('qm_keyst', credential.musickey)
  set('wxopenid', credential.openid)
  set('wxunionid', credential.unionid)
  set('wxaccess_token', credential.accessToken)
  set('wxrefresh_token', credential.refreshToken)
  set('wxrefresh_key', credential.refreshKey)
  merged.login_type = '2'
  return merged
}

function credentialFromWechatCookies(jar: Record<string, string>): Credential | null {
  if (jar.login_type && jar.login_type !== '2') return null
  const rawId = jar.wxuin ?? jar.uin ?? jar.qqmusic_uin ?? ''
  const musicid = rawId.replace(/^o/, '').replace(/^0+(?=\d)/, '')
  const musickey = jar.qqmusic_key ?? jar.qm_keyst ?? jar.musickey ?? ''
  if (!/^\d+$/.test(musicid) || !musickey) return null
  return {
    method: 'wechat',
    musicid,
    musickey,
    expiredAtMs: null,
    refreshToken: jar.wxrefresh_token,
    accessToken: jar.wxaccess_token,
    openid: jar.wxopenid,
    unionid: jar.wxunionid,
    refreshKey: jar.wxrefresh_key,
    webCookies: { ...jar }
  }
}

async function runEmbedLogin(
  run: LoginRun,
  resolve: (credential: Credential) => void,
  reject: (error: unknown) => void
): Promise<void> {
  const partitionSession = session.fromPartition(partitionFor(run.method))
  // 先清空旧 session，避免残留 Cookie 让轮询在用户扫码前就发起换证。
  await clearLoginSession(partitionSession)
  if (run.cancelled) return

  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  if (!win) {
    reject(new UpstreamError('INTERNAL', '无法创建登录视图'))
    return
  }

  let settled = false
  let finishing = false
  let view: WebContentsView | null = null
  let cookieTimer: NodeJS.Timeout | null = null
  let timeoutTimer: NodeJS.Timeout | null = null

  const readCookieJar = async (): Promise<Record<string, string>> => {
    const cookies = await partitionSession.cookies.get({})
    const jar: Record<string, string> = {}
    for (const cookie of cookies) {
      if (cookie.domain?.endsWith('qq.com')) jar[cookie.name] = cookie.value
    }
    return jar
  }

  const cleanup = async (): Promise<void> => {
    if (timeoutTimer) clearTimeout(timeoutTimer)
    if (cookieTimer) clearInterval(cookieTimer)
    if (view) {
      disposeEmbedView(view)
      view = null
    }
    await clearLoginSession(partitionSession)
  }

  const succeed = async (code: string): Promise<void> => {
    if (settled || run.cancelled) return
    settled = true
    let jar: Record<string, string> = {}
    try {
      jar = await readCookieJar()
      await cleanup()
      const credential =
        run.method === 'wechat'
          ? await exchangeWechatLoginCode(code)
          : await exchangeQqLoginCode(code)
      credential.webCookies =
        run.method === 'wechat' ? mergeWechatCookies(credential, jar) : jar
      resolve(credential)
    } catch (error) {
      // 官方页可能已先完成换证并写入 Cookie；code 被消费时用 Cookie 兜底。
      const fallback = run.method === 'wechat' ? credentialFromWechatCookies(jar) : null
      if (fallback) {
        resolve(fallback)
        return
      }
      reject(error)
    }
  }

  const fail = async (message: string): Promise<void> => {
    if (settled || run.cancelled) return
    settled = true
    await cleanup()
    reject(new UpstreamError('AUTH_EXPIRED', message))
  }

  const finishFromCookies = async (): Promise<void> => {
    if (settled || finishing || run.cancelled) return
    finishing = true
    try {
      const jar = await readCookieJar()
      if (run.method === 'wechat') {
        const credential = credentialFromWechatCookies(jar)
        if (!credential) {
          finishing = false
          return
        }
        settled = true
        await cleanup()
        resolve(credential)
        return
      }
      if (!jar.p_skey) {
        finishing = false
        return
      }
      if (!jar.p_uin && !jar.pt4_token && !jar.uin) {
        finishing = false
        return
      }
      settled = true
      await cleanup()
      const code = await requestOAuthCodeWithCookies(jar)
      const credential = await exchangeQqLoginCode(code)
      credential.webCookies = jar
      resolve(credential)
    } catch (error) {
      reject(error)
    }
  }

  const onCode = (code: string): void => {
    void succeed(code)
  }

  view = createEmbedView(run.method, onCode)
  embedView = view
  win.contentView.addChildView(view)
  if (lastBounds) applyBounds(lastBounds)
  try {
    await view.webContents.loadURL(loginUrlFor(run.method))
  } catch (error) {
    await fail(error instanceof Error ? error.message : '登录页加载失败')
    return
  }
  if (run.cancelled) return

  timeoutTimer = setTimeout(() => {
    void fail('扫码登录超时，请重试')
  }, LOGIN_EMBED_TIMEOUT_MS)

  cookieTimer = setInterval(() => {
    void finishFromCookies()
  }, LOGIN_COOKIE_POLL_MS)
}
