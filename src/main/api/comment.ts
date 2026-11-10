import type {
  Comment,
  CommentLikeResult,
  CommentPage
} from '../../shared/types'
import { COMMENT_PAGE_SIZE } from '../../shared/constants'
import { getCredential } from '../credential'
import { UpstreamError, musicu } from './client'

interface RawComment {
  CmId?: string | number
  SeqNo?: string | number
  Nick?: string
  Avatar?: string
  Content?: string
  PubTime?: number
  PraiseNum?: number
  ReplyCnt?: number
  /** 当前登录用户是否已点赞；fixture 与真实响应使用 IsPraised。 */
  IsPraised?: number
  IsLiked?: number
}

interface RawCommentList {
  Comments?: RawComment[]
  Total?: number
  HasMore?: number
}

interface CommentListData {
  CommentList?: RawCommentList
}

interface CommentLikeData {
  code?: number
  msg?: string
  subcode?: number
}

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
    createdAtMs: seconds > 0 ? (seconds > 1_000_000_000_000 ? seconds : seconds * 1000) : 0,
    liked: Number(raw.IsPraised ?? raw.IsLiked ?? 0) === 1
  }
}

/** 歌曲评论；songId 为上游数字歌曲 ID。 */
export async function getComments(
  songId: string,
  cursor = ''
): Promise<CommentPage> {
  const id = songId.trim()
  if (!/^\d+$/.test(id)) {
    return { comments: [], total: 0, hasMore: false }
  }

  // 必须携带登录 Cookie，上游才会按当前用户返回 IsPraised；未登录时自动匿名。
  // SeqNo 可能超过 Number 安全范围，按字符串解析供下一页游标使用。
  const data = await musicu<CommentListData>(
    'music.globalComment.CommentRead',
    'GetNewCommentList',
    {
      PageSize: COMMENT_PAGE_SIZE,
      PageNum: 0,
      HashTagID: '',
      BizType: 1,
      PicEnable: 1,
      LastCommentSeqNo: cursor,
      SelfSeeEnable: 1,
      BizId: id,
      AudioEnable: 1,
      BizSubType: 2
    },
    { stringFields: ['SeqNo'] }
  )

  const list = data.CommentList
  if (!list) {
    throw new UpstreamError('UPSTREAM_CHANGED', '评论响应缺少 CommentList')
  }
  const raw = list.Comments ?? []
  const nextCursor = String(raw.at(-1)?.SeqNo ?? '')
  const comments = raw
    .map(toComment)
    .filter((comment) => comment.id.length > 0 && comment.content.trim().length > 0)
    .slice(0, COMMENT_PAGE_SIZE)

  return {
    comments,
    total: Number(list.Total ?? comments.length),
    hasMore: Boolean(list.HasMore) && /^\d+$/.test(nextCursor),
    nextCursor
  }
}

async function updateLike(commentId: string, type: 3 | 4): Promise<CommentLikeResult> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '请先登录')
  const data = await musicu<CommentLikeData>(
    'GlobalComment.GlobalCommentWriteServer',
    'UpdateHotComment',
    {
      comment_id: commentId,
      type,
      uin: credential.musicid
    },
    { credential }
  )
  if (Number(data.code ?? 0) !== 0 || Number(data.subcode ?? 0) !== 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', data.msg || '评论点赞失败')
  }
  return { commentId, liked: type === 3 }
}

export async function likeComment(commentId: string): Promise<CommentLikeResult> {
  return updateLike(commentId, 3)
}

export async function unlikeComment(commentId: string): Promise<CommentLikeResult> {
  return updateLike(commentId, 4)
}
