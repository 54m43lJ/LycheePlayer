<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { SearchRequest, SearchResult } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import SongTable from '../components/SongTable.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { useDownloadStore } from '../stores/download'
import { SEARCH_PAGE_SIZE_DEFAULT } from '@shared/constants'
import { useUiStore } from '../stores/ui'
import { albumCover, formatCount, playlistSubtitle } from '../utils/format'

type SearchType = SearchRequest['type']

const router = useRouter()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const ui = useUiStore()
const toast = useToast()

const TABS: Array<{ value: SearchType; label: string }> = [
  { value: 'song', label: '单曲' },
  { value: 'singer', label: '歌手' },
  { value: 'album', label: '专辑' },
  { value: 'playlist', label: '歌单' }
]

const HOT_KEYWORDS = ['周杰伦', '林俊杰', '陈奕迅', '邓紫棋', '五月天', '告五人', 'Taylor Swift']

const keyword = ref('')
const activeTab = ref<SearchType>('song')
const result = ref<SearchResult | null>(null)
const loading = ref(false)
const searched = ref(false)
const error = ref('')
const pageNo = ref(1)
const pageSize = SEARCH_PAGE_SIZE_DEFAULT
let requestId = 0

const songs = computed(() => result.value?.songs ?? [])
const singers = computed(() => result.value?.singers ?? [])
const albums = computed(() => result.value?.albums ?? [])
const playlists = computed(() => result.value?.playlists ?? [])
const mvs = computed(() => result.value?.mvs ?? [])
const total = computed(() => result.value?.total ?? 0)
const favoriteMids = computed(() => [...playlistEdit.favorites])
const totalPages = computed(() => {
  if (total.value > 0) return Math.max(1, Math.ceil(total.value / pageSize))
  return searched.value ? pageNo.value : 1
})
const activeLabel = computed(() => TABS.find((tab) => tab.value === activeTab.value)?.label ?? '')

watch(songs, (list) => {
  if (list.length > 0) {
    void playlistEdit.loadFavorites(list.map((song) => song.songMid))
  }
})

async function search(page = 1): Promise<void> {
  const term = keyword.value.trim()
  if (!term) return
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  try {
    const data = unwrap(
      await window.lychee.search.byType({
        type: activeTab.value,
        keyword: term,
        pageNo: page,
        pageSize
      })
    )
    if (currentRequest !== requestId) return
    result.value = data
    pageNo.value = page
    searched.value = true
    if (activeTab.value === 'song') {
      void (async () => {
        try {
          const mvResult = unwrap(await window.lychee.mv.search(term, page))
          if (currentRequest !== requestId || !result.value) return
          result.value = { ...result.value, mvs: mvResult.mvs ?? [] }
        } catch {
          // MV 搜索待探测；失败不影响歌曲结果。
        }
      })()
    }
  } catch (err) {
    if (currentRequest === requestId) {
      error.value = describeError(err)
      toast.error(error.value)
    }
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

function switchTab(tab: SearchType): void {
  if (activeTab.value === tab) return
  activeTab.value = tab
  if (keyword.value.trim()) void search(1)
}

function useKeyword(term: string): void {
  keyword.value = term
  activeTab.value = 'song'
  void search(1)
}

function playSongAt(index: number): void {
  player.playList(songs.value, index)
}

function playNextAt(index: number): void {
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

function searchBySinger(name: string): void {
  useKeyword(name)
}

function searchByAlbum(name: string): void {
  useKeyword(name)
}

function openPlaylist(id: string): void {
  void router.push(`/playlist/${id}`)
}

function changePage(delta: number): void {
  const next = pageNo.value + delta
  if (next < 1 || next > totalPages.value) return
  void search(next)
}
</script>

<template>
  <div class="page">
    <section class="search-hero">
      <div class="eyebrow">Explore</div>
      <h1>搜你想听的</h1>
      <form class="search-box" @submit.prevent="search(1)">
        <span class="search-icon"><AppIcon name="search" :size="19" /></span>
        <input
          v-model="keyword"
          type="search"
          placeholder="搜索歌曲、歌手、专辑或歌单"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn primary small" type="submit" :disabled="loading || !keyword.trim()">
          {{ loading ? '搜索中' : '搜索' }}
        </button>
      </form>
      <div class="chips">
        <button v-for="hot in HOT_KEYWORDS" :key="hot" class="chip" @click="useKeyword(hot)">
          {{ hot }}
        </button>
      </div>
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
        <SongTable
          v-if="songs.length > 0"
          :songs="songs"
          :active-mid="player.current?.songMid"
          :favorite-mids="favoriteMids"
          @play="playSongAt"
          @play-next="playNextAt"
          @toggle="player.toggle()"
          @favorite="toggleFavorite"
          @download="downloadAt"
        />
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="search" :size="25" /></div>
          <h3>没有找到单曲</h3>
        </div>

        <template v-if="mvs.length > 0">
          <div class="section-title"><span>MV</span><span class="count">{{ mvs.length }} 个</span></div>
          <div class="card-grid">
            <button
              v-for="item in mvs"
              :key="item.mvId"
              class="card"
              @click="router.push(`/mv/${item.mvId}`)"
            >
              <CoverArt :src="item.coverUrl" image-class="card-cover" :icon-size="30" />
              <div class="card-name">{{ item.name }}</div>
              <div class="card-sub">{{ item.singerName }}</div>
            </button>
          </div>
        </template>
      </div>

      <div v-else-if="activeTab === 'singer'">
        <div class="section-title"><span>歌手</span><span class="count">{{ singers.length }} 位</span></div>
        <div v-if="singers.length > 0" class="card-grid">
          <button
            v-for="singer in singers"
            :key="singer.mid"
            class="card"
            @click="searchBySinger(singer.name)"
          >
            <div class="avatar-circle">{{ singer.name.slice(0, 1) }}</div>
            <div class="card-name">{{ singer.name }}</div>
            <div class="card-sub">点击搜索 TA 的单曲</div>
          </button>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="user" :size="25" /></div>
          <h3>没有找到歌手</h3>
        </div>
      </div>

      <div v-else-if="activeTab === 'album'">
        <div class="section-title"><span>专辑</span><span class="count">{{ albums.length }} 张</span></div>
        <div v-if="albums.length > 0" class="card-grid">
          <button v-for="album in albums" :key="album.mid" class="card" @click="searchByAlbum(album.name)">
            <CoverArt :src="albumCover(album.mid)" image-class="card-cover" :icon-size="30" />
            <div class="card-name">{{ album.name }}</div>
            <div class="card-sub">点击搜索专辑单曲</div>
          </button>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="music" :size="25" /></div>
          <h3>没有找到专辑</h3>
        </div>
      </div>

      <div v-else>
        <div class="section-title"><span>歌单</span><span class="count">{{ playlists.length }} 个</span></div>
        <div v-if="playlists.length > 0" class="card-grid">
          <button
            v-for="playlist in playlists"
            :key="playlist.id"
            class="card"
            @click="openPlaylist(playlist.id)"
          >
            <CoverArt :src="playlist.coverUrl" image-class="card-cover" :icon-size="30" />
            <div class="card-name">{{ playlist.name }}</div>
            <div class="card-sub">{{ playlistSubtitle(playlist) }}</div>
          </button>
        </div>
        <div v-else class="empty">
          <div class="empty-icon"><AppIcon name="list" :size="25" /></div>
          <h3>没有找到歌单</h3>
        </div>
      </div>

      <div v-if="totalPages > 1" class="pager">
        <button class="icon-btn" :disabled="pageNo <= 1" @click="changePage(-1)">
          <AppIcon name="chevron-left" :size="17" />
        </button>
        <span>{{ activeLabel }} · 第 {{ pageNo }} / {{ totalPages }} 页</span>
        <button class="icon-btn" :disabled="pageNo >= totalPages" @click="changePage(1)">
          <AppIcon name="chevron-right" :size="17" />
        </button>
      </div>
    </template>

    <div v-else class="empty">
      <div class="empty-icon"><AppIcon name="search" :size="25" /></div>
      <h3>开始探索</h3>
    </div>
  </div>
</template>
