import type { Comment } from '@shared/types'

export interface CommentSection {
  key: string
  title: string
  comments: Comment[]
  /** 标题栏展示的条数；评论区块使用上游总数，热评使用实际条数。 */
  count: number
}

/**
 * 构建评论栏区块。热评区块只在存在热评时生成，区块是否存在统一由这里决定；
 * 其余区块始终保留，并剔除与热评重复的条目。后续新增区块只需在此追加。
 */
export function buildCommentSections(
  hotComments: Comment[],
  latestComments: Comment[],
  latestTotal = latestComments.length
): CommentSection[] {
  const sections: CommentSection[] = []
  if (hotComments.length > 0) {
    sections.push({ key: 'hot', title: '热评', comments: hotComments, count: hotComments.length })
  }
  const hotIds = new Set(hotComments.map((comment) => comment.id))
  sections.push({
    key: 'latest',
    title: '评论',
    comments: latestComments.filter((comment) => !hotIds.has(comment.id)),
    count: latestTotal
  })
  return sections
}
