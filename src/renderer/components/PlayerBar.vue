<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import type { AudioCacheProgress, Settings } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import MarqueeText from './MarqueeText.vue'
import PlaylistPicker from './PlaylistPicker.vue'
import { usePlayerStore, PLAY_MODE_LABEL, type PlayMode } from '../stores/player'
import { QUALITY_PREFERENCE_OPTIONS } from '../stores/settings'
import { useUiStore } from '../stores/ui'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { useDownloadStore } from '../stores/download'
import { useToast } from '../composables/toast'
import { useRevealerTouch } from '../composables/revealer-touch'
import { formatDuration, songCover } from '../utils/format'
import { downloadStateIcon, resolveDownloadState } from '../utils/download-state'

const player = usePlayerStore()
const ui = useUiStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const toast = useToast()
const {
  current,
  status,
  volume,
  mode,
  quality,
  requestedQuality,
  qualityPreference,
  positionMs,
  durationMs,
  bufferedMs,
  progress
} = storeToRefs(player)

const compactQuery = window.matchMedia('(max-width: 900px)')
const compact = ref(compactQuery.matches)
const qualityMenu = ref(false)
const volumeOpen = ref(false)
const modeMenu = ref(false)
const likeMenu = ref(false)
const qualityWrap = ref<HTMLElement | null>(null)
const volumeWrap = ref<HTMLElement | null>(null)
const modeWrap = ref<HTMLElement | null>(null)
const likeWrap = ref<HTMLElement | null>(null)
const pickerOpen = ref(false)
const pickerMids = computed(() => (current.value ? [current.value.songMid] : []))
const pickerName = computed(() => current.value?.name ?? '')
const lastVolume = ref(0.8)
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null
let modeOpenTimer: number | null = null
let modeCloseTimer: number | null = null
let qualityOpenTimer: number | null = null
let qualityCloseTimer: number | null = null
let volumeOpenTimer: number | null = null
let volumeCloseTimer: number | null = null
let likeOpenTimer: number | null = null
let likeCloseTimer: number | null = null
const VOLUME_DRAG_RANGE = 120
let volumePressing = false
let volumeActive = false
let volumeStartY = 0
let volumeStartValue = 0
let volumePointerId: number | null = null
let suppressVolumeClick = false
let offCacheProgress: (() => void) | null = null

const cache = ref<AudioCacheProgress | null>(null)

const cover = computed(() => songCover(current.value, 300))
const hasSong = computed(() => Boolean(current.value))
const lyricsTitle = computed(() => {
  if (!hasSong.value) return ''
  return ui.lyricsOpen ? '关闭歌词与评论' : '歌词与评论'
})
const totalMs = computed(() => durationMs.value || current.value?.durationMs || 0)
const MODE_ICON: Record<PlayMode, string> = {
  sequence: 'sequence',
  'repeat-all': 'repeat',
  'repeat-one': 'repeat-one',
  shuffle: 'shuffle'
}
const modeIcon = computed(() => MODE_ICON[mode.value])
const progressStyle = computed(() => ({ width: `${progress.value}%` }))
const volumeStyle = computed(() => ({
  background: `linear-gradient(to right, var(--accent-strong) ${volume.value * 100}%, var(--track) ${volume.value * 100}%)`
}))
const cacheForCurrent = computed(() => {
  const item = cache.value
  if (!item || item.songMid !== current.value?.songMid) return null
  if (item.quality !== quality.value) return null
  return item
})
const cachePercent = computed(() => {
  // 已下载歌曲直接播放本地文件，缓存进度按满格处理。
  if (asset.value?.downloadedQuality) return 100
  const item = cacheForCurrent.value
  if (!item || item.totalBytes <= 0) return 0
  return Math.min(100, (item.receivedBytes / item.totalBytes) * 100)
})
const bufferedPercent = computed(() => {
  const total = totalMs.value
  if (total <= 0) return 0
  return Math.min(100, (bufferedMs.value / total) * 100)
})
const bufferPercent = computed(() => Math.max(cachePercent.value, bufferedPercent.value))
const bufferStyle = computed(() => ({ width: `${bufferPercent.value}%` }))
const bufferVisible = computed(() => hasSong.value && bufferPercent.value > 0)
const bufferLabel = computed(() => {
  if (!bufferVisible.value) return ''
  if (asset.value?.downloadedQuality) return '已下载到本机'
  if (cacheForCurrent.value?.complete) return '缓存完成'
  return `缓冲 ${Math.round(bufferPercent.value)}%`
})

const qualityOptions: Array<{ value: Settings['defaultQuality']; label: string; short: string }> =
  QUALITY_PREFERENCE_OPTIONS

const qualityLabel = computed(() => (quality.value === 'flac' ? 'FLAC' : quality.value.toUpperCase()))
const favorited = computed(() =>
  current.value ? playlistEdit.favorites.has(current.value.songMid) : false
)
const requestedQualityLabel = computed(() =>
  requestedQuality.value === 'flac' ? 'FLAC' : requestedQuality.value.toUpperCase()
)
const qualityPreferenceLabel = computed(
  () =>
    qualityOptions.find((option) => option.value === qualityPreference.value)?.short ?? 'AUTO'
)
const qualityTitle = computed(() => {
  const hint = hasSong.value ? '音质（本次请求档位）' : '音质（下次播放生效）'
  return qualityPreference.value === 'auto'
    ? `${hint}：自动（当前 ${requestedQualityLabel.value}）`
    : hint
})
/** 弹出层只展示“其它档位”；当前档位由常驻按钮本身表示。 */
const otherQualities = computed(() =>
  qualityOptions.filter((option) => option.value !== qualityPreference.value)
)
const asset = computed(() =>
  current.value ? download.assets[current.value.songMid] : undefined
)
const downloadState = computed(() => resolveDownloadState(asset.value))
const downloadIcon = computed(() => downloadStateIcon(downloadState.value))
const downloadTitle = computed(() => {
  const item = asset.value
  const label = (value?: string | null): string =>
    value === 'flac' ? 'FLAC' : (value ?? '').toUpperCase()
  if (item?.taskStatus === 'downloading' || item?.taskStatus === 'pending') return '正在下载'
  if (item?.taskStatus === 'paused') return '下载已暂停'
  if (downloadState.value === 'downloaded') return `已下载 ${label(item?.downloadedQuality)}`
  if (downloadState.value === 'cached') return `已缓存 ${label(item?.cachedQuality)}`
  return '下载'
})

/** 弹出层只展示“其它模式”；当前模式由常驻按钮本身表示。 */
const otherModes = computed<PlayMode[]>(() => {
  const order: PlayMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle']
  return order.filter((item) => item !== mode.value)
})

function visibleSingers(): Array<{ mid: string; name: string }> {
  return (current.value?.singers ?? []).filter((singer) => singer.name.trim().length > 0)
}

async function cycleQuality(): Promise<void> {
  closeMenus()
  try {
    await player.cycleQualityPreference()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function openQualityMenu(immediate = false): void {
  if (qualityCloseTimer !== null) {
    window.clearTimeout(qualityCloseTimer)
    qualityCloseTimer = null
  }
  if (qualityMenu.value) return
  if (qualityOpenTimer !== null) {
    window.clearTimeout(qualityOpenTimer)
    qualityOpenTimer = null
  }
  if (!immediate) {
    qualityOpenTimer = window.setTimeout(() => {
      qualityOpenTimer = null
      qualityMenu.value = true
      volumeOpen.value = false
      modeMenu.value = false
      likeMenu.value = false
    }, 120)
    return
  }
  qualityMenu.value = true
  volumeOpen.value = false
  modeMenu.value = false
  likeMenu.value = false
}

function scheduleCloseQualityMenu(): void {
  if (qualityOpenTimer !== null) {
    window.clearTimeout(qualityOpenTimer)
    qualityOpenTimer = null
  }
  qualityCloseTimer = window.setTimeout(() => {
    qualityMenu.value = false
    qualityCloseTimer = null
  }, 200)
}

function closeMenus(): void {
  if (modeOpenTimer !== null) {
    window.clearTimeout(modeOpenTimer)
    modeOpenTimer = null
  }
  if (modeCloseTimer !== null) {
    window.clearTimeout(modeCloseTimer)
    modeCloseTimer = null
  }
  if (qualityOpenTimer !== null) {
    window.clearTimeout(qualityOpenTimer)
    qualityOpenTimer = null
  }
  if (qualityCloseTimer !== null) {
    window.clearTimeout(qualityCloseTimer)
    qualityCloseTimer = null
  }
  if (volumeOpenTimer !== null) {
    window.clearTimeout(volumeOpenTimer)
    volumeOpenTimer = null
  }
  if (volumeCloseTimer !== null) {
    window.clearTimeout(volumeCloseTimer)
    volumeCloseTimer = null
  }
  if (likeOpenTimer !== null) {
    window.clearTimeout(likeOpenTimer)
    likeOpenTimer = null
  }
  if (likeCloseTimer !== null) {
    window.clearTimeout(likeCloseTimer)
    likeCloseTimer = null
  }
  qualityMenu.value = false
  volumeOpen.value = false
  modeMenu.value = false
  likeMenu.value = false
}

async function chooseQuality(next: Settings['defaultQuality']): Promise<void> {
  closeMenus()
  try {
    await player.updateDefaultQuality(next)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function openModeMenu(immediate = false): void {
  if (modeCloseTimer !== null) {
    window.clearTimeout(modeCloseTimer)
    modeCloseTimer = null
  }
  if (modeMenu.value) return
  if (modeOpenTimer !== null) {
    window.clearTimeout(modeOpenTimer)
    modeOpenTimer = null
  }
  if (!immediate) {
    modeOpenTimer = window.setTimeout(() => {
      modeOpenTimer = null
      modeMenu.value = true
      volumeOpen.value = false
      qualityMenu.value = false
      likeMenu.value = false
    }, 120)
    return
  }
  modeMenu.value = true
  volumeOpen.value = false
  qualityMenu.value = false
  likeMenu.value = false
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

function cyclePlayMode(): void {
  closeMenus()
  player.cycleMode()
}

function chooseMode(next: PlayMode): void {
  player.setMode(next)
  modeMenu.value = false
}

async function toggleFavorite(): Promise<void> {
  if (!current.value) return
  await playlistEdit.toggleFavorite(current.value.songMid)
}

function openLikeMenu(immediate = false): void {
  if (likeCloseTimer !== null) {
    window.clearTimeout(likeCloseTimer)
    likeCloseTimer = null
  }
  if (likeMenu.value) return
  if (likeOpenTimer !== null) {
    window.clearTimeout(likeOpenTimer)
    likeOpenTimer = null
  }
  if (!immediate) {
    likeOpenTimer = window.setTimeout(() => {
      likeOpenTimer = null
      likeMenu.value = true
      qualityMenu.value = false
      modeMenu.value = false
      volumeOpen.value = false
    }, 120)
    return
  }
  likeMenu.value = true
  qualityMenu.value = false
  modeMenu.value = false
  volumeOpen.value = false
}

function scheduleCloseLikeMenu(): void {
  if (likeOpenTimer !== null) {
    window.clearTimeout(likeOpenTimer)
    likeOpenTimer = null
  }
  likeCloseTimer = window.setTimeout(() => {
    likeMenu.value = false
    likeCloseTimer = null
  }, 200)
}

function openSongPicker(): void {
  closeMenus()
  if (!current.value) return
  pickerOpen.value = true
}

async function downloadCurrent(): Promise<void> {
  if (!current.value) return
  try {
    await download.start(current.value.songMid, quality.value)
    toast.show('已加入下载任务')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function openVolumeMenu(immediate = false): void {
  if (!compact.value) return
  if (volumeCloseTimer !== null) {
    window.clearTimeout(volumeCloseTimer)
    volumeCloseTimer = null
  }
  if (volumeOpen.value) return
  if (volumeOpenTimer !== null) {
    window.clearTimeout(volumeOpenTimer)
    volumeOpenTimer = null
  }
  if (!immediate) {
    volumeOpenTimer = window.setTimeout(() => {
      volumeOpen.value = true
      volumeOpenTimer = null
      qualityMenu.value = false
      modeMenu.value = false
      likeMenu.value = false
    }, 120)
    return
  }
  volumeOpen.value = true
  qualityMenu.value = false
  modeMenu.value = false
  likeMenu.value = false
}

function scheduleCloseVolumeMenu(): void {
  if (volumeOpenTimer !== null) {
    window.clearTimeout(volumeOpenTimer)
    volumeOpenTimer = null
  }
  volumeCloseTimer = window.setTimeout(() => {
    volumeOpen.value = false
    volumeCloseTimer = null
  }, 200)
}

function toggleMute(): void {
  if (volume.value > 0) {
    lastVolume.value = volume.value
    player.setVolume(0)
  } else {
    player.setVolume(lastVolume.value || 0.8)
  }
}

function onVolumePointerDown(event: PointerEvent): void {
  if (event.pointerType !== 'touch') return
  volumePressing = true
  volumeActive = false
  volumeStartY = event.clientY
  volumeStartValue = volume.value
  volumePointerId = event.pointerId
}

function onVolumePointerMove(event: PointerEvent): void {
  if (!volumePressing || event.pointerId !== volumePointerId) return
  if (!volumeActive) {
    if (Math.abs(event.clientY - volumeStartY) <= 4) return
    volumeActive = true
    ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
    openVolumeMenu(true)
  }
  const next = Math.min(
    1,
    Math.max(0, volumeStartValue + (volumeStartY - event.clientY) / VOLUME_DRAG_RANGE)
  )
  player.setVolume(next)
  event.preventDefault()
}

function finishVolumeGesture(event: PointerEvent): void {
  if (!volumePressing) return
  const active = volumeActive
  volumePressing = false
  volumeActive = false
  volumePointerId = null
  if (!active) return
  ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
  suppressVolumeClick = true
  window.setTimeout(() => {
    suppressVolumeClick = false
  }, 0)
  scheduleCloseVolumeMenu()
}

function onVolumePointerUp(event: PointerEvent): void {
  finishVolumeGesture(event)
}

function onVolumePointerCancel(event: PointerEvent): void {
  finishVolumeGesture(event)
}

function onVolumeClickCapture(event: Event): void {
  if (!suppressVolumeClick) return
  event.preventDefault()
  event.stopPropagation()
}

function toggleLyrics(): void {
  if (!current.value) return
  ui.toggleLyrics()
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
  if (likeMenu.value && likeWrap.value && !likeWrap.value.contains(target)) {
    likeMenu.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenus()
}

const {
  highlighted: modeHighlighted,
  onPointerDown: onModePointerDown,
  onPointerMove: onModePointerMove,
  onPointerUp: onModePointerUp,
  onPointerCancel: onModePointerCancel,
  onClickCapture: onModeClickCapture
} = useRevealerTouch({
  container: modeWrap,
  open: () => openModeMenu(true),
  close: closeMenus,
  confirm: (index) => {
    const next = otherModes.value[index]
    if (next) chooseMode(next)
  }
})

const {
  highlighted: qualityHighlighted,
  onPointerDown: onQualityPointerDown,
  onPointerMove: onQualityPointerMove,
  onPointerUp: onQualityPointerUp,
  onPointerCancel: onQualityPointerCancel,
  onClickCapture: onQualityClickCapture
} = useRevealerTouch({
  container: qualityWrap,
  open: () => openQualityMenu(true),
  close: closeMenus,
  confirm: (index) => {
    const option = otherQualities.value[index]
    if (option) void chooseQuality(option.value)
  }
})

const {
  highlighted: likeHighlighted,
  onPointerDown: onLikePointerDown,
  onPointerMove: onLikePointerMove,
  onPointerUp: onLikePointerUp,
  onPointerCancel: onLikePointerCancel,
  onClickCapture: onLikeClickCapture
} = useRevealerTouch({
  container: likeWrap,
  open: () => openLikeMenu(true),
  close: closeMenus,
  confirm: () => openSongPicker()
})

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onKeydown)
  mediaListener = (event) => {
    compact.value = event.matches
    if (!event.matches) {
      if (volumeOpenTimer !== null) {
        window.clearTimeout(volumeOpenTimer)
        volumeOpenTimer = null
      }
      if (volumeCloseTimer !== null) {
        window.clearTimeout(volumeCloseTimer)
        volumeCloseTimer = null
      }
      volumeOpen.value = false
    }
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
  if (qualityOpenTimer !== null) window.clearTimeout(qualityOpenTimer)
  if (qualityCloseTimer !== null) window.clearTimeout(qualityCloseTimer)
  if (volumeOpenTimer !== null) window.clearTimeout(volumeOpenTimer)
  if (volumeCloseTimer !== null) window.clearTimeout(volumeCloseTimer)
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
        :title="lyricsTitle"
        :disabled="!hasSong"
        @click="toggleLyrics()"
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
          :class="{ open: modeMenu }"
          @mouseenter="openModeMenu()"
          @mouseleave="scheduleCloseModeMenu()"
          @focusin="openModeMenu()"
          @focusout="scheduleCloseModeMenu()"
          @click.capture="onModeClickCapture"
        >
          <button
            class="mode-button"
            :title="PLAY_MODE_LABEL[mode]"
            aria-haspopup="true"
            :aria-expanded="modeMenu"
            @click="cyclePlayMode()"
            @pointerdown="onModePointerDown"
            @pointermove="onModePointerMove"
            @pointerup="onModePointerUp"
            @pointercancel="onModePointerCancel"
          >
            <AppIcon :name="modeIcon" :size="16" />
          </button>
          <div v-if="modeMenu" class="mode-menu" @click.stop>
            <button
              v-for="(item, index) in otherModes"
              :key="item"
              class="mode-option"
              :class="{ 'touch-active': modeHighlighted === index }"
              data-revealer-option
              :title="PLAY_MODE_LABEL[item]"
              @click="chooseMode(item)"
            >
              <AppIcon :name="MODE_ICON[item]" :size="16" />
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
        <div class="progress-stack" :title="bufferLabel">
          <div class="progress-track" :class="{ 'progress-disabled': !hasSong }" aria-hidden="true">
            <span
              v-if="bufferVisible"
              class="progress-buffer"
              :class="{ complete: cacheForCurrent?.complete }"
              :style="bufferStyle"
            />
            <span v-if="hasSong" class="progress-played" :style="progressStyle" />
          </div>
          <input
            v-if="hasSong"
            class="range progress-range"
            type="range"
            min="0"
            :max="Math.max(1, totalMs)"
            :value="positionMs"
            aria-label="播放进度"
            @input="player.seek(Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <span class="time">{{ hasSong ? formatDuration(totalMs) : '0:00' }}</span>
      </div>
    </div>

    <div class="player-right">
      <div
        ref="likeWrap"
        class="like-wrap"
        :class="{ open: likeMenu }"
        @mouseenter="openLikeMenu()"
        @mouseleave="scheduleCloseLikeMenu()"
        @focusin="openLikeMenu()"
        @focusout="scheduleCloseLikeMenu()"
        @click.capture="onLikeClickCapture"
      >
        <button
          class="icon-btn like-button"
          :class="{ active: favorited }"
          :title="favorited ? '取消收藏' : '收藏'"
          :disabled="!hasSong"
          @click.stop="toggleFavorite()"
          @pointerdown="onLikePointerDown"
          @pointermove="onLikePointerMove"
          @pointerup="onLikePointerUp"
          @pointercancel="onLikePointerCancel"
        >
          <AppIcon :name="favorited ? 'heart-filled' : 'heart'" :size="17" />
        </button>
        <div v-if="likeMenu" class="like-menu" @click.stop>
          <button
            class="like-option"
            :class="{ 'touch-active': likeHighlighted === 0 }"
            data-revealer-option
            title="加入歌单"
            :disabled="!hasSong"
            @click="openSongPicker()"
          >
            <AppIcon name="playlist-add" :size="16" />
          </button>
        </div>
      </div>
      <button
        class="icon-btn"
        :class="downloadState === 'none' ? null : downloadState"
        :title="downloadTitle"
        :disabled="!hasSong"
        @click.stop="downloadCurrent()"
      >
        <AppIcon :name="downloadIcon" :size="17" />
      </button>
      <div
        ref="qualityWrap"
        class="quality-wrap"
        :class="{ open: qualityMenu }"
        @mouseenter="openQualityMenu()"
        @mouseleave="scheduleCloseQualityMenu()"
        @focusin="openQualityMenu()"
        @focusout="scheduleCloseQualityMenu()"
        @click.capture="onQualityClickCapture"
      >
        <button
          class="quality-chip"
          :title="qualityTitle"
          aria-haspopup="true"
          :aria-expanded="qualityMenu"
          @click.stop="cycleQuality()"
          @pointerdown="onQualityPointerDown"
          @pointermove="onQualityPointerMove"
          @pointerup="onQualityPointerUp"
          @pointercancel="onQualityPointerCancel"
        >
          {{ qualityPreferenceLabel }}
        </button>
        <div v-if="qualityMenu" class="quality-menu" @click.stop>
          <button
            v-for="(option, index) in otherQualities"
            :key="option.value"
            :class="{ 'touch-active': qualityHighlighted === index }"
            data-revealer-option
            :title="option.label"
            @click="chooseQuality(option.value)"
          >
            {{ option.short }}
          </button>
        </div>
      </div>
      <div
        ref="volumeWrap"
        class="volume-wrap"
        :class="{ open: volumeOpen }"
        @mouseenter="openVolumeMenu()"
        @mouseleave="scheduleCloseVolumeMenu()"
        @click.capture="onVolumeClickCapture"
      >
        <div v-if="compact && volumeOpen" class="volume-menu" @click.stop>
          <div class="volume-slider">
            <div class="volume-track" aria-hidden="true">
              <span class="volume-fill" :style="{ height: `${volume * 100}%` }" />
            </div>
            <input
              class="range volume-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="volume"
              :title="`音量 ${Math.round(volume * 100)}%`"
              aria-label="音量"
              @input="player.setVolume(Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
        <button
          class="icon-btn volume-button"
          :title="volume > 0 ? '静音' : '恢复音量'"
          aria-haspopup="true"
          :aria-expanded="volumeOpen"
          @click.stop="toggleMute()"
          @pointerdown="onVolumePointerDown"
          @pointermove="onVolumePointerMove"
          @pointerup="onVolumePointerUp"
          @pointercancel="onVolumePointerCancel"
        >
          <AppIcon :name="volume > 0 ? 'volume' : 'mute'" :size="17" />
        </button>
      </div>
      <input
        v-if="!compact"
        class="range volume-range-inline"
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

    <Teleport to="body">
      <PlaylistPicker
        :open="pickerOpen"
        :song-mids="pickerMids"
        :song-name="pickerName"
        @close="pickerOpen = false"
        @added="() => undefined"
      />
    </Teleport>
  </footer>
</template>
