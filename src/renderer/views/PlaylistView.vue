<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import SongTable from '../components/SongTable.vue'
import { describeError } from '../api'
import { useAvailability } from '../composables/availability'
import { useToast } from '../composables/toast'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { usePlaylistStore } from '../stores/playlist'
import { useUiStore } from '../stores/ui'

const route = useRoute()
const router = useRouter()
const playlist = usePlaylistStore()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const ui = useUiStore()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))
const feed = computed(() => playlist.feed)
const meta = computed(() => feed.value?.meta ?? null)
const songs = computed(() => feed.value?.songs ?? [])
const { availability } = useAvailability(songs)
const favoriteMids = computed(() => [...playlistEdit.favorites])

const loading = computed(
  () => feed.value?.status === 'loading' && feed.value.songs.length === 0
)
const error = computed(() =>
  feed.value?.status === 'error' && feed.value.songs.length === 0 ? feed.value.error : ''
)

function source(): { kind: 'playlist'; id: string } {
  return { kind: 'playlist', id: id.value }
}

function startAt(index: number): void {
  const song = songs.value[index]
  if (!song) return
  player.startPlaylistPlayback(song, source())
  syncQueue()
}

function playAll(): void {
  const start = songs.value.findIndex(
    (song) => availability.value[song.songMid]?.playable !== false
  )
  if (start >= 0) startAt(start)
}

function addNextAt(index: number): void {
  const song = songs.value[index]
  if (song) player.addNext(song)
}

function syncQueue(): void {
  const current = player.current
  if (!current || !feed.value || songs.value.length === 0) return
  if (player.queueSource?.id !== id.value) return
  player.appendPlaylistQueue(current, songs.value)
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

function retry(): void {
  void playlist.retry()
}

watch(
  id,
  (value) => {
    if (value) void playlist.load(value)
  },
  { immediate: true }
)

watch(
  [() => feed.value?.status, () => feed.value?.songs.length],
  () => {
    syncQueue()
    if (songs.value.length > 0) {
      void playlistEdit.loadFavorites(songs.value.map((song) => song.songMid))
    }
  }
)
</script>

<template>
  <div class="page">
    <div v-if="loading" class="loading-block">
      <span class="spinner lg" />
      正在加载歌单
    </div>

    <div v-else-if="error" class="empty">
      <div class="empty-icon"><AppIcon name="list" :size="25" /></div>
      <h3>歌单加载失败</h3>
      <p>{{ error }}</p>
      <div class="empty-actions">
        <button class="btn small" @click="retry()">重试</button>
        <button class="btn ghost small" @click="router.push('/library')">返回我的歌单</button>
      </div>
    </div>

    <template v-else-if="meta">
      <section class="playlist-hero">
        <CoverArt :src="meta.coverUrl" image-class="playlist-cover" :icon-size="44" />
        <div class="playlist-info">
          <div class="eyebrow">Playlist</div>
          <h1>{{ meta.kind === 'favorites' ? '我喜欢' : meta.name }}</h1>
          <div class="playlist-meta">
            <span>{{ meta.songCount }} 首歌曲</span>
            <span>歌单 ID {{ meta.id }}</span>
            <span>{{ songs.length }} 首已载入</span>
          </div>
          <div class="playlist-actions">
            <button class="btn primary" :disabled="songs.length === 0" @click="playAll()">
              <AppIcon name="play" :size="15" />
              播放全部
            </button>
            <button class="btn ghost" @click="router.push('/library')">返回我的歌单</button>
          </div>
        </div>
      </section>

      <div class="section-title">
        <span>歌曲</span>
        <span class="count">{{ songs.length }} / {{ meta.songCount }} 首</span>
      </div>
      <SongTable
        v-if="songs.length > 0"
        :songs="songs"
        :active-mid="player.current?.songMid"
        :availability="availability"
        :favorite-mids="favoriteMids"
        :downloadable="true"
        @play="startAt"
        @play-next="addNextAt"
        @toggle="player.toggle()"
        @favorite="toggleFavorite"
        @download="downloadAt"
      />
      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="music" :size="25" /></div>
        <h3>这个歌单还没有可播放的歌曲</h3>
      </div>

      <div v-if="feed && feed.songs.length > 0" class="feed-footer">
        <template v-if="feed.status === 'partial'">
          <span class="spinner" />
          已载入 {{ feed.songs.length }} / {{ feed.total }} 首
        </template>
        <template v-else-if="feed.status === 'error'">
          <span>已载入 {{ feed.songs.length }} / {{ feed.total }} 首，加载中断</span>
          <button class="btn ghost small" @click="retry()">重试</button>
        </template>
        <template v-else>已载入全部 {{ feed.songs.length }} 首</template>
      </div>
    </template>
  </div>
</template>
