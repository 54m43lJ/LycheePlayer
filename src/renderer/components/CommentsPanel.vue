<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Comment } from '@shared/types'
import {
  COMMENT_CONTENT_MAX,
  COMMENT_LOAD_ALL_PAGE_MAX,
  COMMENT_PAGE_SIZE
} from '@shared/constants'
import AppIcon from './AppIcon.vue'
import { describeError, unwrap } from '../api'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/toast'
import { formatCount } from '../utils/format'

const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToast()

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
const songId = computed(() => player.current?.songId ?? '')
const draft = ref('')
const posting = ref(false)
const canPost = computed(
  () => auth.loggedIn && draft.value.trim().length > 0 && !posting.value
)
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
  listRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToBottom(): void {
  const el = listRef.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  updateJumpControls()
}

async function load(): Promise<void> {
  const id = songId.value
  if (!id) {
    comments.value = []
    total.value = 0
    hasMore.value = false
    cursor.value = ''
    error.value = ''
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
  if (listRef.value) listRef.value.scrollTop = 0
  try {
    const page = unwrap(await window.lychee.comment.get(id, ''))
    if (request !== token) return
    comments.value = page.comments
    total.value = page.total
    hasMore.value = page.hasMore
    cursor.value = page.nextCursor ?? ''
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
  const id = songId.value
  if (!id || loadingMore.value || !hasMore.value || !cursor.value) return false
  const request = token
  loadingMore.value = true
  try {
    const page = unwrap(await window.lychee.comment.get(id, cursor.value))
    if (request !== token) return false
    const known = new Set(comments.value.map((comment) => comment.id))
    comments.value = [
      ...comments.value,
      ...page.comments.filter((comment) => !known.has(comment.id))
    ]
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
      toast.show(`评论较多，已加载前 ${pages * COMMENT_PAGE_SIZE} 条`)
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
  return name.slice(0, 1).toUpperCase() || '?'
}

async function submitComment(): Promise<void> {
  const id = songId.value
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
    unwrap(await window.lychee.comment.post(id, content))
    toast.show('评论已发表')
    if (songId.value === id) {
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
  songId,
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
        <button class="icon-btn" title="刷新评论" :disabled="loading" @click="load()">
          <span v-if="loading" class="spinner" />
          <AppIcon v-else name="refresh" :size="17" />
        </button>
      </div>
    </div>

    <div ref="listRef" class="comments-scroll" @scroll.passive="onScroll">
      <div v-if="!songId" class="lyrics-empty">
        <AppIcon name="music" :size="26" />
        <span>播放歌曲后显示评论</span>
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
            <div class="comment-head">
              <span class="comment-nick">{{ comment.nickname || '匿名用户' }}</span>
              <span class="comment-text">{{ comment.content }}</span>
            </div>
            <div class="comment-foot">
              <span class="comment-time">{{ timeLabel(comment.createdAtMs) }}</span>
              <button
                class="comment-like"
                :class="{ active: comment.liked }"
                :title="comment.liked ? '取消点赞' : '点赞'"
                @click="toggleLike(comment, $event)"
              >
                <AppIcon :name="comment.liked ? 'heart-filled' : 'heart'" :size="13" />
                <span v-if="comment.likedCount > 0">{{ formatCount(comment.likedCount) }}</span>
              </button>
            </div>
          </div>
        </article>
        <div v-if="loadingMore" class="comments-more"><span class="spinner" />加载更多</div>
        <div v-else-if="!hasMore" class="comments-more faint">已经到底了</div>
      </template>
    </div>

    <form v-if="songId" class="comment-composer" @submit.prevent="submitComment()">
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
        title="跳转到顶部"
        aria-label="跳转到顶部"
        @click="scrollToTop()"
      >
        <AppIcon name="to-top" :size="17" />
      </button>
      <button
        v-if="showBottom"
        class="comments-jump-btn"
        title="跳转到底部"
        aria-label="跳转到底部"
        :disabled="loadingAll"
        @click="jumpToBottom()"
      >
        <span v-if="loadingAll" class="spinner" />
        <AppIcon v-else name="to-bottom" :size="17" />
      </button>
    </div>
  </section>
</template>
