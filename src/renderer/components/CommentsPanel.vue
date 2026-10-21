<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Comment } from '@shared/types'
import AppIcon from './AppIcon.vue'
import { describeError, unwrap } from '../api'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { formatCount } from '../utils/format'

const player = usePlayerStore()
const ui = useUiStore()

const comments = ref<Comment[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const songId = computed(() => player.current?.songId ?? '')
let token = 0

async function load(): Promise<void> {
  const id = songId.value
  if (!ui.lyricsOpen || !id) {
    comments.value = []
    total.value = 0
    error.value = ''
    loading.value = false
    return
  }

  const request = ++token
  loading.value = true
  error.value = ''
  try {
    const page = unwrap(await window.lychee.comment.get(id))
    if (request !== token) return
    comments.value = page.comments
    total.value = page.total
  } catch (err) {
    if (request !== token) return
    comments.value = []
    total.value = 0
    error.value = describeError(err)
  } finally {
    if (request === token) loading.value = false
  }
}

watch([songId, () => ui.lyricsOpen], () => void load(), { immediate: true })

function avatarLetter(name: string): string {
  return name.slice(0, 1).toUpperCase() || '?'
}
</script>

<template>
  <section class="now-playing-side comments-side">
    <div class="lyrics-head">
      <div>
        <h2>评论</h2>
        <p v-if="total > 0">{{ formatCount(total) }} 条</p>
      </div>
      <button class="icon-btn" title="刷新评论" @click="load()">
        <AppIcon name="refresh" :size="17" />
      </button>
    </div>

    <div v-if="!songId" class="lyrics-empty">
      <AppIcon name="music" :size="26" />
      <span>播放歌曲后显示评论</span>
    </div>

    <div v-else-if="loading" class="lyrics-empty">
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

    <div v-else class="comment-list">
      <article v-for="comment in comments" :key="comment.id" class="comment">
        <span class="comment-avatar">
          <img v-if="comment.avatarUrl" :src="comment.avatarUrl" alt="" />
          <template v-else>{{ avatarLetter(comment.nickname) }}</template>
        </span>
        <div class="comment-content">
          <div class="comment-head">
            <span class="comment-nick">{{ comment.nickname || '匿名用户' }}</span>
            <span v-if="comment.likedCount > 0" class="comment-likes">
              赞 {{ formatCount(comment.likedCount) }}
            </span>
          </div>
          <p class="comment-text">{{ comment.content }}</p>
        </div>
      </article>
    </div>
  </section>
</template>
