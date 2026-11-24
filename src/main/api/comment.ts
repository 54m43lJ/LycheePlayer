import type {
  Comment,
  CommentLikeResult,
  CommentPage,
  CommentPostResult
} from '../../shared/types'
import {
  COMMENT_CONTENT_MAX,
  COMMENT_HOT_REPLY_LIMIT,
  COMMENT_HOT_REPLY_MIN_LIKES,
  COMMENT_PAGE_SIZE,
  COMMENT_REPLY_PAGE_SIZE
} from '../../shared/constants'
import { getCredential } from '../credential'
import { UpstreamError, musicu } from './client'

interface RawComment {
  CmId?: string | number
  SeqNo?: string | number
  Nick?: string
  Avatar?: string
  Content?: string
  /** 评论附图 URL。 */
  Pic?: string
  /** 评论内嵌表情图片 URL，对应 Content 中的 U+FFFC 占位。 */
  EmoPic?: string
  PubTime?: number
  PraiseNum?: number
  ReplyCnt?: number
  /** 当前登录用户是否已点赞；fixture 与真实响应使用 IsPraised。 */
  IsPraised?: number
  IsLiked?: number
  /** 0 仅自己可见、1 正常、2 已删除、3 热评、4 置顶、5 未知。 */
  State?: number
  /** 回复针对的目标评论；顶层评论为空。 */
  RepliedComments?: Array<{ Nick?: string }>
}

interface RawCommentList {
  Comments?: RawComment[]
  Total?: number
  HasMore?: number
}

interface CommentListData {
  CommentList?: RawCommentList
  /** WithHot=1 时返回的热评附加模块；仅首屏。 */
  CommentList2?: RawCommentList
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

function mapComments(raw: RawComment[]): Comment[] {
  return raw
    .map(toComment)
    .filter(
      (comment) =>
        comment.id.length > 0 &&
        (comment.deleted ||
          comment.content.replace(/\uFFFC/g, '').trim().length > 0 ||
          Boolean(comment.imageUrl) ||
          Boolean(comment.emojiUrl))
    )
}

/** 首屏热评附加模块：按点赞数降序返回全部热评，并按 ID 去重。 */
function toHotComments(list: RawCommentList | undefined): Comment[] {
  if (!list) return []
  const unique = new Map<string, Comment>()
  for (const comment of mapComments(list.Comments ?? [])) {
    if (!unique.has(comment.id)) unique.set(comment.id, comment)
  }
  return [...unique.values()].sort((left, right) => right.likedCount - left.likedCount)
}

function toCommentPage(
  list: RawCommentList,
  pageSize: number,
  hotList?: RawCommentList
): CommentPage {
  const raw = list.Comments ?? []
  const nextCursor = String(raw.at(-1)?.SeqNo ?? '')
  const comments = mapComments(raw).slice(0, pageSize)

  return {
    comments,
    hotComments: toHotComments(hotList),
    total: Number(list.Total ?? comments.length),
    hasMore: Boolean(list.HasMore) && /^\d+$/.test(nextCursor),
    nextCursor
  }
}

function normalizeHttpsUrl(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

/**
 * 上游昵称 / 正文可能夹带 C0 / C1 控制字符（如 U+007F），浏览器会为它们
 * 分配字形宽度并显示为缺字方框。统一移除；正文只保留换行符。
 */
function stripControlChars(value: string, keepLineBreaks: boolean): string {
  const pattern = keepLineBreaks
    ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F-\u009F]/g
    : /[\u0000-\u001F\u007F-\u009F]/g
  return value.replace(pattern, '')
}

function cleanNickname(value: string | undefined): string {
  return stripControlChars(value ?? '', false).trim()
}

/**
 * 上游评论正文的换行格式不统一：部分记录直接返回真实换行，
 * 另一些记录返回字面量 “\n” / “\r\n” / “\r”。统一归一化为真实换行，
 * 交给评论区的 white-space: pre-wrap 渲染；不解析 HTML。
 * U+FFFC（对象替换符）仅表示内嵌表情（EmoPic）位置。附图（Pic）始终
 * 单独显示在正文下方，带 Pic 的评论里出现的 U+FFFC 按残留占位移除；
 * 两者都没有时保留 U+FFFC，交给渲染层显示加载失败占位。
 */
function normalizeCommentContent(
  value: string | undefined,
  hasEmoji: boolean,
  hasImage: boolean
): string {
  if (!value) return ''
  const text = stripControlChars(
    value.replace(/\r\n?/g, '\n').replace(/\\r\\n|\\n|\\r/g, '\n'),
    true
  )
  return hasEmoji || !hasImage ? text : text.replace(/\uFFFC/g, '')
}

function toComment(raw: RawComment): Comment {
  const seconds = Number(raw.PubTime ?? 0)
  const emojiUrl = normalizeHttpsUrl(raw.EmoPic)
  const imageUrl = normalizeHttpsUrl(raw.Pic)
  const replied = raw.RepliedComments?.[0]
  const replyToNickname = cleanNickname(replied?.Nick)
  return {
    id: String(raw.CmId ?? ''),
    nickname: cleanNickname(raw.Nick),
    avatarUrl: normalizeHttpsUrl(raw.Avatar),
    content: normalizeCommentContent(raw.Content, Boolean(emojiUrl), Boolean(imageUrl)),
    imageUrl: imageUrl || undefined,
    emojiUrl: emojiUrl || undefined,
    likedCount: Number(raw.PraiseNum ?? 0),
    replyCount: Number(raw.ReplyCnt ?? 0),
    createdAtMs: seconds > 0 ? (seconds > 1_000_000_000_000 ? seconds : seconds * 1000) : 0,
    liked: Number(raw.IsPraised ?? raw.IsLiked ?? 0) === 1,
    deleted: Number(raw.State ?? 1) === 2,
    replyToNickname: replied ? replyToNickname : undefined
  }
}

/** 歌曲评论；songId 为上游数字歌曲 ID。 */
const SONG_BIZ_TYPE = 1
const SONG_BIZ_SUBTYPE = 2
/** MV 评论使用 BizType 5，BizId 为 MV 的 vid 字符串。 */
const MV_BIZ_TYPE = 5

interface CommentQuery extends Record<string, unknown> {
  PageSize: number
  PageNum: number
  HashTagID: string
  BizType: number
  PicEnable: number
  LastCommentSeqNo: string
  SelfSeeEnable: number
  BizId: string
  AudioEnable: number
  BizSubType?: number
  /** 首屏 1：附带热评模块 CommentList2。 */
  WithHot?: number
}

async function fetchComments(
  bizId: string,
  cursor: string,
  bizType: number,
  bizSubType?: number
): Promise<CommentPage> {
  if (!bizId) return { comments: [], total: 0, hasMore: false }

  // 必须携带登录 Cookie，上游才会按当前用户返回 IsPraised；未登录时自动匿名。
  // SeqNo 可能超过 Number 安全范围，按字符串解析供下一页游标使用。
  const param: CommentQuery = {
    PageSize: COMMENT_PAGE_SIZE,
    PageNum: 0,
    HashTagID: '',
    BizType: bizType,
    PicEnable: 1,
    LastCommentSeqNo: cursor,
    SelfSeeEnable: 1,
    BizId: bizId,
    AudioEnable: 1
  }
  if (bizSubType !== undefined) param.BizSubType = bizSubType
  const firstPage = cursor === ''
  // 热评附加模块只存在于首屏，后续页不再请求。
  if (firstPage) param.WithHot = 1
  const data = await musicu<CommentListData>(
    'music.globalComment.CommentRead',
    'GetNewCommentList',
    param,
    { stringFields: ['SeqNo'] }
  )

  const list = data.CommentList
  if (!list) {
    throw new UpstreamError('UPSTREAM_CHANGED', '评论响应缺少 CommentList')
  }
  return toCommentPage(list, COMMENT_PAGE_SIZE, firstPage ? data.CommentList2 : undefined)
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
  return fetchComments(id, cursor, SONG_BIZ_TYPE, SONG_BIZ_SUBTYPE)
}

/** MV 评论；mvId 为上游 vid 字符串，使用 BizType 5。 */
export async function getMvComments(
  mvId: string,
  cursor = ''
): Promise<CommentPage> {
  const id = mvId.trim()
  if (!id) return { comments: [], total: 0, hasMore: false }
  return fetchComments(id, cursor, MV_BIZ_TYPE)
}

/** 首屏回复热评：RankType=1 按点赞数取前几条，点赞数须超过阈值；失败时降级为无热评。 */
async function fetchHotReplies(commentId: string): Promise<Comment[]> {
  const data = await musicu<CommentListData>(
    'music.globalComment.CommentRead',
    'GetReplyCommentList',
    {
      RootCmId: commentId,
      LastCommentSeqNo: '',
      PageSize: COMMENT_HOT_REPLY_LIMIT,
      LastRankScore: '',
      RankType: 1,
      PicEnable: 1,
      PageNum: 0
    },
    { stringFields: ['SeqNo'] }
  )
  const list = data.CommentList
  if (!list) return []
  const unique = new Map<string, Comment>()
  for (const reply of mapComments(list.Comments ?? [])) {
    if (!unique.has(reply.id)) unique.set(reply.id, reply)
  }
  return [...unique.values()]
    .filter((reply) => reply.likedCount > COMMENT_HOT_REPLY_MIN_LIKES)
    .sort((left, right) => right.likedCount - left.likedCount)
    .slice(0, COMMENT_HOT_REPLY_LIMIT)
}

async function fetchReplyPage(commentId: string, cursor: string): Promise<CommentPage> {
  const data = await musicu<CommentListData>(
    'music.globalComment.CommentRead',
    'GetReplyCommentList',
    {
      RootCmId: commentId,
      LastCommentSeqNo: cursor,
      PageSize: COMMENT_REPLY_PAGE_SIZE,
      LastRankScore: '',
      RankType: 0,
      PicEnable: 1,
      PageNum: 0
    },
    { stringFields: ['SeqNo'] }
  )
  const list = data.CommentList
  if (!list) {
    throw new UpstreamError('UPSTREAM_CHANGED', '回复响应缺少 CommentList')
  }
  return toCommentPage(list, COMMENT_REPLY_PAGE_SIZE)
}

/** 评论回复；commentId 为顶层评论 CmId，按 10 条游标分页，首屏附带回复热评。 */
export async function getCommentReplies(
  commentId: string,
  cursor = ''
): Promise<CommentPage> {
  const id = commentId.trim()
  if (!id) return { comments: [], total: 0, hasMore: false }
  const initial = cursor === ''
  const hotPromise = initial
    ? fetchHotReplies(id).catch(() => [] as Comment[])
    : Promise.resolve<Comment[]>([])
  const page = await fetchReplyPage(id, cursor)
  return { ...page, hotReplies: await hotPromise }
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

/** 发表评论；上游要求登录并限制正文 300 字。 */
async function submitComment(
  bizId: string,
  bizType: number,
  content: string,
  bizSubType?: number,
  repliedCmId?: string
): Promise<CommentPostResult> {
  const id = bizId.trim()
  if (!id) {
    throw new UpstreamError('UPSTREAM_CHANGED', '评论目标无效，无法发表评论')
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

  // WriteServer 使用 SubCode 表示业务结果；歌曲沿用 BizSubType 2，MV 不传。
  const param: Record<string, unknown> = {
    Content: text,
    BizType: bizType,
    BizId: id
  }
  if (bizSubType !== undefined) param.BizSubType = bizSubType
  if (repliedCmId) param.RepliedCmId = repliedCmId
  const data = await musicu<AddCommentData>(
    'music.globalComment.CommentWriteServer',
    'AddComment',
    param,
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

/** 发表歌曲评论；songId 为上游数字歌曲 ID。 */
export async function postComment(
  songId: string,
  content: string
): Promise<CommentPostResult> {
  const id = songId.trim()
  if (!/^\d+$/.test(id)) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌曲 ID 无效，无法发表评论')
  }
  return submitComment(id, SONG_BIZ_TYPE, content, SONG_BIZ_SUBTYPE)
}

/** 发表 MV 评论；mvId 为上游 vid 字符串。 */
export async function postMvComment(
  mvId: string,
  content: string
): Promise<CommentPostResult> {
  const id = mvId.trim()
  if (!id) {
    throw new UpstreamError('UPSTREAM_CHANGED', 'MV ID 无效，无法发表评论')
  }
  return submitComment(id, MV_BIZ_TYPE, content)
}

/** 回复评论；沿用目标类型的 BizType / BizId，并携带 RepliedCmId。 */
export async function postCommentReply(
  targetType: 'song' | 'mv',
  targetId: string,
  commentId: string,
  content: string
): Promise<CommentPostResult> {
  const replyTo = commentId.trim()
  if (!replyTo) {
    throw new UpstreamError('UPSTREAM_CHANGED', '评论 ID 无效，无法回复')
  }
  if (targetType === 'mv') {
    const id = targetId.trim()
    if (!id) {
      throw new UpstreamError('UPSTREAM_CHANGED', 'MV ID 无效，无法发表评论')
    }
    return submitComment(id, MV_BIZ_TYPE, content, undefined, replyTo)
  }
  const id = targetId.trim()
  if (!/^\d+$/.test(id)) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌曲 ID 无效，无法发表评论')
  }
  return submitComment(id, SONG_BIZ_TYPE, content, SONG_BIZ_SUBTYPE, replyTo)
}
