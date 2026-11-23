<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import CoverArt from './components/CoverArt.vue'
import DownloadDeleteDialog from './components/DownloadDeleteDialog.vue'
import LyricsOverlay from './components/LyricsOverlay.vue'
import MemberBadge from './components/MemberBadge.vue'
import MvButton from './components/MvButton.vue'
import PlayerBar from './components/PlayerBar.vue'
import ReauthDialog from './components/ReauthDialog.vue'
import ToastStack from './components/ToastStack.vue'
import { installBackNavigation, useBackDismiss } from './composables/back-navigation'
import { useAuthStore } from './stores/auth'
import { useDownloadStore } from './stores/download'
import { useHistoryStore } from './stores/history'
import { usePlayerStore } from './stores/player'
import { usePlaylistEditStore } from './stores/playlist-edit'
import { usePlaylistStore } from './stores/playlist'
import { useRecommendStore } from './stores/recommend'
import { useSettingsStore } from './stores/settings'
import { useUiStore } from './stores/ui'
import { useToast } from './composables/toast'
import { appTitle, dailyPlaylistName, singerNames, songCover } from './utils/format'
import { FAVORITES_PLAYLIST_ID } from '@shared/constants'
import { SHORTCUT_ACTIONS, matchesShortcut } from '@shared/shortcuts'
import type { ShortcutAction } from '@shared/types'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const playlistStore = usePlaylistStore()
const download = useDownloadStore()
const history = useHistoryStore()
const recommend = useRecommendStore()
const settings = useSettingsStore()
const ui = useUiStore()
const toast = useToast()

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
const showReauth = computed(
  () => Boolean(auth.reauthReason) && route.name !== 'login'
)
const currentPlaylistId = computed(() => player.queueSource?.id ?? '')
const viewedPlaylistId = computed(() =>
  route.name === 'playlist' ? String(route.params.id ?? '') : ''
)
const favoritesPath = `/playlist/${FAVORITES_PLAYLIST_ID}`

let offCommand: (() => void) | null = null
let offUpstreamBlocked: (() => void) | null = null
let offLoginStatus: (() => void) | null = null
let offBackNavigation: (() => void) | null = null

function onLogout(): void {
  // 只重置内存视图；各账号的最近歌单、播放历史与磁盘缓存保留，设置页可按账号清理。
  playlistStore.reset()
  recommend.reset()
  download.reset()
}

function quitApp(): void {
  window.lychee.system.quit()
}

async function toggleTheme(): Promise<void> {
  const theme = settings.settings.theme === 'light' ? 'dark' : 'light'
  try {
    await settings.update({ theme })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function onSidebarNavigate(): void {
  ui.closeLyrics()
  ui.closeSidebar()
}

function openReauthLogin(): void {
  auth.dismissReauth()
  void router.push('/login')
}

function recentPlaylistName(name: string): string {
  return dailyPlaylistName(name, auth.profile?.nickname ?? '')
}

function openSidebar(): void {
  ui.openSidebar()
  void playlistStore.validateRecent(true)
}

// 侧栏拖拽手势只在窄屏启用；宽屏仍通过侧栏按钮或空白点击进入。
const narrowQuery = window.matchMedia('(max-width: 900px)')
let dragStartX: number | null = null

// 后退优先关闭当前浮层；没有浮层时才沿路由历史返回。
useBackDismiss(() => ui.queueOpen, () => ui.closeQueue())
useBackDismiss(() => ui.sidebarOpen && narrowQuery.matches, () => ui.closeSidebar())

function hasSelectedText(): boolean {
  const selection = window.getSelection()
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim())
}

function onPointerDown(event: PointerEvent): void {
  // 歌词 / 评论打开期间横向手势归分页独占，避免同时唤起侧栏；左边缘 revealer 点击仍可用。
  if (ui.lyricsOpen || event.button !== 0 || !narrowQuery.matches) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, button, a, [role="button"], .range')) return
  if (event.clientX <= 10 || (ui.sidebarOpen && event.clientX < 300)) {
    dragStartX = event.clientX
    return
  }
  // 窄屏主界面向右拖动可拉出侧栏；向左拖动可收起。
  dragStartX = event.clientX
}

function onPointerUp(event: PointerEvent): void {
  if (ui.lyricsOpen) {
    dragStartX = null
    return
  }
  if (dragStartX === null) return
  const delta = event.clientX - dragStartX
  dragStartX = null
  // 触屏长按会形成文本选区，此时应保留选择而不是切换侧栏。
  if (event.pointerType === 'touch' && hasSelectedText()) return
  if (Math.abs(delta) > 60) {
    if (delta > 0 && !ui.sidebarOpen) openSidebar()
    else if (delta < 0 && ui.sidebarOpen) ui.closeSidebar()
  }
}

function onPointerCancel(): void {
  dragStartX = null
}

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  const tag = element.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    element.isContentEditable
  )
}

/** 空格在按钮 / 链接上保留原生激活行为，不被全局播放 / 暂停吞掉。 */
function spaceActivatesTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  return Boolean(
    element?.closest('button, a, [role="button"], input, textarea, select, [contenteditable="true"]')
  )
}

function shortcutFor(event: KeyboardEvent): ShortcutAction | null {
  const shortcuts = settings.settings.shortcuts
  if (!shortcuts) return null
  for (const action of SHORTCUT_ACTIONS) {
    if (matchesShortcut(event, shortcuts[action.id])) return action.id
  }
  return null
}

function runShortcut(action: ShortcutAction): void {
  if (action === 'togglePlay') {
    player.toggle()
    return
  }
  if (action === 'previous') {
    player.previous()
    return
  }
  if (action === 'next') {
    player.playNext()
    return
  }
  const song = player.current
  if (!song) return
  if (action === 'favorite') {
    void playlistEdit.toggleFavorite(song.songMid)
    return
  }
  if (!auth.loggedIn) {
    toast.error('请先登录')
    return
  }
  ui.openSongPicker([song.songMid], song.name)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (ui.lyricsOpen) {
      ui.closeLyrics()
      return
    }
    if (ui.sidebarOpen) {
      ui.closeSidebar()
      return
    }
    if (ui.songPicker) ui.closeSongPicker()
    return
  }
  if (event.defaultPrevented || event.isComposing || event.repeat) return
  if (isEditableTarget(event.target)) return
  // 弹窗打开时不响应全局快捷键，避免在确认 / 选择流程中误触播放。
  if (document.querySelector('.dialog-backdrop')) return
  const action = shortcutFor(event)
  if (!action) return
  if (action === 'togglePlay' && spaceActivatesTarget(event.target)) return
  event.preventDefault()
  runShortcut(action)
}

onMounted(() => {
  offBackNavigation = installBackNavigation(() => router.back())
  window.addEventListener('lychee:logout', onLogout)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  void (async () => {
    await Promise.allSettled([auth.refresh(), settings.load()])
    settings.applyTheme()
    player.applySettings()
    playlistStore.loadRecent()
    history.load()
    void playlistStore.validateRecent(true)
    if (player.current) {
      void playlistEdit.loadFavorites([player.current.songMid])
    }
  })()

  offCommand = window.lychee.player.onCommand((command) => player.handleCommand(command))
  offLoginStatus = window.lychee.login.onStatus((status) => auth.applyStatus(status))
  offUpstreamBlocked = window.lychee.upstream.onBlocked((event) => {
    const seconds = Math.max(1, Math.ceil((event.untilMs - Date.now()) / 1000))
    toast.error(`QQ 音乐风控：已暂停上游请求 ${seconds} 秒。${event.reason}`)
  })
})

onBeforeUnmount(() => {
  offBackNavigation?.()
  offCommand?.()
  offLoginStatus?.()
  offUpstreamBlocked?.()
  window.removeEventListener('lychee:logout', onLogout)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
})

watch(
  () => player.current?.songMid ?? null,
  (songMid) => {
    if (songMid) void playlistEdit.loadFavorites([songMid])
  }
)

// 窗口标题跟随当前歌曲；Electron 默认把 document.title 同步到窗口 / 任务栏。
watch(
  () => player.current,
  (current) => {
    document.title = appTitle(current)
  },
  { immediate: true }
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
    download.reset()
    playlistStore.loadRecent()
    void playlistStore.validateRecent(true)
    history.load()
  }
)

watch(
  () => ui.sidebarOpen,
  (open) => {
    if (open) void playlistStore.validateRecent(true)
  }
)

watch(
  () => route.fullPath,
  () => ui.closeLyrics()
)
</script>

<template>
  <div class="app-shell" :class="{ 'sidebar-is-open': ui.sidebarOpen }">
    <button
      class="sidebar-revealer"
      aria-label="打开导航"
      @click.stop="openSidebar()"
    />

    <div v-if="ui.sidebarOpen" class="sidebar-backdrop" @click="ui.closeSidebar()" />

    <aside class="sidebar" :class="{ open: ui.sidebarOpen }">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="music" :size="20" /></div>
        <div class="brand-text">
          <div class="brand-name">Lychee Player</div>
        </div>
      </div>

      <nav class="nav">
        <div class="nav-label">浏览</div>
        <RouterLink class="nav-item" active-class="active" to="/discover" @click="onSidebarNavigate">
          <AppIcon name="compass" :size="18" />
          <span class="nav-text">发现</span>
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/search" @click="onSidebarNavigate">
          <AppIcon name="search" :size="18" />
          <span class="nav-text">搜索</span>
        </RouterLink>
        <RouterLink
          v-if="auth.loggedIn"
          class="nav-item"
          active-class="active"
          :to="favoritesPath"
          @click="onSidebarNavigate"
        >
          <AppIcon name="heart" :size="18" />
          <span class="nav-text">我喜欢</span>
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
            :class="{
              active: item.id === viewedPlaylistId || item.id === currentPlaylistId,
              stale: item.stale
            }"
            :to="`/playlist/${item.id}`"
            @click="onSidebarNavigate"
          >
            <CoverArt :src="item.coverUrl" image-class="recent-cover" :icon-size="12" />
            <span class="nav-recent-name">{{ recentPlaylistName(item.name) }}</span>
            <span
              v-if="item.id === currentPlaylistId"
              class="nav-recent-playing"
              aria-label="正在播放"
            >
              <AppIcon name="volume" :size="13" />
            </span>
          </RouterLink>
        </div>
        <RouterLink
          class="nav-item"
          active-class="active"
          to="/history"
          @click="onSidebarNavigate"
        >
          <AppIcon name="history" :size="18" />
          <span class="nav-text">播放历史</span>
        </RouterLink>
        <div class="nav-label" style="margin-top: 14px">应用</div>
        <RouterLink class="nav-item" active-class="active" to="/downloads" @click="onSidebarNavigate">
          <AppIcon name="download" :size="18" />
          <span class="nav-text">下载</span>
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/settings" @click="onSidebarNavigate">
          <AppIcon name="settings" :size="18" />
          <span class="nav-text">设置</span>
        </RouterLink>
        <button
          class="nav-item"
          type="button"
          aria-label="退出 Lychee Player"
          @click="quitApp()"
        >
          <AppIcon name="power" :size="18" />
          <span class="nav-text">退出</span>
        </button>
        <button
          class="icon-btn sidebar-theme-toggle"
          type="button"
          aria-label="切换配色"
          @click="toggleTheme()"
        >
          <AppIcon
            :name="settings.settings.theme === 'light' ? 'sun' : 'moon'"
            :size="18"
          />
        </button>
      </nav>

      <div class="sidebar-foot">
        <RouterLink v-if="!auth.loggedIn" class="user-pill" to="/login" @click="onSidebarNavigate">
          <span class="user-avatar"><AppIcon name="user" :size="17" /></span>
          <span class="user-meta">
            <span class="user-name">登录 QQ 音乐</span>
          </span>
          <AppIcon name="chevron-right" :size="15" />
        </RouterLink>
        <RouterLink v-else class="user-pill" to="/settings" @click="onSidebarNavigate">
          <span class="user-avatar">
            <img v-if="auth.profile?.avatarUrl" :src="auth.profile.avatarUrl" alt="" />
            <template v-else>{{ avatarLetter }}</template>
          </span>
          <span class="user-meta">
            <span class="user-name-row">
              <span class="user-name">{{ auth.displayName }}</span>
              <MemberBadge :status="auth.vip" :size="14" />
            </span>
            <span class="user-state">{{ auth.musicid }}</span>
          </span>
          <AppIcon name="chevron-right" :size="15" />
        </RouterLink>
      </div>
    </aside>

    <main class="main">
      <RouterView />
    </main>

    <LyricsOverlay v-if="ui.lyricsOpen" />

    <PlayerBar />
    <DownloadDeleteDialog />
    <ReauthDialog
      :open="showReauth"
      :reason="auth.reauthReason"
      @login="openReauthLogin"
      @dismiss="auth.dismissReauth"
    />

    <aside class="lyrics-panel queue-panel" :class="{ open: ui.queueOpen }">
      <div class="lyrics-head">
        <div>
          <h2>播放队列</h2>
          <p>
            接下来 {{ player.queue.length }} 首
            <template v-if="player.queueBuilding"> · 正在补齐</template>
          </p>
        </div>
        <div class="lyrics-head-actions">
          <button
            class="icon-btn"
            aria-label="清空播放队列"
            :disabled="player.queue.length === 0"
            @click="player.clearQueue()"
          >
            <AppIcon name="trash" :size="17" />
          </button>
          <button class="icon-btn" aria-label="关闭播放队列" @click="ui.closeQueue()">
            <AppIcon name="close" :size="18" />
          </button>
        </div>
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
        <input
          v-model="queueFilter"
          class="input"
          aria-label="筛选队列中的歌曲"
          autocomplete="off"
          spellcheck="false"
        />
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
            <div class="song-title">
              <span class="queue-title">{{ song.name }}</span>
              <MvButton
                v-if="song.mvId"
                :mv-id="song.mvId"
                class="queue-mv"
                @click="ui.closeQueue()"
              />
            </div>
            <div class="song-artist">{{ singerNames(song) }}</div>
          </div>
          <button
            class="song-icon danger"
            aria-label="从队列移除"
            @click="player.removeFromQueue(queueIndex)"
          >
            <AppIcon name="close" :size="15" />
          </button>
        </div>
      </div>
    </aside>

    <ToastStack />
  </div>
</template>
