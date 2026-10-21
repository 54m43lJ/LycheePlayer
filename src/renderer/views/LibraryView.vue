<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { PlaylistMeta } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { playlistSubtitle } from '../utils/format'

const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const playlists = ref<PlaylistMeta[]>([])
const loading = ref(false)
const error = ref('')

async function load(): Promise<void> {
  if (!auth.loggedIn) return
  loading.value = true
  error.value = ''
  try {
    playlists.value = unwrap(await window.lychee.playlist.listMine())
  } catch (err) {
    error.value = describeError(err)
  } finally {
    loading.value = false
  }
}

async function refreshAll(): Promise<void> {
  await auth.refresh()
  await load()
}

async function logout(): Promise<void> {
  try {
    await auth.logout()
    playlists.value = []
    toast.show('已退出登录')
  } catch (err) {
    toast.error(describeError(err))
  }
}

watch(
  () => auth.loggedIn,
  (loggedIn) => {
    if (loggedIn) void load()
    else playlists.value = []
  },
  { immediate: true }
)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Library</div>
        <h1 class="page-title">我的歌单</h1>
      </div>
      <button class="btn small" :disabled="loading || !auth.loggedIn" @click="refreshAll()">
        <AppIcon name="refresh" :size="14" />
        刷新
      </button>
    </div>

    <div v-if="!auth.ready" class="loading-block"><span class="spinner" />正在读取登录态</div>

    <div v-else-if="!auth.loggedIn" class="empty">
      <div class="empty-icon"><AppIcon name="user" :size="26" /></div>
      <h3>登录后查看你的歌单</h3>
      <button class="btn primary" @click="router.push('/login')">
        <AppIcon name="login" :size="15" />
        去登录
      </button>
    </div>

    <template v-else>
      <section class="profile-band">
        <span class="user-avatar">
          <img v-if="auth.profile?.avatarUrl" :src="auth.profile.avatarUrl" alt="" />
          <template v-else>{{ auth.displayName.slice(0, 1).toUpperCase() }}</template>
        </span>
        <div>
          <h2>{{ auth.displayName }}</h2>
          <p>musicid {{ auth.musicid }}</p>
        </div>
        <div class="profile-actions">
          <button class="btn ghost small" @click="logout()">
            <AppIcon name="logout" :size="14" />
            退出登录
          </button>
        </div>
      </section>

      <div v-if="loading" class="loading-block"><span class="spinner lg" />正在加载歌单</div>

      <div v-else-if="error" class="empty">
        <div class="empty-icon"><AppIcon name="list" :size="25" /></div>
        <h3>歌单加载失败</h3>
        <p>{{ error }}</p>
        <button class="btn small" @click="load()">重试</button>
      </div>

      <template v-else-if="playlists.length > 0">
        <div class="section-title">
          <span>歌单</span>
          <span class="count">{{ playlists.length }} 个</span>
        </div>
        <div class="card-grid">
          <button
            v-for="playlist in playlists"
            :key="playlist.id"
            class="card"
            @click="router.push(`/playlist/${playlist.id}`)"
          >
            <CoverArt :src="playlist.coverUrl" image-class="card-cover" :icon-size="30" />
            <div class="card-name">{{ playlist.name }}</div>
            <div class="card-sub">{{ playlistSubtitle(playlist) }}</div>
          </button>
        </div>
      </template>

      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="list" :size="25" /></div>
        <h3>这个账号下还没有歌单</h3>
      </div>
    </template>
  </div>
</template>
