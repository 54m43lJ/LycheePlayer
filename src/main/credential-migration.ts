import type { Credential, LoginMethod } from '../shared/types'

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function optionalCookieJar(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const jar: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.length > 0) jar[key] = entry
  }
  return Object.keys(jar).length > 0 ? jar : undefined
}

/** v1 没有 method 字段：按旧 loginType 与微信 musickey 前缀识别。 */
export function inferLoginMethod(value: {
  method?: unknown
  loginType?: unknown
  musickey?: unknown
}): LoginMethod {
  if (value.method === 'wechat' || value.method === 'qq') return value.method
  const loginType = Number(value.loginType)
  const musickey = typeof value.musickey === 'string' ? value.musickey : ''
  return loginType === 1 || musickey.startsWith('W_X') ? 'wechat' : 'qq'
}

/** 把 v1 / v2 凭证归一化为当前模型；字段不完整时返回 null。 */
export function normalizeCredential(value: unknown): Credential | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (typeof candidate.musicid !== 'string' || candidate.musicid.length === 0) return null
  if (typeof candidate.musickey !== 'string' || candidate.musickey.length === 0) return null
  if (candidate.expiredAtMs !== null && typeof candidate.expiredAtMs !== 'number') {
    return null
  }

  return {
    method: inferLoginMethod(candidate),
    musicid: candidate.musicid,
    musickey: candidate.musickey,
    expiredAtMs: candidate.expiredAtMs,
    refreshKey: optionalString(candidate.refreshKey),
    refreshToken: optionalString(candidate.refreshToken),
    accessToken: optionalString(candidate.accessToken),
    openid: optionalString(candidate.openid),
    unionid: optionalString(candidate.unionid),
    webCookies: optionalCookieJar(candidate.webCookies)
  }
}
