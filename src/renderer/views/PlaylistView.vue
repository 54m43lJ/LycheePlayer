<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CoverArt from '../components/CoverArt.vue'
import PageJump from '../components/PageJump.vue'
import SongListTable from '../components/SongListTable.vue'
import { describeError } from '../api'
import { useAvailability } from '../composables/availability'
import { usePageJump } from '../composables/page-jump'
import { scrollToSongRow } from '../utils/page-jump'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { usePlaylistStore } from '../stores/playlist'
import { PLAYLIST_POLL_INTERVAL_MS } from '@shared/constants'
import { dailyPlaylistName, singerNames } from '../utils/format'

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
const displayName = computed(() =>
  dailyPlaylistName(meta.value?.name ?? '', auth.profile?.nickname ?? '')
)
const songs = computed(() => feed.value?.songs ?? [])
const { availability, loading: availabilityLoading } = useAvailability(songs)
watch(
  [availability, availabilityLoading],
  ([value, loading]) => playlist.setProbeState(value, loading),
  { immediate: true, flush: 'sync' }
)
const downloadedCount = computed(
  () =>
    songs.value.filter((song) => Boolean(download.assets[song.songMid]?.downloadedQuality))
      .length
)
const filterText = ref('')
const pageRef = ref<HTMLElement | null>(null)
const {
  showTop: showJumpTop,
  showBottom: showJumpBottom,
  scrollToTop,
  scrollToBottom
} = usePageJump(pageRef)

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
const currentSongInList = computed(
  () =>
    Boolean(player.current) &&
    filteredSongs.value.some((song) => song.songMid === player.current?.songMid)
)
const showJumpCurrent = computed(
  () =>
    player.queueSource?.kind === 'playlist' &&
    player.queueSource.id === id.value &&
    currentSongInList.value
)

/** 把当前歌曲行滚到内容区可视范围中间。 */
function scrollToCurrent(): void {
  const root = pageRef.value
  const mid = player.current?.songMid
  if (root && mid) scrollToSongRow(root, mid)
}
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

async function downloadAll(): Promise<void> {
  if (!meta.value || playableSongs.value.length === 0) return
  try {
    await download.startMany(
      playableSongs.value.map((song) => ({
        songMid: song.songMid,
        name: song.name,
        singers: song.singers.map((singer) => singer.name).filter(Boolean),
        albumName: song.album.name
      })),
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

function stopPolling(): void {
  if (pollTimer === null) return
  window.clearInterval(pollTimer)
  pollTimer = null
}

function startPolling(): void {
  if (pollTimer !== null) return
  pollTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible' && id.value) {
      void playlist.poll(id.value)
    }
  }, PLAYLIST_POLL_INTERVAL_MS)
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible') {
    if (id.value) void playlist.poll(id.value)
    startPolling()
  } else {
    stopPolling()
  }
}

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (document.visibilityState === 'visible') startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  playlist.stop(id.value)
})
</script>

<template>
  <div ref="pageRef" class="page">
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
          <h1>{{ meta.kind === 'favorites' ? '我喜欢' : displayName }}</h1>
          <div class="playlist-meta">
            <span>{{ meta.songCount }} 首歌曲</span>
            <span>歌单 ID {{ meta.id }}</span>
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
          <template v-if="filterText">筛选 {{ filteredSongs.length }} · </template>
          已下载 {{ downloadedCount }} / {{ songs.length }} 首
        </span>
      </div>

      <div v-if="songs.length > 0" class="table-filter">
        <span class="search-icon"><AppIcon name="search" :size="16" /></span>
        <input
          v-model="filterText"
          class="input"
          aria-label="筛选歌名、歌手或专辑"
          autocomplete="off"
          spellcheck="false"
        />
        <button v-if="filterText" class="btn ghost small" @click="filterText = ''">清除</button>
      </div>

      <SongListTable
        v-if="filteredSongs.length > 0"
        :songs="filteredSongs"
        :active-mid="player.current?.songMid"
        :availability="availability"
        :removable="removable"
        :can-add-to-playlist="auth.loggedIn"
        @play="startAt"
        @remove="removeAt"
        @added="onPickerAdded"
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

      <div
        v-if="feed && feed.songs.length > 0 && (feed.status === 'partial' || feed.status === 'error')"
        class="feed-footer"
      >
        <template v-if="feed.status === 'partial'">
          <span class="spinner" />
          正在加载
        </template>
        <template v-else>
          <span>加载中断</span>
          <button class="btn ghost small" @click="retry()">重试</button>
        </template>
      </div>
    </template>

    <PageJump
      :show-top="showJumpTop"
      :show-bottom="showJumpBottom"
      :show-current="showJumpCurrent"
      @top="scrollToTop"
      @current="scrollToCurrent"
      @bottom="scrollToBottom"
    />

    <ConfirmDialog
      :open="removeTarget !== null"
      title="从歌单删除"
      :message="`确定从歌单「${displayName}」删除「${removeTarget?.name ?? ''}」？`"
      confirm-label="删除"
      danger
      @confirm="confirmRemove()"
      @cancel="removeTarget = null"
    />
  </div>
</template>
