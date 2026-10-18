import { app, session, webContents } from 'electron'
import type { Event as ElectronEvent, WebContents } from 'electron'
import type { Credential } from '../../shared/types'
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

interface AttachedHandlers {
  onWillNavigate: (event: ElectronEvent, url: string) => void
  onWillRedirect: (event: ElectronEvent, url: string) => void
  onDidNavigate: (event: ElectronEvent, url: string) => void
}

let active: Promise<Credential> | null = null

/**
 * 登录页内嵌 webview 加载官方 xlogin 组件；主进程轮询该 session 的 Cookie 完成 OAuth 换证。
 * 渲染进程挂载 webview 后调用本接口；重复调用复用进行中的流程。
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
    const attached = new Map<WebContents, AttachedHandlers>()
    let settled = false
    let finishing = false
    let cookieTimer: NodeJS.Timeout | null = null
    let timeoutTimer: NodeJS.Timeout | null = null

    const detach = (wc: WebContents, handlers: AttachedHandlers): void => {
      wc.removeListener('will-navigate', handlers.onWillNavigate)
      wc.removeListener('will-redirect', handlers.onWillRedirect)
      wc.removeListener('did-navigate', handlers.onDidNavigate)
      attached.delete(wc)
    }

    const cleanup = async (): Promise<void> => {
      if (timeoutTimer) clearTimeout(timeoutTimer)
      if (cookieTimer) clearInterval(cookieTimer)
      app.removeListener('web-contents-created', onWebContentsCreated)
      for (const [wc, handlers] of attached) {
        if (!wc.isDestroyed()) detach(wc, handlers)
      }
      await clearLoginSession(partitionSession)
    }

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

    const attach = (wc: WebContents): void => {
      if (attached.has(wc) || wc.isDestroyed()) return
      const handlers = makeHandlers()
      wc.on('will-navigate', handlers.onWillNavigate)
      wc.on('will-redirect', handlers.onWillRedirect)
      wc.on('did-navigate', handlers.onDidNavigate)
      wc.setWindowOpenHandler(({ url }) => {
        if (!isAllowedHost(url)) return { action: 'deny' }
        return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } }
      })
      attached.set(wc, handlers)
    }

    const isLoginTarget = (wc: WebContents): boolean =>
      (wc.getType() === 'webview' || wc.getType() === 'window') && wc.session === partitionSession

    function onWebContentsCreated(_event: ElectronEvent, wc: WebContents): void {
      if (settled) return
      if (isLoginTarget(wc)) attach(wc)
    }

    app.on('web-contents-created', onWebContentsCreated)

    // 登录页可能先于本次调用挂载 webview，补挂既有目标。
    for (const wc of webContents.getAllWebContents()) {
      if (isLoginTarget(wc)) attach(wc)
    }

    timeoutTimer = setTimeout(() => {
      void fail('扫码登录超时，请重试')
    }, 5 * 60_000)

    cookieTimer = setInterval(() => {
      void finishFromCookies()
    }, 1000)
  })
}
