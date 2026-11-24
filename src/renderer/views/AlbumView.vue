<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { AlbumDetail } from '@shared/types'
import { SCROLL_LOAD_THRESHOLD } from '@shared/constants'
import AppIcon from '../components/AppIcon.vue'
import CatalogDescription from '../components/CatalogDescription.vue'
import CoverArt from '../components/CoverArt.vue'
import PageJump from '../components/PageJump.vue'
import SongListTable from '../components/SongListTable.vue'
import { describeError, unwrap } from '../api'
import { goBack } from '../composables/back-navigation'
import { usePageJump } from '../composables/page-jump'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'

const route = useRoute()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const auth = useAuthStore()
const toast = useToast()

const pageRef = ref<HTMLElement | null>(null)
const { showTop, showBottom, scrollToTop, scrollToBottom } = usePageJump(pageRef)
const detail = ref<AlbumDetail | null>(null)
const loading = ref(false)
const error = ref('')
const loadingMore = ref(false)
let token = 0
let scrollRoot: HTMLElement | null = null
const mid = computed(() => String(route.params.mid ?? ''))
const songs = computed(() => detail.value?.songs ?? [])

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

function playAll(): void {
  if (songs.value.length > 0) player.playList(songs.value, 0)
}

function playAt(index: number): void {
  player.playList(songs.value, index)
}

function maybeLoadMore(): void {
  if (loading.value || loadingMore.value || !detail.value?.hasMore) return
  const el = scrollRoot
  if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_LOAD_THRESHOLD) {
    void load(false)
  }
}

onMounted(() => {
  scrollRoot = pageRef.value?.closest<HTMLElement>('.main') ?? null
  scrollRoot?.addEventListener('scroll', maybeLoadMore, { passive: true })
})

onBeforeUnmount(() => {
  scrollRoot?.removeEventListener('scroll', maybeLoadMore)
  scrollRoot = null
})

watch(mid, () => void load(), { immediate: true })
</script>

<template>
  <div ref="pageRef" class="page">
    <div class="page-head">
      <button class="btn ghost small" @click="goBack()">
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
            <button class="btn ghost" @click="goBack()">返回</button>
          </div>
        </div>
      </section>

      <CatalogDescription v-if="detail.description" :text="detail.description" />

      <div class="section-title">
        <span>歌曲</span>
        <span class="count">{{ songs.length }} / {{ detail.total }} 首</span>
      </div>

      <SongListTable
        v-if="songs.length > 0"
        :songs="songs"
        :active-mid="player.current?.songMid"
        :can-add-to-playlist="auth.loggedIn"
        @play="playAt"
      />
      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="music" :size="25" /></div>
        <h3>暂无歌曲</h3>
      </div>

      <div v-if="detail.hasMore" class="feed-footer">
        <template v-if="loadingMore">
          <span class="spinner" />
          <span>正在加载更多</span>
        </template>
        <span v-else>继续向下滚动加载更多</span>
      </div>
      <div v-else-if="songs.length > 0" class="feed-footer">已经到底了</div>

      <PageJump
        :show-top="showTop"
        :show-bottom="showBottom"
        @top="scrollToTop"
        @bottom="scrollToBottom"
      />
    </template>
  </div>
</template>
