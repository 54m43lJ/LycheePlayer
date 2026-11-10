import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import type {
  AuthStatus,
  EmbedRect,
  IpcResult,
  MprisCommand,
  PlayerState,
  PlaylistSnapshot,
  ProbeOptions,
  Quality,
  SearchRequest,
  Settings
} from '../shared/types'
import { DOWNLOAD_QUEUE_MAX, IPC_SONG_MIDS_MAX, PROBE_MIDS_MAX } from '../shared/constants'
import { loginWithCookie, refreshSession } from './api/login'
import { openWebLogin, setEmbedBounds } from './api/web-login'
import { getLyric } from './api/lyric'
import { getComments, likeComment, unlikeComment } from './api/comment'
import {
  fetchPlaylistPage,
  getCachedPlaylist,
  listMine,
  savePlaylistSnapshot
} from './api/playlist'
import {
  addSongs,
  createPlaylist,
  removePlaylist,
  removeSongs,
  renamePlaylist
} from './api/playlist-write'
import { getFavoriteStates, toggleFavorite } from './api/favorite'
import { fetchRecommendFeed, clearRecommendCache } from './api/recommend'
import { getMvDetail, getMvStream, searchMv } from './api/mv'
import { searchByType } from './api/search'
import { getArtist, getArtistSongs } from './api/artist'
import { getAlbum } from './api/album'
import { getStreamUrls } from './api/song'
import { probeAvailability, clearAvailabilityCache } from './api/availability'
import { getProfile } from './api/user'
import { toIpcError, setUpstreamBlockNotifier } from './api/client'
import { clearCredential, getCredential, loadCredential, saveCredential } from './credential'
import { getSettings, saveSettings } from './settings'
import { publishState } from './integration/mpris'
import { updateTray } from './integration/tray'
import { clearPlaylistCache, invalidatePlaylistCache } from './cache/playlist'
import { audioCacheStats, clearAudioCache, enforceAudioCacheLimit } from './cache/audio'
import { readFlagsFile, writeFlagsFile } from './startup-flags'
import {
  assetStates,
  clearCompletedDownloads,
  clearDownloadDirectory,
  downloadStorage,
  listDownloads,
  pauseDownload,
  removeDownload,
  resumeDownload,
  startDownload,
  startDownloads
} from './download/manager'

function broadcast(channel: string, payload: unknown): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(channel, payload)
  }
}

async function envelope<T>(fn: () => Promise<T>, logError = true): Promise<IpcResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    const error = toIpcError(err)
    // 不输出凭证、Cookie 与完整播放链接。
    if (logError) console.error(`[ipc] ${error.code}: ${error.message}`)
    return { ok: false, error }
  }
}

function handle(
  channel: string,
  fn: (...args: any[]) => Promise<unknown>,
  options: { silent?: boolean } = {}
): void {
  ipcMain.handle(channel, (_event, ...args: any[]) =>
    envelope(() => fn(...args), !options.silent)
  )
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

function stringArg(value: unknown, name: string, max = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new Error(`${name} 无效`)
  }
  return value
}

function midArray(value: unknown, max = IPC_SONG_MIDS_MAX): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > max) {
    throw new Error(`歌曲列表必须为非空数组且不超过 ${max} 个`)
  }
  return value.map((item) => String(item))
}

function qualityArg(value: unknown): Quality {
  if (value !== '128k' && value !== '320k' && value !== 'flac') {
    throw new Error(`非法音质：${String(value)}`)
  }
  return value
}

let lastPlayerStatus: PlayerState['status'] = 'stopped'
let lastToggleAt = 0

/** MPRIS / 托盘等主进程侧控制统一转成 player:command 推送。 */
export function sendPlayerCommand(command: MprisCommand): void {
  broadcast('player:command', command)
}

/**
 * 托盘播放 / 暂停：把 toggle 解析成明确的 play / pause，避免渲染进程与菜单状态竞态；
 * 200ms 内的重复点击只执行一次，但不会吞掉间隔更长的连续操作。
 */
export function sendPlaybackToggle(): void {
  const now = Date.now()
  if (now - lastToggleAt < 200) return
  lastToggleAt = now
  sendPlayerCommand(lastPlayerStatus === 'playing' ? 'pause' : 'play')
}

export function registerIpc(): void {
  // 104009 触发全局截断时，通知渲染层展示 toast；截断本身由上游请求入口执行。
  setUpstreamBlockNotifier((event) => broadcast('upstream:blocked', event))

  // ---------- application ----------
  ipcMain.on('app.quit', () => app.quit())

  // ---------- flags ----------
  handle('flags.get', async () => readFlagsFile())
  handle('flags.save', async (content: unknown) => {
    if (typeof content !== 'string') throw new Error('启动参数内容无效')
    await writeFlagsFile(content)
    return null
  })

  // ---------- login ----------
  handle('login.getStatus', async () => {
    // 密钥环解锁较晚时，状态查询会重试解密已保存的凭证。
    await loadCredential()
    return currentAuthStatus()
  })
  handle('login.loginWithCookie', async (cookie: unknown) => {
    if (typeof cookie !== 'string' || cookie.trim().length === 0) {
      throw new Error('Cookie 不能为空')
    }
    const credential = await loginWithCookie(cookie)
    await saveCredential(credential)
    // 重新登录后旧的不可播缓存可能来自失效会话，必须丢弃重探。
    clearAvailabilityCache()
    return currentAuthStatus()
  })
  handle('login.openWebLogin', async () => {
    const credential = await openWebLogin()
    await saveCredential(credential)
    clearAvailabilityCache()
    return currentAuthStatus()
  })
  handle('login.refreshSession', async () => {
    await refreshSession()
    clearAvailabilityCache()
    return currentAuthStatus()
  })
  handle('login.logout', async () => {
    await clearCredential()
    await clearPlaylistCache()
    clearAvailabilityCache()
    clearRecommendCache()
    return null
  })

  ipcMain.on('login.setEmbedBounds', (_event, rect: unknown) => {
    if (rect === null) {
      setEmbedBounds(null)
      return
    }
    const value = rect as Record<string, unknown>
    const nums = [value.x, value.y, value.width, value.height]
    if (nums.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      setEmbedBounds({
        x: value.x as number,
        y: value.y as number,
        width: value.width as number,
        height: value.height as number
      } satisfies EmbedRect)
    }
  })

  // ---------- content ----------
  handle('search.byType', async (req: SearchRequest) => searchByType(req))
  handle('artist.get', async (mid: unknown, offset: unknown, sort: unknown) =>
    getArtist(
      stringArg(mid, '歌手 mid'),
      Number(offset) || 0,
      sort === 'latest' ? 'latest' : 'hot'
    )
  )
  handle('artist.getSongs', async (mid: unknown, offset: unknown, sort: unknown) =>
    getArtistSongs(
      stringArg(mid, '歌手 mid'),
      Number(offset) || 0,
      sort === 'latest' ? 'latest' : 'hot'
    )
  )
  handle('album.get', async (mid: unknown, offset: unknown) =>
    getAlbum(stringArg(mid, '专辑 mid'), Number(offset) || 0)
  )

  handle('song.getUrls', async (mids: unknown, quality: unknown) =>
    getStreamUrls(midArray(mids), qualityArg(quality))
  )
  handle(
    'song.probe',
    async (mids: unknown, options: unknown) => {
      const list = midArray(mids, PROBE_MIDS_MAX)
      return probeAvailability(list, (options ?? {}) as ProbeOptions)
    },
    // 背景可用性探测失败时渲染层会静默处理，不输出易误导的 IPC 错误日志。
    { silent: true }
  )

  handle('playlist.get', async (id: unknown, options: unknown) => {
    const value = (options ?? {}) as { offset?: number }
    const offset = Number.isFinite(value.offset) ? Number(value.offset) : 0
    return fetchPlaylistPage(stringArg(id, '歌单 ID'), offset)
  })
  handle('playlist.getCached', async (id: unknown) =>
    getCachedPlaylist(stringArg(id, '歌单 ID'))
  )
  handle('playlist.saveCache', async (id: unknown, snapshot: unknown, complete: unknown) => {
    await savePlaylistSnapshot(
      stringArg(id, '歌单 ID'),
      snapshot as PlaylistSnapshot,
      Boolean(complete)
    )
    return null
  })
  handle('playlist.listMine', async () => listMine())
  handle('playlist.create', async (name: unknown) => createPlaylist(stringArg(name, '歌单名', 128)))
  handle('playlist.rename', async (id: unknown, name: unknown) => {
    const result = await renamePlaylist(stringArg(id, '歌单 ID'), stringArg(name, '歌单名', 128))
    await invalidatePlaylistCache(String(id))
    return result
  })
  handle('playlist.remove', async (id: unknown) => {
    await removePlaylist(stringArg(id, '歌单 ID'))
    await invalidatePlaylistCache(String(id))
    return null
  })
  handle('playlist.addSongs', async (id: unknown, mids: unknown) => {
    const result = await addSongs(stringArg(id, '歌单 ID'), midArray(mids))
    await invalidatePlaylistCache(String(id))
    return result
  })
  handle('playlist.removeSongs', async (id: unknown, mids: unknown) => {
    const result = await removeSongs(stringArg(id, '歌单 ID'), midArray(mids))
    await invalidatePlaylistCache(String(id))
    return result
  })

  handle('favorite.get', async (mids: unknown) => getFavoriteStates(midArray(mids)))
  handle('favorite.toggle', async (mid: unknown) => {
    const result = await toggleFavorite(stringArg(mid, '歌曲 mid'))
    await invalidatePlaylistCache('liked')
    return result
  })

  handle('recommend.get', async () => fetchRecommendFeed())
  handle('recommend.refresh', async (sectionId: unknown) =>
    fetchRecommendFeed(true, typeof sectionId === 'string' ? sectionId : undefined)
  )

  handle('mv.search', async (keyword: unknown, pageNo: unknown) =>
    searchMv(stringArg(keyword, '关键词', 128), Number(pageNo) || 1)
  )
  handle('mv.getDetail', async (mvId: unknown) => getMvDetail(stringArg(mvId, 'MV ID')))
  handle('mv.getStream', async (mvId: unknown, quality: unknown) => {
    if (quality !== 'sd' && quality !== 'hd' && quality !== 'fhd') throw new Error('非法清晰度')
    return getMvStream(stringArg(mvId, 'MV ID'), quality)
  })

  // ---------- download ----------
  handle('download.list', async () => listDownloads())
  handle('download.assetStates', async (mids: unknown) =>
    assetStates(
      Array.isArray(mids)
        ? mids.map((item) => String(item)).filter(Boolean).slice(0, IPC_SONG_MIDS_MAX)
        : []
    )
  )
  handle('download.start', async (mid: unknown, quality: unknown) =>
    startDownload(stringArg(mid, '歌曲 mid'), qualityArg(quality))
  )
  handle('download.startMany', async (mids: unknown, quality: unknown) =>
    startDownloads(midArray(mids, DOWNLOAD_QUEUE_MAX), qualityArg(quality))
  )
  handle('download.pause', async (id: unknown) => pauseDownload(stringArg(id, '任务 ID')))
  handle('download.resume', async (id: unknown) => resumeDownload(stringArg(id, '任务 ID')))
  handle('download.remove', async (id: unknown) => {
    await removeDownload(stringArg(id, '任务 ID'))
    return null
  })
  handle('download.clearCompleted', async () => {
    await clearCompletedDownloads()
    return null
  })
  handle('download.clearDirectory', async () => {
    await clearDownloadDirectory()
    return null
  })
  handle('download.storage', async () => {
    const storage = await downloadStorage()
    const cache = await audioCacheStats()
    return { ...storage, cacheBytes: cache.bytes, cacheFiles: cache.files }
  })
  handle('download.openFolder', async () => {
    const storage = await downloadStorage()
    await mkdir(storage.directory, { recursive: true })
    await shell.openPath(storage.directory)
    return null
  })
  handle('download.chooseFolder', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择下载目录',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  handle('download.clearCache', async () => {
    await clearAudioCache()
    return null
  })

  // ---------- account / metadata ----------
  handle('user.getProfile', async () => getProfile())
  handle('lyric.get', async (songMid: unknown) => getLyric(stringArg(songMid, '歌曲 mid')))
  handle('comment.get', async (songId: unknown, sort: unknown, cursor: unknown) => {
    const order: 'latest' | 'oldest' = sort === 'oldest' ? 'oldest' : 'latest'
    return getComments(String(songId), order, typeof cursor === 'string' ? cursor : '')
  })
  handle('comment.like', async (commentId: unknown) =>
    likeComment(stringArg(commentId, '评论 ID'))
  )
  handle('comment.unlike', async (commentId: unknown) =>
    unlikeComment(stringArg(commentId, '评论 ID'))
  )

  // ---------- settings ----------
  handle('settings.get', async () => getSettings())
  handle('settings.set', async (patch: Partial<Settings>) => {
    const previous = getSettings()
    const next: Settings = { ...previous, ...patch }
    await saveSettings(next)
    const saved = getSettings()
    if (previous.audioCacheEnabled && !saved.audioCacheEnabled) await clearAudioCache()
    if (saved.audioCacheMaxBytes !== previous.audioCacheMaxBytes) await enforceAudioCacheLimit()
    return saved
  })

  // ---------- player ----------
  ipcMain.on('player:state', (_event, state: PlayerState) => {
    lastPlayerStatus = state.status
    publishState(state)
    updateTray(state)
  })
}
