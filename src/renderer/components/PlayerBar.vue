<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import type { AudioCacheProgress, Quality } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import MarqueeText from './MarqueeText.vue'
import { usePlayerStore, PLAY_MODE_LABEL, type PlayMode } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { useDownloadStore } from '../stores/download'
import { useSettingsStore } from '../stores/settings'
import { useToast } from '../composables/toast'
import { formatDuration, songCover } from '../utils/format'

const player = usePlayerStore()
const ui = useUiStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const settings = useSettingsStore()
const toast = useToast()
const router = useRouter()
const { current, status, volume, mode, quality, requestedQuality, positionMs, durationMs, progress } =
  storeToRefs(player)

const compactQuery = window.matchMedia('(max-width: 900px)')
const compact = ref(compactQuery.matches)
const qualityMenu = ref(false)
const volumeOpen = ref(false)
const modeMenu = ref(false)
const qualityWrap = ref<HTMLElement | null>(null)
const volumeWrap = ref<HTMLElement | null>(null)
const modeWrap = ref<HTMLElement | null>(null)
const lastVolume = ref(0.8)
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null
let modeOpenTimer: number | null = null
let modeCloseTimer: number | null = null
let offCacheProgress: (() => void) | null = null

const cache = ref<AudioCacheProgress | null>(null)

const cover = computed(() => songCover(current.value, 300))
const hasSong = computed(() => Boolean(current.value))
const totalMs = computed(() => durationMs.value || current.value?.durationMs || 0)
const modeIcon = computed(() => {
  if (mode.value === 'repeat-one') return 'repeat-one'
  if (mode.value === 'shuffle') return 'shuffle'
  if (mode.value === 'repeat-all') return 'repeat'
  return 'list'
})
const progressStyle = computed(() => ({
  background: `linear-gradient(to right, var(--gold) ${progress.value}%, var(--track) ${progress.value}%)`
}))
const volumeStyle = computed(() => ({
  background: `linear-gradient(to right, var(--accent-strong) ${volume.value * 100}%, var(--track) ${volume.value * 100}%)`
}))
const cacheStyle = computed(() => {
  const percent =
    cache.value && cache.value.totalBytes > 0
      ? Math.min(100, (cache.value.receivedBytes / cache.value.totalBytes) * 100)
      : 0
  return {
    width: `${percent}%`
  }
})
const cacheVisible = computed(
  () =>
    Boolean(hasSong.value) &&
    settings.settings.audioCacheEnabled &&
    Boolean(cache.value) &&
    cache.value?.songMid === current.value?.songMid
)
const cacheLabel = computed(() => {
  if (!cache.value) return ''
  if (cache.value.complete) return '缓存完成'
  const percent =
    cache.value.totalBytes > 0
      ? Math.round((cache.value.receivedBytes / cache.value.totalBytes) * 100)
      : 0
  return `缓存 ${percent}%`
})

const qualityOptions: Array<{ value: Quality; label: string }> = [
  { value: '128k', label: '标准 128k' },
  { value: '320k', label: '高品质 320k' },
  { value: 'flac', label: '无损 FLAC' }
]

const qualityLabel = computed(() => (quality.value === 'flac' ? 'FLAC' : quality.value.toUpperCase()))
const favorited = computed(() =>
  current.value ? playlistEdit.favorites.has(current.value.songMid) : false
)
const requestedQualityLabel = computed(() =>
  requestedQuality.value === 'flac' ? 'FLAC' : requestedQuality.value.toUpperCase()
)
const asset = computed(() =>
  current.value ? download.assets[current.value.songMid] : undefined
)
const downloadIcon = computed(() => {
  if (asset.value?.downloadedQuality) return 'download-done'
  if (asset.value?.cachedQuality) return 'download-cached'
  return 'download'
})
const downloadTitle = computed(() => {
  const item = asset.value
  const label = (value?: string | null): string =>
    value === 'flac' ? 'FLAC' : (value ?? '').toUpperCase()
  if (item?.taskStatus === 'downloading' || item?.taskStatus === 'pending') return '正在下载'
  if (item?.taskStatus === 'paused') return '下载已暂停'
  if (item?.downloadedQuality) {
    return item.cachedQuality
      ? `已下载 ${label(item.downloadedQuality)} · 已缓存 ${label(item.cachedQuality)}`
      : `已下载 ${label(item.downloadedQuality)}`
  }
  if (item?.cachedQuality) return `已缓存 ${label(item.cachedQuality)}`
  return '下载'
})

const menuModes = computed<PlayMode[]>(() => {
  const order: PlayMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle']
  return [...order.filter((item) => item !== mode.value), mode.value]
})

function visibleSingers(): Array<{ mid: string; name: string }> {
  return (current.value?.singers ?? []).filter((singer) => singer.name.trim().length > 0)
}

function toggleQualityMenu(): void {
  qualityMenu.value = !qualityMenu.value
  if (qualityMenu.value) {
    volumeOpen.value = false
    modeMenu.value = false
  }
}

function closeMenus(): void {
  qualityMenu.value = false
  volumeOpen.value = false
  modeMenu.value = false
}

function chooseQuality(next: Quality): void {
  closeMenus()
  player.setQuality(next)
}

function openModeMenu(): void {
  if (modeCloseTimer !== null) {
    window.clearTimeout(modeCloseTimer)
    modeCloseTimer = null
  }
  if (modeMenu.value) return
  modeOpenTimer = window.setTimeout(() => {
    modeMenu.value = true
    modeOpenTimer = null
  }, 120)
}

function scheduleCloseModeMenu(): void {
  if (modeOpenTimer !== null) {
    window.clearTimeout(modeOpenTimer)
    modeOpenTimer = null
  }
  modeCloseTimer = window.setTimeout(() => {
    modeMenu.value = false
    modeCloseTimer = null
  }, 200)
}

function toggleModeMenu(): void {
  modeMenu.value = !modeMenu.value
  qualityMenu.value = false
  volumeOpen.value = false
}

function chooseMode(next: PlayMode): void {
  player.setMode(next)
  modeMenu.value = false
}

async function toggleFavorite(): Promise<void> {
  if (!current.value) return
  await playlistEdit.toggleFavorite(current.value.songMid)
}

async function downloadCurrent(): Promise<void> {
  if (!current.value) return
  try {
    await download.start(current.value.songMid, quality.value)
    if (!ui.downloadOpen) ui.toggleDownload()
    toast.show('已加入下载任务')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function toggleVolume(): void {
  if (compact.value) {
    volumeOpen.value = !volumeOpen.value
    if (volumeOpen.value) {
      qualityMenu.value = false
      modeMenu.value = false
    }
    return
  }
  toggleMute()
}

function toggleMute(): void {
  if (volume.value > 0) {
    lastVolume.value = volume.value
    player.setVolume(0)
  } else {
    player.setVolume(lastVolume.value || 0.8)
  }
}

function openLyrics(): void {
  if (!current.value) return
  void router.push('/lyrics')
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as Node | null
  if (!target) return
  if (qualityMenu.value && qualityWrap.value && !qualityWrap.value.contains(target)) {
    qualityMenu.value = false
  }
  if (volumeOpen.value && volumeWrap.value && !volumeWrap.value.contains(target)) {
    volumeOpen.value = false
  }
  if (modeMenu.value && modeWrap.value && !modeWrap.value.contains(target)) {
    modeMenu.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenus()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onKeydown)
  mediaListener = (event) => {
    compact.value = event.matches
    if (!event.matches) volumeOpen.value = false
  }
  compactQuery.addEventListener('change', mediaListener)
  offCacheProgress = window.lychee.audioCache.onProgress((item) => {
    cache.value = item
  })
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onKeydown)
  if (mediaListener) compactQuery.removeEventListener('change', mediaListener)
  if (modeOpenTimer !== null) window.clearTimeout(modeOpenTimer)
  if (modeCloseTimer !== null) window.clearTimeout(modeCloseTimer)
  offCacheProgress?.()
})

watch(
  () => [current.value?.songMid ?? null, quality.value] as const,
  () => {
    cache.value = null
    if (current.value) void download.refreshAssets([current.value.songMid])
  },
  { immediate: true }
)
</script>

<template>
  <footer class="player" :class="{ 'player-empty-state': !hasSong }">
    <div class="player-now">
      <button
        class="player-cover-button"
        :title="hasSong ? '歌词与评论' : ''"
        :disabled="!hasSong"
        @click="openLyrics()"
      >
        <CoverArt v-if="hasSong" :src="cover" image-class="player-cover" :icon-size="20" />
        <span v-else class="player-cover placeholder" aria-hidden="true" />
      </button>
      <div class="player-text">
        <div class="player-title-row">
          <MarqueeText v-if="hasSong" class="player-title" :text="current?.name ?? ''" />
          <span v-else class="player-title">&nbsp;</span>
          <span v-if="hasSong" class="quality-mark" title="实际音质（降档后）">{{ qualityLabel }}</span>
        </div>
        <div v-if="hasSong" class="player-artist">
          <template v-for="(singer, index) in visibleSingers()" :key="`${singer.mid}-${index}`">
            <RouterLink v-if="singer.mid" class="inline-link" :to="`/artist/${singer.mid}`">
              {{ singer.name }}
            </RouterLink>
            <span v-else>{{ singer.name }}</span>
            <span v-if="index < visibleSingers().length - 1" class="singer-sep"> / </span>
          </template>
          <template v-if="current?.album.name">
            <span class="singer-sep"> · </span>
            <RouterLink
              v-if="current.album.mid"
              class="inline-link"
              :to="`/album/${current.album.mid}`"
              >{{ current.album.name }}</RouterLink
            >
            <span v-else>{{ current.album.name }}</span>
          </template>
        </div>
        <span v-else class="player-artist">&nbsp;</span>
      </div>
    </div>

    <div class="player-center">
      <div class="player-controls">
        <div
          ref="modeWrap"
          class="mode-wrap"
          @mouseenter="openModeMenu()"
          @mouseleave="scheduleCloseModeMenu()"
        >
          <button
            class="icon-btn"
            :title="PLAY_MODE_LABEL[mode]"
            :class="{ active: mode !== 'sequence' }"
            :disabled="!hasSong"
            @click="toggleModeMenu()"
          >
            <AppIcon :name="modeIcon" :size="16" />
          </button>
          <div v-if="modeMenu" class="mode-menu" @click.stop>
            <button
              v-for="item in menuModes"
              :key="item"
              class="mode-option"
              :class="{ current: item === mode }"
              :title="PLAY_MODE_LABEL[item]"
              @click="chooseMode(item)"
            >
              <AppIcon
                :name="
                  item === 'sequence'
                    ? 'list'
                    : item === 'repeat-all'
                      ? 'repeat'
                      : item === 'repeat-one'
                        ? 'repeat-one'
                        : 'shuffle'
                "
                :size="16"
              />
            </button>
          </div>
        </div>
        <button class="icon-btn" title="上一首" :disabled="!hasSong" @click="player.previous()">
          <AppIcon name="previous" :size="17" />
        </button>
        <button
          class="play-button"
          :title="status === 'playing' ? '暂停' : '播放'"
          :disabled="!hasSong || player.loading || !player.canPlay"
          @click="player.toggle()"
        >
          <span v-if="player.loading" class="spinner" />
          <AppIcon v-else :name="status === 'playing' ? 'pause' : 'play'" :size="17" />
        </button>
        <button class="icon-btn" title="下一首" :disabled="!hasSong" @click="player.playNext()">
          <AppIcon name="next" :size="17" />
        </button>
        <button
          class="icon-btn"
          :class="{ active: ui.queueOpen }"
          title="播放队列"
          @click="ui.toggleQueue()"
        >
          <AppIcon name="list" :size="17" />
        </button>
      </div>
      <div class="progress-row">
        <span class="time">{{ hasSong ? formatDuration(positionMs) : '0:00' }}</span>
        <div class="progress-stack">
          <input
            v-if="hasSong"
            class="range"
            type="range"
            min="0"
            :max="Math.max(1, totalMs)"
            :value="positionMs"
            :style="progressStyle"
            aria-label="播放进度"
            @input="player.seek(Number(($event.target as HTMLInputElement).value))"
          />
          <div v-else class="range progress-disabled" aria-hidden="true" />
          <div
            v-if="cacheVisible"
            class="cache-progress"
            :title="cacheLabel"
            :class="{ complete: cache?.complete }"
          >
            <span :style="cacheStyle" />
          </div>
        </div>
        <span class="time">{{ hasSong ? formatDuration(totalMs) : '0:00' }}</span>
      </div>
    </div>

    <div class="player-right">
      <button
        class="icon-btn"
        :class="{ active: favorited }"
        :title="favorited ? '取消收藏' : '收藏'"
        :disabled="!hasSong"
        @click.stop="toggleFavorite()"
      >
        <AppIcon :name="favorited ? 'heart-filled' : 'heart'" :size="17" />
      </button>
      <button
        class="icon-btn"
        :class="{
          cached: asset?.cachedQuality,
          downloaded: asset?.downloadedQuality
        }"
        :title="downloadTitle"
        :disabled="!hasSong"
        @click.stop="downloadCurrent()"
      >
        <AppIcon :name="downloadIcon" :size="17" />
      </button>
      <div ref="qualityWrap" class="quality-wrap">
        <button
          class="quality-chip"
          title="音质（本次请求档位）"
          :disabled="!hasSong"
          @click.stop="toggleQualityMenu()"
        >
          {{ requestedQualityLabel }}
        </button>
        <div v-if="qualityMenu" class="quality-menu">
          <button
            v-for="option in qualityOptions"
            :key="option.value"
            :class="{ active: option.value === requestedQuality }"
            @click="chooseQuality(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
      <div ref="volumeWrap" class="volume-wrap">
        <button
          class="icon-btn"
          :title="compact ? '音量' : volume > 0 ? '静音' : '恢复音量'"
          @click.stop="toggleVolume()"
        >
          <AppIcon :name="volume > 0 ? 'volume' : 'mute'" :size="17" />
        </button>
        <div v-if="compact && volumeOpen" class="volume-popover" @click.stop>
          <span class="volume-value">{{ Math.round(volume * 100) }}%</span>
          <div class="vertical-range">
            <input
              class="range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="volume"
              :style="volumeStyle"
              aria-label="音量"
              @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <button class="icon-btn" title="静音" @click="toggleMute()">
            <AppIcon :name="volume > 0 ? 'volume' : 'mute'" :size="15" />
          </button>
        </div>
      </div>
      <input
        v-if="!compact"
        class="range volume-range"
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="volume"
        :style="volumeStyle"
        aria-label="音量"
        @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
      />
    </div>
  </footer>
</template>
