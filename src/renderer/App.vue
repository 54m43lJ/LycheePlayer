<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppIcon from './components/AppIcon.vue'
import LyricsPanel from './components/LyricsPanel.vue'
import PlayerBar from './components/PlayerBar.vue'
import ToastStack from './components/ToastStack.vue'
import { useAuthStore } from './stores/auth'
import { usePlayerStore } from './stores/player'
import { useSettingsStore } from './stores/settings'
import { useUiStore } from './stores/ui'

const auth = useAuthStore()
const player = usePlayerStore()
const settings = useSettingsStore()
const ui = useUiStore()
const route = useRoute()

const avatarLetter = computed(() => {
  const name = auth.profile?.nickname || auth.musicid || 'Q'
  return name.slice(0, 1).toUpperCase()
})

let offCommand: (() => void) | null = null

onMounted(() => {
  void (async () => {
    await Promise.allSettled([auth.refresh(), settings.load()])
    settings.applyTheme()
    player.applySettings()
  })()

  offCommand = window.lychee.player.onCommand((command) => player.handleCommand(command))
})

onBeforeUnmount(() => {
  offCommand?.()
})

watch(
  () => route.fullPath,
  () => ui.closeLyrics()
)
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark"><AppIcon name="music" :size="20" /></div>
        <div>
          <div class="brand-name">Lychee Player</div>
          <div class="brand-sub">QQ Music · Linux</div>
        </div>
      </div>

      <nav class="nav">
        <div class="nav-label">浏览</div>
        <RouterLink class="nav-item" active-class="active" to="/search">
          <AppIcon name="search" :size="18" />
          搜索
        </RouterLink>
        <RouterLink class="nav-item" active-class="active" to="/library">
          <AppIcon name="library" :size="18" />
          我的歌单
        </RouterLink>
        <div class="nav-label" style="margin-top: 14px">应用</div>
        <RouterLink class="nav-item" active-class="active" to="/settings">
          <AppIcon name="settings" :size="18" />
          设置
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
        <p class="sidebar-note">POC 验证版本<br />仅调用 QQ 音乐官方公开接口</p>
      </div>
    </aside>

    <main class="main">
      <RouterView />
    </main>

    <PlayerBar />
    <LyricsPanel />
    <ToastStack />
  </div>
</template>
