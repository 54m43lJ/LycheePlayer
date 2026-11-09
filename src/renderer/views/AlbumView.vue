<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { AlbumDetail } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import PlaylistPicker from '../components/PlaylistPicker.vue'
import SongTable from '../components/SongTable.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const auth = useAuthStore()
const toast = useToast()

const detail = ref<AlbumDetail | null>(null)
const loading = ref(false)
const error = ref('')
const loadingMore = ref(false)
const pickerOpen = ref(false)
const pickerIndex = ref(-1)
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
  } else {
    if (!detail.value || !detail.value.hasMore) return
    loadingMore.value = true
  }
  try {
    const offset = reset ? 0 : songs.value.length
    const data = unwrap(await window.lychee.album.get(id, offset))
    if (request !== token) return
    if (reset) {
      detail.value = data
    } else if (detail.value) {
      detail.value = { ...data, songs: [...detail.value.songs, ...data.songs] }
    }
    void playlistEdit.loadFavorites(data.songs.map((song) => song.songMid))
    void download.refreshAssets(data.songs.map((song) => song.songMid))
  } catch (err) {
    if (request === token) error.value = describeError(err)
  } finally {
    if (request === token) {
      loading.value = false
      loadingMore.value = false
    }
  }
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
</script>

<template>
  <div class="page">
    <div class="page-head">
      <button class="btn ghost small" @click="router.back()">
        <AppIcon name="chevron-left" :size="15" />
        返回
      </button>
    </div>

    <div v-if="loading" class="loading-block"><span class="spinner lg" />正在加载专辑</div>

    <div v-else-if="error" class="empty">
      <div class="empty-icon"><AppIcon name="music" :size="26" /></div>
      <h3>专辑加载失败</h3>
      <p>{{ error }}</p>
      <button class="btn small" @click="load()">重试</button>
    </div>

    <template v-else-if="detail">
      <section class="playlist-hero">
        <CoverArt :src="detail.coverUrl" image-class="playlist-cover" :icon-size="44" />
        <div class="playlist-info">
          <div class="eyebrow">Album</div>
          <h1>{{ detail.name || '未知专辑' }}</h1>
          <div class="playlist-meta">
            <span v-if="detail.publishDate">{{ detail.publishDate }}</span>
            <span>{{ songs.length }} / {{ detail.total }} 首</span>
            <span v-if="detail.singers.length" class="artist-links">
              <template v-for="(singer, index) in detail.singers" :key="`${singer.mid}-${index}`">
                <RouterLink
                  v-if="singer.mid"
                  class="inline-link"
                  :to="`/artist/${singer.mid}`"
                  >{{ singer.name }}</RouterLink
                >
                <span v-else>{{ singer.name }}</span>
                <span v-if="index < detail.singers.length - 1"> / </span>
              </template>
            </span>
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
        <span class="count">{{ songs.length }} / {{ detail.total }} 首</span>
      </div>

      <SongTable
        v-if="songs.length > 0"
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

      <div v-if="detail.hasMore" class="feed-footer">
        <button class="btn ghost small" :disabled="loadingMore" @click="load(false)">
          {{ loadingMore ? '加载中' : '加载更多' }}
        </button>
      </div>

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
