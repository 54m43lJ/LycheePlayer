<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { Quality } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import { usePlayerStore, PLAY_MODE_LABEL } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { formatDuration, singerNames, songCover } from '../utils/format'

const player = usePlayerStore()
const ui = useUiStore()
const { current, status, volume, mode, quality, positionMs, durationMs, progress } = storeToRefs(player)

const qualityMenu = ref(false)
const lastVolume = ref(0.8)

const cover = computed(() => songCover(current.value, 300))
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

function chooseQuality(next: Quality): void {
  qualityMenu.value = false
  player.setQuality(next)
}

function toggleMute(): void {
  if (volume.value > 0) {
    lastVolume.value = volume.value
    player.setVolume(0)
  } else {
    player.setVolume(lastVolume.value || 0.8)
  }
}
</script>

<template>
  <footer class="player">
    <div v-if="!current" class="player-empty">
      <AppIcon name="music" :size="16" />
      还没有播放中的歌曲，搜索并双击任意歌曲开始
    </div>

    <template v-else>
      <div class="player-now">
        <CoverArt :src="cover" image-class="player-cover" :icon-size="20" />
        <div class="player-text">
          <div class="player-title" :title="current.name">{{ current.name }}</div>
          <div class="player-artist">{{ singerNames(current) }} · {{ current.album.name }}</div>
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
            :disabled="player.loading"
            @click="player.toggle()"
          >
            <span v-if="player.loading" class="spinner" />
            <AppIcon v-else :name="status === 'playing' ? 'pause' : 'play'" :size="17" />
          </button>
          <button class="icon-btn" title="下一首" @click="player.next()">
            <AppIcon name="next" :size="17" />
          </button>
          <button
            class="icon-btn"
            :class="{ active: ui.lyricsOpen }"
            title="歌词"
            @click="ui.toggleLyrics()"
          >
            <AppIcon name="lyrics" :size="17" />
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
        <div class="quality-wrap">
          <button class="quality-chip" title="切换音质" @click.stop="qualityMenu = !qualityMenu">
            {{ quality === 'flac' ? 'FLAC' : quality.toUpperCase() }}
          </button>
          <div v-if="qualityMenu" class="quality-menu">
            <button
              v-for="option in qualityOptions"
              :key="option.value"
              :class="{ active: option.value === quality }"
              @click="chooseQuality(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
        <button class="icon-btn" :title="volume > 0 ? '静音' : '恢复音量'" @click="toggleMute">
          <AppIcon :name="volume > 0 ? 'volume' : 'mute'" :size="17" />
        </button>
        <input
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

  <div v-if="qualityMenu" class="menu-backdrop" @click="qualityMenu = false" />
</template>
