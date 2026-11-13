import type {
  Comment,
  CommentLikeResult,
  CommentPage,
  CommentPostResult
} from '../../shared/types'
import { COMMENT_CONTENT_MAX, COMMENT_PAGE_SIZE } from '../../shared/constants'
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

interface AddCommentData {
  SubCode?: number
  subcode?: number
  Msg?: string
  msg?: string
  AddedCmId?: string | number
  VerifyUrl?: string
}

function normalizeAvatar(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

/**
 * 上游评论正文的换行格式不统一：部分记录直接返回真实换行，
 * 另一些记录返回字面量 “\n” / “\r\n” / “\r”。统一归一化为真实换行，
 * 交给评论区的 white-space: pre-wrap 渲染；不解析 HTML。
 */
function normalizeCommentContent(value: string | undefined): string {
  if (!value) return ''
  return value.replace(/\r\n?/g, '\n').replace(/\\r\\n|\\n|\\r/g, '\n')
}

function toComment(raw: RawComment): Comment {
  const seconds = Number(raw.PubTime ?? 0)
  return {
    id: String(raw.CmId ?? ''),
    nickname: raw.Nick ?? '',
    avatarUrl: normalizeAvatar(raw.Avatar),
    content: normalizeCommentContent(raw.Content),
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

/** 发表歌曲评论；上游要求登录并限制正文 300 字。 */
export async function postComment(
  songId: string,
  content: string
): Promise<CommentPostResult> {
  const id = songId.trim()
  if (!/^\d+$/.test(id)) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌曲 ID 无效，无法发表评论')
  }
  const text = content.trim()
  if (!text) {
    throw new UpstreamError('UPSTREAM_CHANGED', '评论内容不能为空')
  }
  if (text.length > COMMENT_CONTENT_MAX) {
    throw new UpstreamError('UPSTREAM_CHANGED', `评论内容不能超过 ${COMMENT_CONTENT_MAX} 字`)
  }
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '请先登录')

  // BizType 1 + BizSubType 2 对应普通歌曲；WriteServer 使用 SubCode 表示业务结果。
  const data = await musicu<AddCommentData>(
    'music.globalComment.CommentWriteServer',
    'AddComment',
    {
      Content: text,
      BizType: 1,
      BizId: id,
      BizSubType: 2
    },
    { credential }
  )

  const subcode = Number(data.SubCode ?? data.subcode ?? 0)
  if (data.VerifyUrl) {
    throw new UpstreamError(
      'NO_PERMISSION',
      '发表评论需要完成验证码，请先在官方客户端完成验证',
      false,
      subcode || undefined
    )
  }
  if (subcode !== 0) {
    if (subcode === 1000) {
      throw new UpstreamError('AUTH_EXPIRED', '登录已失效，请重新登录', false, subcode)
    }
    throw new UpstreamError(
      'UPSTREAM_CHANGED',
      data.Msg || data.msg || `评论发表失败（上游返回 ${subcode}）`,
      false,
      subcode
    )
  }
  return { commentId: String(data.AddedCmId ?? '') }
}
