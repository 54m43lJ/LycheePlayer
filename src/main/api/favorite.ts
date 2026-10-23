import type { FavoriteState } from '../../shared/types'
import { UpstreamError } from './client'

// 待实现，可以根据实际情况调整

/**
 * 收藏接口尚待 fixture 验证；在验证前不写入猜测的方法名。
 * 读取返回未知状态（未收藏），写入明确返回上游变更错误。
 */
export async function getFavoriteStates(mids: string[]): Promise<FavoriteState[]> {
  return mids.map((songMid) => ({ songMid, favorited: false }))
}

export async function toggleFavorite(_songMid: string): Promise<FavoriteState> {
  throw new UpstreamError('UPSTREAM_CHANGED', '收藏接口待探测，暂时无法修改收藏状态')
}
