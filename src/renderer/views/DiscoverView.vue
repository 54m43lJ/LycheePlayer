<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { RecommendSection, Song } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import MarqueeText from '../components/MarqueeText.vue'
import { describeError } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useRecommendStore } from '../stores/recommend'
import { singerNames, songCover } from '../utils/format'

const auth = useAuthStore()
const recommend = useRecommendStore()
const player = usePlayerStore()
const router = useRouter()
const toast = useToast()
const refreshing = ref<RecommendSection['id'] | null>(null)

const sections = computed(() => recommend.feed?.sections ?? [])

async function load(force = false): Promise<void> {
  try {
    await recommend.load(force)
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function refreshSection(id: RecommendSection['id']): Promise<void> {
  if (refreshing.value) return
  refreshing.value = id
  try {
    await recommend.refreshSection(id)
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    refreshing.value = null
  }
}

function playSong(section: RecommendSection, song: Song): void {
  player.playList(section.songs, section.songs.findIndex((item) => item.songMid === song.songMid))
}

function addNext(song: Song): void {
  player.addNext(song)
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

    <div v-else-if="recommend.error" class="empty">
      <div class="empty-icon"><AppIcon name="compass" :size="25" /></div>
      <h3>推荐加载失败</h3>
      <p>{{ recommend.error }}</p>
      <button class="btn small" @click="load(true)">重试</button>
    </div>

    <template v-else>
      <section v-for="section in sections" :key="section.id" class="discover-section">
        <div class="section-title">
          <span>{{ section.title }}</span>
          <span class="discover-actions">
            <span class="count">{{ section.songs.length }} 首</span>
            <button
              class="icon-btn"
              :title="`刷新${section.title}`"
              :disabled="refreshing === section.id"
              @click="refreshSection(section.id)"
            >
              <span v-if="refreshing === section.id" class="spinner" />
              <AppIcon v-else name="refresh" :size="15" />
            </button>
          </span>
        </div>

        <div v-if="section.songs.length > 0" class="discover-strip">
          <article
            v-for="song in section.songs"
            :key="song.songMid"
            class="discover-item"
            role="button"
            tabindex="0"
            @click="playSong(section, song)"
            @keydown.enter="playSong(section, song)"
          >
            <CoverArt :src="songCover(song, 300)" image-class="discover-cover" :icon-size="22" />
            <div class="discover-text">
              <MarqueeText class="discover-name" :text="song.name" />
              <MarqueeText class="discover-singer" :text="singerNames(song)" />
            </div>
            <button
              class="icon-btn discover-next"
              title="下一首播放"
              @click.stop="addNext(song)"
            >
              <AppIcon name="play-next" :size="14" />
            </button>
          </article>
        </div>

        <div v-if="section.playlists.length > 0" class="discover-playlists">
          <button
            v-for="playlist in section.playlists"
            :key="playlist.id"
            class="card discover-playlist"
            @click="router.push(`/playlist/${playlist.id}`)"
          >
            <CoverArt :src="playlist.coverUrl" image-class="card-cover" :icon-size="26" />
            <div class="card-name">{{ playlist.name }}</div>
            <div class="card-sub">{{ playlist.songCount }} 首歌曲</div>
          </button>
        </div>

        <div v-if="section.songs.length === 0 && section.playlists.length === 0" class="empty compact">
          <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
          <h3>暂无内容</h3>
          <p>上游返回了空结果，可稍后刷新。</p>
        </div>
      </section>

      <div v-if="sections.length === 0" class="empty">
        <div class="empty-icon"><AppIcon name="compass" :size="25" /></div>
        <h3>暂无推荐内容</h3>
      </div>
    </template>
  </div>
</template>
