import type { MvDetail, MvStream, SearchResult } from '../../shared/types'
import { UpstreamError } from './client'

// 待实现，可以根据实际情况调整

/**
 * MV 搜索 / 详情 / 取流接口尚待 fixture 验证；验证前不写猜测的方法名。
 * 搜索返回空结果，详情与取流明确返回上游变更错误。
 */
export async function searchMv(_keyword: string, _pageNo: number): Promise<SearchResult> {
  return { songs: [], singers: [], albums: [], playlists: [], mvs: [], total: 0 }
}

export async function getMvDetail(_mvId: string): Promise<MvDetail> {
  throw new UpstreamError('UPSTREAM_CHANGED', 'MV 详情接口待探测')
}

export async function getMvStream(
  _mvId: string,
  _quality: MvStream['quality']
): Promise<MvStream> {
  throw new UpstreamError('UPSTREAM_CHANGED', 'MV 取流接口待探测')
}
