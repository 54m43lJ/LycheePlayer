<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import CoverArt from './components/CoverArt.vue'
import DownloadDrawer from './components/DownloadDrawer.vue'
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

const avatarLetter = computed(() => {
  const name = auth.profile?.nickname || auth.musicid || 'Q'
  return name.slice(0, 1).toUpperCase()
})

const queueFilter = ref('')
const filteredQueue = computed(() => {
  const keyword = queueFilter.value.trim().toLowerCase()
  const items = player.queue.map((song, index) => ({ song, index }))
  if (!keyword) return items
  return items.filter(({ song }) => {
    const haystack = [song.name, singerNames(song), song.album.name].join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})
const currentPlaylistId = computed(() => player.queueSource?.id ?? '')

let offCommand: (() => void) | null = null

function onLogout(): void {
  playlistStore.reset()
  playlistStore.clearRecent()
  recommend.reset()
}

function quitApp(): void {
  window.lychee.system.quit()
}

function onSidebarNavigate(): void {
  ui.closeSidebar()
}

function openSidebar(): void {
  ui.openSidebar()
  void playlistStore.validateRecent(true)
}

// 左边缘 / 主界面向右拖动显示侧栏，向左拖动隐藏。
let dragStartX: number | null = null

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, button, a, [role="button"], .range')) return
  if (event.clientX <= 10 || (ui.sidebarOpen && event.clientX < 300)) {
    dragStartX = event.clientX
    return
  }
  // 主界面向右拖动可拉出侧栏；向左拖动可收起。
  dragStartX = event.clientX
}

function onPointerUp(event: PointerEvent): void {
  if (dragStartX === null) return
  const delta = event.clientX - dragStartX
  if (Math.abs(delta) > 60) {
    if (delta > 0 && !ui.sidebarOpen) openSidebar()
    else if (delta < 0 && ui.sidebarOpen) ui.closeSidebar()
  }
  dragStartX = null
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && ui.sidebarOpen) ui.closeSidebar()
}

onMounted(() => {
  window.addEventListener('lychee:logout', onLogout)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  void (async () => {
    await Promise.allSettled([auth.refresh(), settings.load()])
    settings.applyTheme()
    player.applySettings()
    playlistStore.loadRecent()
    void playlistStore.validateRecent(true)
    if (player.current) {
      void playlistEdit.loadFavorites([player.current.songMid])
    }
  })()

  offCommand = window.lychee.player.onCommand((command) => player.handleCommand(command))
})

onBeforeUnmount(() => {
  offCommand?.()
  window.removeEventListener('lychee:logout', onLogout)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
})

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

watch(
  () => auth.musicid,
  () => {
    playlistStore.loadRecent()
    void playlistStore.validateRecent(true)
  }
)

watch(
  () => ui.sidebarOpen,
  (open) => {
    if (open) void playlistStore.validateRecent(true)
  }
)
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-is-open': ui.sidebarOpen }">
    <button
      class="sidebar-revealer"
      title="打开导航"
      aria-label="打开导航"
      @click.stop="openSidebar()"
    />

    <div v-if="ui.sidebarOpen" class="sidebar-backdrop" @click="ui.closeSidebar()" />

    <aside class="sidebar" :class="{ open: ui.sidebarOpen }">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="music" :size="20" /></div>
        <div class="brand-text">
          <div class="brand-name">Lychee Player</div>
          <div class="brand-sub">QQ Music · Linux</div>
        </div>
      </div>

      <nav class="nav">
        <div class="nav-label">浏览</div>
        <RouterLink class="nav-item" active-class="active" to="/search" @click="onSidebarNavigate">
          <AppIcon name="search" :size="18" />
          <span class="nav-text">搜索</span>
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/discover" @click="onSidebarNavigate">
          <AppIcon name="compass" :size="18" />
          <span class="nav-text">发现</span>
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/library" @click="onSidebarNavigate">
          <AppIcon name="library" :size="18" />
          <span class="nav-text">我的歌单</span>
        </RouterLink>
        <div v-if="playlistStore.recent.length > 0" class="nav-recent">
          <RouterLink
            v-for="item in playlistStore.recent"
            :key="item.id"
            class="nav-recent-item"
            :class="{ active: item.id === currentPlaylistId, stale: item.stale }"
            :to="`/playlist/${item.id}`"
            @click="onSidebarNavigate"
          >
            <CoverArt :src="item.coverUrl" image-class="recent-cover" :icon-size="12" />
            <span class="nav-recent-name">{{ item.name }}</span>
            <span v-if="item.id === currentPlaylistId" class="nav-recent-playing" title="正在播放">
              <AppIcon name="volume" :size="13" />
            </span>
          </RouterLink>
        </div>
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
        <RouterLink class="nav-item" active-class="active" to="/settings" @click="onSidebarNavigate">
          <AppIcon name="settings" :size="18" />
          <span class="nav-text">设置</span>
        </RouterLink>
        <button class="nav-item" type="button" title="退出 Lychee Player" @click="quitApp()">
          <AppIcon name="power" :size="18" />
          <span class="nav-text">退出</span>
        </button>
      </nav>

      <div class="sidebar-foot">
        <RouterLink v-if="!auth.loggedIn" class="user-pill" to="/login" @click="onSidebarNavigate">
          <span class="user-avatar"><AppIcon name="user" :size="17" /></span>
          <span class="user-meta">
            <span class="user-name">登录 QQ 音乐</span>
            <span class="user-state">扫码或粘贴 Cookie</span>
          </span>
          <AppIcon name="chevron-right" :size="15" />
        </RouterLink>
        <RouterLink v-else class="user-pill" to="/settings" @click="onSidebarNavigate">
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

      <div v-if="player.queue.length > 0" class="table-filter queue-filter">
        <span class="search-icon"><AppIcon name="search" :size="16" /></span>
        <input v-model="queueFilter" class="input" placeholder="筛选队列中的歌曲" />
        <button v-if="queueFilter" class="btn ghost small" @click="queueFilter = ''">清除</button>
      </div>

      <div v-if="player.queue.length === 0" class="lyrics-empty">
        <AppIcon name="list" :size="26" />
        <span>队列为空，当前歌曲之后的歌曲会显示在这里</span>
      </div>
      <div v-else-if="filteredQueue.length === 0" class="lyrics-empty">
        <AppIcon name="search" :size="26" />
        <span>没有匹配的队列歌曲</span>
      </div>
      <div v-else class="queue-list">
        <div
          v-for="{ song, index: queueIndex } in filteredQueue"
          :key="`${song.songMid}-${queueIndex}`"
          class="queue-row"
        >
          <span class="queue-index">{{ queueIndex + 1 }}</span>
          <CoverArt :src="songCover(song, 300)" image-class="cover-thumb" :icon-size="16" />
          <div class="song-text">
            <div class="song-title">{{ song.name }}</div>
            <div class="song-artist">{{ singerNames(song) }}</div>
          </div>
          <button
            class="song-icon danger"
            title="从队列移除"
            aria-label="从队列移除"
            @click="player.removeFromQueue(queueIndex)"
          >
            <AppIcon name="close" :size="15" />
          </button>
        </div>
        <div class="queue-footer">
          <button class="btn ghost small" @click="player.clearQueue()">清空队列</button>
        </div>
      </div>
    </aside>

    <DownloadDrawer />
    <ToastStack />
  </div>
</template>
