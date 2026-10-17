import { BrowserWindow, session } from 'electron'
import type { Credential } from '../../shared/types'
import { UpstreamError } from './client'
import { exchangeQqLoginCode, requestOAuthCodeWithCookies } from './login'

const PARTITION = 'qqy-xlogin'

/** 与官方 Linux 客户端使用的 QQ 登录组件一致；只加载扫码窗口，不加载完整 y.qq.com。 */
const LOGIN_URL =
  'https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=716027609&daid=383&style=33&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self&s_url=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump&pt_3rd_aid=100497308&pt_feedback_link=https%3A%2F%2Fsupport.qq.com%2Fproducts%2F77942%3FcustomInfo%3D.appid100497308&theme=2&verify_theme='

let active: Promise<Credential> | null = null
let activeWindow: BrowserWindow | null = null

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

async function runWindowLogin(): Promise<Credential> {
  const partitionSession = session.fromPartition(PARTITION)
  await clearLoginSession(partitionSession)

  return new Promise<Credential>((resolve, reject) => {
    const children: BrowserWindow[] = []
    let settled = false
    let finishing = false
    let cookieTimer: NodeJS.Timeout | null = null

    const window = new BrowserWindow({
      width: 470,
      height: 610,
      minWidth: 420,
      minHeight: 540,
      show: false,
      autoHideMenuBar: true,
      title: '登录 QQ 音乐 — qqy',
      backgroundColor: '#ffffff',
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    activeWindow = window

    const cleanup = async (): Promise<void> => {
      clearTimeout(timeoutTimer)
      if (cookieTimer) clearInterval(cookieTimer)
      for (const child of children) {
        if (!child.isDestroyed()) child.destroy()
      }
      if (!window.isDestroyed()) window.destroy()
      await clearLoginSession(partitionSession)
    }

    const succeed = async (code: string): Promise<void> => {
      if (settled) return
      settled = true
      try {
        window.webContents.stop()
        await cleanup()
        const credential = await exchangeQqLoginCode(code)
        resolve(credential)
      } catch (error) {
        reject(error)
      }
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
        window.webContents.stop()
        await cleanup()
        const code = await requestOAuthCodeWithCookies(jar)
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

    const capture = (event: Electron.Event, url: string): void => {
      const code = extractOauthCode(url)
      if (!code) return
      event.preventDefault()
      void succeed(code)
    }

    const timeoutTimer = setTimeout(() => {
      void fail('扫码登录超时，请重试')
    }, 5 * 60_000)

    cookieTimer = setInterval(() => {
      void finishFromCookies()
    }, 1000)

    window.once('ready-to-show', () => window.show())
    window.on('closed', () => {
      if (!settled) void fail('登录窗口已关闭')
    })

    window.webContents.on('will-redirect', capture)
    window.webContents.on('will-navigate', capture)
    window.webContents.on('did-navigate', (_event, url) => {
      const code = extractOauthCode(url)
      if (code) void succeed(code)
    })

    window.webContents.setWindowOpenHandler(({ url }) => {
      if (!isAllowedHost(url)) return { action: 'deny' }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: true,
          autoHideMenuBar: true,
          webPreferences: {
            partition: PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
          }
        }
      }
    })

    window.webContents.on('did-create-window', (child) => {
      children.push(child)
      child.webContents.on('will-redirect', capture)
      child.webContents.on('will-navigate', capture)
    })

    void window.loadURL(LOGIN_URL).catch(() => {
      void fail('无法打开 QQ 登录组件')
    })
  })
}

/** 官方 QQ 扫码窗口：用户完成扫码后拦截 OAuth code，换取 QQ 音乐凭证。 */
export function openWebLogin(): Promise<Credential> {
  if (active) {
    activeWindow?.focus()
    return active
  }
  active = runWindowLogin().finally(() => {
    active = null
    activeWindow = null
  })
  return active
}
