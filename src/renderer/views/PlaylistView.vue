<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { PlaylistDetail } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import SongTable from '../components/SongTable.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { usePlayerStore } from '../stores/player'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const toast = useToast()

const playlist = ref<PlaylistDetail | null>(null)
const loading = ref(false)
const error = ref('')

const songs = computed(() => (playlist.value?.songs ?? []).filter((song) => song.songMid.length > 0))
const meta = computed(() => playlist.value?.meta ?? null)

async function load(): Promise<void> {
  const id = String(route.params.id ?? '')
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    playlist.value = unwrap(await window.lychee.playlist.get(id))
  } catch (err) {
    error.value = describeError(err)
    toast.error(error.value)
  } finally {
    loading.value = false
  }
}

function playAt(index: number): void {
  player.playList(songs.value, index)
}

watch(() => route.params.id, load, { immediate: true })
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
      <div style="display: flex; gap: 8px">
        <button class="btn small" @click="load()">重试</button>
        <button class="btn ghost small" @click="router.push('/search')">返回搜索</button>
      </div>
    </div>

    <template v-else-if="playlist && meta">
      <section class="playlist-hero">
        <CoverArt :src="meta.coverUrl" image-class="playlist-cover" :icon-size="44" />
        <div class="playlist-info">
          <div class="eyebrow">Playlist</div>
          <h1>{{ meta.name }}</h1>
          <div class="playlist-meta">
            <span>{{ meta.songCount }} 首歌曲</span>
            <span>歌单 ID {{ meta.id }}</span>
            <span>{{ songs.length }} 首已载入</span>
          </div>
          <div class="playlist-actions">
            <button class="btn primary" :disabled="songs.length === 0" @click="player.playList(songs, 0)">
              <AppIcon name="play" :size="15" />
              播放全部
            </button>
            <button class="btn" @click="router.push('/search')">返回搜索</button>
          </div>
        </div>
      </section>

      <div class="section-title"><span>歌曲</span><span class="count">{{ songs.length }} 首</span></div>
      <SongTable
        v-if="songs.length > 0"
        :songs="songs"
        :active-mid="player.current?.songMid"
        @play="playAt"
      />
      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="music" :size="25" /></div>
        <h3>这个歌单还没有可播放的歌曲</h3>
        <p>可能是空歌单，或上游未返回歌曲数据。</p>
      </div>
    </template>
  </div>
</template>
