import type { Credential, ErrorCode, IpcError, UpstreamBlockedEvent } from '../../shared/types'
import {
  MUSICU_BUSY_BACKOFF_MS,
  UPSTREAM_BLOCK_MS,
  UPSTREAM_NETWORK_BACKOFF_MS,
  UPSTREAM_QUOTA_BACKOFF_MS,
  UPSTREAM_RATE_LIMIT_BURST,
  UPSTREAM_RATE_LIMIT_PER_SECOND,
  UPSTREAM_RETRY_ATTEMPTS,
  UPSTREAM_TIMEOUT_MS
} from '../../shared/constants'
import { getCredential } from '../credential'

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 进程级稳定 GUID，播放链接请求使用。 */
const GUID = String(Math.floor(1_000_000_000 + Math.random() * 8_000_000_000))

const BLOCK_REASON = 'QQ 音乐拒绝了播放链接请求（104009），可能是网络 / VPN / 代理出口或临时风控'

let blockedUntilMs = 0
let blockNotifier: ((event: UpstreamBlockedEvent) => void) | null = null

/** 注册全局截断通知；主进程通过 IPC 广播给渲染层展示 toast。 */
export function setUpstreamBlockNotifier(
  notifier: ((event: UpstreamBlockedEvent) => void) | null
): void {
  blockNotifier = notifier
}

/** 返回全局截断的剩余时长；0 表示当前可以请求上游。 */
export function upstreamBlockRemainingMs(): number {
  return Math.max(0, blockedUntilMs - Date.now())
}

/**
 * 收到 104009 后进入全局截断窗口：窗口内所有上游请求立即失败，避免继续触发风控。
 * 已经处于截断窗口时不重复通知，避免并发失败刷出多条 toast。
 */
export function tripUpstreamBlock(reason = BLOCK_REASON): void {
  const wasBlocked = upstreamBlockRemainingMs() > 0
  const untilMs = Date.now() + UPSTREAM_BLOCK_MS
  blockedUntilMs = Math.max(blockedUntilMs, untilMs)
  if (!wasBlocked) blockNotifier?.({ untilMs, reason })
}

/** 仅测试使用：清除截断状态。 */
export function resetUpstreamBlock(): void {
  blockedUntilMs = 0
}

export function assertUpstreamAvailable(): void {
  const remaining = upstreamBlockRemainingMs()
  if (remaining <= 0) return
  throw new UpstreamError(
    'UPSTREAM_NETWORK',
    `上游请求已暂停（104009），请 ${Math.ceil(remaining / 1000)} 秒后重试`,
    false,
    104009
  )
}

export class UpstreamError extends Error {
  readonly code: ErrorCode
  readonly retryable: boolean
  readonly upstreamCode?: number

  constructor(code: ErrorCode, message: string, retryable = false, upstreamCode?: number) {
    super(message)
    this.name = 'UpstreamError'
    this.code = code
    this.retryable = retryable
    this.upstreamCode = upstreamCode
  }
}

export function getGuid(): string {
  return GUID
}

export function toIpcError(err: unknown): IpcError {
  if (err instanceof UpstreamError) {
    return { code: err.code, message: err.message }
  }
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { code: 'UPSTREAM_NETWORK', message: '上游请求超时' }
    }
    return { code: 'INTERNAL', message: err.message }
  }
  return { code: 'INTERNAL', message: String(err) }
}

export interface UpstreamRequest {
  host: string
  path: string
  params: Record<string, string>
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  credential?: Credential | null
  timeoutMs?: number
  /** 解析前把指定字段的数字字面量转成字符串，避免超过 Number 安全范围时丢精度。 */
  stringFields?: string[]
}

function cookieHeader(credential: Credential | null): Record<string, string> {
  if (!credential?.musicid || !credential.musickey) return {}
  const merged: Record<string, string> = {
    ...(credential.webCookies ?? {}),
    uin: credential.musicid,
    qqmusic_uin: credential.musicid,
    qm_keyst: credential.musickey,
    qqmusic_key: credential.musickey
  }
  return {
    Cookie: Object.entries(merged)
      .filter(([name, value]) => name && value !== '')
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }
}

// 全局令牌桶：平滑探测 / 连续失败切歌等场景的请求突发，避免触发上游风控。
const RATE_LIMIT_INTERVAL_MS = 1000 / UPSTREAM_RATE_LIMIT_PER_SECOND
let rateTokens = UPSTREAM_RATE_LIMIT_BURST
let rateUpdatedAt = Date.now()
let rateQueue: Promise<void> = Promise.resolve()

/** 每个实际发往 QQ 音乐的上游请求都要先取得一个令牌。 */
export function throttleUpstream(): Promise<void> {
  const task = rateQueue.then(async () => {
    for (;;) {
      const now = Date.now()
      rateTokens = Math.min(
        UPSTREAM_RATE_LIMIT_BURST,
        rateTokens + (now - rateUpdatedAt) / RATE_LIMIT_INTERVAL_MS
      )
      rateUpdatedAt = now
      if (rateTokens >= 1) {
        rateTokens -= 1
        return
      }
      await sleep(Math.max(1, Math.ceil((1 - rateTokens) * RATE_LIMIT_INTERVAL_MS)))
    }
  })
  rateQueue = task.catch(() => undefined)
  return task
}

async function fetchOnce(req: UpstreamRequest): Promise<Response> {
  assertUpstreamAvailable()
  const credential = req.credential === undefined ? getCredential() : req.credential
  const url = new URL(req.path, req.host)
  for (const [key, value] of Object.entries(req.params)) {
    url.searchParams.set(key, value)
  }

  await throttleUpstream()
  // 排队取令牌期间可能刚好收到 104009，取到令牌后再检查一次。
  assertUpstreamAvailable()

  let response: Response
  try {
    response = await fetch(url, {
      method: req.method ?? 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://y.qq.com/',
        Accept: 'application/json, text/plain, */*',
        ...cookieHeader(credential),
        ...req.headers
      },
      body: req.body,
      signal: AbortSignal.timeout(req.timeoutMs ?? UPSTREAM_TIMEOUT_MS)
    })
  } catch (error) {
    // 连接失败 / 超时不重试。
    const message =
      error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
        ? '上游请求超时'
        : '无法连接上游'
    throw new UpstreamError('UPSTREAM_NETWORK', message)
  }

  if (response.status === 429) {
    throw new UpstreamError('QUOTA_LIMITED', '上游限流', true)
  }
  if (!response.ok) {
    throw new UpstreamError('UPSTREAM_NETWORK', `上游返回 HTTP ${response.status}`, true)
  }
  return response
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 把指定字段的裸数字改为字符串，保留超过 Number.MAX_SAFE_INTEGER 的精度。 */
function stringifyNumberFields(text: string, fields: string[]): string {
  let next = text
  for (const field of fields) {
    const pattern = new RegExp(`("${field}"\\s*:\\s*)(-?\\d+)`, 'g')
    next = next.replace(pattern, '$1"$2"')
  }
  return next
}

/** 统一上游请求入口：Cookie 注入、超时与退避都在此完成。 */
export async function upstreamRequest<T>(req: UpstreamRequest): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < UPSTREAM_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchOnce(req)
      let text: string
      try {
        text = await response.text()
      } catch {
        throw new UpstreamError('UPSTREAM_NETWORK', '读取上游响应失败')
      }
      try {
        const parsed = req.stringFields?.length
          ? stringifyNumberFields(text, req.stringFields)
          : text
        return JSON.parse(parsed) as T
      } catch {
        throw new UpstreamError('UPSTREAM_CHANGED', '上游响应不是合法 JSON')
      }
    } catch (err) {
      lastError = err
      if (err instanceof UpstreamError && err.code === 'UPSTREAM_CHANGED') throw err
      if (err instanceof UpstreamError && err.retryable && attempt < UPSTREAM_RETRY_ATTEMPTS - 1) {
        const delay =
          err.code === 'QUOTA_LIMITED'
            ? UPSTREAM_QUOTA_BACKOFF_MS
            : UPSTREAM_NETWORK_BACKOFF_MS
        await sleep(delay * 2 ** attempt)
        continue
      }
      throw err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new UpstreamError('UPSTREAM_NETWORK', '上游请求失败')
}

interface MusicuResponse<T> {
  code: number
  req_0?: {
    code: number
    data?: T
    message?: string
  }
  req?: {
    code: number
    data?: T
    message?: string
  }
}

/** 部分接口把具体错误放在 data.retcode，而 req_0.code 统一为 1000。 */
function dataErrorCode(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const code = Number((data as Record<string, unknown>).retcode)
  return Number.isFinite(code) && code !== 0 ? code : null
}

export interface MusicuOptions {
  /** 附加/覆盖 comm；传 false 表示完全不带 comm。 */
  comm?: Record<string, unknown> | false
  /** undefined 使用当前登录态，null 强制匿名。 */
  credential?: Credential | null
  /** vkey 需要先尝试备用入口，104009 由调用方在两次失败后统一触发截断。 */
  deferBlock?: boolean
  /** 解析前把指定字段的数字字面量转成字符串。 */
  stringFields?: string[]
}

/** 调用 musicu.fcg 的单个 req_0 请求，返回其 data。 */
export async function musicu<T>(
  module: string,
  method: string,
  param: Record<string, unknown>,
  options: MusicuOptions = {}
): Promise<T> {
  const credential = options.credential === undefined ? getCredential() : options.credential
  const comm =
    options.comm === false
      ? undefined
      : {
          uin: credential?.musicid ? Number(credential.musicid) || 0 : 0,
          format: 'json',
          ct: 24,
          cv: 0,
          ...options.comm
        }

  const payload: Record<string, unknown> = {
    req_0: { module, method, param }
  }
  if (comm) payload.comm = comm

  for (let attempt = 0; attempt < UPSTREAM_RETRY_ATTEMPTS; attempt += 1) {
    const response = await upstreamRequest<MusicuResponse<T>>({
      host: 'https://u.y.qq.com',
      path: '/cgi-bin/musicu.fcg',
      params: { data: JSON.stringify(payload) },
      credential,
      stringFields: options.stringFields
    })

    const node = response.req_0
    const baseCode = response.code !== 0 ? response.code : (node?.code ?? 0)
    const specificCode = dataErrorCode(node?.data)
    const code = baseCode === 1000 && specificCode !== null ? specificCode : baseCode
    if (code !== 0) {
      // 2001 / 104604 为上游瞬时繁忙，短退避后重试；其余错误码直接映射。
      if ((code === 2001 || code === 104604) && attempt < UPSTREAM_RETRY_ATTEMPTS - 1) {
        await sleep(MUSICU_BUSY_BACKOFF_MS * 2 ** attempt)
        continue
      }
      if (code === 104009 && !options.deferBlock) tripUpstreamBlock()
      throw mapUpstreamCode(code, `${module}.${method}`)
    }
    if (!node) {
      throw new UpstreamError('UPSTREAM_CHANGED', `musicu 响应缺少 req_0（${module}.${method}）`)
    }
    if (node.data === undefined) {
      throw new UpstreamError('UPSTREAM_CHANGED', `musicu 响应缺少 data（${module}.${method}）`)
    }
    return node.data
  }

  throw new UpstreamError('QUOTA_LIMITED', '上游持续繁忙')
}

export function mapUpstreamCode(code: number, context: string): UpstreamError {
  if (code === 1000 || code === 104401 || code === 104400) {
    return new UpstreamError('AUTH_EXPIRED', '登录凭证已过期', false, code)
  }
  if (code === 104009) {
    return new UpstreamError(
      'UPSTREAM_NETWORK',
      'QQ 音乐拒绝了播放链接请求（104009），请检查网络 / VPN / 代理出口后重试',
      false,
      code
    )
  }
  if (code === 104604 || code === 2001 || code === 100001) {
    return new UpstreamError('QUOTA_LIMITED', '上游限流或繁忙')
  }
  if (code === 104003) {
    return new UpstreamError('NO_STREAM', '当前账号无该音质权限', false, code)
  }
  if (code === 104004) {
    return new UpstreamError('UPSTREAM_NETWORK', '播放链接获取失败（104004），请稍后重试', false, code)
  }
  if (code === 104013) {
    return new UpstreamError('NO_PERMISSION', '当前设备无法播放该内容（104013）', false, code)
  }
  if (code === 403) {
    return new UpstreamError('NO_PERMISSION', '当前账号无权执行该操作')
  }
  const loginMessages: Record<number, string> = {
    20261: '登录参数错误',
    20271: '验证码错误',
    20272: '账号绑定异常',
    20274: '账号绑定缺失，请先在官方 QQ 音乐客户端登录一次',
    20277: '账号受限',
    20278: '账号受限',
    20279: '登录设备数量超限',
    20450: '账号已被封禁'
  }
  if (loginMessages[code]) {
    return new UpstreamError('AUTH_EXPIRED', loginMessages[code])
  }
  return new UpstreamError('UPSTREAM_CHANGED', `上游返回错误码 ${code}（${context}）`, false, code)
}
