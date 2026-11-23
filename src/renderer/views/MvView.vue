<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { MvStream } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CommentsPanel from '../components/CommentsPanel.vue'
import CoverArt from '../components/CoverArt.vue'
import { describeError } from '../api'
import { goBack } from '../composables/back-navigation'
import { useToast } from '../composables/toast'
import { useMvStore } from '../stores/mv'
import { usePlayerStore } from '../stores/player'

const route = useRoute()
const mv = useMvStore()
const player = usePlayerStore()
const toast = useToast()
const videoRef = ref<HTMLVideoElement | null>(null)
const error = ref('')

const mvId = computed(() => String(route.params.id ?? ''))
const qualities: Array<{ value: MvStream['quality']; label: string }> = [
  { value: 'fhd', label: '超清' },
  { value: 'hd', label: '高清' },
  { value: 'sd', label: '标清' }
]

async function load(): Promise<void> {
  if (!mvId.value) return
  error.value = ''
  try {
    await mv.load(mvId.value)
    if (videoRef.value && mv.stream?.url) {
      videoRef.value.load()
    }
  } catch (err) {
    error.value = describeError(err)
  }
}

async function chooseQuality(quality: MvStream['quality']): Promise<void> {
  try {
    await mv.setQuality(quality)
    videoRef.value?.load()
  } catch (err) {
    toast.error(describeError(err))
  }
}

/** MV 开始播放时暂停音乐；音乐开始播放时由下方 watch 暂停 MV。 */
function onVideoPlay(): void {
  if (player.status === 'playing') player.pause()
}

/**
 * 原生 video 不跨会话记忆音量；复用播放器已持久化的全局音量，
 * 不新增存储字段。loadedmetadata 时应用，volumechange 时写回。
 */
function applyVideoVolume(): void {
  const video = videoRef.value
  if (!video) return
  video.volume = player.volume
  video.muted = false
}

function onVideoVolumeChange(): void {
  const video = videoRef.value
  if (!video) return
  if (Math.abs(video.volume - player.volume) < 0.001) return
  player.setVolume(video.volume)
}

watch(
  () => player.volume,
  (volume) => {
    const video = videoRef.value
    if (video && Math.abs(video.volume - volume) > 0.001) video.volume = volume
  }
)

watch(
  () => player.status,
  (status) => {
    if (status === 'playing') videoRef.value?.pause()
  }
)

watch(mvId, () => void load())
onMounted(() => void load())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="btn ghost small" @click="goBack()">
        <AppIcon name="chevron-left" :size="15" />
        返回
      </button>
      <div class="page-head-actions">
        <span v-for="quality in qualities" :key="quality.value">
          <button
            class="btn small"
            :class="{ primary: mv.quality === quality.value }"
            @click="chooseQuality(quality.value)"
          >
            {{ quality.label }}
          </button>
        </span>
      </div>
    </div>

    <div v-if="mv.loading" class="loading-block"><span class="spinner lg" />正在加载 MV</div>

    <div v-else-if="error" class="empty">
      <div class="empty-icon"><AppIcon name="video" :size="26" /></div>
      <h3>MV 加载失败</h3>
      <p>{{ error }}</p>
      <button class="btn small" @click="load()">重试</button>
    </div>

    <template v-else-if="mv.detail">
      <section class="mv-stage">
        <video
          v-if="mv.stream?.url"
          ref="videoRef"
          class="mv-video"
          :src="mv.stream.url"
          controls
          autoplay
          @play="onVideoPlay"
          @loadedmetadata="applyVideoVolume"
          @volumechange="onVideoVolumeChange"
        />
        <div v-else class="mv-placeholder">
          <CoverArt :src="mv.detail.coverUrl" image-class="playlist-cover" :icon-size="44" />
          <p>当前清晰度暂无可用视频流</p>
          <button class="btn small" @click="load()">重试</button>
        </div>
      </section>

      <section class="mv-info">
        <div>
          <div class="eyebrow">Music Video</div>
          <h1>{{ mv.detail.name }}</h1>
          <p class="page-sub">{{ mv.detail.singerName }}</p>
          <p v-if="mv.detail.description" class="mv-description">{{ mv.detail.description }}</p>
        </div>
      </section>

      <section class="mv-comments">
        <CommentsPanel target-type="mv" :target-id="mvId" />
      </section>
    </template>
  </div>
</template>
