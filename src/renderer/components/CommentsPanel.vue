<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Comment } from '@shared/types'
import {
  COMMENT_CONTENT_MAX,
  COMMENT_LOAD_ALL_PAGE_MAX,
  COMMENT_PAGE_SIZE,
  COMMENT_REPLY_PAGE_SIZE,
  COMMENT_REPLY_PREVIEW
} from '@shared/constants'
import AppIcon from './AppIcon.vue'
import ImageLightbox from './ImageLightbox.vue'
import { describeError, unwrap } from '../api'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/toast'
import { formatCount } from '../utils/format'
import { scrollWithTransition } from '../utils/page-jump'
import {
  replyPageCount as countReplyPages,
  replyPageLinks as buildReplyPageLinks
} from '../utils/comment-replies'

const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToast()

const props = withDefaults(
  defineProps<{
    /** 评论目标类型；默认歌曲。 */
    targetType?: 'song' | 'mv'
    /** 指定评论目标 ID；歌曲模式省略时跟随当前播放歌曲。 */
    targetId?: string
  }>(),
  { targetType: 'song', targetId: '' }
)

const comments = ref<Comment[]>([])
const total = ref(0)
const hasMore = ref(false)
const cursor = ref('')
const loading = ref(false)
const loadingMore = ref(false)
const loadingAll = ref(false)
const error = ref('')
const listRef = ref<HTMLElement | null>(null)
const showTop = ref(false)
const showBottom = ref(false)
const resolvedId = computed(
  () => props.targetId || (props.targetType === 'song' ? player.current?.songId ?? '' : '')
)
const emptyLabel = computed(() =>
  props.targetType === 'mv' ? 'MV 加载后显示评论' : '播放歌曲后显示评论'
)
const draft = ref('')
const posting = ref(false)
const failedMedia = ref<Record<string, boolean>>({})
const viewerUrl = ref<string | null>(null)
const canPost = computed(
  () => auth.loggedIn && draft.value.trim().length > 0 && !posting.value
)
const replyingTo = ref('')
const replyDraft = ref('')
const replyPosting = ref(false)
const canPostReply = computed(
  () => auth.loggedIn && replyDraft.value.trim().length > 0 && !replyPosting.value
)

interface ReplyThread {
  items: Comment[]
  /** 按游标依次加载的页，每页最多 COMMENT_REPLY_PAGE_SIZE 条。 */
  pages: Comment[][]
  total: number
  cursor: string
  hasMore: boolean
  expanded: boolean
  pageIndex: number
  loading: boolean
  loadingPage: boolean
  /** 首次请求已返回；用于区分“尚未加载”与“加载后确实为空”。 */
  loaded: boolean
  error: string
  token: number
}

const replyThreads = ref<Record<string, ReplyThread>>({})
let token = 0

function timeLabel(ms: number): string {
  if (!ms) return ''
  const date = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function updateJumpControls(): void {
  const el = listRef.value
  if (!el) {
    showTop.value = false
    showBottom.value = false
    return
  }
  const max = el.scrollHeight - el.clientHeight
  showTop.value = el.scrollTop > 120
  showBottom.value = hasMore.value || (max > 40 && el.scrollTop < max - 120)
}

function scrollToTop(): void {
  const el = listRef.value
  if (el) scrollWithTransition(el, 0)
}

function scrollToBottom(): void {
  const el = listRef.value
  if (!el) return
  scrollWithTransition(el, el.scrollHeight)
  updateJumpControls()
}

function fetchPage(id: string, cursor: string) {
  return props.targetType === 'mv'
    ? window.lychee.comment.getMv(id, cursor)
    : window.lychee.comment.get(id, cursor)
}

function postTarget(id: string, content: string) {
  return props.targetType === 'mv'
    ? window.lychee.comment.postMv(id, content)
    : window.lychee.comment.post(id, content)
}

function resetReplyState(): void {
  replyThreads.value = {}
  replyingTo.value = ''
  replyDraft.value = ''
  replyPosting.value = false
}

function replyThread(commentId: string): ReplyThread | null {
  return replyThreads.value[commentId] ?? null
}

function ensureReplyThread(commentId: string): ReplyThread {
  const existing = replyThreads.value[commentId]
  if (existing) return existing
  const thread = reactive<ReplyThread>({
    items: [],
    pages: [],
    total: 0,
    cursor: '',
    hasMore: false,
    expanded: false,
    pageIndex: 0,
    loading: false,
    loadingPage: false,
    loaded: false,
    error: '',
    token: 0
  })
  replyThreads.value = { ...replyThreads.value, [commentId]: thread }
  return thread
}

/** 按游标加载回复；reset 时从第一页重新开始并丢弃仍在途的旧请求。 */
async function loadReplies(comment: Comment, reset = false): Promise<boolean> {
  const thread = ensureReplyThread(comment.id)
  if (reset) {
    thread.token += 1
    thread.items = []
    thread.pages = []
    thread.total = 0
    thread.cursor = ''
    thread.hasMore = false
    thread.expanded = false
    thread.pageIndex = 0
    thread.loading = false
    thread.loadingPage = false
    thread.loaded = false
    thread.error = ''
  }
  if (thread.loading || thread.loadingPage) return false
  const initial = thread.pages.length === 0
  const request = thread.token
  if (initial) thread.loading = true
  else thread.loadingPage = true
  try {
    const page = unwrap(
      await window.lychee.comment.getReplies(comment.id, initial ? '' : thread.cursor)
    )
    if (request !== thread.token) return false
    const known = new Set(thread.items.map((item) => item.id))
    const fresh = page.comments.filter((item) => !known.has(item.id))
    if (initial) {
      thread.pages = [fresh]
    } else if (fresh.length > 0) {
      thread.pages = [...thread.pages, fresh]
    }
    thread.items = [...thread.items, ...fresh]
    if (initial || page.total > thread.total) thread.total = page.total
    thread.cursor = page.hasMore ? page.nextCursor ?? '' : ''
    thread.hasMore = page.hasMore && Boolean(thread.cursor)
    thread.loaded = true
    thread.error = ''
    return true
  } catch (err) {
    if (request === thread.token) thread.error = describeError(err)
    return false
  } finally {
    if (request === thread.token) {
      thread.loading = false
      thread.loadingPage = false
    }
  }
}

/** 有回复的评论在渲染后预取第一页，避免展开时再等待。 */
function prefetchReplies(list: Comment[]): void {
  for (const comment of list) {
    if (comment.deleted || comment.replyCount <= 0) continue
    if (replyThread(comment.id)) continue
    void loadReplies(comment)
  }
}

function visibleReplies(comment: Comment): Comment[] {
  const thread = replyThread(comment.id)
  if (!thread) return []
  if (!thread.expanded) return thread.items.slice(0, COMMENT_REPLY_PREVIEW)
  return thread.pages[thread.pageIndex] ?? thread.items.slice(0, COMMENT_REPLY_PAGE_SIZE)
}

function replyPageCount(thread: ReplyThread | null | undefined): number {
  if (!thread) return 1
  return countReplyPages({
    itemCount: thread.items.length,
    loadedPageCount: thread.pages.length,
    total: thread.total,
    hasMore: thread.hasMore,
    loaded: thread.loaded
  })
}

/** 回复计数可能大于实际列表；首次拉取确认没有回复后不渲染空回复框。 */
function shouldShowReplies(comment: Comment): boolean {
  if (comment.replyCount <= 0) return false
  const thread = replyThread(comment.id)
  if (!thread) return false
  if (thread.error && thread.items.length === 0) return true
  if (!thread.loaded) return true
  return thread.items.length > 0
}

function replyPageLinks(thread: ReplyThread | null | undefined): number[] {
  if (!thread) return []
  return buildReplyPageLinks(thread.pageIndex + 1, replyPageCount(thread))
}

function expandReplies(comment: Comment): void {
  const thread = ensureReplyThread(comment.id)
  thread.expanded = true
  thread.pageIndex = 0
  if (thread.pages.length === 0 && !thread.loading) void loadReplies(comment)
}

async function gotoReplyPage(comment: Comment, page: number): Promise<void> {
  const thread = ensureReplyThread(comment.id)
  thread.expanded = true
  const target = Math.min(Math.max(0, page - 1), replyPageCount(thread) - 1)
  while (thread.pages.length <= target && thread.hasMore && !thread.loadingPage) {
    const ok = await loadReplies(comment)
    if (!ok) break
  }
  thread.pageIndex = Math.min(target, Math.max(0, thread.pages.length - 1))
}

function stepReplyPage(comment: Comment, delta: number): void {
  const thread = replyThread(comment.id)
  if (!thread) return
  void gotoReplyPage(comment, thread.pageIndex + 1 + delta)
}

function startReply(comment: Comment): void {
  if (!auth.loggedIn) {
    toast.error('请先登录')
    return
  }
  if (replyingTo.value === comment.id) {
    cancelReply()
    return
  }
  replyingTo.value = comment.id
  replyDraft.value = ''
}

function cancelReply(): void {
  replyingTo.value = ''
  replyDraft.value = ''
}

async function submitReply(comment: Comment): Promise<void> {
  const id = resolvedId.value
  const content = replyDraft.value.trim()
  if (!id || !content || replyPosting.value) return
  if (!auth.loggedIn) {
    toast.error('请先登录')
    return
  }
  if (content.length > COMMENT_CONTENT_MAX) {
    toast.error(`评论不能超过 ${COMMENT_CONTENT_MAX} 字`)
    return
  }
  replyPosting.value = true
  try {
    unwrap(
      await window.lychee.comment.postReply(props.targetType, id, comment.id, content)
    )
    if (resolvedId.value !== id) return
    replyDraft.value = ''
    replyingTo.value = ''
    comment.replyCount += 1
    const thread = ensureReplyThread(comment.id)
    await loadReplies(comment, true)
    thread.expanded = true
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    replyPosting.value = false
  }
}

async function load(): Promise<void> {
  resetReplyState()
  const id = resolvedId.value
  if (!id) {
    comments.value = []
    total.value = 0
    hasMore.value = false
    cursor.value = ''
    error.value = ''
    failedMedia.value = {}
    loading.value = false
    updateJumpControls()
    return
  }
  const request = ++token
  loading.value = true
  loadingMore.value = false
  loadingAll.value = false
  error.value = ''
  cursor.value = ''
  failedMedia.value = {}
  if (listRef.value) listRef.value.scrollTop = 0
  try {
    const page = unwrap(await fetchPage(id, ''))
    if (request !== token) return
    comments.value = page.comments
    total.value = page.total
    hasMore.value = page.hasMore
    cursor.value = page.nextCursor ?? ''
    prefetchReplies(page.comments)
  } catch (err) {
    if (request !== token) return
    comments.value = []
    total.value = 0
    hasMore.value = false
    cursor.value = ''
    error.value = describeError(err)
  } finally {
    if (request === token) loading.value = false
    await nextTick()
    if (request === token) updateJumpControls()
  }
}

async function loadMore(): Promise<boolean> {
  const id = resolvedId.value
  if (!id || loadingMore.value || !hasMore.value || !cursor.value) return false
  const request = token
  loadingMore.value = true
  try {
    const page = unwrap(await fetchPage(id, cursor.value))
    if (request !== token) return false
    const known = new Set(comments.value.map((comment) => comment.id))
    const fresh = page.comments.filter((comment) => !known.has(comment.id))
    comments.value = [...comments.value, ...fresh]
    prefetchReplies(fresh)
    cursor.value = page.nextCursor ?? ''
    hasMore.value = page.hasMore
    await nextTick()
    if (request === token) updateJumpControls()
    return true
  } catch (err) {
    if (request === token) toast.error(describeError(err))
    return false
  } finally {
    loadingMore.value = false
  }
}

async function jumpToBottom(): Promise<void> {
  if (!listRef.value || loadingAll.value || loadingMore.value) return
  if (!hasMore.value || !cursor.value) {
    scrollToBottom()
    return
  }
  loadingAll.value = true
  const request = token
  let pages = 0
  try {
    while (
      request === token &&
      hasMore.value &&
      cursor.value &&
      pages < COMMENT_LOAD_ALL_PAGE_MAX
    ) {
      const ok = await loadMore()
      if (!ok) break
      pages += 1
    }
    if (request === token && hasMore.value && pages >= COMMENT_LOAD_ALL_PAGE_MAX) {
      toast.show(
        `评论太多，仅跳过 ${COMMENT_LOAD_ALL_PAGE_MAX * COMMENT_PAGE_SIZE} 条`
      )
    }
  } finally {
    if (request === token) {
      loadingAll.value = false
      await nextTick()
      scrollToBottom()
    }
  }
}

function avatarLetter(name: string): string {
  return name.slice(0, 1).toUpperCase()
}

function mediaFailed(url: string): boolean {
  return Boolean(failedMedia.value[url])
}

function markMediaFailed(url: string): void {
  failedMedia.value = { ...failedMedia.value, [url]: true }
}

function openViewer(url: string): void {
  viewerUrl.value = url
}

interface CommentPart {
  text?: string
  emoji?: string
  missing?: boolean
}

/**
 * 正文中的 U+FFFC 是内嵌表情的占位。EmoPic 只提供一个表情图，
 * 第一个占位符替换为表情，其余占位符显示加载失败占位；
 * 没有占位符时把表情追加到末尾。Pic 不参与占位符映射。
 */
function contentParts(comment: Comment): CommentPart[] {
  const emoji = comment.emojiUrl ?? ''
  const chunks = comment.content.split('\uFFFC')
  const parts: CommentPart[] = []
  let emojiUsed = false
  chunks.forEach((text, index) => {
    if (text) parts.push({ text })
    if (index < chunks.length - 1) {
      if (emoji && !emojiUsed) {
        parts.push({ emoji })
        emojiUsed = true
      } else {
        parts.push({ missing: true })
      }
    }
  })
  if (emoji && !emojiUsed) parts.push({ emoji })
  return parts
}

async function submitComment(): Promise<void> {
  const id = resolvedId.value
  const content = draft.value.trim()
  if (!id || !content || posting.value) return
  if (!auth.loggedIn) {
    toast.error('请先登录')
    return
  }
  if (content.length > COMMENT_CONTENT_MAX) {
    toast.error(`评论不能超过 ${COMMENT_CONTENT_MAX} 字`)
    return
  }
  posting.value = true
  try {
    unwrap(await postTarget(id, content))
    if (resolvedId.value === id) {
      draft.value = ''
      await load()
    }
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    posting.value = false
  }
}

async function toggleLike(comment: Comment, event: Event): Promise<void> {
  event.stopPropagation()
  if (!auth.loggedIn) {
    toast.error('请先登录')
    return
  }
  const beforeLiked = Boolean(comment.liked)
  const beforeCount = comment.likedCount
  comment.liked = !beforeLiked
  comment.likedCount = Math.max(0, beforeCount + (beforeLiked ? -1 : 1))
  try {
    const result = unwrap(
      await (beforeLiked
        ? window.lychee.comment.unlike(comment.id)
        : window.lychee.comment.like(comment.id))
    )
    comment.liked = result.liked
    if (typeof result.likedCount === 'number') comment.likedCount = result.likedCount
  } catch (err) {
    comment.liked = beforeLiked
    comment.likedCount = beforeCount
    toast.error(describeError(err))
  }
}

function onScroll(): void {
  updateJumpControls()
  if (loadingAll.value) return
  const el = listRef.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) void loadMore()
}

function onResize(): void {
  updateJumpControls()
}

watch(
  resolvedId,
  () => {
    draft.value = ''
    void load()
  },
  { immediate: true }
)

onMounted(() => window.addEventListener('resize', onResize))

onBeforeUnmount(() => {
  token += 1
  loadingAll.value = false
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <section class="lyrics-page-side comments-side">
    <div class="comments-toolbar">
      <div class="comments-title">评论</div>
      <div class="comments-toolbar-right">
        <span v-if="total > 0" class="faint">{{ formatCount(total) }} 条</span>
        <button class="icon-btn" aria-label="刷新评论" :disabled="loading" @click="load()">
          <span v-if="loading" class="spinner" />
          <AppIcon v-else name="refresh" :size="17" />
        </button>
      </div>
    </div>

    <div ref="listRef" class="comments-scroll" @scroll.passive="onScroll">
      <div v-if="!resolvedId" class="lyrics-empty">
        <AppIcon :name="targetType === 'mv' ? 'video' : 'music'" :size="26" />
        <span>{{ emptyLabel }}</span>
      </div>

      <div v-else-if="loading && comments.length === 0" class="lyrics-empty">
        <span class="spinner" />
        <span>正在加载评论</span>
      </div>

      <div v-else-if="error" class="comments-error">
        <p>{{ error }}</p>
        <button class="btn ghost small" @click="load()">重试</button>
      </div>

      <div v-else-if="comments.length === 0" class="lyrics-empty">
        <AppIcon name="music" :size="26" />
        <span>暂无评论</span>
      </div>

      <template v-else>
        <article v-for="comment in comments" :key="comment.id" class="comment">
          <span class="comment-avatar">
            <img v-if="comment.avatarUrl" :src="comment.avatarUrl" alt="" />
            <template v-else>{{ avatarLetter(comment.nickname) }}</template>
          </span>
          <div class="comment-content">
            <div v-if="comment.deleted" class="comment-removed">该评论已删除</div>
            <template v-else>
              <div class="comment-head">
                <span class="comment-nick">{{ comment.nickname }}</span>
                <span class="comment-text">
                  <template v-for="(part, index) in contentParts(comment)" :key="index">
                    <img
                      v-if="part.emoji && !mediaFailed(part.emoji)"
                      class="comment-emoji"
                      :src="part.emoji"
                      alt="表情"
                      loading="lazy"
                      @error="markMediaFailed(part.emoji)"
                    />
                    <span
                      v-else-if="part.emoji"
                      class="comment-media-failed comment-media-failed-emoji"
                      aria-label="表情加载失败"
                    >
                      <AppIcon name="paper-torn" :size="14" />
                    </span>
                    <span
                      v-else-if="part.missing"
                      class="comment-media-failed comment-media-failed-emoji"
                      aria-label="媒体加载失败"
                    >
                      <AppIcon name="paper-torn" :size="14" />
                    </span>
                    <template v-else>{{ part.text }}</template>
                  </template>
                </span>
              </div>
              <img
                v-if="comment.imageUrl && !mediaFailed(comment.imageUrl)"
                class="comment-media"
                :src="comment.imageUrl"
                alt="评论图片"
                loading="lazy"
                @error="markMediaFailed(comment.imageUrl)"
                @click="openViewer(comment.imageUrl)"
              />
              <div
                v-else-if="comment.imageUrl"
                class="comment-media-failed"
                aria-label="图片加载失败"
              >
                <AppIcon name="paper-torn" :size="24" />
              </div>
              <div class="comment-foot">
                <span class="comment-time">{{ timeLabel(comment.createdAtMs) }}</span>
                <div class="comment-actions">
                  <button
                    class="comment-like"
                    :class="{ active: comment.liked }"
                    :aria-label="comment.liked ? '取消点赞' : '点赞'"
                    @click="toggleLike(comment, $event)"
                  >
                    <AppIcon :name="comment.liked ? 'heart-filled' : 'heart'" :size="13" />
                    <span v-if="comment.likedCount > 0">{{
                      formatCount(comment.likedCount)
                    }}</span>
                  </button>
                  <button class="comment-reply-action" @click="startReply(comment)">
                    回复
                  </button>
                </div>
              </div>

              <form
                v-if="replyingTo === comment.id"
                class="comment-reply-composer"
                @submit.prevent="submitReply(comment)"
              >
                <textarea
                  v-model="replyDraft"
                  class="comment-input comment-reply-input"
                  :maxlength="COMMENT_CONTENT_MAX"
                  :placeholder="`回复 ${comment.nickname}…`"
                  :disabled="replyPosting"
                  aria-label="回复内容"
                  rows="2"
                />
                <div class="comment-reply-composer-actions">
                  <button
                    type="button"
                    class="btn ghost small"
                    :disabled="replyPosting"
                    @click="cancelReply()"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    class="btn primary small"
                    :disabled="!canPostReply"
                  >
                    <span v-if="replyPosting" class="spinner" />
                    <span v-else>发表</span>
                  </button>
                </div>
              </form>

              <div v-if="shouldShowReplies(comment)" class="comment-replies">
                <div
                  v-if="
                    replyThreads[comment.id]?.loading &&
                    !replyThreads[comment.id]?.items.length
                  "
                  class="comment-replies-state"
                >
                  <span class="spinner" />加载回复
                </div>
                <div
                  v-else-if="
                    replyThreads[comment.id]?.error &&
                    !replyThreads[comment.id]?.items.length
                  "
                  class="comment-replies-state"
                >
                  <span>{{ replyThreads[comment.id]?.error }}</span>
                  <button class="btn ghost small" @click="loadReplies(comment, true)">
                    重试
                  </button>
                </div>
                <template v-else>
                  <ul class="comment-reply-list">
                    <li
                      v-for="reply in visibleReplies(comment)"
                      :key="reply.id"
                      class="comment-reply"
                    >
                      <span v-if="reply.deleted" class="comment-reply-removed">
                        该评论已删除
                      </span>
                      <template v-else>
                        <span class="comment-reply-avatar">
                          <img v-if="reply.avatarUrl" :src="reply.avatarUrl" alt="" />
                          <template v-else>{{ avatarLetter(reply.nickname) }}</template>
                        </span>
                        <div class="comment-reply-body">
                          <div class="comment-reply-text">
                            <span class="comment-reply-nick">{{ reply.nickname }}</span>
                            <template v-if="reply.replyToNickname">
                              <span class="comment-reply-to"> 回复 </span>
                              <span class="comment-reply-nick"
                                >@{{ reply.replyToNickname }}</span
                              >
                            </template>
                            <span>：</span>
                            <template
                              v-for="(part, index) in contentParts(reply)"
                              :key="index"
                            >
                              <img
                                v-if="part.emoji && !mediaFailed(part.emoji)"
                                class="comment-reply-emoji"
                                :src="part.emoji"
                                alt="表情"
                                loading="lazy"
                                @error="markMediaFailed(part.emoji)"
                              />
                              <span
                                v-else-if="part.emoji"
                                class="comment-media-failed comment-media-failed-emoji"
                                aria-label="表情加载失败"
                              >
                                <AppIcon name="paper-torn" :size="12" />
                              </span>
                              <span
                                v-else-if="part.missing"
                                class="comment-media-failed comment-media-failed-emoji"
                                aria-label="媒体加载失败"
                              >
                                <AppIcon name="paper-torn" :size="12" />
                              </span>
                              <template v-else>{{ part.text }}</template>
                            </template>
                            <span
                              v-if="reply.imageUrl && !reply.content && !reply.emojiUrl"
                              class="comment-reply-to"
                              >[图片]</span
                            >
                          </div>
                          <div class="comment-reply-foot">
                            <span>{{ timeLabel(reply.createdAtMs) }}</span>
                            <button
                              class="comment-like"
                              :class="{ active: reply.liked }"
                              :aria-label="reply.liked ? '取消点赞' : '点赞'"
                              @click="toggleLike(reply, $event)"
                            >
                              <AppIcon
                                :name="reply.liked ? 'heart-filled' : 'heart'"
                                :size="12"
                              />
                              <span v-if="reply.likedCount > 0">{{
                                formatCount(reply.likedCount)
                              }}</span>
                            </button>
                          </div>
                        </div>
                      </template>
                    </li>
                  </ul>
                  <div
                    v-if="replyThreads[comment.id]?.loadingPage"
                    class="comment-replies-state"
                  >
                    <span class="spinner" />加载更多回复
                  </div>
                  <button
                    v-else-if="
                      !replyThreads[comment.id]?.expanded &&
                      ((replyThreads[comment.id]?.items.length ?? 0) >
                        COMMENT_REPLY_PREVIEW ||
                        replyThreads[comment.id]?.hasMore)
                    "
                    class="comment-replies-more"
                    @click="expandReplies(comment)"
                  >
                    更多评论
                  </button>
                  <div
                    v-if="
                      replyThreads[comment.id]?.expanded &&
                      replyPageCount(replyThreads[comment.id]) > 1
                    "
                    class="comment-reply-pager"
                  >
                    <button
                      class="comment-reply-page-btn"
                      aria-label="上一页回复"
                      :disabled="
                        (replyThreads[comment.id]?.pageIndex ?? 0) === 0 ||
                        replyThreads[comment.id]?.loadingPage
                      "
                      @click="stepReplyPage(comment, -1)"
                    >
                      <AppIcon name="chevron-left" :size="12" />
                    </button>
                    <button
                      v-for="page in replyPageLinks(replyThreads[comment.id])"
                      :key="page"
                      class="comment-reply-page"
                      :class="{
                        active: page === (replyThreads[comment.id]?.pageIndex ?? 0) + 1
                      }"
                      :disabled="replyThreads[comment.id]?.loadingPage"
                      @click="gotoReplyPage(comment, page)"
                    >
                      {{ page }}
                    </button>
                    <button
                      class="comment-reply-page-btn"
                      aria-label="下一页回复"
                      :disabled="
                        (replyThreads[comment.id]?.pageIndex ?? 0) + 1 >=
                          replyPageCount(replyThreads[comment.id]) ||
                        replyThreads[comment.id]?.loadingPage
                      "
                      @click="stepReplyPage(comment, 1)"
                    >
                      <AppIcon name="chevron-right" :size="12" />
                    </button>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </article>
        <div v-if="loadingMore" class="comments-more"><span class="spinner" />加载更多</div>
        <div v-else-if="!hasMore" class="comments-more faint">已经到底了</div>
      </template>
    </div>

    <form v-if="resolvedId" class="comment-composer" @submit.prevent="submitComment()">
      <textarea
        v-model="draft"
        class="comment-input"
        :maxlength="COMMENT_CONTENT_MAX"
        :placeholder="auth.loggedIn ? '写下你的评论…' : '登录后发表评论'"
        :disabled="!auth.loggedIn || posting"
        aria-label="评论内容"
        rows="2"
      />
      <button class="btn primary small comment-send" type="submit" :disabled="!canPost">
        <span v-if="posting" class="spinner" />
        <span v-else>发表</span>
      </button>
    </form>

    <div v-if="showTop || showBottom" class="comments-jump">
      <button
        v-if="showTop"
        class="comments-jump-btn"
        aria-label="跳转到顶部"
        @click="scrollToTop()"
      >
        <AppIcon name="to-top" :size="17" />
      </button>
      <button
        v-if="showBottom"
        class="comments-jump-btn"
        aria-label="跳转到底部"
        :disabled="loadingAll"
        @click="jumpToBottom()"
      >
        <span v-if="loadingAll" class="spinner" />
        <AppIcon v-else name="to-bottom" :size="17" />
      </button>
    </div>

    <ImageLightbox :url="viewerUrl" @close="viewerUrl = null" />
  </section>
</template>
