import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { mkdir } from 'node:fs/promises'
import type {
  AuthStatus,
  DownloadRequest,
  EmbedRect,
  IpcResult,
  MprisCommand,
  PlayerState,
  PlaylistSnapshot,
  Quality,
  SearchRequest,
  Settings
} from '../shared/types'
import {
  COMMENT_CONTENT_MAX,
  DOWNLOAD_QUEUE_MAX,
  IPC_SONG_MIDS_MAX
} from '../shared/constants'
import {
  getRefreshState,
  refreshSession,
  resetRefreshState,
  setAuthStatusNotifier
} from './api/login'
import { openWebLogin, setEmbedBounds } from './api/web-login'
import { getLyric } from './api/lyric'
import {
  getCommentReplies,
  getComments,
  getMvComments,
  likeComment,
  postComment,
  postCommentReply,
  postMvComment,
  unlikeComment
} from './api/comment'
import {
  fetchPlaylistPage,
  fetchPlaylistSnapshot,
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
import { fetchGuessBatch, fetchRecommendFeed } from './api/recommend'
import { getMvDetail, getMvStream, searchMv } from './api/mv'
import { searchByType } from './api/search'
import { getArtist, getArtistAlbums, getArtistSongs } from './api/artist'
import { getAlbum } from './api/album'
import { getMvId, getStreamUrls } from './api/song'
import { getProfile, getVipStatus } from './api/user'
import { toIpcError, setUpstreamBlockNotifier } from './api/client'
import {
  clearCredential,
  getCredential,
  getReauthReason,
  loadCredential,
  saveCredential
} from './credential'
import { getSettings, saveSettings } from './settings'
import { publishState } from './integration/mpris'
import { updateTray } from './integration/tray'
import { invalidatePlaylistCache } from './cache/playlist'
import { audioCacheStats, clearAudioCache, enforceAudioCacheLimit } from './cache/audio'
import { clearUserCache, listUserCaches } from './cache/user'
import { readFlagsFile, writeFlagsFile } from './startup-flags'
import {
  assetStates,
  clearCompletedDownloads,
  clearDownloadTasks,
  clearDownloadDirectory,
  downloadStorage,
  listDownloads,
  pauseDownload,
  removeDownload,
  removeDownloadedSong,
  resumeAllDownloads,
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
    method: credential?.method ?? null,
    musicid: credential?.musicid ?? null,
    expiresAtMs: credential?.expiredAtMs ?? null,
    refreshState: getRefreshState(),
    reauthReason: getReauthReason()
  }
}

function stringArg(value: unknown, name: string, max = 512): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > max) {
    throw new Error(`${name} 无效`)
  }
  return value
}

function numberArg(value: unknown, name: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`${name} 无效`)
  return parsed
}

/** 缓存作用域只接受 musicid 或 anonymous，避免把路径片段带进缓存目录。 */
function cacheScopeArg(value: unknown): string {
  const scope = stringArg(value, '用户 ID', 64)
  if (!/^[A-Za-z0-9_]+$/.test(scope)) throw new Error('用户 ID 无效')
  return scope
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

/** 渲染层入队时带来的已知歌曲信息；只用于标题与文件名，不触发上游请求。 */
function downloadRequestArg(value: unknown): DownloadRequest {
  if (!value || typeof value !== 'object') throw new Error('下载歌曲信息无效')
  const record = value as Record<string, unknown>
  const songMid = stringArg(record.songMid, '歌曲 mid')
  const name = typeof record.name === 'string' ? record.name : ''
  const albumName = typeof record.albumName === 'string' ? record.albumName : ''
  const singers = Array.isArray(record.singers)
    ? record.singers
        .filter((singer): singer is string => typeof singer === 'string')
        .map((singer) => singer.trim())
        .filter(Boolean)
        .slice(0, 32)
    : []
  return { songMid, name, singers, albumName }
}

function downloadRequestsArg(value: unknown): DownloadRequest[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > DOWNLOAD_QUEUE_MAX) {
    throw new Error(`下载歌曲列表必须为非空数组且不超过 ${DOWNLOAD_QUEUE_MAX} 个`)
  }
  return value.map(downloadRequestArg)
}

function taskIdsArg(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > DOWNLOAD_QUEUE_MAX) {
    throw new Error(`任务列表必须为非空数组且不超过 ${DOWNLOAD_QUEUE_MAX} 个`)
  }
  return value.map((item) => stringArg(item, '任务 ID'))
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

/** 正在执行的完整歌单拉取；取消时只中止匹配的请求标识。 */
const playlistFetches = new Map<string, { token: number; controller: AbortController }>()

/** 发现页只有一条推荐加载链；同 token 的成功结束不会删除新请求。 */
const recommendFetches = new Map<string, { token: number; controller: AbortController }>()

async function runRecommendFetch(
  force: boolean,
  sectionId: unknown,
  token: unknown
): Promise<unknown> {
  const requestToken = numberArg(token, '刷新标识')
  const current = recommendFetches.get('feed')
  if (current && current.token !== requestToken) current.controller.abort()
  const controller = new AbortController()
  recommendFetches.set('feed', { token: requestToken, controller })
  try {
    return await fetchRecommendFeed(
      force,
      typeof sectionId === 'string' ? sectionId : undefined,
      controller.signal
    )
  } finally {
    if (recommendFetches.get('feed')?.token === requestToken) {
      recommendFetches.delete('feed')
    }
  }
}

export function registerIpc(): void {
  // 104009 触发全局截断时，通知渲染层展示 toast；截断本身由上游请求入口执行。
  setUpstreamBlockNotifier((event) => broadcast('upstream:blocked', event))
  // 登录 / 续期 / 退出后实时同步登录态；续期状态机不直接依赖窗口层。
  setAuthStatusNotifier(() => broadcast('login:status', currentAuthStatus()))

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
  handle('login.openWebLogin', async (method: unknown) => {
    if (method !== 'qq' && method !== 'wechat') {
      throw new Error('登录方式无效')
    }
    const credential = await openWebLogin(method)
    await saveCredential(credential)
    resetRefreshState()
    return currentAuthStatus()
  })
  handle('login.refreshSession', async () => {
    await refreshSession()
    return currentAuthStatus()
  })
  handle('login.logout', async () => {
    // 退出只移除凭证与续期状态；各账号缓存与本地配置保留，由设置页按账号管理。
    await clearCredential()
    resetRefreshState()
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
  handle('artist.getAlbums', async (mid: unknown, offset: unknown, sort: unknown) =>
    getArtistAlbums(
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
  handle('song.getMvId', async (mid: unknown) => getMvId(stringArg(mid, '歌曲 mid')))

  handle('playlist.get', async (id: unknown, options: unknown) => {
    const value = (options ?? {}) as { offset?: number }
    const offset = Number.isFinite(value.offset) ? Number(value.offset) : 0
    return fetchPlaylistPage(stringArg(id, '歌单 ID'), offset)
  })
  handle('playlist.getCached', async (id: unknown) =>
    getCachedPlaylist(stringArg(id, '歌单 ID'))
  )
  handle('playlist.getSnapshot', async (id: unknown, token: unknown) => {
    const playlistId = stringArg(id, '歌单 ID')
    const requestToken = numberArg(token, '刷新标识')
    const previous = playlistFetches.get(playlistId)
    if (previous && previous.token !== requestToken) previous.controller.abort()
    const controller = new AbortController()
    playlistFetches.set(playlistId, { token: requestToken, controller })
    try {
      return await fetchPlaylistSnapshot(playlistId, controller.signal)
    } finally {
      if (playlistFetches.get(playlistId)?.token === requestToken) {
        playlistFetches.delete(playlistId)
      }
    }
  })
  handle('playlist.cancelSnapshot', async (id: unknown, token: unknown) => {
    const playlistId = stringArg(id, '歌单 ID')
    const requestToken = numberArg(token, '刷新标识')
    const current = playlistFetches.get(playlistId)
    if (current?.token === requestToken) {
      current.controller.abort()
      playlistFetches.delete(playlistId)
    }
    return null
  })
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
  handle('playlist.rename', async (id: unknown, name: unknown) =>
    renamePlaylist(stringArg(id, '歌单 ID'), stringArg(name, '歌单名', 128))
  )
  handle('playlist.remove', async (id: unknown) => {
    await removePlaylist(stringArg(id, '歌单 ID'))
    await invalidatePlaylistCache(String(id))
    return null
  })
  handle('playlist.addSongs', async (id: unknown, mids: unknown) =>
    addSongs(stringArg(id, '歌单 ID'), midArray(mids))
  )
  handle('playlist.removeSongs', async (id: unknown, mids: unknown) =>
    removeSongs(stringArg(id, '歌单 ID'), midArray(mids))
  )

  handle('favorite.get', async (mids: unknown) => getFavoriteStates(midArray(mids)))
  handle('favorite.toggle', async (mid: unknown) =>
    toggleFavorite(stringArg(mid, '歌曲 mid'))
  )

  handle('recommend.get', async (sectionId: unknown, token: unknown) =>
    runRecommendFetch(false, sectionId, token)
  )
  handle('recommend.refresh', async (sectionId: unknown, token: unknown) =>
    runRecommendFetch(true, sectionId, token)
  )
  handle('recommend.guess', async (page: unknown) => {
    const pageNo = Math.min(10_000, Math.max(1, Math.floor(numberArg(page, '猜你喜欢页码'))))
    return fetchGuessBatch(pageNo)
  })
  handle('recommend.cancel', async (token: unknown) => {
    const requestToken = numberArg(token, '刷新标识')
    const current = recommendFetches.get('feed')
    if (current?.token === requestToken) {
      current.controller.abort()
      recommendFetches.delete('feed')
    }
    return null
  })

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
  handle('download.start', async (request: unknown, quality: unknown) =>
    startDownload(downloadRequestArg(request), qualityArg(quality))
  )
  handle('download.startMany', async (requests: unknown, quality: unknown) =>
    startDownloads(downloadRequestsArg(requests), qualityArg(quality))
  )
  handle('download.pause', async (id: unknown) => pauseDownload(stringArg(id, '任务 ID')))
  handle('download.resume', async (id: unknown) => resumeDownload(stringArg(id, '任务 ID')))
  handle('download.resumeAll', async () => resumeAllDownloads())
  handle('download.remove', async (id: unknown) => {
    await removeDownload(stringArg(id, '任务 ID'))
    return null
  })
  handle('download.removeSong', async (mid: unknown) => {
    await removeDownloadedSong(stringArg(mid, '歌曲 mid'))
    return null
  })
  handle('download.clearCompleted', async () => {
    await clearCompletedDownloads()
    return null
  })
  handle('download.clearTasks', async (ids: unknown) => {
    await clearDownloadTasks(taskIdsArg(ids))
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

  // ---------- cache management ----------
  handle('cache.listUsers', async () => listUserCaches())
  handle('cache.clearUser', async (musicid: unknown) => {
    await clearUserCache(cacheScopeArg(musicid))
    return null
  })

  // ---------- account / metadata ----------
  handle('user.getProfile', async () => getProfile())
  handle('user.vipStatus', async () => getVipStatus())
  handle('lyric.get', async (songId: unknown) => getLyric(stringArg(songId, '歌曲 ID')))
  handle('comment.get', async (songId: unknown, cursor: unknown) =>
    getComments(String(songId), typeof cursor === 'string' ? cursor : '')
  )
  handle('comment.getMv', async (mvId: unknown, cursor: unknown) =>
    getMvComments(String(mvId), typeof cursor === 'string' ? cursor : '')
  )
  handle('comment.getReplies', async (commentId: unknown, cursor: unknown) =>
    getCommentReplies(
      stringArg(commentId, '评论 ID'),
      typeof cursor === 'string' ? cursor : ''
    )
  )
  handle('comment.post', async (songId: unknown, content: unknown) =>
    postComment(
      stringArg(songId, '歌曲 ID'),
      stringArg(content, '评论内容', COMMENT_CONTENT_MAX)
    )
  )
  handle('comment.postMv', async (mvId: unknown, content: unknown) =>
    postMvComment(
      stringArg(mvId, 'MV ID'),
      stringArg(content, '评论内容', COMMENT_CONTENT_MAX)
    )
  )
  handle(
    'comment.postReply',
    async (
      targetType: unknown,
      targetId: unknown,
      commentId: unknown,
      content: unknown
    ) => {
      if (targetType !== 'song' && targetType !== 'mv') {
        throw new Error('评论目标类型无效')
      }
      return postCommentReply(
        targetType,
        stringArg(targetId, '评论目标 ID'),
        stringArg(commentId, '评论 ID'),
        stringArg(content, '评论内容', COMMENT_CONTENT_MAX)
      )
    }
  )
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
