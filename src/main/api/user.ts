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

/**
 * 当前登录账号的会员状态；接口失败返回 unknown，不把失败当作非 VIP。
 * 只把 vip / 豪华绿钻 / svip 视为播放权益，星级等其余标记不参与判断。
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
    const huge = isFlag(identity.huge_vip ?? identity.HugeVip)
    const svip = isFlag(data.svip)
    const level: VipLevel = svip ? 'svip' : huge ? 'huge_vip' : vip ? 'vip' : 'none'
    const status: VipStatus = {
      state: 'known',
      isVip: level !== 'none',
      level,
      expiresAtMs: parseVipExpire(data.userinfo?.expire)
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
