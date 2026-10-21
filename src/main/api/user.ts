import type { UserProfile } from '../../shared/types'
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
  identity?: {
    vip?: number
    huge_vip?: number
    HugeVip?: number
  }
}

interface VipCache {
  musicid: string
  expiresAt: number
  isVip: boolean
}

// 推荐值 5 × 60_000 ms；VIP 状态缓存时长。
const VIP_CACHE_MS = 5 * 60_000

let vipCache: VipCache | null = null

/** 当前登录账号是否具有 VIP 权益；接口失败时按非 VIP 处理。 */
export async function isVipUser(): Promise<boolean> {
  const credential = getCredential()
  if (!credential) return false
  if (
    vipCache &&
    vipCache.musicid === credential.musicid &&
    vipCache.expiresAt > Date.now()
  ) {
    return vipCache.isVip
  }

  try {
    const data = await musicu<VipData>('VipLogin.VipLoginInter', 'vip_login_base', {})
    const isVip = Boolean(
      data.identity?.vip || data.identity?.huge_vip || data.identity?.HugeVip || data.svip
    )
    vipCache = {
      musicid: credential.musicid,
      expiresAt: Date.now() + VIP_CACHE_MS,
      isVip
    }
    return isVip
  } catch {
    return false
  }
}
