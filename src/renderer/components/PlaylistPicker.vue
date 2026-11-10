<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PlaylistMeta } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import { describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { playlistSubtitle } from '../utils/format'

const props = defineProps<{ open: boolean; songMids: string[]; songName?: string }>()
const emit = defineEmits<{ close: []; added: [id: string] }>()

const toast = useToast()
const playlistEdit = usePlaylistEditStore()
const playlists = ref<PlaylistMeta[]>([])
const loading = ref(false)
const error = ref('')
const creating = ref(false)
const newName = ref('')
const submittingId = ref('')

async function load(): Promise<void> {
  if (!props.open) return
  loading.value = true
  error.value = ''
  try {
    const all = unwrap(await window.lychee.playlist.listMine())
    playlists.value = all.filter(
      (playlist) => playlist.editable && playlist.kind !== 'favorites'
    )
  } catch (err) {
    error.value = describeError(err)
  } finally {
    loading.value = false
  }
}

async function isDuplicate(id: string): Promise<boolean> {
  try {
    const cached = unwrap(await window.lychee.playlist.getCached(id))
    if (cached?.complete) {
      const members = new Set(cached.songs.map((song) => song.songMid))
      return props.songMids.every((mid) => members.has(mid))
    }
  } catch {
    // 缓存不可用时交给上游去重。
  }
  return false
}

async function addTo(id: string): Promise<void> {
  if (submittingId.value) return
  submittingId.value = id
  try {
    if (await isDuplicate(id)) {
      toast.show('已在歌单中')
      return
    }
    const changed = await playlistEdit.addSongs(id, props.songMids)
    if (!changed) return
    emit('added', id)
    emit('close')
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    submittingId.value = ''
  }
}

async function createAndAdd(): Promise<void> {
  const name = newName.value.trim()
  if (!name || submittingId.value) return
  submittingId.value = 'new'
  try {
    const meta = unwrap(await window.lychee.playlist.create(name))
    await playlistEdit.addSongs(meta.id, props.songMids)
    emit('added', meta.id)
    emit('close')
  } catch (err) {
    toast.error(describeError(err))
  } finally {
    submittingId.value = ''
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      newName.value = ''
      creating.value = false
      void load()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog playlist-picker">
      <header class="dialog-head">
        <div>
          <h2>添加到歌单</h2>
          <p v-if="songName" class="faint">{{ songName }}</p>
        </div>
        <button class="icon-btn" title="关闭" @click="emit('close')">
          <AppIcon name="close" :size="17" />
        </button>
      </header>

      <div class="dialog-body">
        <div v-if="loading" class="loading-block compact"><span class="spinner" />正在加载歌单</div>
        <div v-else-if="error" class="empty compact">
          <p>{{ error }}</p>
          <button class="btn ghost small" @click="load()">重试</button>
        </div>
        <template v-else>
          <div v-if="playlists.length > 0" class="picker-list">
            <button
              v-for="playlist in playlists"
              :key="playlist.id"
              class="picker-row"
              :disabled="Boolean(submittingId)"
              @click="addTo(playlist.id)"
            >
              <CoverArt :src="playlist.coverUrl" image-class="cover-thumb" :icon-size="16" />
              <span class="picker-text">
                <span class="picker-name">{{ playlist.name }}</span>
                <span class="picker-sub">{{ playlistSubtitle(playlist) }}</span>
              </span>
              <span v-if="submittingId === playlist.id" class="spinner" />
              <AppIcon v-else name="chevron-right" :size="15" />
            </button>
          </div>
          <div v-else class="empty compact">
            <p>还没有可编辑的普通歌单</p>
          </div>

          <div class="picker-create">
            <button class="btn ghost small" @click="creating = !creating">
              <AppIcon name="plus" :size="14" />
              新建歌单
            </button>
            <div v-if="creating" class="picker-create-row">
              <input
                v-model="newName"
                class="input"
                maxlength="128"
                placeholder="歌单名称"
                @keydown.enter="createAndAdd()"
              />
              <button
                class="btn primary small"
                :disabled="!newName.trim() || Boolean(submittingId)"
                @click="createAndAdd()"
              >
                创建并添加
              </button>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>
</template>
