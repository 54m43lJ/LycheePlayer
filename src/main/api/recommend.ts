import type { RecommendFeed, RecommendSection } from '../../shared/types'

// 待实现，可以根据实际情况调整

/**
 * 推荐接口尚待 fixture 验证；在此之前返回空分区，界面展示空状态。
 * 验证通过后在此补文档 §4.1 的具体方法名与参数。
 */
let cached: RecommendFeed | null = null

function emptySection(id: RecommendSection['id'], title: string): RecommendSection {
  return { id, title, songs: [], playlists: [], refreshedAtMs: Date.now() }
}

function emptyFeed(): RecommendFeed {
  return {
    sections: [
      emptySection('daily', '每日推荐'),
      emptySection('radar', '专属雷达'),
      emptySection('guess', '猜你喜欢')
    ]
  }
}

export async function fetchRecommendFeed(force = false): Promise<RecommendFeed> {
  if (!force && cached) return cached
  cached = emptyFeed()
  return cached
}

export function clearRecommendCache(): void {
  cached = null
}
