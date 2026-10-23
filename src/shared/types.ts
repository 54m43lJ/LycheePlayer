/**
 * 跨进程数据模型。
 * 该文件是 IPC 两端的唯一类型来源。
 */

export type Quality = '128k' | '320k' | 'flac'

export type ErrorCode =
  | 'UPSTREAM_NETWORK' // 无法连接上游或请求超时
  | 'AUTH_EXPIRED' // 凭证过期或无效
  | 'NO_STREAM' // 各档音质均无播放链接
  | 'UPSTREAM_CHANGED' // 上游响应结构与预期不符
  | 'QUOTA_LIMITED' // 上游限流
  | 'NO_PERMISSION' // 当前账号无权执行该写操作
  | 'INTERNAL' // 主进程内部错误

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

export type PlaylistKind = 'normal' | 'favorites'

export interface PlaylistMeta {
  id: string
  name: string
  coverUrl: string
  songCount: number
  kind: PlaylistKind
  editable: boolean
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
  mvs?: MvSummary[]
  total: number
}

export interface Lyric {
  format: 'lrc' | 'qrc'
  text: string
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

export interface SongAvailability {
  songMid: string
  playable: boolean
  maxQuality: Quality | null
  checkedAtMs: number
}

export interface ProbeOptions {
  force?: boolean
}

export interface PlaylistCacheEntry {
  meta: PlaylistMeta
  songs: Song[]
  total: number
  complete: boolean
  fetchedAtMs: number
}

export interface PlaylistPage {
  meta: PlaylistMeta
  songs: Song[]
  offset: number
  total: number
  hasMore: boolean
}

export interface PlaylistPageResult {
  page: PlaylistPage
  fetchedAtMs: number
  stale: boolean
  fromCache: boolean
}

export interface RecommendSection {
  id: 'daily' | 'radar' | 'guess'
  title: string
  songs: Song[]
  playlists: PlaylistMeta[]
  refreshedAtMs: number
}

export interface RecommendFeed {
  sections: RecommendSection[]
}

export interface FavoriteState {
  songMid: string
  favorited: boolean
}

export interface PlaylistEditResult {
  meta: PlaylistMeta
  songs?: Song[]
}

export interface MvSummary {
  mvId: string
  name: string
  singerName: string
  coverUrl: string
}

export interface MvDetail extends MvSummary {
  description: string
  publishDate: string
}

export interface MvStream {
  mvId: string
  quality: 'sd' | 'hd' | 'fhd'
  url: string | null
}

export interface DownloadTask {
  id: string
  songMid: string
  name: string
  quality: Quality
  filePath: string
  coverPath: string | null
  status: 'pending' | 'downloading' | 'paused' | 'done' | 'failed'
  receivedBytes: number
  totalBytes: number
  error: string
}

export interface MpvState {
  available: boolean
  version: string | null
  playing: boolean
}

export interface MpvEvent {
  type: 'time' | 'duration' | 'play' | 'pause' | 'loaded' | 'ended' | 'error'
  positionMs?: number
  durationMs?: number
}

/** 登录凭证；完整字段与转换见 PROVIDER §4.3。仅主进程持有。 */
export interface Credential {
  musicid: string
  musickey: string
  expiredAtMs: number | null
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
  defaultQuality: 'auto' | Quality
  closeToTray: boolean
  theme: 'dark' | 'light'
  audioCacheEnabled: boolean
  shortcuts: Partial<Record<'toggleWindow' | 'playPause' | 'next' | 'previous', string>>
  /** 音频引擎选择；mpv 缺失时回退 HTML5。 */
  audioEngine?: 'auto' | 'html5' | 'mpv'
  /** 下载目录；缺省为 ~/Music/Lychee Player。 */
  downloadDir?: string
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

export interface EmbedRect {
  x: number
  y: number
  width: number
  height: number
}

export interface StartupFlag {
  kind: 'switch' | 'argument'
  name?: string
  value?: string
  raw: string
}

export interface FlagsFile {
  path: string
  content: string
}

export interface AudioCacheStats {
  bytes: number
  files: number
}

export interface DownloadStorageInfo {
  directory: string
  bytes: number
  freeBytes: number
  cacheBytes?: number
  cacheFiles?: number
}
