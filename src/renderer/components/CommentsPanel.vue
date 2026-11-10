<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { Comment, CommentSort } from '@shared/types'
import AppIcon from './AppIcon.vue'
import { describeError, unwrap } from '../api'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useToast } from '../composables/toast'
import { formatCount } from '../utils/format'

const player = usePlayerStore()
const auth = useAuthStore()
const toast = useToast()

const SORTS: Array<{ value: CommentSort; label: string }> = [
  { value: 'latest', label: '最新' },
  { value: 'oldest', label: '最旧' }
]

const comments = ref<Comment[]>([])
const total = ref(0)
const hasMore = ref(false)
const cursor = ref('')
const sort = ref<CommentSort>('latest')
const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const listRef = ref<HTMLElement | null>(null)
const songId = computed(() => player.current?.songId ?? '')
let token = 0

function timeLabel(ms: number): string {
  if (!ms) return ''
  const date = new Date(ms)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function load(reset = true): Promise<void> {
  const id = songId.value
  if (!id) {
    comments.value = []
    total.value = 0
    hasMore.value = false
    error.value = ''
    loading.value = false
    return
  }
  if (reset) {
    const request = ++token
    loading.value = true
    error.value = ''
    cursor.value = ''
    try {
      const page = unwrap(await window.lychee.comment.get(id, sort.value, ''))
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
    }
    return
  }
  if (loadingMore.value || !hasMore.value || !cursor.value) return
  const request = token
  loadingMore.value = true
  try {
    const page = unwrap(
      await window.lychee.comment.get(id, sort.value, cursor.value)
    )
    if (request !== token) return
    const known = new Set(comments.value.map((comment) => comment.id))
    comments.value = [
      ...comments.value,
      ...page.comments.filter((comment) => !known.has(comment.id))
    ]
    if (sort.value === 'oldest') {
      comments.value = comments.value
        .slice()
        .sort((a, b) => a.createdAtMs - b.createdAtMs)
    }
    cursor.value = page.nextCursor ?? ''
    hasMore.value = page.hasMore
  } catch (err) {
    if (request === token) toast.error(describeError(err))
  } finally {
    if (request === token) loadingMore.value = false
  }
}

function changeSort(next: CommentSort): void {
  if (sort.value === next) return
  sort.value = next
  void load(true)
}

function avatarLetter(name: string): string {
  return name.slice(0, 1).toUpperCase() || '?'
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
  const el = listRef.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) void load(false)
}

watch(
  [songId, sort],
  () => void load(true),
  { immediate: true }
)

onBeforeUnmount(() => {
  token += 1
})
</script>

<template>
  <section class="lyrics-page-side comments-side">
    <div class="comments-toolbar">
      <div class="comment-sorts">
        <button
          v-for="item in SORTS"
          :key="item.value"
          class="tab small"
          :class="{ active: sort === item.value }"
          @click="changeSort(item.value)"
        >
          {{ item.label }}
        </button>
      </div>
      <div class="comments-toolbar-right">
        <span v-if="total > 0" class="faint">{{ formatCount(total) }} 条</span>
        <button class="icon-btn" title="刷新评论" :disabled="loading" @click="load(true)">
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
        <button class="btn ghost small" @click="load(true)">重试</button>
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
  </section>
</template>
