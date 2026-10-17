import type { Credential, ErrorCode, IpcError } from '../../shared/types'
import { getCredential } from '../credential'

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 进程级稳定 GUID，播放链接请求使用。 */
const GUID = String(Math.floor(1_000_000_000 + Math.random() * 8_000_000_000))

export class UpstreamError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'UpstreamError'
    this.code = code
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
}

function cookieHeader(credential: Credential | null): Record<string, string> {
  if (!credential?.musicid || !credential.musickey) return {}
  return {
    Cookie: [
      `uin=${credential.musicid}`,
      `qqmusic_uin=${credential.musicid}`,
      `qm_keyst=${credential.musickey}`,
      `qqmusic_key=${credential.musickey}`
    ].join('; ')
  }
}

async function fetchOnce(req: UpstreamRequest): Promise<Response> {
  const credential = req.credential === undefined ? getCredential() : req.credential
  const url = new URL(req.path, req.host)
  for (const [key, value] of Object.entries(req.params)) {
    url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    method: req.method ?? 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Referer: 'https://y.qq.com/',
      Accept: 'application/json, text/plain, */*',
      ...cookieHeader(credential),
      ...req.headers
    },
    body: req.body,
    signal: AbortSignal.timeout(req.timeoutMs ?? 15_000)
  })

  if (response.status === 429) {
    throw new UpstreamError('QUOTA_LIMITED', '上游限流')
  }
  if (!response.ok) {
    throw new UpstreamError('UPSTREAM_NETWORK', `上游返回 HTTP ${response.status}`)
  }
  return response
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 统一上游请求入口：签名、Cookie 注入、超时与退避都在此完成。
 * 目前 QQ 音乐公开 CGI 不需要额外签名，保留该入口以隔离未来变更。
 */
export async function upstreamRequest<T>(req: UpstreamRequest): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchOnce(req)
      const text = await response.text()
      try {
        return JSON.parse(text) as T
      } catch {
        throw new UpstreamError('UPSTREAM_CHANGED', '上游响应不是合法 JSON')
      }
    } catch (err) {
      lastError = err
      if (err instanceof UpstreamError && err.code === 'UPSTREAM_CHANGED') throw err
      if (err instanceof UpstreamError && err.code === 'QUOTA_LIMITED' && attempt < 2) {
        await sleep(600 * 2 ** attempt)
        continue
      }
      if (err instanceof UpstreamError && err.code === 'UPSTREAM_NETWORK' && attempt < 2) {
        await sleep(400 * 2 ** attempt)
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
}

export interface MusicuOptions {
  /** 附加/覆盖 comm；传 false 表示完全不带 comm。 */
  comm?: Record<string, unknown> | false
  /** undefined 使用当前登录态，null 强制匿名。 */
  credential?: Credential | null
}

/**
 * 调用 musicu.fcg 的单个 req_0 请求，返回其 data。
 */
export async function musicu<T>(
  module: string,
  method: string,
  param: Record<string, unknown>,
  options: MusicuOptions = {}
): Promise<T> {
  const credential =
    options.credential === undefined ? getCredential() : options.credential
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

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await upstreamRequest<MusicuResponse<T>>({
      host: 'https://u.y.qq.com',
      path: '/cgi-bin/musicu.fcg',
      params: { data: JSON.stringify(payload) },
      credential
    })

    const node = response.req_0
    const code = response.code !== 0 ? response.code : (node?.code ?? 0)
    if (code !== 0) {
      // 2001 / 104604 为上游瞬时繁忙，短退避后重试。
      if ((code === 2001 || code === 104604) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt))
        continue
      }
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
    return new UpstreamError('AUTH_EXPIRED', '登录凭证已过期')
  }
  if (code === 104604 || code === 100001 || code === 2001) {
    return new UpstreamError('QUOTA_LIMITED', '上游限流或繁忙')
  }
  if (code === 104003) {
    return new UpstreamError('NO_STREAM', '当前账号无该音质权限')
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
  return new UpstreamError('UPSTREAM_CHANGED', `上游返回错误码 ${code}（${context}）`)
}
