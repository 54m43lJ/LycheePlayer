<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Quality } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import MarqueeText from './MarqueeText.vue'
import { usePlayerStore, PLAY_MODE_LABEL } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { useDownloadStore } from '../stores/download'
import { useToast } from '../composables/toast'
import { formatDuration, singerNames, songCover } from '../utils/format'

const player = usePlayerStore()
const ui = useUiStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const toast = useToast()
const { current, status, volume, mode, quality, requestedQuality, positionMs, durationMs, progress } = storeToRefs(player)

const compactQuery = window.matchMedia('(max-width: 900px)')
const compact = ref(compactQuery.matches)
const qualityMenu = ref(false)
const volumeOpen = ref(false)
const lastVolume = ref(0.8)
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null

const cover = computed(() => songCover(current.value, 300))
const artistLine = computed(() =>
  current.value ? `${singerNames(current.value)} · ${current.value.album.name}` : ''
)
const totalMs = computed(() => durationMs.value || current.value?.durationMs || 0)
const modeIcon = computed(() => {
  if (mode.value === 'repeat-one') return 'repeat-one'
  if (mode.value === 'shuffle') return 'shuffle'
  if (mode.value === 'sequence') return 'list'
  return 'repeat'
})
const progressStyle = computed(() => ({
  background: `linear-gradient(to right, var(--gold) ${progress.value}%, var(--track) ${progress.value}%)`
}))
const volumeStyle = computed(() => ({
  background: `linear-gradient(to right, var(--accent-strong) ${volume.value * 100}%, var(--track) ${volume.value * 100}%)`
}))

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

function toggleQualityMenu(): void {
  qualityMenu.value = !qualityMenu.value
  if (qualityMenu.value) volumeOpen.value = false
}

function closeMenus(): void {
  qualityMenu.value = false
  volumeOpen.value = false
}

function chooseQuality(next: Quality): void {
  closeMenus()
  player.setQuality(next)
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
    if (volumeOpen.value) qualityMenu.value = false
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

function onDocumentClick(): void {
  closeMenus()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  mediaListener = (event) => {
    compact.value = event.matches
    if (!event.matches) volumeOpen.value = false
  }
  compactQuery.addEventListener('change', mediaListener)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  if (mediaListener) compactQuery.removeEventListener('change', mediaListener)
})
</script>

<template>
  <footer class="player">
    <div v-if="!current" class="player-empty">
      <AppIcon name="music" :size="16" />
      还没有播放中的歌曲
    </div>

    <template v-else>
      <div class="player-now">
        <button class="player-cover-button" title="歌词与评论" @click="ui.toggleLyrics()">
          <CoverArt :src="cover" image-class="player-cover" :icon-size="20" />
        </button>
        <div class="player-text">
          <div class="player-title-row">
            <MarqueeText class="player-title" :text="current.name" />
            <span class="quality-mark" title="实际音质（降档后）">{{ qualityLabel }}</span>
          </div>
          <MarqueeText class="player-artist" :text="artistLine" />
        </div>
      </div>

      <div class="player-center">
        <div class="player-controls">
          <button
            class="icon-btn"
            :title="PLAY_MODE_LABEL[mode]"
            :class="{ active: mode !== 'sequence' }"
            @click="player.cycleMode()"
          >
            <AppIcon :name="modeIcon" :size="16" />
          </button>
          <button class="icon-btn" title="上一首" @click="player.previous()">
            <AppIcon name="previous" :size="17" />
          </button>
          <button
            class="play-button"
            :title="status === 'playing' ? '暂停' : '播放'"
            :disabled="player.loading || !player.canPlay"
            @click="player.toggle()"
          >
            <span v-if="player.loading" class="spinner" />
            <AppIcon v-else :name="status === 'playing' ? 'pause' : 'play'" :size="17" />
          </button>
          <button class="icon-btn" title="下一首" @click="player.playNext()">
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
          <span class="time">{{ formatDuration(positionMs) }}</span>
          <input
            class="range"
            type="range"
            min="0"
            :max="Math.max(1, totalMs)"
            :value="positionMs"
            :style="progressStyle"
            aria-label="播放进度"
            @input="player.seek(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="time">{{ formatDuration(totalMs) }}</span>
        </div>
      </div>

      <div class="player-right">
        <button
          class="icon-btn"
          :class="{ active: favorited }"
          :title="favorited ? '取消收藏' : '收藏'"
          @click.stop="toggleFavorite()"
        >
          <AppIcon name="heart" :size="17" />
        </button>
        <button class="icon-btn" title="下载" @click.stop="downloadCurrent()">
          <AppIcon name="download" :size="17" />
        </button>
        <div class="quality-wrap">
          <button class="quality-chip" title="音质（本次请求档位）" @click.stop="toggleQualityMenu()">
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
        <div class="volume-wrap">
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
    </template>
  </footer>

  <div v-if="qualityMenu || volumeOpen" class="menu-backdrop" @click="closeMenus()" />
</template>
