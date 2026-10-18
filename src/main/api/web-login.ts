import { app, session, webContents } from 'electron'
import type { Event as ElectronEvent, WebContents } from 'electron'
import type { Credential } from '../../shared/types'
import { UpstreamError } from './client'
import { exchangeQqLoginCode, requestOAuthCodeWithCookies } from './login'

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

/** 登录 iframe 与应用共用默认 session；结束后清掉本次登录写入的 QQ cookie。 */
async function clearQqCookies(): Promise<void> {
  try {
    const cookies = await session.defaultSession.cookies.get({})
    for (const cookie of cookies) {
      if (!cookie.domain || !(cookie.domain === 'qq.com' || cookie.domain.endsWith('.qq.com'))) continue
      const url = `https://${cookie.domain.replace(/^\./, '')}${cookie.path}`
      await session.defaultSession.cookies.remove(url, cookie.name)
    }
  } catch {
    // 清理失败不阻塞登录结果。
  }
}

interface AttachedHandlers {
  onWillNavigate: (event: ElectronEvent, url: string) => void
  onWillRedirect: (event: ElectronEvent, url: string) => void
  onDidNavigate: (event: ElectronEvent, url: string) => void
}

let active: Promise<Credential> | null = null

/**
 * 登录页内嵌 iframe 加载官方 xlogin 组件；主进程轮询默认 session 的 Cookie 完成 OAuth 换证，
 * 并捕获 iframe frame 导航与子窗口中的 OAuth code。重复调用复用进行中的流程。
 */
export function openWebLogin(): Promise<Credential> {
  if (active) return active
  active = runEmbedLogin().finally(() => {
    active = null
  })
  return active
}

function runEmbedLogin(): Promise<Credential> {
  const defaultSession = session.defaultSession
  void clearQqCookies()

  return new Promise<Credential>((resolve, reject) => {
    const detachFns = new Map<WebContents, () => void>()
    let settled = false
    let finishing = false
    let cookieTimer: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null

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
        const cookies = await defaultSession.cookies.get({})
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
      app.removeListener('web-contents-created', onWebContentsCreated)
      for (const [wc, detach] of detachFns) {
        if (!wc.isDestroyed()) detach()
      }
      detachFns.clear()
      await clearQqCookies()
    }

    const makeHandlers = (): AttachedHandlers => ({
      onWillNavigate: (event, url) => {
        const code = extractOauthCode(url)
        if (code) {
          event.preventDefault()
          void succeed(code)
          return
        }
        if (!isAllowedHost(url)) event.preventDefault()
      },
      onWillRedirect: (event, url) => {
        const code = extractOauthCode(url)
        if (code) {
          event.preventDefault()
          void succeed(code)
          return
        }
        if (!isAllowedHost(url)) event.preventDefault()
      },
      onDidNavigate: (_event, url) => {
        const code = extractOauthCode(url)
        if (code) void succeed(code)
      }
    })

    const attachChildWindow = (wc: WebContents): void => {
      if (detachFns.has(wc) || wc.isDestroyed()) return
      const handlers = makeHandlers()
      wc.on('will-navigate', handlers.onWillNavigate)
      wc.on('will-redirect', handlers.onWillRedirect)
      wc.on('did-navigate', handlers.onDidNavigate)
      wc.setWindowOpenHandler(({ url }) => {
        if (!isAllowedHost(url)) return { action: 'deny' }
        return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, webPreferences: { sandbox: true } } }
      })
      detachFns.set(wc, () => {
        wc.removeListener('will-navigate', handlers.onWillNavigate)
        wc.removeListener('will-redirect', handlers.onWillRedirect)
        wc.removeListener('did-navigate', handlers.onDidNavigate)
      })
    }

    /** iframe 内的 OAuth code 跳转经主窗口的 frame 导航事件捕获。 */
    const attachFrameCapture = (wc: WebContents): void => {
      if (detachFns.has(wc) || wc.isDestroyed()) return
      const onFrameNavigate = (
        _event: ElectronEvent,
        url: string,
        _httpResponseCode: number,
        _method: string,
        isMainFrame: boolean
      ): void => {
        if (isMainFrame) return
        const code = extractOauthCode(url)
        if (code) void succeed(code)
      }
      wc.on('did-frame-navigate', onFrameNavigate)
      detachFns.set(wc, () => wc.removeListener('did-frame-navigate', onFrameNavigate))
    }

    const isChildWindow = (wc: WebContents): boolean =>
      wc.getType() === 'window' && wc.session === defaultSession && !wc.getURL().startsWith('file:')

    function onWebContentsCreated(_event: ElectronEvent, wc: WebContents): void {
      if (settled) return
      if (isChildWindow(wc)) attachChildWindow(wc)
    }
    app.on('web-contents-created', onWebContentsCreated)

    // 主窗口（frame 捕获）与既有子窗口可能在本次调用前就已存在，逐个补挂。
    for (const wc of webContents.getAllWebContents()) {
      if (wc.isDestroyed() || wc.getType() !== 'window' || wc.session !== defaultSession) continue
      attachFrameCapture(wc)
      if (!wc.getURL().startsWith('file:')) attachChildWindow(wc)
    }

    timeoutTimer = setTimeout(() => {
      void fail('扫码登录超时，请重试')
    }, 5 * 60_000)

    cookieTimer = setInterval(() => {
      void finishFromCookies()
    }, 1000)
  })
}
