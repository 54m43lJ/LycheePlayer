/**
 * 跨进程数据模型 — 对应 ARCHITECTURE §4.2 / §4.3。
 * 该文件是 IPC 两端的唯一类型来源。
 */

export type Quality = '128k' | '320k' | 'flac'

export type ErrorCode =
  | 'UPSTREAM_NETWORK'
  | 'AUTH_EXPIRED'
  | 'NO_STREAM'
  | 'UPSTREAM_CHANGED'
  | 'QUOTA_LIMITED'
  | 'INTERNAL'

export interface IpcError {
  code: ErrorCode
  message: string
}

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: IpcError }

export interface Singer {
  mid: string
  name: string
}

export interface Album {
  mid: string
  name: string
}

export interface PayInfo {
  free: boolean
  vip: boolean
  album: boolean
}

export interface Song {
  songMid: string
  songId: string
  name: string
  singers: Singer[]
  album: Album
  durationMs: number
  pay: PayInfo
}

export interface PlaylistMeta {
  id: string
  name: string
  coverUrl: string
  songCount: number
}

export interface PlaylistDetail {
  meta: PlaylistMeta
  songs: Song[]
}

export interface SearchRequest {
  type: 'song' | 'singer' | 'album' | 'playlist'
  keyword: string
  pageNo: number
  pageSize: number
}

export interface SearchResult {
  songs: Song[]
  singers: Singer[]
  albums: Album[]
  playlists: PlaylistMeta[]
  total: number
}

export interface Lyric {
  lrc: string
  trans: string | null
}

export interface Credential {
  musicid: string
  musickey: string
  expiredAtMs: number | null
  /** 以下字段仅主进程内部使用，不跨 IPC 下发。 */
  refreshKey?: string
  refreshToken?: string
  accessToken?: string
  openid?: string
  unionid?: string
  loginType?: number
}

export interface UrlResult {
  songMid: string
  url: string | null
  quality: Quality
}

export interface Settings {
  defaultQuality: Quality
  closeToTray: boolean
}

export type QrStatus = {
  stage: 'waiting' | 'scanned' | 'ok' | 'expired' | 'failed'
  message?: string
}

/**
 * POC 扩展：二维码图片必须随创建结果返回，渲染进程才能显示。
 * 见 POC.md「与设计文档的差异」。
 */
export interface QrSession {
  imageDataUrl: string
  expiresAtMs: number
}

/** POC 扩展：渲染进程启动时恢复登录态。 */
export interface AuthStatus {
  loggedIn: boolean
  musicid: string | null
  expiresAtMs: number | null
  canRefresh: boolean
}

export type MprisCommand = 'play' | 'pause' | 'toggle' | 'next' | 'previous' | { seekTo: number }

export interface PlayerState {
  song: Song | null
  status: 'stopped' | 'playing' | 'paused'
  positionMs: number
  quality: Quality
}

export interface UserProfile {
  nickname: string
  avatarUrl: string
}
