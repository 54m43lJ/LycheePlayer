<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import CoverArt from './components/CoverArt.vue'
import DownloadDrawer from './components/DownloadDrawer.vue'
import LyricsPanel from './components/LyricsPanel.vue'
import PlayerBar from './components/PlayerBar.vue'
import ToastStack from './components/ToastStack.vue'
import { useAuthStore } from './stores/auth'
import { usePlayerStore } from './stores/player'
import { usePlaylistEditStore } from './stores/playlist-edit'
import { usePlaylistStore } from './stores/playlist'
import { useRecommendStore } from './stores/recommend'
import { useSettingsStore } from './stores/settings'
import { useUiStore } from './stores/ui'
import { singerNames, songCover } from './utils/format'

const auth = useAuthStore()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const playlistStore = usePlaylistStore()
const recommend = useRecommendStore()
const settings = useSettingsStore()
const ui = useUiStore()
const route = useRoute()

const avatarLetter = computed(() => {
  const name = auth.profile?.nickname || auth.musicid || 'Q'
  return name.slice(0, 1).toUpperCase()
})

let offCommand: (() => void) | null = null

function onLogout(): void {
  playlistStore.reset()
  recommend.reset()
}

onMounted(() => {
  window.addEventListener('lychee:logout', onLogout)
  void (async () => {
    await Promise.allSettled([auth.refresh(), settings.load()])
    settings.applyTheme()
    player.applySettings()
    if (player.current) {
      void playlistEdit.loadFavorites([player.current.songMid])
    }
  })()

  offCommand = window.lychee.player.onCommand((command) => player.handleCommand(command))
})

onBeforeUnmount(() => {
  offCommand?.()
  window.removeEventListener('lychee:logout', onLogout)
})

watch(
  () => route.fullPath,
  () => ui.closeLyrics()
)

watch(
  () => player.current?.songMid ?? null,
  (songMid) => {
    if (songMid) void playlistEdit.loadFavorites([songMid])
  }
)

watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (!loggedIn) playlistEdit.favorites = new Set()
  }
)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="music" :size="20" /></div>
        <div class="brand-text">
          <div class="brand-name">Lychee Player</div>
          <div class="brand-sub">QQ Music · Linux</div>
        </div>
      </div>

      <nav class="nav">
        <div class="nav-label">浏览</div>
        <RouterLink class="nav-item" active-class="active" to="/search">
          <AppIcon name="search" :size="18" />
          <span class="nav-text">搜索</span>
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/discover">
          <AppIcon name="compass" :size="18" />
          <span class="nav-text">发现</span>
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/library">
          <AppIcon name="library" :size="18" />
          <span class="nav-text">我的歌单</span>
        </RouterLink>
        <div class="nav-label" style="margin-top: 14px">应用</div>
        <button
          class="nav-item"
          :class="{ active: ui.downloadOpen }"
          type="button"
          @click="ui.toggleDownload()"
        >
          <AppIcon name="download" :size="18" />
          <span class="nav-text">下载</span>
        </button>
        <RouterLink class="nav-item" active-class="active" to="/settings">
          <AppIcon name="settings" :size="18" />
          <span class="nav-text">设置</span>
        </RouterLink>
      </nav>

      <div class="sidebar-foot">
        <RouterLink v-if="!auth.loggedIn" class="user-pill" to="/login">
          <span class="user-avatar"><AppIcon name="user" :size="17" /></span>
          <span class="user-meta">
            <span class="user-name">登录 QQ 音乐</span>
            <span class="user-state">扫码或粘贴 Cookie</span>
          </span>
          <AppIcon name="chevron-right" :size="15" />
        </RouterLink>
        <RouterLink v-else class="user-pill" to="/settings">
          <span class="user-avatar">
            <img v-if="auth.profile?.avatarUrl" :src="auth.profile.avatarUrl" alt="" />
            <template v-else>{{ avatarLetter }}</template>
          </span>
          <span class="user-meta">
            <span class="user-name">{{ auth.displayName }}</span>
            <span class="user-state">已登录 · {{ auth.musicid }}</span>
          </span>
          <AppIcon name="chevron-right" :size="15" />
        </RouterLink>
      </div>
    </aside>

    <main class="main">
      <RouterView />
    </main>

    <PlayerBar />
    <LyricsPanel />

    <aside class="lyrics-panel queue-panel" :class="{ open: ui.queueOpen }">
      <div class="lyrics-head">
        <div>
          <h2>播放队列</h2>
          <p>
            接下来 {{ player.queue.length }} 首
            <template v-if="player.queueBuilding"> · 正在补齐</template>
          </p>
        </div>
        <button class="icon-btn" title="关闭播放队列" @click="ui.closeQueue()">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <div class="queue-now">
        <div class="queue-now-label">正在播放</div>
        <div v-if="player.current" class="queue-now-song">
          <CoverArt :src="songCover(player.current, 300)" image-class="cover-thumb" :icon-size="16" />
          <div class="song-text">
            <div class="song-title">{{ player.current.name }}</div>
            <div class="song-artist">{{ singerNames(player.current) }}</div>
          </div>
        </div>
        <div v-else class="queue-empty-inline">暂无歌曲</div>
      </div>

      <div v-if="player.queue.length === 0" class="lyrics-empty">
        <AppIcon name="list" :size="26" />
        <span>队列为空，当前歌曲之后的歌曲会显示在这里</span>
      </div>
      <div v-else class="queue-list">
        <div
          v-for="(song, queueIndex) in player.queue"
          :key="`${song.songMid}-${queueIndex}`"
          class="queue-row"
        >
          <span class="queue-index">{{ queueIndex + 1 }}</span>
          <CoverArt :src="songCover(song, 300)" image-class="cover-thumb" :icon-size="16" />
          <div class="song-text">
            <div class="song-title">{{ song.name }}</div>
            <div class="song-artist">{{ singerNames(song) }}</div>
          </div>
          <div class="queue-album" :title="song.album.name">{{ song.album.name || '—' }}</div>
          <button class="song-next" @click="player.removeFromQueue(queueIndex)">移除</button>
        </div>
        <div class="queue-footer">
          <button class="song-next" @click="player.clearQueue()">清空队列</button>
        </div>
      </div>
    </aside>

    <DownloadDrawer />
    <ToastStack />
  </div>
</template>
