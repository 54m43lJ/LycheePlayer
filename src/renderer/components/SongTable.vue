<script setup lang="ts">
import type { Song, SongAssetState, SongAvailability } from '@shared/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import MarqueeText from './MarqueeText.vue'
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
    assetStates?: Record<string, SongAssetState>
    removable?: boolean
    canAddToPlaylist?: boolean
  }>(),
  {
    activeMid: null,
    showAlbum: true,
    availability: () => ({}),
    favoriteMids: () => [],
    downloadable: true,
    assetStates: () => ({}),
    removable: false,
    canAddToPlaylist: false
  }
)

const emit = defineEmits<{
  play: [index: number]
  playNext: [index: number]
  toggle: []
  favorite: [index: number]
  download: [index: number]
  remove: [index: number]
  addToPlaylist: [index: number]
}>()

const player = usePlayerStore()
const playing = computed(() => player.status === 'playing')
const compactQuery = window.matchMedia('(max-width: 900px)')
const compact = ref(compactQuery.matches)
const menuIndex = ref<number | null>(null)
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null

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

function visibleSingers(song: Song): Array<{ mid: string; name: string }> {
  return song.singers.filter((singer) => singer.name.trim().length > 0)
}

function isFavorite(song: Song): boolean {
  return props.favoriteMids.includes(song.songMid)
}

function downloadIcon(song: Song): string {
  const asset = props.assetStates[song.songMid]
  if (asset?.downloadedQuality) return 'download-done'
  if (asset?.cachedQuality) return 'download-cached'
  return 'download'
}

function downloadTitle(song: Song): string {
  const asset = props.assetStates[song.songMid]
  const quality = (value: string | null | undefined): string =>
    value === 'flac' ? 'FLAC' : (value ?? '').toUpperCase()
  if (asset?.taskStatus === 'downloading' || asset?.taskStatus === 'pending') return '正在下载'
  if (asset?.taskStatus === 'paused') return '下载已暂停'
  if (asset?.taskStatus === 'failed') return '下载失败，点击重试'
  if (asset?.downloadedQuality) {
    return asset.cachedQuality
      ? `已下载 ${quality(asset.downloadedQuality)} · 已缓存 ${quality(asset.cachedQuality)}`
      : `已下载 ${quality(asset.downloadedQuality)}`
  }
  if (asset?.cachedQuality) return `已缓存 ${quality(asset.cachedQuality)}`
  return '下载'
}

function toggleMenu(index: number): void {
  menuIndex.value = menuIndex.value === index ? null : index
}

function closeMenu(): void {
  menuIndex.value = null
}

function run(action: () => void): void {
  closeMenu()
  action()
}

function onDocumentClick(): void {
  closeMenu()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
  mediaListener = (event) => {
    compact.value = event.matches
    closeMenu()
  }
  compactQuery.addEventListener('change', mediaListener)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
  if (mediaListener) compactQuery.removeEventListener('change', mediaListener)
})
</script>

<template>
  <table class="song-table">
    <thead>
      <tr>
        <th class="song-index">#</th>
        <th>标题</th>
        <th v-if="showAlbum" class="song-album-col">专辑</th>
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
                <MarqueeText class="song-title-text" :text="song.name" />
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
              <div v-if="singerNames(song)" class="song-artist">
                <template v-for="(singer, singerIndex) in visibleSingers(song)" :key="`${singer.mid}-${singerIndex}`">
                  <RouterLink
                    v-if="singer.mid"
                    class="inline-link"
                    :to="`/artist/${singer.mid}`"
                    @click.stop
                    >{{ singer.name }}</RouterLink
                  >
                  <span v-else>{{ singer.name }}</span>
                  <span v-if="singerIndex < visibleSingers(song).length - 1" class="singer-sep"> / </span>
                </template>
              </div>
            </div>
          </div>
        </td>
        <td v-if="showAlbum" class="song-album-col">
          <RouterLink
            v-if="song.album.mid"
            class="song-album inline-link"
            :to="`/album/${song.album.mid}`"
            :title="song.album.name"
            @click.stop
          >
            <MarqueeText :text="song.album.name || '—'" />
          </RouterLink>
          <div v-else class="song-album" :title="song.album.name">{{ song.album.name || '—' }}</div>
        </td>
        <td class="song-action">
          <div v-if="!compact" class="song-action-inner">
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
              :class="{
                cached: assetStates[song.songMid]?.cachedQuality,
                downloaded: assetStates[song.songMid]?.downloadedQuality
              }"
              :title="downloadTitle(song)"
              :disabled="!downloadable || availability[song.songMid]?.playable === false"
              @click.stop="emit('download', index)"
            >
              <AppIcon :name="downloadIcon(song)" :size="15" />
            </button>
            <button
              class="song-icon"
              title="下一首播放"
              aria-label="下一首播放"
              :disabled="!isPlayable(song, index)"
              @click.stop="emit('playNext', index)"
            >
              <AppIcon name="play-next" :size="16" />
            </button>
            <button
              v-if="canAddToPlaylist"
              class="song-icon"
              title="添加到歌单"
              aria-label="添加到歌单"
              @click.stop="emit('addToPlaylist', index)"
            >
              <AppIcon name="playlist-add" :size="16" />
            </button>
            <button
              v-if="removable"
              class="song-icon danger"
              title="从歌单删除"
              aria-label="从歌单删除"
              @click.stop="emit('remove', index)"
            >
              <AppIcon name="trash" :size="15" />
            </button>
          </div>
          <div v-else class="song-more-wrap" @click.stop>
            <button
              class="song-icon"
              title="更多操作"
              aria-label="更多操作"
              @click.stop="toggleMenu(index)"
            >
              <AppIcon name="more" :size="17" />
            </button>
            <div v-if="menuIndex === index" class="song-more-menu">
              <button @click="run(() => emit('favorite', index))">
                <AppIcon :name="isFavorite(song) ? 'heart-filled' : 'heart'" :size="15" />
                {{ isFavorite(song) ? '取消收藏' : '收藏' }}
              </button>
              <button
                :disabled="!downloadable || availability[song.songMid]?.playable === false"
                @click="run(() => emit('download', index))"
              >
                <AppIcon :name="downloadIcon(song)" :size="15" />
                {{ downloadTitle(song) }}
              </button>
              <button :disabled="!isPlayable(song, index)" @click="run(() => emit('playNext', index))">
                <AppIcon name="play-next" :size="15" />
                下一首播放
              </button>
              <button v-if="canAddToPlaylist" @click="run(() => emit('addToPlaylist', index))">
                <AppIcon name="playlist-add" :size="15" />
                添加到歌单
              </button>
              <button v-if="removable" class="danger" @click="run(() => emit('remove', index))">
                <AppIcon name="trash" :size="15" />
                从歌单删除
              </button>
            </div>
          </div>
        </td>
        <td class="song-duration">{{ formatDuration(song.durationMs) }}</td>
      </tr>
    </tbody>
  </table>
</template>
