import type { IpcError, IpcResult } from '@shared/types'

export class IpcCallError extends Error {
  readonly code: IpcError['code']

  constructor(error: IpcError) {
    super(error.message)
    this.name = 'IpcCallError'
    this.code = error.code
  }
}

export function unwrap<T>(result: IpcResult<T>): T {
  if (result.ok) return result.data
  throw new IpcCallError(result.error)
}

export function describeError(error: unknown): string {
  if (error instanceof IpcCallError) {
    const hints: Record<IpcError['code'], string> = {
      UPSTREAM_NETWORK: '网络异常，请稍后重试',
      AUTH_EXPIRED: '登录已失效，请重新登录',
      NO_STREAM: '当前内容不可播放（可能需要 VIP 或已下架）',
      UPSTREAM_CHANGED: '上游接口发生变化',
      QUOTA_LIMITED: '请求过于频繁，请稍后重试',
      NO_PERMISSION: '当前账号无权执行该操作',
      INTERNAL: '主进程内部错误'
    }
    if (error.code === 'NO_STREAM' && error.message) return error.message
    return hints[error.code] ?? error.message
  }
  return error instanceof Error ? error.message : String(error)
}
