import { BrowserWindow, session, WebContentsView } from 'electron'
import type { Event as ElectronEvent, WebContents } from 'electron'
import type { Credential, EmbedRect } from '../../shared/types'
import { XLOGIN_URL } from '../../shared/xlogin'
import { UpstreamError } from './client'
import { exchangeQqLoginCode, requestOAuthCodeWithCookies } from './login'

const PARTITION = 'lychee-xlogin'

function isAllowedHost(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return (
      host === 'qq.com' ||
      host.endsWith('.qq.com') ||
      host.endsWith('.gtimg.cn') ||
      host.endsWith('.weixin.qq.com')
    )
  } catch {
    return false
  }
}

export { isAllowedHost }

function extractOauthCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.endsWith('y.qq.com') && !parsed.hostname.endsWith('graph.qq.com')) {
      return null
    }
    const code = parsed.searchParams.get('code') ?? new URLSearchParams(parsed.hash.slice(1)).get('code')
    return code && code.length >= 8 ? code : null
  } catch {
    return null
  }
}

async function clearLoginSession(target: Electron.Session): Promise<void> {
  try {
    await target.clearStorageData({ storages: ['cookies'] })
  } catch {
    // 清理失败不阻塞登录结果。
  }
}

let active: Promise<Credential> | null = null
let embedView: WebContentsView | null = null

/**
 * 渲染进程上报登录组件占位区域（页面 CSS 坐标）；null 表示离开登录页，摘除视图。
 * 视图为 WebContentsView（独立分区、顶级 guest）：cookie 属第一方，尺寸由主进程 setBounds 决定。
 */
export function setEmbedBounds(rect: EmbedRect | null): void {
  if (!rect) {
    disposeEmbedView()
    return
  }
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  if (!win) return
  if (!embedView) {
    embedView = createEmbedView()
    win.contentView.addChildView(embedView)
    void embedView.webContents.loadURL(XLOGIN_URL)
  }
  embedView.setBounds({
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height))
  })
}

/** 摘除并关闭登录视图（登录结束、离开页面或退出应用时）。 */
export function disposeEmbedView(): void {
  if (!embedView) return
  const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
  win?.contentView.removeChildView(embedView)
  if (!embedView.webContents.isDestroyed()) embedView.webContents.close()
  embedView = null
}

function createEmbedView(): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  attachCapture(view.webContents)
  return view
}

/** 当前登录流程的 code 回调；无进行中的登录时为 null（导航捕获静默忽略）。 */
let emitCode: ((code: string) => void) | null = null

const onWillNavigate = (event: ElectronEvent, url: string): void => {
  const code = extractOauthCode(url)
  if (code) {
    event.preventDefault()
    emitCode?.(code)
    return
  }
  if (!isAllowedHost(url)) event.preventDefault()
}

const onWillRedirect = (event: ElectronEvent, url: string): void => {
  const code = extractOauthCode(url)
  if (code) {
    event.preventDefault()
    emitCode?.(code)
    return
  }
  if (!isAllowedHost(url)) event.preventDefault()
}

const onDidNavigate = (_event: ElectronEvent, url: string): void => {
  const code = extractOauthCode(url)
  if (code) emitCode?.(code)
}

function attachCapture(wc: WebContents): void {
  wc.on('will-navigate', onWillNavigate)
  wc.on('will-redirect', onWillRedirect)
  wc.on('did-navigate', onDidNavigate)
  // 子窗口（设备锁/滑块验证）放行 QQ 域名，并落在同一分区 session。
  wc.setWindowOpenHandler(({ url }) => {
    if (!isAllowedHost(url)) return { action: 'deny' }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        autoHideMenuBar: true,
        webPreferences: { partition: PARTITION, sandbox: true }
      }
    }
  })
}

/**
 * 官方 xlogin 组件内嵌于登录页（WebContentsView）；主进程轮询该分区 session 的 Cookie
 * 完成 OAuth 换证。渲染进程挂载组件并上报 bounds 后调用；重复调用复用进行中的流程。
 */
export function openWebLogin(): Promise<Credential> {
  if (active) return active
  active = runEmbedLogin().finally(() => {
    active = null
  })
  return active
}

function runEmbedLogin(): Promise<Credential> {
  const partitionSession = session.fromPartition(PARTITION)
  void clearLoginSession(partitionSession)

  return new Promise<Credential>((resolve, reject) => {
    let settled = false
    let finishing = false
    let cookieTimer: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null

    emitCode = (code) => void succeed(code)

    const succeed = async (code: string): Promise<void> => {
      if (settled) return
      settled = true
      try {
        await cleanup()
        const credential = await exchangeQqLoginCode(code)
        resolve(credential)
      } catch (error) {
        reject(error)
      }
    }

    const fail = async (message: string): Promise<void> => {
      if (settled) return
      settled = true
      await cleanup()
      reject(new UpstreamError('AUTH_EXPIRED', message))
    }

    const finishFromCookies = async (): Promise<void> => {
      if (settled || finishing) return
      finishing = true
      try {
        const cookies = await partitionSession.cookies.get({})
        const jar: Record<string, string> = {}
        for (const cookie of cookies) {
          if (cookie.domain?.endsWith('qq.com')) jar[cookie.name] = cookie.value
        }
        if (!jar.p_skey) {
          finishing = false
          return
        }
        if (!jar.p_uin && !jar.pt4_token && !jar.uin) {
          finishing = false
          return
        }
        if (settled) return
        settled = true
        await cleanup()
        const code = await requestOAuthCodeWithCookies(jar)
        const credential = await exchangeQqLoginCode(code)
        resolve(credential)
      } catch (error) {
        reject(error)
      }
    }

    const cleanup = async (): Promise<void> => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (cookieTimer) clearInterval(cookieTimer)
      emitCode = null
      disposeEmbedView()
      await clearLoginSession(partitionSession)
    }

    timeoutTimer = setTimeout(() => {
      void fail('扫码登录超时，请重试')
    }, 5 * 60_000)

    cookieTimer = setInterval(() => {
      void finishFromCookies()
    }, 1000)
  })
}
