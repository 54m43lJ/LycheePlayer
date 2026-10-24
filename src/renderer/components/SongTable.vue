<script setup lang="ts">
import type { Song, SongAvailability } from '@shared/types'
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import { usePlayerStore } from '../stores/player'
import { formatDuration, singerNames, songCover } from '../utils/format'

const props = withDefaults(
  defineProps<{
    songs: Song[]
    activeMid?: string | null
    showAlbum?: boolean
    availability?: Record<string, SongAvailability>
    favoriteMids?: string[]
    downloadable?: boolean
  }>(),
  {
    activeMid: null,
    showAlbum: true,
    availability: () => ({}),
    favoriteMids: () => [],
    downloadable: true
  }
)

const emit = defineEmits<{
  play: [index: number]
  playNext: [index: number]
  toggle: []
  favorite: [index: number]
  download: [index: number]
}>()

const player = usePlayerStore()
const playing = computed(() => player.status === 'playing')

function isPlayable(song: Song, index: number): boolean {
  return props.availability[song.songMid]?.playable !== false && index >= 0
}

function availabilityLabel(song: Song): string {
  const item = props.availability[song.songMid]
  if (!item) return ''
  if (item.playable === false) return '不可播'
  if (item.maxQuality === 'flac') return 'FLAC'
  if (item.maxQuality === '320k') return '320K'
  if (item.maxQuality === '128k') return '128K'
  return ''
}

function isFavorite(song: Song): boolean {
  return props.favoriteMids.includes(song.songMid)
}
</script>

<template>
  <table class="song-table">
    <thead>
      <tr>
        <th class="song-index">#</th>
        <th>标题</th>
        <th v-if="showAlbum">专辑</th>
        <th class="song-action">操作</th>
        <th class="song-duration-col">时长</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(song, index) in songs"
        :key="`${song.songMid}-${index}`"
        class="song-row"
        :class="{
          active: song.songMid === activeMid,
          unavailable: availability[song.songMid]?.playable === false
        }"
        @dblclick="isPlayable(song, index) && emit('play', index)"
      >
        <td class="song-index">
          <span class="song-index-slot">
            <span class="song-index-text">{{ index + 1 }}</span>
            <button
              class="song-play"
              :title="song.songMid === activeMid ? (playing ? '暂停' : '继续播放') : '播放'"
              :disabled="!isPlayable(song, index)"
              @click.stop="song.songMid === activeMid ? emit('toggle') : emit('play', index)"
            >
              <AppIcon :name="song.songMid === activeMid && playing ? 'pause' : 'play'" :size="13" />
            </button>
          </span>
        </td>
        <td class="song-title-cell">
          <div class="song-main">
            <CoverArt :src="songCover(song, 300)" image-class="cover-thumb" :icon-size="16" />
            <div class="song-text">
              <div class="song-title">
                {{ song.name }}
                <span v-if="song.pay.album" class="pay-badge album">数字专辑</span>
                <span v-else-if="song.pay.vip" class="pay-badge">VIP</span>
                <span v-else-if="!song.pay.free" class="pay-badge">付费</span>
                <span
                  v-if="availability[song.songMid] && availabilityLabel(song)"
                  class="quality-badge"
                  :class="{ unavailable: availability[song.songMid]?.playable === false }"
                  >{{ availabilityLabel(song) }}</span
                >
              </div>
              <div class="song-artist">{{ singerNames(song) }}</div>
            </div>
          </div>
        </td>
        <td v-if="showAlbum">
          <div class="song-album" :title="song.album.name">{{ song.album.name || '—' }}</div>
        </td>
        <td class="song-action">
          <div class="song-action-inner">
            <button
              class="song-icon"
              :class="{ active: isFavorite(song) }"
              :title="isFavorite(song) ? '取消收藏' : '收藏'"
              @click.stop="emit('favorite', index)"
            >
              <AppIcon :name="isFavorite(song) ? 'heart-filled' : 'heart'" :size="15" />
            </button>
            <button
              class="song-icon"
              title="下载"
              :disabled="!downloadable || availability[song.songMid]?.playable === false"
              @click.stop="emit('download', index)"
            >
              <AppIcon name="download" :size="15" />
            </button>
            <button
              class="song-icon"
              title="下一首播放"
              aria-label="下一首播放"
              :disabled="!isPlayable(song, index)"
              @click.stop="emit('playNext', index)"
            >
              <AppIcon name="plus" :size="16" />
            </button>
          </div>
        </td>
        <td class="song-duration">{{ formatDuration(song.durationMs) }}</td>
      </tr>
    </tbody>
  </table>
</template>
