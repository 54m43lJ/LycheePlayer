import type { Comment } from '@shared/types'
import { COMMENT_REPLY_PAGE_LINK_MAX, COMMENT_REPLY_PAGE_SIZE } from '@shared/constants'

export interface ReplyPagingState {
  itemCount: number
  loadedPageCount: number
  total: number
  hasMore: boolean
  loaded: boolean
}

/**
 * 回复页数。上游 HasMore 已为 false 时只按实际拉到的回复计算，
 * 不再用可能偏大的 Total 保留无法打开的空页；仍有下一页时保留
 * Total 推算的远端页码，点击时按游标继续补拉。
 */
export function replyPageCount(state: ReplyPagingState): number {
  if (state.loaded && !state.hasMore) {
    return Math.max(1, Math.ceil(state.itemCount / COMMENT_REPLY_PAGE_SIZE))
  }
  const byTotal = Math.ceil(
    Math.max(state.total, state.itemCount) / COMMENT_REPLY_PAGE_SIZE
  )
  const byMore = state.hasMore ? state.loadedPageCount + 1 : state.loadedPageCount
  return Math.max(1, byTotal, byMore)
}

/** 以当前页为中心生成最多 max 个连续页码，并夹在 1..pageCount 内。 */
export function replyPageLinks(
  currentPage: number,
  pageCount: number,
  max = COMMENT_REPLY_PAGE_LINK_MAX
): number[] {
  const count = Math.max(1, pageCount)
  const current = Math.min(Math.max(1, currentPage), count)
  const width = Math.max(1, max)
  let start = Math.max(1, current - Math.floor(width / 2))
  const end = Math.min(count, start + width - 1)
  start = Math.max(1, end - width + 1)
  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

/** 回复热评固定在最前；普通回复中与热评重复的条目被移除。 */
export function hotRepliesFirst(hotReplies: Comment[], replies: Comment[]): Comment[] {
  if (hotReplies.length === 0) return replies
  const hotIds = new Set(hotReplies.map((reply) => reply.id))
  return [...hotReplies, ...replies.filter((reply) => !hotIds.has(reply.id))]
}
