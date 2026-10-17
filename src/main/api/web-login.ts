import { BrowserWindow, session } from 'electron'
import type { Credential } from '../../shared/types'
import { UpstreamError } from './client'
import { loginWithCookie } from './login'

const PARTITION = 'qqy-web-login'

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

function cookieValue(cookies: Electron.Cookie[], names: string[]): string | null {
  return cookies.find((cookie) => names.includes(cookie.name) && cookie.value)?.value ?? null
}

async function clearLoginSession(target: Electron.Session): Promise<void> {
  try {
    await target.clearStorageData({ storages: ['cookies'] })
  } catch {
    // 清理失败不阻塞登录结果。
  }
}

function runWindowLogin(): Promise<Credential> {
  return new Promise<Credential>((resolve, reject) => {
    const partitionSession = session.fromPartition(PARTITION)
    const children: BrowserWindow[] = []
    let settled = false
    let lastTriedCookie = ''

    const window = new BrowserWindow({
      width: 980,
      height: 760,
      minWidth: 640,
      minHeight: 520,
      show: false,
      autoHideMenuBar: true,
      title: '登录 QQ 音乐 — qqy',
      backgroundColor: '#0e0e12',
      webPreferences: {
        partition: PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    activeWindow = window

    const cleanup = async (): Promise<void> => {
      clearInterval(pollTimer)
      clearTimeout(timeoutTimer)
      for (const child of children) {
        if (!child.isDestroyed()) child.destroy()
      }
      if (!window.isDestroyed()) window.destroy()
      await clearLoginSession(partitionSession)
    }

    const succeed = async (credential: Credential): Promise<void> => {
      if (settled) return
      settled = true
      await cleanup()
      resolve(credential)
    }

    const fail = async (message: string): Promise<void> => {
      if (settled) return
      settled = true
      await cleanup()
      reject(new UpstreamError('AUTH_EXPIRED', message))
    }

    const pollTimer = setInterval(() => {
      void (async () => {
        try {
          const cookies = await partitionSession.cookies.get({})
          const uin = cookieValue(cookies, ['uin', 'qqmusic_uin', 'p_uin', 'wxuin'])
          const key = cookieValue(cookies, [
            'qm_keyst',
            'qqmusic_key',
            'musickey',
            'music_key'
          ])
          if (!uin || !key) return
          const cookie = `uin=${uin}; qm_keyst=${key}`
          if (cookie === lastTriedCookie) return
          lastTriedCookie = cookie
          const credential = await loginWithCookie(cookie)
          await succeed(credential)
        } catch {
          // 页面可能仍在跳转或登录态尚未完全写入，下一次轮询继续。
        }
      })()
    }, 1200)

    const timeoutTimer = setTimeout(() => {
      void fail('网页登录超时，请重试')
    }, 5 * 60_000)

    window.once('ready-to-show', () => window.show())
    window.on('closed', () => {
      if (!settled) void fail('登录窗口已关闭')
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
    })

    void window.loadURL('https://y.qq.com/').catch(() => {
      void fail('无法打开 QQ 音乐登录页')
    })
  })
}

/**
 * 官方网页登录兜底：在独立 session 中打开 y.qq.com，
 * 用户自行完成扫码/验证后读取 qm_keyst，再走 Cookie 校验。
 */
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
