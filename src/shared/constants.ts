/**
 * 工程常量集中声明。
 * 其它模块只 import；推荐值以注释形式记录，源码中的赋值是运行时的唯一来源。
 */

// ---------- 上游请求 ----------

/** 单次上游请求超时。推荐值 15_000 ms。 */
export const UPSTREAM_TIMEOUT_MS = 15_000
/** HTTP 非 2xx / 429 / 瞬时繁忙的最大尝试次数。推荐值 3。 */
export const UPSTREAM_RETRY_ATTEMPTS = 3
/** HTTP 非 2xx 重试的基础退避，指数退避。推荐值 400 ms。 */
export const UPSTREAM_NETWORK_BACKOFF_MS = 400
/** HTTP 429 重试的基础退避，指数退避。推荐值 600 ms。 */
export const UPSTREAM_QUOTA_BACKOFF_MS = 600
/** 瞬时繁忙码（2001 / 104604）重试的基础退避。推荐值 500 ms。 */
export const MUSICU_BUSY_BACKOFF_MS = 500

// ---------- 搜索 ----------

/** 搜索空结果重试延迟。推荐值 350 ms。 */
export const SEARCH_EMPTY_RETRY_MS = 350
/** 搜索空结果重试次数。推荐值 1。 */
export const SEARCH_EMPTY_RETRY_COUNT = 1
/** 搜索页码上限。推荐值 100。 */
export const SEARCH_PAGE_NO_MAX = 100
/** 搜索每页默认条数。推荐值 20。 */
export const SEARCH_PAGE_SIZE_DEFAULT = 20
/** 搜索每页最大条数。推荐值 50。 */
export const SEARCH_PAGE_SIZE_MAX = 50

// ---------- 歌单 ----------

/** 歌单固定 50 首/页。 */
export const PLAYLIST_PAGE_SIZE = 50
/** 歌单本地最大分页数。推荐值 20_000。 */
export const PLAYLIST_PAGE_MAX = 20_000
/** 歌单界面变化轮询间隔。推荐值 15_000 ms。 */
export const PLAYLIST_POLL_INTERVAL_MS = 15_000
/** 歌单缓存字节上限。推荐值 16 × 1024 × 1024。 */
export const PLAYLIST_CACHE_MAX_BYTES = 16 * 1024 * 1024
/** 自动补全时单页失败的最大重试次数。 */
export const PLAYLIST_PAGE_RETRY_ATTEMPTS = 3
/** 自动补全失败重试的基础退避。推荐值 500 ms。 */
export const PLAYLIST_PAGE_RETRY_BACKOFF_MS = 500

// ---------- 可用性探测 ----------

/**
 * 单次探测的歌曲上限。推荐值 50。
 * 约束：与 PLAYLIST_PAGE_SIZE 对齐（一个 50 首歌单页一次探测），且不超过 IPC_SONG_MIDS_MAX。
 */
export const PROBE_MIDS_MAX = 50
/** 歌曲详情并发。推荐值 2。 */
export const PROBE_DETAIL_CONCURRENCY = 2
/**
 * vkey 批量大小。推荐值 50。
 * 约束：与 PROBE_MIDS_MAX 对齐（一批探测一次 vkey），且不超过 IPC_SONG_MIDS_MAX。
 */
export const PROBE_VKEY_BATCH = 50
/** 可用性缓存 TTL。推荐值 10 × 60_000 ms。 */
export const PROBE_CACHE_TTL_MS = 10 * 60_000
/** 可用性缓存的最大歌曲数；由 PLAYLIST_PAGE_SIZE × PLAYLIST_PAGE_MAX 派生。 */
export const PROBE_MAX_SONGS = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX
/** 可用性探测空闲调度超时。推荐值 2000 ms。 */
export const PROBE_IDLE_TIMEOUT_MS = 2000
/** 无 requestIdleCallback 时的探测延迟。推荐值 300 ms。 */
export const PROBE_IDLE_FALLBACK_MS = 300
/** 下载中心进度轮询间隔。推荐值 1500 ms。 */
export const DOWNLOAD_POLL_MS = 1500

// ---------- 播放 ----------

/** 播放状态推送节流窗口。推荐值 900 ms。 */
export const PLAYER_STATE_THROTTLE_MS = 900
/** 播放历史容量上限。推荐值 100。 */
export const PLAY_HISTORY_MAX = 100
/** Toast 自动消失时间。推荐值 3600 ms。 */
export const TOAST_DURATION_MS = 3600
/** 判断“回到开头”而非上一首的播放位置。推荐值 3000 ms。 */
export const PREVIOUS_RESTART_THRESHOLD_MS = 3000
/** mpv 可执行文件名。 */
export const MPV_BINARY = 'mpv'
/** mpv IPC socket 文件名前缀。 */
export const MPV_SOCKET_PREFIX = 'lychee-mpv'

// ---------- IPC ----------

/** song.getUrls / song.probe 单次批量上限。推荐值 100。 */
export const IPC_SONG_MIDS_MAX = 100

// ---------- 登录与会话 ----------

/** 内嵌 xlogin 登录总超时。推荐值 5 × 60_000 ms。 */
export const LOGIN_EMBED_TIMEOUT_MS = 5 * 60_000
/** 内嵌登录读取 session Cookie 的轮询间隔。推荐值 1000 ms。 */
export const LOGIN_COOKIE_POLL_MS = 1000
/** 登录组件的独立 session 分区名。 */
export const LOGIN_EMBED_PARTITION = 'lychee-xlogin'
/** 会话续期定时器间隔。推荐值 30 × 60_000 ms。 */
export const SESSION_REFRESH_INTERVAL_MS = 30 * 60_000
/** 凭证到期前提前续期的窗口。推荐值 10 × 60_000 ms。 */
export const SESSION_REFRESH_AHEAD_MS = 10 * 60_000
/** 凭证无到期时间时的续期间隔。推荐值 6 小时。 */
export const SESSION_REFRESH_FALLBACK_MS = 6 * 60 * 60_000
/** OAuth 授权请求超时。推荐值 15_000 ms。 */
export const OAUTH_TIMEOUT_MS = 15_000
/** 登录流程允许导航的腾讯域名后缀。 */
export const LOGIN_ALLOWED_DOMAINS = ['qq.com', 'gtimg.cn', 'weixin.qq.com'] as const

// ---------- 缓存与下载 ----------

/** 收藏状态缓存时长。推荐值 30_000 ms。 */
export const FAVORITE_STATUS_CACHE_MS = 30_000
/** VIP 状态缓存时长。推荐值 5 × 60_000 ms。 */
export const VIP_CACHE_MS = 5 * 60_000
/** 评论单页条数；上游上限 25。 */
export const COMMENT_PAGE_SIZE = 20
/** 音频缓存总容量上限。推荐值 2 GiB。 */
export const AUDIO_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024
/** 音频缓存目录名。 */
export const AUDIO_CACHE_DIR = 'audio'
// ---------- 启动参数 ----------

/** flags 文件字节上限。推荐值 8 × 1024。 */
export const STARTUP_FLAGS_MAX_BYTES = 8 * 1024
/** flags 文件行数上限。推荐值 64。 */
export const STARTUP_FLAGS_MAX_LINES = 64

// ---------- 外部资源 ----------

/** 官方 xlogin 扫码组件地址。 */
export const XLOGIN_URL =
  'https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=716027609&daid=383&style=33&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self&s_url=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump&pt_3rd_aid=100497308&pt_feedback_link=https%3A%2F%2Fsupport.qq.com%2Fproducts%2F77942%3FcustomInfo%3D.appid100497308&theme=2&verify_theme='

/** 本地音频协议 scheme。 */
export const AUDIO_PROTOCOL_SCHEME = 'lychee-audio'
