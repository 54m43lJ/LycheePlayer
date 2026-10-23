<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Song } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import SongTable from '../components/SongTable.vue'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useRecommendStore } from '../stores/recommend'
import { playlistSubtitle } from '../utils/format'

const auth = useAuthStore()
const recommend = useRecommendStore()
const player = usePlayerStore()
const router = useRouter()
const toast = useToast()

const sections = computed(() => recommend.feed?.sections ?? [])

async function load(force = false): Promise<void> {
  try {
    await recommend.load(force)
  } catch (err) {
    toast.error(describeError(err))
  }
}

function playAll(sectionSongs: Song[]): void {
  if (sectionSongs.length > 0) player.playList(sectionSongs, 0)
}

function playAt(sectionSongs: Song[], index: number): void {
  player.playList(sectionSongs, index)
}

function addNextAt(sectionSongs: Song[], index: number): void {
  const song = sectionSongs[index]
  if (song) player.addNext(song)
}

onMounted(() => void load())
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Discover</div>
        <h1 class="page-title">发现</h1>
      </div>
      <button class="btn small" :disabled="recommend.loading" @click="load(true)">
        <AppIcon name="refresh" :size="14" />
        换一批
      </button>
    </div>

    <div v-if="!auth.loggedIn" class="empty">
      <div class="empty-icon"><AppIcon name="user" :size="26" /></div>
      <h3>登录后查看每日推荐</h3>
      <button class="btn primary" @click="router.push('/login')">去登录</button>
    </div>

    <div v-else-if="recommend.loading && !recommend.feed" class="loading-block">
      <span class="spinner lg" />正在加载推荐
    </div>

    <template v-else>
      <section v-for="section in sections" :key="section.id" class="discover-section">
        <div class="section-title">
          <span>{{ section.title }}</span>
          <span class="count">{{ section.songs.length }} 首<template v-if="section.playlists.length"> · {{ section.playlists.length }} 个歌单</template></span>
        </div>

        <div v-if="section.songs.length > 0" class="discover-songs">
          <SongTable
            :songs="section.songs.slice(0, 5)"
            :active-mid="player.current?.songMid"
            :show-album="false"
            @play="(index) => playAt(section.songs, index)"
            @play-next="(index) => addNextAt(section.songs, index)"
            @toggle="player.toggle()"
            @favorite="() => undefined"
            @download="() => undefined"
          />
          <button class="btn ghost small" @click="playAll(section.songs)">
            <AppIcon name="play" :size="14" />
            播放全部
          </button>
        </div>

        <div v-if="section.playlists.length > 0" class="card-grid">
          <button
            v-for="playlist in section.playlists"
            :key="playlist.id"
            class="card"
            @click="router.push(`/playlist/${playlist.id}`)"
          >
            <CoverArt :src="playlist.coverUrl" image-class="card-cover" :icon-size="30" />
            <div class="card-name">{{ playlist.name }}</div>
            <div class="card-sub">{{ playlistSubtitle(playlist) }}</div>
          </button>
        </div>

        <div v-if="section.songs.length === 0 && section.playlists.length === 0" class="empty compact">
          <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
          <h3>推荐接口待探测</h3>
          <p>该分区暂无数据，接口验证后会自动显示内容。</p>
        </div>
      </section>

      <div v-if="sections.length === 0" class="empty">
        <div class="empty-icon"><AppIcon name="compass" :size="25" /></div>
        <h3>暂无推荐内容</h3>
        <p v-if="recommend.feed">推荐接口待探测，验证后会显示每日推荐、专属雷达与猜你喜欢。</p>
      </div>
    </template>
  </div>
</template>
