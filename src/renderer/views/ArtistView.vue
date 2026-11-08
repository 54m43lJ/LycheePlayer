<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ArtistDetail, ArtistSongSort } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import PlaylistPicker from '../components/PlaylistPicker.vue'
import SongTable from '../components/SongTable.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { useUiStore } from '../stores/ui'
import { formatCount } from '../utils/format'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const auth = useAuthStore()
const ui = useUiStore()
const toast = useToast()

const SONG_SORTS: Array<{ value: ArtistSongSort; label: string }> = [
  { value: 'hot', label: '最热' },
  { value: 'latest', label: '最新' }
]

const detail = ref<ArtistDetail | null>(null)
const loading = ref(false)
const error = ref('')
const loadingMore = ref(false)
const songsLoading = ref(false)
const songSort = ref<ArtistSongSort>('hot')
const pickerOpen = ref(false)
const pickerIndex = ref(-1)
const pageRef = ref<HTMLElement | null>(null)
const SCROLL_LOAD_THRESHOLD = 160
let scrollRoot: HTMLElement | null = null
let token = 0
const mid = computed(() => String(route.params.mid ?? ''))
const songs = computed(() => detail.value?.songs ?? [])
const favoriteMids = computed(() => [...playlistEdit.favorites])
const pickerMids = computed(() => {
  const song = songs.value[pickerIndex.value]
  return song ? [song.songMid] : []
})
const pickerName = computed(() => songs.value[pickerIndex.value]?.name ?? '')

async function load(reset = true): Promise<void> {
  const id = mid.value
  if (!id) return
  const request = ++token
  if (reset) {
    loading.value = true
    error.value = ''
    detail.value = null
    loadingMore.value = false
    songsLoading.value = false
  } else {
    if (!detail.value || !detail.value.hasMore) return
    loadingMore.value = true
  }
  try {
    const offset = reset ? 0 : songs.value.length
    if (reset) {
      const data = unwrap(await window.lychee.artist.get(id, 0, songSort.value))
      if (request !== token) return
      detail.value = data
      void playlistEdit.loadFavorites(data.songs.map((song) => song.songMid))
      void download.refreshAssets(data.songs.map((song) => song.songMid))
      return
    }
    const page = unwrap(
      await window.lychee.artist.getSongs(id, offset, songSort.value)
    )
    if (request !== token || !detail.value) return
    detail.value = {
      ...detail.value,
      songs: [...detail.value.songs, ...page.songs],
      total: page.total,
      hasMore: page.hasMore
    }
    void playlistEdit.loadFavorites(page.songs.map((song) => song.songMid))
    void download.refreshAssets(page.songs.map((song) => song.songMid))
  } catch (err) {
    if (request === token) {
      if (reset) error.value = describeError(err)
      else toast.error(describeError(err))
    }
  } finally {
    if (request === token) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

/** 仅重载歌曲列表：保留歌手头部信息，分页从 0 重新开始。 */
async function reloadSongs(next: ArtistSongSort): Promise<void> {
  const id = mid.value
  if (!id) return
  const previous = songSort.value
  songSort.value = next
  const request = ++token
  loadingMore.value = false
  songsLoading.value = true
  try {
    const page = unwrap(await window.lychee.artist.getSongs(id, 0, next))
    if (request !== token) return
    if (detail.value) {
      detail.value = {
        ...detail.value,
        songs: page.songs,
        total: page.total,
        hasMore: page.hasMore
      }
    }
    void playlistEdit.loadFavorites(page.songs.map((song) => song.songMid))
    void download.refreshAssets(page.songs.map((song) => song.songMid))
  } catch (err) {
    if (request === token) {
      songSort.value = previous
      toast.error(describeError(err))
    }
  } finally {
    if (request === token) songsLoading.value = false
  }
}

function maybeLoadMore(): void {
  if (loading.value || loadingMore.value || songsLoading.value || !detail.value?.hasMore) return
  const el = scrollRoot
  if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_THRESHOLD) {
    void load(false)
  }
}

function changeSort(next: ArtistSongSort): void {
  if (songSort.value === next) return
  scrollRoot?.scrollTo({ top: 0 })
  void reloadSongs(next)
}

function playAll(): void {
  if (songs.value.length > 0) player.playList(songs.value, 0)
}

function playAt(index: number): void {
  player.playList(songs.value, index)
}

function addNextAt(index: number): void {
  const song = songs.value[index]
  if (song) player.addNext(song)
}

async function toggleFavorite(index: number): Promise<void> {
  const song = songs.value[index]
  if (song) await playlistEdit.toggleFavorite(song.songMid)
}

async function downloadAt(index: number): Promise<void> {
  const song = songs.value[index]
  if (!song) return
  try {
    await download.start(song.songMid, player.requestedQuality)
    if (!ui.downloadOpen) ui.toggleDownload()
    toast.show('已加入下载任务')
  } catch (err) {
    toast.error(describeError(err))
  }
}

function openPicker(index: number): void {
  pickerIndex.value = index
  pickerOpen.value = true
}

watch(mid, () => void load(), { immediate: true })

onMounted(() => {
  scrollRoot = pageRef.value?.closest<HTMLElement>('.main') ?? null
  scrollRoot?.addEventListener('scroll', maybeLoadMore, { passive: true })
})

onBeforeUnmount(() => {
  scrollRoot?.removeEventListener('scroll', maybeLoadMore)
  scrollRoot = null
})
</script>

<template>
  <div ref="pageRef" class="page">
    <div class="page-head">
      <button class="btn ghost small" @click="router.back()">
        <AppIcon name="chevron-left" :size="15" />
        返回
      </button>
    </div>

    <div v-if="loading" class="loading-block"><span class="spinner lg" />正在加载歌手</div>

    <div v-else-if="error" class="empty">
      <div class="empty-icon"><AppIcon name="user" :size="26" /></div>
      <h3>歌手加载失败</h3>
      <p>{{ error }}</p>
      <button class="btn small" @click="load()">重试</button>
    </div>

    <template v-else-if="detail">
      <section class="catalog-hero">
        <span class="artist-avatar">
          <img v-if="detail.coverUrl" :src="detail.coverUrl" alt="" />
          <template v-else>{{ detail.name.slice(0, 1) || '?' }}</template>
        </span>
        <div class="catalog-info">
          <div class="eyebrow">Artist</div>
          <h1>{{ detail.name || '未知歌手' }}</h1>
          <div class="playlist-meta">
            <span>{{ formatCount(detail.songCount) }} 首歌曲</span>
            <span v-if="detail.albumCount > 0">{{ formatCount(detail.albumCount) }} 张专辑</span>
          </div>
          <div class="playlist-actions">
            <button class="btn primary" :disabled="songs.length === 0" @click="playAll()">
              <AppIcon name="play" :size="15" />
              播放全部
            </button>
            <button class="btn ghost" @click="router.push('/search')">返回搜索</button>
          </div>
        </div>
      </section>

      <p v-if="detail.description" class="catalog-desc">{{ detail.description }}</p>

      <div class="section-title">
        <span>歌曲</span>
        <div class="section-title-right">
          <div class="tabs song-sort-tabs">
            <button
              v-for="item in SONG_SORTS"
              :key="item.value"
              class="tab"
              :class="{ active: songSort === item.value }"
              @click="changeSort(item.value)"
            >
              {{ item.label }}
            </button>
          </div>
          <span class="count">{{ songs.length }} / {{ detail.total }} 首</span>
        </div>
      </div>

      <div v-if="songsLoading" class="loading-block">
        <span class="spinner lg" />
        正在加载歌曲
      </div>
      <SongTable
        v-else-if="songs.length > 0"
        :songs="songs"
        :active-mid="player.current?.songMid"
        :favorite-mids="favoriteMids"
        :asset-states="download.assets"
        :can-add-to-playlist="auth.loggedIn"
        @play="playAt"
        @play-next="addNextAt"
        @toggle="player.toggle()"
        @favorite="toggleFavorite"
        @download="downloadAt"
        @add-to-playlist="openPicker"
      />
      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="music" :size="25" /></div>
        <h3>暂无歌曲</h3>
      </div>

      <div v-if="!songsLoading && detail.hasMore" class="feed-footer">
        <template v-if="loadingMore">
          <span class="spinner" />
          <span>正在加载更多</span>
        </template>
        <span v-else>继续向下滚动加载更多</span>
      </div>
      <div v-else-if="!songsLoading && songs.length > 0" class="feed-footer">已经到底了</div>

      <PlaylistPicker
        :open="pickerOpen"
        :song-mids="pickerMids"
        :song-name="pickerName"
        @close="pickerOpen = false"
        @added="() => undefined"
      />
    </template>
  </div>
</template>
