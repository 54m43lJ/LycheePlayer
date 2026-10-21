/**
 * 跨进程数据模型。
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

export interface Comment {
  id: string
  nickname: string
  avatarUrl: string
  content: string
  likedCount: number
  replyCount: number
  createdAtMs: number
}

export interface CommentPage {
  comments: Comment[]
  total: number
  hasMore: boolean
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
  /** auto = 按登录态取默认：已登录 flac、未登录 320k。 */
  defaultQuality: 'auto' | Quality
  closeToTray: boolean
  theme: 'dark' | 'light'
}

export interface AuthStatus {
  loggedIn: boolean
  musicid: string | null
  expiresAtMs: number | null
  canRefresh: boolean
}

export type MprisCommand =
  | 'play'
  | 'pause'
  | 'toggle'
  | 'next'
  | 'previous'
  | { seekTo: number }
  | { setVolume: number }
  | { setLoopStatus: 'None' | 'Track' | 'Playlist' }
  | { setShuffle: boolean }

export interface PlayerState {
  song: Song | null
  status: 'stopped' | 'playing' | 'paused'
  positionMs: number
  quality: Quality
  volume: number
  loopStatus: 'None' | 'Track' | 'Playlist'
  shuffle: boolean
}

export interface UserProfile {
  nickname: string
  avatarUrl: string
}

/** 登录组件占位区域（页面 CSS 坐标），驱动主进程 WebContentsView 定位。 */
export interface EmbedRect {
  x: number
  y: number
  width: number
  height: number
}
