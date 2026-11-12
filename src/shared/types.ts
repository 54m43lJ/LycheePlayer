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
  /** 歌手页 mid；官方存在无歌手页但仍有名称的歌手，此时为空字符串。 */
  mid: string
  /** 可能为空；渲染时跳过空名称。 */
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
  /** 当前账号下的歌单目录 ID（写入接口的 dirId）；公开歌单可能没有。 */
  dirId?: number
  name: string
  coverUrl: string
  songCount: number
  kind: PlaylistKind
  editable: boolean
}

/** 歌单加删歌曲的写入结果；是否需要刷新由渲染层统一触发。 */
export interface PlaylistMutationResult {
  changed: boolean
}

export interface RecentPlaylist extends PlaylistMeta {
  visitedAtMs: number
  stale?: boolean
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
  liked?: boolean
}

/** 歌手歌曲排序：上游 order=1 为最热，其余值均为最新。 */
export type ArtistSongSort = 'hot' | 'latest'

export interface CommentLikeResult {
  commentId: string
  liked: boolean
  likedCount?: number
}

export interface CommentPage {
  comments: Comment[]
  total: number
  hasMore: boolean
  /** 下一页游标（上游 LastCommentSeqNo）；为空表示没有下一页。 */
  nextCursor?: string
}

export interface CommentPostResult {
  /** 上游新增评论 ID；响应未返回时为空字符串，调用方以重新拉取结果为准。 */
  commentId: string
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

export interface PlaylistSnapshot {
  meta: PlaylistMeta
  songs: Song[]
  total: number
  /** 上游声明的曲目总数；展示总数以实际拉到的 songs 为准。 */
  sourceTotal?: number
}

export interface PlaylistCacheEntry extends PlaylistSnapshot {
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

export interface ArtistDetail {
  mid: string
  name: string
  description: string
  coverUrl: string
  songCount: number
  albumCount: number
  songs: Song[]
  total: number
  hasMore: boolean
}

export interface ArtistSongPage {
  songs: Song[]
  total: number
  hasMore: boolean
}

export interface AlbumDetail {
  mid: string
  name: string
  coverUrl: string
  description: string
  publishDate: string
  singers: Singer[]
  songs: Song[]
  total: number
  hasMore: boolean
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

export type DownloadSource = 'network' | 'cache'

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
  source: DownloadSource
}

/** 每首歌的本机资产状态：缓存档位、下载档位、最高可用档与当前任务。 */
export interface SongAssetState {
  songMid: string
  cachedQuality: Quality | null
  downloadedQuality: Quality | null
  maxQuality: Quality | null
  taskStatus: DownloadTask['status'] | null
}

/** 主进程收到 104009 后进入全局上游截断窗口的通知。 */
export interface UpstreamBlockedEvent {
  /** 截断结束时间（Unix 毫秒）；此前所有上游请求立即失败。 */
  untilMs: number
  reason: string
}

/** 主进程上报的边播边缓存进度。 */
export interface AudioCacheProgress {
  songMid: string
  quality: Quality
  receivedBytes: number
  totalBytes: number
  complete: boolean
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
  /** 登录网页会话 Cookie（p_skey / skey 等），仅主进程使用。 */
  webCookies?: Record<string, string>
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
  /** 播放缓存上限（字节），取值限定为 128M / 256M / 512M / 1G / 1.5G / 2G。 */
  audioCacheMaxBytes: number
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
