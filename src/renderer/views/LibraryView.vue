<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { PlaylistMeta } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import CoverArt from '../components/CoverArt.vue'
import PlaylistEditDialog from '../components/PlaylistEditDialog.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { useAuthStore } from '../stores/auth'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { playlistSubtitle } from '../utils/format'

const router = useRouter()
const auth = useAuthStore()
const edit = usePlaylistEditStore()
const toast = useToast()

const playlists = ref<PlaylistMeta[]>([])
const loading = ref(false)
const error = ref('')
const dialogOpen = ref(false)
const editingPlaylist = ref<PlaylistMeta | null>(null)

async function load(): Promise<void> {
  if (!auth.loggedIn) return
  loading.value = true
  error.value = ''
  try {
    playlists.value = unwrap(await window.lychee.playlist.listMine())
    const favorites = playlists.value.find(
      (playlist) => playlist.kind === 'favorites' || playlist.id === 'liked'
    )
    if (favorites) window.lychee.playlist.prefetch([favorites.id])
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

function openCreate(): void {
  editingPlaylist.value = null
  dialogOpen.value = true
}

function openRename(playlist: PlaylistMeta): void {
  editingPlaylist.value = playlist
  dialogOpen.value = true
}

async function submitDialog(name: string): Promise<void> {
  try {
    if (editingPlaylist.value) await edit.rename(editingPlaylist.value.id, name)
    else await edit.create(name)
    dialogOpen.value = false
    await load()
  } catch (err) {
    toast.error(describeError(err))
  }
}

async function removePlaylist(playlist: PlaylistMeta): Promise<void> {
  if (!window.confirm(`确定删除歌单「${playlist.name}」？`)) return
  try {
    await edit.remove(playlist.id)
    await load()
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

watch(
  () => edit.favoriteVersion,
  () => {
    if (auth.loggedIn) void load()
  }
)
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Library</div>
        <h1 class="page-title">我的歌单</h1>
      </div>
      <div class="page-head-actions">
        <button v-if="auth.loggedIn" class="btn small" @click="openCreate()">
          <AppIcon name="plus" :size="14" />
          新建歌单
        </button>
        <button class="btn small" :disabled="loading || !auth.loggedIn" @click="refreshAll()">
          <AppIcon name="refresh" :size="14" />
          刷新
        </button>
      </div>
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
          <div
            v-for="playlist in playlists"
            :key="playlist.id"
            class="card playlist-card"
            role="button"
            tabindex="0"
            @click="router.push(`/playlist/${playlist.id}`)"
            @keydown.enter="router.push(`/playlist/${playlist.id}`)"
          >
            <CoverArt :src="playlist.coverUrl" image-class="card-cover" :icon-size="30" />
            <div class="card-name">
              {{ playlist.kind === 'favorites' ? '我喜欢' : playlist.name }}
            </div>
            <div class="card-sub">{{ playlistSubtitle(playlist) }}</div>
            <div v-if="playlist.editable && playlist.kind !== 'favorites'" class="card-actions">
              <button class="icon-btn" title="重命名" @click.stop="openRename(playlist)">
                <AppIcon name="edit" :size="14" />
              </button>
              <button class="icon-btn" title="删除" @click.stop="removePlaylist(playlist)">
                <AppIcon name="trash" :size="14" />
              </button>
            </div>
          </div>
        </div>
      </template>

      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="list" :size="25" /></div>
        <h3>这个账号下还没有歌单</h3>
        <button class="btn small" @click="openCreate()">新建歌单</button>
      </div>
    </template>

    <PlaylistEditDialog
      :open="dialogOpen"
      :playlist="editingPlaylist"
      @close="dialogOpen = false"
      @submit="submitDialog"
    />
  </div>
</template>
