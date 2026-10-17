import type { UserProfile } from '../../shared/types'
import { getCredential } from '../credential'
import { UpstreamError, upstreamRequest } from './client'
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
