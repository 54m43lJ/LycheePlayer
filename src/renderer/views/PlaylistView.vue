<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CoverArt from '../components/CoverArt.vue'
import PlaylistPicker from '../components/PlaylistPicker.vue'
import SongTable from '../components/SongTable.vue'
import { describeError } from '../api'
import { useAvailability } from '../composables/availability'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { usePlaylistStore } from '../stores/playlist'
import { PLAYLIST_POLL_INTERVAL_MS } from '@shared/constants'
import { singerNames } from '../utils/format'

const route = useRoute()
const router = useRouter()
const playlist = usePlaylistStore()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const auth = useAuthStore()
const toast = useToast()

const id = computed(() => String(route.params.id ?? ''))
const feed = computed(() => playlist.feed)
const meta = computed(() => feed.value?.meta ?? null)
const songs = computed(() => feed.value?.songs ?? [])
const { availability, loading: availabilityLoading } = useAvailability(songs)
watch(
  [availability, availabilityLoading],
  ([value, loading]) => playlist.setProbeState(value, loading),
  { immediate: true, flush: 'sync' }
)
const favoriteMids = computed(() => [...playlistEdit.favorites])
const assetStates = computed(() => download.assets)
const filterText = ref('')

const filteredSongs = computed(() => {
  const keyword = filterText.value.trim().toLowerCase()
  if (!keyword) return songs.value
  return songs.value.filter((song) => {
    const haystack = [song.name, singerNames(song), song.album.name].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

const loading = computed(
  () => feed.value?.status === 'loading' && feed.value.songs.length === 0
)
const error = computed(() =>
  feed.value?.status === 'error' && feed.value.songs.length === 0 ? feed.value.error : ''
)
const removable = computed(
  () => Boolean(meta.value && meta.value.editable && meta.value.kind === 'normal')
)
const playableSongs = computed(() =>
  songs.value.filter((song) => availability.value[song.songMid]?.playable !== false)
)

function source(): { kind: 'playlist'; id: string } {
  return { kind: 'playlist', id: id.value }
}

function startAt(index: number): void {
  const song = filteredSongs.value[index]
  if (!song) return
  player.startPlaylistPlayback(song, source())
  playlist.beginQueueBuild()
}

function playAll(): void {
  const start = filteredSongs.value.findIndex(
    (song) => availability.value[song.songMid]?.playable !== false
  )
  if (start >= 0) startAt(start)
}

function addNextAt(index: number): void {
  const song = filteredSongs.value[index]
  if (song) player.addNext(song)
}

async function toggleFavorite(index: number): Promise<void> {
  const song = filteredSongs.value[index]
  if (song) await playlistEdit.toggleFavorite(song.songMid)
}

async function downloadAt(index: number): Promise<void> {
  const song = filteredSongs.value[index]
  if (!song) return
  try {
    await download.start(song.songMid, player.requestedQuality)
    toast.show('已加入下载任务')
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function downloadAll(): Promise<void> {
  if (!meta.value || playableSongs.value.length === 0) return
  try {
    await download.startMany(
      playableSongs.value.map((song) => song.songMid),
      player.requestedQuality
    )
    toast.show('已加入下载队列')
  } catch (err) {
    toast.error(describeError(err))
  }
}

const removeTarget = ref<{ songMid: string; name: string } | null>(null)

function removeAt(index: number): void {
  const song = filteredSongs.value[index]
  if (!song || !meta.value || !removable.value) return
  removeTarget.value = song
}

async function confirmRemove(): Promise<void> {
  const target = removeTarget.value
  const currentMeta = meta.value
  if (!target || !currentMeta || !removable.value) {
    removeTarget.value = null
    return
  }
  removeTarget.value = null
  const snapshot = songs.value.slice()
  playlist.removeMembers(id.value, [target.songMid])
  try {
    await playlistEdit.removeSongs(id.value, [target.songMid])
  } catch (err) {
    if (feed.value) {
      feed.value.songs = snapshot
      feed.value.total = Math.max(feed.value.total, snapshot.length)
      feed.value.meta = {
        ...currentMeta,
        songCount: Math.max(currentMeta.songCount, snapshot.length)
      }
    }
    toast.error(describeError(err))
  }
}

const pickerOpen = ref(false)
const pickerIndex = ref(-1)
const pickerMids = computed(() => {
  const song = filteredSongs.value[pickerIndex.value]
  return song ? [song.songMid] : []
})
const pickerName = computed(() => filteredSongs.value[pickerIndex.value]?.name ?? '')

function openPicker(index: number): void {
  pickerIndex.value = index
  pickerOpen.value = true
}

function onPickerAdded(playlistId: string): void {
  playlist.invalidate(playlistId)
}

function retry(): void {
  void playlist.retry()
}

watch(
  id,
  (value, previous) => {
    if (previous && previous !== value) playlist.stop(previous)
    if (value) void playlist.load(value)
    filterText.value = ''
  },
  { immediate: true }
)

watch(
  () => meta.value?.id ?? null,
  () => {
    if (meta.value) playlist.visit(meta.value)
  },
  { immediate: true }
)

watch(
  () => songs.value.map((song) => song.songMid).join('|'),
  () => {
    void download.refreshAssets(songs.value.map((song) => song.songMid))
    if (songs.value.length > 0) {
      void playlistEdit.loadFavorites(songs.value.map((song) => song.songMid))
    }
  },
  { immediate: true }
)

watch(
  () => download.tasks.map((task) => `${task.songMid}:${task.status}`).join('|'),
  () => void download.refreshAssets(songs.value.map((song) => song.songMid))
)

let pollTimer: number | null = null

onMounted(() => {
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && id.value) {
      void playlist.poll(id.value)
    }
  }, PLAYLIST_POLL_INTERVAL_MS)
})

onBeforeUnmount(() => {
  if (pollTimer !== null) window.clearInterval(pollTimer)
  playlist.stop(id.value)
})
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
            <button
              class="btn ghost"
              :disabled="!auth.loggedIn || playableSongs.length === 0"
              @click="downloadAll()"
            >
              <AppIcon name="download" :size="15" />
              下载全部
            </button>
            <button class="btn ghost" @click="router.push('/library')">返回我的歌单</button>
          </div>
        </div>
      </section>

      <div class="section-title">
        <span>歌曲</span>
        <span class="count">
          {{ filterText ? `${filteredSongs.length} / ${songs.length}` : songs.length }} /
          {{ meta.songCount }} 首
        </span>
      </div>

      <div v-if="songs.length > 0" class="table-filter">
        <span class="search-icon"><AppIcon name="search" :size="16" /></span>
        <input v-model="filterText" class="input" placeholder="筛选歌名、歌手或专辑" />
        <button v-if="filterText" class="btn ghost small" @click="filterText = ''">清除</button>
      </div>

      <SongTable
        v-if="filteredSongs.length > 0"
        :songs="filteredSongs"
        :active-mid="player.current?.songMid"
        :availability="availability"
        :favorite-mids="favoriteMids"
        :asset-states="assetStates"
        :downloadable="true"
        :removable="removable"
        :can-add-to-playlist="auth.loggedIn"
        @play="startAt"
        @play-next="addNextAt"
        @toggle="player.toggle()"
        @favorite="toggleFavorite"
        @download="downloadAt"
        @remove="removeAt"
        @add-to-playlist="openPicker"
      />
      <div v-else-if="filterText" class="empty compact">
        <div class="empty-icon"><AppIcon name="search" :size="22" /></div>
        <h3>没有匹配的歌曲</h3>
        <p>共 {{ songs.length }} 首，试试其他关键词。</p>
        <button class="btn ghost small" @click="filterText = ''">清除筛选</button>
      </div>
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

      <PlaylistPicker
        :open="pickerOpen"
        :song-mids="pickerMids"
        :song-name="pickerName"
        @close="pickerOpen = false"
        @added="onPickerAdded"
      />
    </template>

    <ConfirmDialog
      :open="removeTarget !== null"
      title="从歌单删除"
      :message="`确定从歌单「${meta?.name ?? ''}」删除「${removeTarget?.name ?? ''}」？`"
      confirm-label="删除"
      danger
      @confirm="confirmRemove()"
      @cancel="removeTarget = null"
    />
  </div>
</template>
