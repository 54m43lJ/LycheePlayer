import { BrowserWindow, ipcMain } from 'electron'
import type {
  AuthStatus,
  IpcResult,
  MprisCommand,
  PlayerState,
  SearchRequest,
  Settings
} from '../shared/types'
import { createQrKey, initLoginEvents, loginWithCookie, refreshSession, stopPolling } from './api/login'
import { openWebLogin, setEmbedBounds } from './api/web-login'
import { getLyric } from './api/lyric'
import { getPlaylist, listMine } from './api/playlist'
import { searchByType } from './api/search'
import { getStreamUrls } from './api/song'
import { getProfile } from './api/user'
import { toIpcError } from './api/client'
import { clearCredential, getCredential, saveCredential } from './credential'
import { getSettings, saveSettings } from './settings'
import { publishState } from './integration/mpris'

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

async function envelope<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const error = toIpcError(err)
    // 不输出凭证、Cookie 与完整播放链接。
    console.error(`[ipc] ${error.code}: ${error.message}`)
    return { ok: false, error }
  }
}

function handle(channel: string, fn: (...args: any[]) => Promise<unknown>): void {
  ipcMain.handle(channel, (_event, ...args: any[]) => envelope(() => fn(...args)))
}

function currentAuthStatus(): AuthStatus {
  const credential = getCredential()
  return {
    loggedIn: Boolean(credential),
    musicid: credential?.musicid ?? null,
    expiresAtMs: credential?.expiredAtMs ?? null,
    canRefresh: Boolean(credential?.refreshToken)
  }
}

/** MPRIS / 托盘等主进程侧控制统一转成 player:command 推送。 */
export function sendPlayerCommand(command: MprisCommand): void {
  broadcast('player:command', command)
}

export function registerIpc(): void {
  initLoginEvents({
    onStatus: (status) => broadcast('login:status', status),
    onCredential: async (credential) => {
      await saveCredential(credential)
    }
  })

  handle('login.createQrKey', async () => createQrKey())
  handle('login.getStatus', async () => currentAuthStatus())
  handle('login.loginWithCookie', async (cookie: unknown) => {
    if (typeof cookie !== 'string' || cookie.trim().length === 0) {
      throw new Error('Cookie 不能为空')
    }
    const credential = await loginWithCookie(cookie)
    await saveCredential(credential)
    broadcast('login:status', { stage: 'ok' })
    return currentAuthStatus()
  })
  handle('login.openWebLogin', async () => {
    const credential = await openWebLogin()
    await saveCredential(credential)
    broadcast('login:status', { stage: 'ok' })
    return currentAuthStatus()
  })
  handle('login.refreshSession', async () => {
    await refreshSession()
    return currentAuthStatus()
  })
  handle('login.logout', async () => {
    stopPolling()
    await clearCredential()
    return null
  })

  ipcMain.on('login.setEmbedBounds', (_event, rect: unknown) => {
    if (rect === null) {
      setEmbedBounds(null)
      return
    }
    const r = rect as Record<string, unknown>
    const nums = [r.x, r.y, r.width, r.height]
    if (nums.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      setEmbedBounds({ x: r.x as number, y: r.y as number, width: r.width as number, height: r.height as number })
    }
  })

  handle('search.byType', async (req: SearchRequest) => searchByType(req))

  handle('song.getUrls', async (mids: unknown, quality: string) => {
    if (!Array.isArray(mids) || mids.length === 0 || mids.length > 100) {
      throw new Error('mids 必须为非空数组且不超过 100 个')
    }
    if (quality !== '128k' && quality !== '320k' && quality !== 'flac') {
      throw new Error(`非法音质：${quality}`)
    }
    return getStreamUrls(mids.map((mid) => String(mid)), quality)
  })

  handle('playlist.get', async (id: unknown) => getPlaylist(String(id)))
  handle('playlist.listMine', async () => listMine())
  handle('lyric.get', async (songMid: unknown) => getLyric(String(songMid)))
  handle('user.getProfile', async () => getProfile())

  handle('settings.get', async () => getSettings())
  handle('settings.set', async (patch: Partial<Settings>) => {
    const next: Settings = { ...getSettings(), ...patch }
    await saveSettings(next)
    return next
  })

  ipcMain.on('player:state', (_event, state: PlayerState) => {
    publishState(state)
  })
}
