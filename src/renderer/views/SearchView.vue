<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { SearchRequest, SearchResult } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CardPlayButton from '../components/CardPlayButton.vue'
import CoverArt from '../components/CoverArt.vue'
import MarqueeText from '../components/MarqueeText.vue'
import SongListTable from '../components/SongListTable.vue'
import { describeError, unwrap } from '../api'
import { usePlaylistPlay } from '../composables/playlist-play'
import { useToast } from '../composables/toast'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { useDownloadStore } from '../stores/download'
import { SEARCH_PAGE_SIZE_DEFAULT, SEARCH_SINGER_PAGE_SIZE } from '@shared/constants'
import { useAuthStore } from '../stores/auth'
import { albumCover, formatCount, playlistSubtitle } from '../utils/format'
import { mergeSearchResult } from '../utils/search-results'

type SearchType = SearchRequest['type']

const router = useRouter()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const auth = useAuthStore()
const toast = useToast()
const { playingId, playPlaylist, isSourcePlaying, isSourcePaused, toggleSource } =
  usePlaylistPlay()

const TABS: Array<{ value: SearchType; label: string }> = [
  { value: 'song', label: '单曲' },
  { value: 'singer', label: '歌手' },
  { value: 'album', label: '专辑' },
  { value: 'playlist', label: '歌单' },
  { value: 'mv', label: 'MV' }
]

const keyword = ref('')
const activeTab = ref<SearchType>('song')
const result = ref<SearchResult | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const searched = ref(false)
const error = ref('')
const pageNo = ref(1)
// 歌手固定 24 条一页；其余类型固定 48 条一页，与宽 / 窄屏列数解耦。
const pageSize = computed(() =>
  activeTab.value === 'singer' ? SEARCH_SINGER_PAGE_SIZE : SEARCH_PAGE_SIZE_DEFAULT
)
const pageRef = ref<HTMLElement | null>(null)
let requestId = 0
let scrollRoot: HTMLElement | null = null

const songs = computed(() => result.value?.songs ?? [])
const singers = computed(() => result.value?.singers ?? [])
const albums = computed(() => result.value?.albums ?? [])
const playlists = computed(() => result.value?.playlists ?? [])
const mvs = computed(() => result.value?.mvs ?? [])
const total = computed(() => result.value?.total ?? 0)
const moreAvailable = ref(false)
const hasMore = computed(() => searched.value && moreAvailable.value)

function updateMore(data: SearchResult, page: number): void {
  if (typeof data.hasMore === 'boolean') {
    moreAvailable.value = data.hasMore
    return
  }
  const pages =
    data.total > 0 ? Math.max(1, Math.ceil(data.total / pageSize.value)) : page
  moreAvailable.value = page < pages
}

watch(songs, (list) => {
  if (list.length > 0) {
    void playlistEdit.loadFavorites(list.map((song) => song.songMid))
    void download.refreshAssets(list.map((song) => song.songMid))
  }
})



async function search(page = 1, append = false): Promise<void> {
  const term = keyword.value.trim()
  if (!term) return
  if (append && (loading.value || loadingMore.value || !hasMore.value)) return
  const currentRequest = ++requestId
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    result.value = null
    moreAvailable.value = false
    pageNo.value = 0
    error.value = ''
    scrollRoot?.scrollTo({ top: 0 })
  }
  try {
    const data = unwrap(
      await window.lychee.search.byType({
        type: activeTab.value,
        keyword: term,
        pageNo: page,
        pageSize: pageSize.value
      })
    )
    if (currentRequest !== requestId) return
    result.value = append && result.value ? mergeSearchResult(result.value, data) : data
    pageNo.value = page
    updateMore(data, page)
    searched.value = true
  } catch (err) {
    if (currentRequest !== requestId) return
    if (append) {
      toast.error(describeError(err))
    } else {
      error.value = describeError(err)
    }
  } finally {
    if (currentRequest === requestId) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

function loadMore(): void {
  void search(pageNo.value + 1, true)
}

function onScroll(): void {
  const el = scrollRoot
  if (!el || loading.value || loadingMore.value || !hasMore.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 160) loadMore()
}

onMounted(() => {
  scrollRoot = pageRef.value?.closest<HTMLElement>('.main') ?? null
  scrollRoot?.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  requestId += 1
  scrollRoot?.removeEventListener('scroll', onScroll)
  scrollRoot = null
})

function switchTab(tab: SearchType): void {
  if (activeTab.value === tab) return
  activeTab.value = tab
  if (keyword.value.trim()) void search(1)
}

function playSongAt(index: number): void {
  player.playList(songs.value, index)
}

function openArtist(mid: string): void {
  if (mid) void router.push(`/artist/${mid}`)
}

function openAlbum(mid: string): void {
  if (mid) void router.push(`/album/${mid}`)
}

function openPlaylist(id: string): void {
  void router.push(`/playlist/${id}`)
}
</script>

<template>
  <div ref="pageRef" class="page">
    <section class="search-hero">
      <div class="eyebrow">Explore</div>
      <h1>搜你想听的</h1>
      <form class="search-box" @submit.prevent="search(1)">
        <span class="search-icon"><AppIcon name="search" :size="19" /></span>
        <input
          v-model="keyword"
          type="search"
          aria-label="搜索歌曲、歌手、专辑、歌单或 MV"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn primary small" type="submit" :disabled="loading || !keyword.trim()">
          {{ loading ? '搜索中' : '搜索' }}
        </button>
      </form>
    </section>

    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        class="tab"
        :class="{ active: activeTab === tab.value }"
        @click="switchTab(tab.value)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="loading" class="loading-block">
      <span class="spinner lg" />
      正在搜索「{{ keyword }}」
    </div>

    <div v-else-if="error" class="empty compact">
      <div class="empty-icon"><AppIcon name="search" :size="22" /></div>
      <h3>搜索失败</h3>
      <p>{{ error }}</p>
      <button class="btn small" @click="search(pageNo)">重试</button>
    </div>

    <template v-else-if="searched">
      <div v-if="activeTab === 'song'">
        <div class="section-title">
          <span>单曲</span>
          <span class="count">{{ total > 0 ? `${formatCount(total)} 个结果` : `${songs.length} 个结果` }}</span>
        </div>
        <SongListTable
          v-if="songs.length > 0"
          :songs="songs"
          :active-mid="player.current?.songMid"
          :can-add-to-playlist="auth.loggedIn"
          @play="playSongAt"
        />
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="search" :size="25" /></div>
          <h3>没有找到单曲</h3>
        </div>
      </div>

      <div v-else-if="activeTab === 'singer'">
        <div class="section-title">
          <span>歌手</span>
          <span class="count">{{ total > 0 ? `${formatCount(total)} 位` : `${singers.length} 位` }}</span>
        </div>
        <div v-if="singers.length > 0" class="card-grid search-grid">
          <button
            v-for="singer in singers"
            :key="singer.mid"
            class="card"
            @click="openArtist(singer.mid)"
          >
            <div class="avatar-circle">
              <img
                v-if="singer.avatarUrl"
                :src="singer.avatarUrl"
                alt=""
                loading="lazy"
                @error="singer.avatarUrl = ''"
              />
              <template v-else>{{ singer.name.slice(0, 1) }}</template>
            </div>
            <div class="card-name">{{ singer.name }}</div>
          </button>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="user" :size="25" /></div>
          <h3>没有找到歌手</h3>
        </div>
      </div>

      <div v-else-if="activeTab === 'album'">
        <div class="section-title">
          <span>专辑</span>
          <span class="count">{{ total > 0 ? `${formatCount(total)} 张` : `${albums.length} 张` }}</span>
        </div>
        <div v-if="albums.length > 0" class="card-grid search-grid">
          <button v-for="album in albums" :key="album.mid" class="card" @click="openAlbum(album.mid)">
            <CoverArt :src="albumCover(album.mid)" image-class="card-cover" :icon-size="30" />
            <div class="card-name">{{ album.name }}</div>
          </button>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="music" :size="25" /></div>
          <h3>没有找到专辑</h3>
        </div>
      </div>

      <div v-else-if="activeTab === 'playlist'">
        <div class="section-title">
          <span>歌单</span>
          <span class="count">{{ total > 0 ? `${formatCount(total)} 个` : `${playlists.length} 个` }}</span>
        </div>
        <div v-if="playlists.length > 0" class="card-grid search-grid">
          <div
            v-for="playlist in playlists"
            :key="playlist.id"
            class="card"
            role="button"
            tabindex="0"
            @click="openPlaylist(playlist.id)"
            @keydown.enter="openPlaylist(playlist.id)"
          >
            <div class="card-cover-wrap">
              <CoverArt :src="playlist.coverUrl" image-class="card-cover" :icon-size="30" />
              <CardPlayButton
                :loading="playingId === playlist.id"
                :playing="isSourcePlaying('playlist', playlist.id)"
                :paused="isSourcePaused('playlist', playlist.id)"
                @play="toggleSource('playlist', playlist.id, () => playPlaylist(playlist))"
              />
            </div>
            <div class="card-name">{{ playlist.name }}</div>
            <div class="card-sub">{{ playlistSubtitle(playlist) }}</div>
          </div>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="list" :size="25" /></div>
          <h3>没有找到歌单</h3>
        </div>
      </div>

      <div v-else-if="activeTab === 'mv'">
        <div class="section-title">
          <span>MV</span>
          <span class="count">{{ total > 0 ? `${formatCount(total)} 个` : `${mvs.length} 个` }}</span>
        </div>
        <div v-if="mvs.length > 0" class="card-grid search-grid search-grid-mv">
          <div
            v-for="item in mvs"
            :key="item.mvId"
            class="card mv-card"
            role="button"
            tabindex="0"
            @click="router.push(`/mv/${item.mvId}`)"
            @keydown.enter="router.push(`/mv/${item.mvId}`)"
          >
            <CoverArt :src="item.coverUrl" image-class="card-cover mv-cover" :icon-size="30" />
            <MarqueeText class="card-name" :text="item.name" />
            <MarqueeText v-if="item.singers.length > 0" class="card-sub mv-singers">
              <template v-for="(singer, index) in item.singers" :key="`${singer.mid}-${index}`">
                <RouterLink
                  v-if="singer.mid"
                  class="inline-link"
                  :to="`/artist/${singer.mid}`"
                  @click.stop
                  @keydown.stop
                  >{{ singer.name }}</RouterLink
                >
                <span v-else>{{ singer.name }}</span>
                <span v-if="index < item.singers.length - 1" class="singer-sep"> / </span>
              </template>
            </MarqueeText>
            <div v-else class="card-sub">{{ item.singerName }}</div>
          </div>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="video" :size="25" /></div>
          <h3>没有找到 MV</h3>
        </div>
      </div>

      <div v-if="hasMore" class="search-more">
        <button class="btn ghost small" :disabled="loadingMore" @click="loadMore()">
          <span v-if="loadingMore" class="spinner" />
          <template v-else>加载更多</template>
        </button>
      </div>
    </template>

    <div v-else class="empty">
      <div class="empty-icon"><AppIcon name="search" :size="25" /></div>
      <h3>开始探索</h3>
    </div>
  </div>
</template>
