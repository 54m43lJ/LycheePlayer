<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { RecommendSection, Song } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CardPlayButton from '../components/CardPlayButton.vue'
import CoverArt from '../components/CoverArt.vue'
import DiscoverSkeleton from '../components/DiscoverSkeleton.vue'
import MarqueeText from '../components/MarqueeText.vue'
import { usePlaylistPlay } from '../composables/playlist-play'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'
import { useRecommendStore } from '../stores/recommend'
import { dailyPlaylistName, singerNames, songCover } from '../utils/format'

const auth = useAuthStore()
const recommend = useRecommendStore()
const player = usePlayerStore()
const router = useRouter()
const toast = useToast()
const { playingId, playPlaylist } = usePlaylistPlay()

const sections = computed(() => recommend.feed.sections)
const topSections = computed(() => {
  const order: RecommendSection['id'][] = ['guess', 'daily']
  return order
    .map((id) => sections.value.find((section) => section.id === id))
    .filter((section): section is RecommendSection => Boolean(section))
})
const listSections = computed(() => sections.value.filter((section) => !isCardSection(section)))
const nickname = computed(() => auth.profile?.nickname ?? '')
/** 跨日检查间隔：每分钟确认一次每日推荐是否已过期。 */
const DAILY_EXPIRY_CHECK_MS = 60_000
let dailyCheckTimer: ReturnType<typeof setInterval> | null = null

function sectionTitle(section: RecommendSection): string {
  return section.id === 'daily'
    ? dailyPlaylistName(section.title, nickname.value)
    : section.title
}

function playlistTitle(name: string): string {
  return dailyPlaylistName(name, nickname.value)
}

function isPlaceholder(section: RecommendSection): boolean {
  return section.refreshedAtMs === 0
}

function isCardSection(section: RecommendSection): boolean {
  return section.id === 'daily' || section.id === 'guess'
}

/** 有歌单入口的分区只保留伪歌单，不再重复渲染歌曲列表。 */
function showsSongStrip(section: RecommendSection): boolean {
  return !isCardSection(section) && section.playlists.length === 0 && section.songs.length > 0
}

async function load(): Promise<void> {
  await recommend.load()
}

async function refreshSection(id: RecommendSection['id']): Promise<void> {
  await recommend.refreshSection(id)
  const message = recommend.errors[id]
  if (message) toast.error(message)
}

function playSong(section: RecommendSection, song: Song): void {
  player.playList(section.songs, section.songs.findIndex((item) => item.songMid === song.songMid))
}

function startGuessRadio(section: RecommendSection): void {
  if (section.songs.length === 0) return
  player.startRadioQueue(section.songs)
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

onMounted(() => {
  dailyCheckTimer = setInterval(() => {
    void recommend.refreshDailyIfExpired()
  }, DAILY_EXPIRY_CHECK_MS)
})

onBeforeUnmount(() => {
  if (dailyCheckTimer !== null) {
    clearInterval(dailyCheckTimer)
    dailyCheckTimer = null
  }
  recommend.cancel()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Discover</div>
        <h1 class="page-title">发现</h1>
      </div>
    </div>

    <div v-if="!auth.loggedIn" class="empty">
      <div class="empty-icon"><AppIcon name="user" :size="26" /></div>
      <h3>登录后查看每日推荐</h3>
      <button class="btn primary" @click="router.push('/login')">去登录</button>
    </div>

    <template v-else>
      <div class="discover-top">
        <div v-for="section in topSections" :key="section.id" class="discover-top-item">
          <DiscoverSkeleton
            v-if="isPlaceholder(section) && !recommend.errors[section.id]"
            :songs="0"
            :playlists="1"
          />

          <div v-else-if="isPlaceholder(section)" class="empty compact">
            <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
            <h3>这个分区加载失败</h3>
            <p>{{ recommend.errors[section.id] }}</p>
            <button class="btn ghost small" @click="refreshSection(section.id)">重试</button>
          </div>

          <template v-else>
            <div
              v-if="section.id === 'daily' && section.playlists.length > 0"
              class="card discover-playlist"
              role="button"
              tabindex="0"
              @click="router.push(`/playlist/${section.playlists[0].id}`)"
              @keydown.enter="router.push(`/playlist/${section.playlists[0].id}`)"
            >
              <div class="card-cover-wrap">
                <CoverArt
                  :src="section.playlists[0].coverUrl"
                  image-class="card-cover"
                  :icon-size="26"
                />
                <CardPlayButton
                  :loading="playingId === section.playlists[0].id"
                  @play="playPlaylist(section.playlists[0])"
                />
              </div>
              <div class="card-name">{{ playlistTitle(section.playlists[0].name) }}</div>
              <div class="card-sub">{{ section.playlists[0].songCount }} 首歌曲</div>
            </div>

            <div
              v-else-if="section.id === 'guess' && section.songs.length > 0"
              class="card discover-playlist"
              role="button"
              tabindex="0"
              title="开始播放猜你喜欢连续推荐"
              @click="startGuessRadio(section)"
              @keydown.enter="startGuessRadio(section)"
            >
              <div class="card-cover-wrap">
                <CoverArt
                  :src="songCover(section.songs[0], 300)"
                  image-class="card-cover"
                  :icon-size="26"
                />
                <CardPlayButton
                  label="开始播放猜你喜欢"
                  @play="startGuessRadio(section)"
                />
              </div>
              <div class="card-name">{{ sectionTitle(section) }}</div>
            </div>

            <div v-else class="empty compact">
              <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
              <h3>暂无内容</h3>
              <p>上游返回了空结果，可稍后刷新。</p>
            </div>
          </template>
        </div>
      </div>

      <section v-for="section in listSections" :key="section.id" class="discover-section">
        <div class="section-title">
          <span>{{ sectionTitle(section) }}</span>
          <span class="discover-actions">
            <span v-if="!isPlaceholder(section)" class="count">
              {{ section.songs.length }} 首
            </span>
            <button
              class="icon-btn"
              :title="`刷新${sectionTitle(section)}`"
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
          :songs="30"
          :playlists="0"
        />

        <div v-else-if="isPlaceholder(section)" class="empty compact">
          <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
          <h3>这个分区加载失败</h3>
          <p>{{ recommend.errors[section.id] }}</p>
          <button class="btn ghost small" @click="refreshSection(section.id)">重试</button>
        </div>

        <template v-else>
          <div v-if="showsSongStrip(section)" class="discover-strip">
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

          <div v-if="section.songs.length === 0" class="empty compact">
            <div class="empty-icon"><AppIcon name="compass" :size="22" /></div>
            <h3>暂无内容</h3>
            <p>上游返回了空结果，可稍后刷新。</p>
          </div>
        </template>
      </section>
    </template>
  </div>
</template>
