import type { PlaybackPermission, Song, VipLevel, VipStatus } from './types'

const VIP_RANK: Record<VipLevel, number> = {
  none: 0,
  vip: 1,
  deluxe: 2,
  super: 3
}

/**
 * 按阻断判定栈从 Song 元数据与账号会员状态派生播放权限。
 * 只列不可播条件；未命中任一阻断即视为可播。
 */
export function playbackPermission(song: Song, vip: VipStatus): PlaybackPermission {
  const maxQuality = song.maxQuality
  const blocked = (): PlaybackPermission => ({ playable: false, maxQuality })
  const allowed = (): PlaybackPermission => ({ playable: true, maxQuality })

  if (song.status === 1 || song.status === 2) return blocked()
  if (song.pay_play !== 1) return allowed()
  if (vip.state === 'unknown') return blocked()

  const rank = VIP_RANK[vip.level]
  if (rank < VIP_RANK.deluxe && song.pay_month === 0) return blocked()
  if (rank < VIP_RANK.vip) {
    if (song.pay_status === 0) return blocked()
    if (song.pay_month !== 0 && song.pay_month !== 1) return blocked()
    if (song.pay_month === 1) return blocked()
  }
  return allowed()
}
