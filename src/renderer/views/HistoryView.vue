<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import PageJump from '../components/PageJump.vue'
import SongListTable from '../components/SongListTable.vue'
import { useCurrentSongJump } from '../composables/current-song-jump'
import { usePageJump } from '../composables/page-jump'
import { useHistoryStore } from '../stores/history'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { singerNames } from '../utils/format'
import { matchesSearchQuery } from '../utils/local-filter'

const history = useHistoryStore()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const pageRef = ref<HTMLElement | null>(null)
const { showTop, showBottom, scrollToTop, scrollToBottom } = usePageJump(pageRef)

const searchText = ref('')
const confirmClearOpen = ref(false)

const songs = computed(() => history.entries.map((entry) => entry.song))
const filteredSongs = computed(() => {
  if (!searchText.value.trim()) return songs.value
  return songs.value.filter((song) =>
    matchesSearchQuery([song.name, singerNames(song), song.album.name], searchText.value)
  )
})
const { showCurrent: showJumpCurrent, scrollToCurrent } = useCurrentSongJump(
  pageRef,
  filteredSongs
)

function startAt(index: number): void {
  const song = filteredSongs.value[index]
  if (!song) return
  player.playList(filteredSongs.value.slice(), index)
}

function playAll(): void {
  if (filteredSongs.value.length === 0) return
  player.playList(filteredSongs.value.slice(), 0)
}

function clearHistory(): void {
  confirmClearOpen.value = false
  history.clear()
  searchText.value = ''
}

onMounted(() => {
  history.load()
  void playlistEdit.loadFavorites(songs.value.map((song) => song.songMid))
})
</script>

<template>
  <div ref="pageRef" class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">History</div>
        <h1 class="page-title">播放历史</h1>
      </div>
      <div class="page-head-actions">
        <button
          class="btn primary"
          :disabled="filteredSongs.length === 0"
          @click="playAll()"
        >
          <AppIcon name="play" :size="15" />
          播放全部
        </button>
        <button
          class="btn ghost"
          :disabled="history.entries.length === 0"
          @click="confirmClearOpen = true"
        >
          <AppIcon name="trash" :size="15" />
          清空历史
        </button>
      </div>
    </div>

    <div v-if="history.entries.length > 0" class="table-filter">
      <span class="search-icon"><AppIcon name="search" :size="16" /></span>
      <input
        v-model="searchText"
        class="input"
        type="search"
        aria-label="搜索播放历史"
        autocomplete="off"
        spellcheck="false"
      />
      <button v-if="searchText" class="btn ghost small" @click="searchText = ''">清除</button>
    </div>

    <SongListTable
      v-if="filteredSongs.length > 0"
      :songs="filteredSongs"
      :active-mid="player.current?.songMid"
      @play="startAt"
    />
    <div v-else-if="searchText" class="empty compact">
      <div class="empty-icon"><AppIcon name="search" :size="22" /></div>
      <h3>没有匹配的播放历史</h3>
      <p>共 {{ history.entries.length }} 首，试试其他关键词。</p>
      <button class="btn ghost small" @click="searchText = ''">清除筛选</button>
    </div>
    <div v-else class="empty">
      <div class="empty-icon"><AppIcon name="history" :size="26" /></div>
      <h3>还没有播放历史</h3>
      <p>播放歌曲后会显示在这里。</p>
    </div>

    <PageJump
      :show-top="showTop"
      :show-bottom="showBottom"
      :show-current="showJumpCurrent"
      @top="scrollToTop"
      @current="scrollToCurrent"
      @bottom="scrollToBottom"
    />

    <ConfirmDialog
      :open="confirmClearOpen"
      title="清空播放历史"
      message="确定清空当前账号的播放历史？此操作不会删除本机下载或缓存。"
      confirm-label="清空"
      danger
      @confirm="clearHistory()"
      @cancel="confirmClearOpen = false"
    />
  </div>
</template>
