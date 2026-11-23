import type { UserProfile, VipLevel, VipStatus } from '../../shared/types'
import { VIP_CACHE_MS, VIP_UNKNOWN_CACHE_MS } from '../../shared/constants'
import { getCredential } from '../credential'
import { UpstreamError, musicu, upstreamRequest } from './client'
import { hash33 } from './hash'

interface ProfileResponse {
  code?: number
  data?: {
    creator?: {
      nick?: string
      headpic?: string
      hostuin?: string
    }
  }
}

/** 登录用户昵称/头像；仅用于界面展示。 */
export async function getProfile(): Promise<UserProfile> {
  const credential = getCredential()
  if (!credential) {
    throw new UpstreamError('AUTH_EXPIRED', '未登录')
  }

  const data = await upstreamRequest<ProfileResponse>({
    host: 'https://c6.y.qq.com',
    path: '/rsc/fcgi-bin/fcg_get_profile_homepage.fcg',
    params: {
      g_tk: String(hash33(credential.musickey, 5381)),
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      notice: '0',
      cid: '205360838',
      needNewCode: '0',
      loginUin: credential.musicid,
      hostUin: '0',
      userid: credential.musicid,
      reqfrom: '1'
    }
  })

  if ((data.code ?? 0) !== 0) {
    throw new UpstreamError('AUTH_EXPIRED', '登录态已失效')
  }
  const creator = data.data?.creator
  return {
    nickname: creator?.nick ?? credential.musicid,
    avatarUrl: creator?.headpic?.replace(/^http:/, 'https:') ?? ''
  }
}

interface VipData {
  svip?: number
  star?: number
  ystar?: number
  identity?: {
    vip?: number
    huge_vip?: number
    HugeVip?: number
    year_flag?: number
    huge_year_flag?: number
    /** 会员到期展示时间，格式通常为 YYYY-MM-DD HH:mm:ss。 */
    overdate?: string
    HugeVipStart?: string
    HugeVipEnd?: string
    LMStart?: string
    LMEnd?: string
  }
  userinfo?: {
    expire?: number
  }
}

interface VipCache {
  musicid: string
  expiresAt: number
  status: VipStatus
}

let vipCache: VipCache | null = null

function isFlag(value: unknown): boolean {
  return Number(value) > 0
}

function unknownVipStatus(): VipStatus {
  return { state: 'unknown', isVip: false, level: 'none', expiresAtMs: null }
}

/** 上游到期时间可能是秒或毫秒；无法识别时返回 null。 */
function parseVipExpire(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  if (numeric > 1e12) return numeric
  if (numeric > 1e9) return numeric * 1000
  return null
}

/** identity.overdate 为展示用日期字符串；按北京时间解析，失败返回 null。 */
function parseVipOverdate(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = Date.parse(`${value.trim().replace(' ', 'T')}+08:00`)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * 当前登录账号的会员状态；接口失败返回 unknown，不把失败当作非 VIP。
 * 字段映射（已用同一账号购买超级会员前后对比确认）：
 * identity.vip=绿钻，svip=豪华绿钻，HugeVip=超级会员。
 * 星级等其余标记不参与播放判断。
 */
export async function getVipStatus(): Promise<VipStatus> {
  const credential = getCredential()
  if (!credential) {
    return { state: 'known', isVip: false, level: 'none', expiresAtMs: null }
  }
  if (
    vipCache &&
    vipCache.musicid === credential.musicid &&
    vipCache.expiresAt > Date.now()
  ) {
    return vipCache.status
  }

  try {
    const data = await musicu<VipData>('VipLogin.VipLoginInter', 'vip_login_base', {})
    const identity = data.identity ?? {}
    const vip = isFlag(identity.vip)
    const deluxe = isFlag(data.svip)
    const superVip = isFlag(identity.HugeVip ?? identity.huge_vip)
    const level: VipLevel = superVip ? 'super' : deluxe ? 'deluxe' : vip ? 'vip' : 'none'
    const status: VipStatus = {
      state: 'known',
      isVip: level !== 'none',
      level,
      expiresAtMs:
        (superVip
          ? parseVipOverdate(identity.HugeVipEnd)
          : parseVipOverdate(identity.overdate) ?? parseVipOverdate(identity.LMEnd)) ??
        parseVipExpire(data.userinfo?.expire) ??
        parseVipOverdate(identity.overdate)
    }
    vipCache = {
      musicid: credential.musicid,
      expiresAt: Date.now() + VIP_CACHE_MS,
      status
    }
    return status
  } catch {
    const status = unknownVipStatus()
    vipCache = {
      musicid: credential.musicid,
      expiresAt: Date.now() + VIP_UNKNOWN_CACHE_MS,
      status
    }
    return status
  }
}

/** 兼容调用：true / false 为已知状态，null 表示接口失败、无法判断。 */
export async function isVipUser(): Promise<boolean | null> {
  const status = await getVipStatus()
  return status.state === 'known' ? status.isVip : null
}
