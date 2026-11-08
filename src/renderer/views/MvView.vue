<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MvStream } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useMvStore } from '../stores/mv'

const route = useRoute()
const router = useRouter()
const mv = useMvStore()
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
    toast.error(error.value)
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

function fullscreen(): void {
  void videoRef.value?.requestFullscreen()
}

watch(mvId, () => void load())
onMounted(() => void load())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="btn ghost small" @click="router.back()">
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
        />
        <div v-else class="mv-placeholder">
          <CoverArt :src="mv.detail.coverUrl" image-class="playlist-cover" :icon-size="44" />
          <p>MV 取流接口待探测</p>
        </div>
      </section>

      <section class="mv-info">
        <div>
          <div class="eyebrow">Music Video</div>
          <h1>{{ mv.detail.name }}</h1>
          <p class="page-sub">{{ mv.detail.singerName }}</p>
          <p v-if="mv.detail.description" class="mv-description">{{ mv.detail.description }}</p>
        </div>
        <button v-if="mv.stream?.url" class="btn small" @click="fullscreen()">
          <AppIcon name="fullscreen" :size="14" />
          全屏
        </button>
      </section>
    </template>
  </div>
</template>
