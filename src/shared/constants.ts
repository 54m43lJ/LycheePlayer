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
/** 上游请求持续速率上限（每秒）。推荐值 4。 */
export const UPSTREAM_RATE_LIMIT_PER_SECOND = 4
/** 上游请求突发令牌容量。推荐值 8。 */
export const UPSTREAM_RATE_LIMIT_BURST = 8
/** 收到 104009 后全局截断上游请求的时长。推荐值 60_000 ms。 */
export const UPSTREAM_BLOCK_MS = 60_000

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

/** “我喜欢”固定歌单 ID。 */
export const FAVORITES_PLAYLIST_ID = 'liked'
/** 歌单轻量探测页大小（最近歌单校验 / 轮询首页）。 */
export const PLAYLIST_PAGE_SIZE = 50
/** 完整歌单快照单次拉取条数。推荐值 2000；实测上游单次最多可返回约 1 万首。 */
export const PLAYLIST_FETCH_PAGE_SIZE = 2000
/** 完整歌单拉取的最大页数，约 2 万首；防止异常 total 造成无限循环。 */
export const PLAYLIST_FETCH_PAGE_MAX = 10
/**
 * 完整歌单校验允许缺失的比例与下限。推荐值 0.02 / 10。
 * 上游会静默省略部分不可用曲目，因此不能要求条数与 total 严格相等。
 */
export const PLAYLIST_FETCH_MISSING_RATIO = 0.02
export const PLAYLIST_FETCH_MISSING_MIN = 10
/** 歌单本地最大分页数。推荐值 20_000。 */
export const PLAYLIST_PAGE_MAX = 20_000
/** 歌单界面变化轮询间隔。推荐值 15_000 ms。 */
export const PLAYLIST_POLL_INTERVAL_MS = 15_000
/** 完整歌单刷新失败后的自动重试间隔。推荐值 5 * 60_000 ms。 */
export const PLAYLIST_REFRESH_RETRY_MS = 5 * 60_000
/** 歌单缓存字节上限。推荐值 64 × 1024 × 1024。 */
export const PLAYLIST_CACHE_MAX_BYTES = 64 * 1024 * 1024

// ---------- 可用性探测 ----------

/**
 * 单次探测的歌曲上限。推荐值 50。
 * 约束：与 PLAYLIST_PAGE_SIZE 对齐（一个 50 首歌单页一次探测），且不超过 IPC_SONG_MIDS_MAX。
 */
export const PROBE_MIDS_MAX = 50
/** 歌曲详情并发（批量详情缺失时的单曲兜底）。推荐值 2。 */
export const PROBE_DETAIL_CONCURRENCY = 2
/** 批量歌曲详情单次请求上限。推荐值 50。 */
export const SONG_DETAIL_BATCH = 50
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
/** 连续整批不可播的批次数上限；达到后停止本轮探测。推荐值 2。 */
export const PROBE_EMPTY_BATCH_LIMIT = 2
/** 最近歌单数量上限。 */
export const RECENT_PLAYLIST_LIMIT = 5
/** 最近歌单校验节流。推荐值 5000 ms。 */
export const RECENT_PLAYLIST_VALIDATE_MS = 5000

/** 雷达 / 猜你喜欢分区缓存时长；每日推荐按上海自然日 0 点过期，不使用该 TTL。推荐值 24 小时。 */
export const RECOMMEND_CACHE_TTL_MS = 24 * 60 * 60_000
/** 发现页分区顺序；渲染与主进程共用。 */
export const RECOMMEND_SECTION_IDS = ['daily', 'radar', 'guess'] as const
export const RECOMMEND_SECTION_TITLES = {
  daily: '每日推荐',
  radar: '专属雷达',
  guess: '猜你喜欢'
} as const
/** 猜你喜欢连续队列每批拉取的歌曲数。推荐值 5。 */
export const GUESS_RADIO_BATCH_SIZE = 5
/** 歌手 / 专辑歌曲单页条数；上游上限 100。 */
export const CATALOG_PAGE_SIZE = 50
/** 歌手专辑列表单页条数；上游上限 80。 */
export const ARTIST_ALBUM_PAGE_SIZE = 80
/** 歌手页展开专辑时最多补拉的页数；80 × 20 = 1600 张。 */
export const ARTIST_ALBUM_PAGE_MAX = 20

/** 下载中心进度轮询间隔。推荐值 1500 ms。 */
export const DOWNLOAD_POLL_MS = 1500
/** 下载并发；固定为 1，按入队顺序串行。 */
export const DOWNLOAD_CONCURRENCY = 1
/** 单次“下载全部”入队歌曲上限。推荐值 2000。 */
export const DOWNLOAD_QUEUE_MAX = 2000
/** 下载索引文件名前缀；按账号隔离并放在 downloadDir 内。 */
export const DOWNLOAD_INDEX_PREFIX = '.lychee-downloads-'
/** 下载索引落盘节流。推荐值 800 ms。 */
export const DOWNLOAD_INDEX_SAVE_MS = 800

// ---------- 播放 ----------

/** 播放状态推送节流窗口。推荐值 900 ms。 */
export const PLAYER_STATE_THROTTLE_MS = 900
/** 上一首回退历史容量上限。推荐值 100。 */
export const PLAY_HISTORY_MAX = 100
/** 用户可见的播放历史容量上限。推荐值 1000。 */
export const PLAY_HISTORY_LIMIT = 1000
/** 播放历史 localStorage key 前缀；与账号 musicid（未登录为 anonymous）拼接。 */
export const PLAY_HISTORY_STORAGE_PREFIX = 'lychee:play-history:'
/** Toast 自动消失时间。推荐值 3600 ms。 */
export const TOAST_DURATION_MS = 3600
/** 判断“回到开头”而非上一首的播放位置。推荐值 3000 ms。 */
export const PREVIOUS_RESTART_THRESHOLD_MS = 3000
/** 连续无法获取播放链接的歌曲数上限；达到后停止自动切歌。推荐值 10。 */
export const NO_STREAM_SKIP_LIMIT = 10
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
/** 上游实测 PageSize 上限：25 成功，26 起返回业务码 10000。 */
export const COMMENT_PAGE_SIZE = 25
/** “跳转到底部”一次最多补拉的页数；25 × 40 = 1000 条，防止热门歌曲无限拉取与渲染阻塞。 */
export const COMMENT_LOAD_ALL_PAGE_MAX = 40
/** 发表评论正文长度上限；上游限制 300 字。 */
export const COMMENT_CONTENT_MAX = 300
/** 音频缓存上限的最高档位，也是旧版本沿用的默认值（2 GiB）。 */
export const AUDIO_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024
/** 播放缓存上限的可选档位：128M / 256M / 512M / 1G / 1.5G / 2G。 */
export const AUDIO_CACHE_LIMIT_STEPS_BYTES = [
  128 * 1024 * 1024,
  256 * 1024 * 1024,
  512 * 1024 * 1024,
  1024 * 1024 * 1024,
  1536 * 1024 * 1024,
  2048 * 1024 * 1024
] as const
/** 默认缓存上限；与旧版本保持一致，为 2 GiB。 */
export const AUDIO_CACHE_DEFAULT_BYTES = AUDIO_CACHE_MAX_BYTES

/** 将任意输入归一到最近的缓存上限档位；非法值回退到默认档位。 */
export function normalizeAudioCacheLimitBytes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return AUDIO_CACHE_DEFAULT_BYTES
  let best: number = AUDIO_CACHE_LIMIT_STEPS_BYTES[0]
  for (const step of AUDIO_CACHE_LIMIT_STEPS_BYTES) {
    if (Math.abs(step - value) < Math.abs(best - value)) best = step
  }
  return best
}
/** 音频缓存目录名。 */
export const AUDIO_CACHE_DIR = 'audio'
/** 音频缓存进度上报节流。推荐值 300 ms。 */
export const CACHE_PROGRESS_THROTTLE_MS = 300
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
