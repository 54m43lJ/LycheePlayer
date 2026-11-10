<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { RecommendSection, Song } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import DiscoverSkeleton from '../components/DiscoverSkeleton.vue'
import MarqueeText from '../components/MarqueeText.vue'
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

const sections = computed(() => recommend.feed.sections)

function isPlaceholder(section: RecommendSection): boolean {
  return section.refreshedAtMs === 0
}

async function load(force = false): Promise<void> {
  await recommend.load(force)
}

async function refreshSection(id: RecommendSection['id']): Promise<void> {
  await recommend.refreshSection(id)
  const message = recommend.errors[id]
  if (message) toast.error(message)
}

function playSong(section: RecommendSection, song: Song): void {
  player.playList(section.songs, section.songs.findIndex((item) => item.songMid === song.songMid))
}

function addNext(song: Song): void {
  player.addNext(song)
}

watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (loggedIn) void load()
  },
  { immediate: true }
)

onBeforeUnmount(() => recommend.cancel())
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

    <template v-else>
      <section v-for="section in sections" :key="section.id" class="discover-section">
        <div class="section-title">
          <span>{{ section.title }}</span>
          <span class="discover-actions">
            <span v-if="!isPlaceholder(section)" class="count">{{ section.songs.length }} 首</span>
            <button
              class="icon-btn"
              :title="`刷新${section.title}`"
              :disabled="recommend.loading || recommend.loadingIds[section.id]"
              @click="refreshSection(section.id)"
            >
              <span v-if="recommend.loadingIds[section.id]" class="spinner" />
              <AppIcon v-else name="refresh" :size="15" />
            </button>
          </span>
        </div>

        <DiscoverSkeleton
          v-if="isPlaceholder(section) && !recommend.errors[section.id]"
        />

        <div v-else-if="isPlaceholder(section)" class="empty compact">
          <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
          <h3>这个分区加载失败</h3>
          <p>{{ recommend.errors[section.id] }}</p>
          <button class="btn ghost small" @click="refreshSection(section.id)">重试</button>
        </div>

        <template v-else>
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

          <div
            v-if="section.songs.length === 0 && section.playlists.length === 0"
            class="empty compact"
          >
            <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
            <h3>暂无内容</h3>
            <p>上游返回了空结果，可稍后刷新。</p>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>
