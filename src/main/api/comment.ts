import type { Comment, CommentPage } from '../../shared/types'
import { UpstreamError, musicu } from './client'

interface RawComment {
  CmId?: string | number
  Nick?: string
  Avatar?: string
  Content?: string
  PubTime?: number
  PraiseNum?: number
  ReplyCnt?: number
}

interface CommentListData {
  CommentList?: {
    Comments?: RawComment[]
    Total?: number
    HasMore?: number
  }
}

// 推荐值 20；单次评论请求条数（上游上限 25）。
const COMMENT_PAGE_SIZE = 20

function normalizeAvatar(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

function toComment(raw: RawComment): Comment {
  const seconds = Number(raw.PubTime ?? 0)
  return {
    id: String(raw.CmId ?? ''),
    nickname: raw.Nick ?? '',
    avatarUrl: normalizeAvatar(raw.Avatar),
    content: raw.Content ?? '',
    likedCount: Number(raw.PraiseNum ?? 0),
    replyCount: Number(raw.ReplyCnt ?? 0),
    createdAtMs: seconds > 0 ? (seconds > 1_000_000_000_000 ? seconds : seconds * 1000) : 0
  }
}

/** 歌曲评论；songId 为上游数字歌曲 ID。 */
export async function getComments(songId: string): Promise<CommentPage> {
  const id = songId.trim()
  if (!/^\d+$/.test(id)) {
    return { comments: [], total: 0, hasMore: false }
  }

  const data = await musicu<CommentListData>(
    'music.globalComment.CommentRead',
    'GetNewCommentList',
    {
      PageSize: COMMENT_PAGE_SIZE,
      PageNum: 0,
      HashTagID: '',
      BizType: 1,
      PicEnable: 1,
      LastCommentSeqNo: '',
      SelfSeeEnable: 1,
      BizId: id,
      AudioEnable: 1,
      BizSubType: 2
    },
    { credential: null }
  )

  const list = data.CommentList
  if (!list) {
    throw new UpstreamError('UPSTREAM_CHANGED', '评论响应缺少 CommentList')
  }
  const comments = (list.Comments ?? [])
    .map(toComment)
    .filter((comment) => comment.id.length > 0 && comment.content.trim().length > 0)

  return {
    comments,
    total: Number(list.Total ?? comments.length),
    hasMore: Boolean(list.HasMore)
  }
}
