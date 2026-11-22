<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PlaylistMeta } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import { describeError, unwrap } from '../api'
import { useBackDismiss } from '../composables/back-navigation'
import { useToast } from '../composables/toast'
import { usePlaylistEditStore } from '../stores/playlist-edit'
import { playlistSubtitle } from '../utils/format'

const props = defineProps<{ open: boolean; songMids: string[]; songName?: string }>()
const emit = defineEmits<{ close: []; added: [id: string] }>()

useBackDismiss(() => props.open, () => emit('close'))

const toast = useToast()
const playlistEdit = usePlaylistEditStore()
const playlists = ref<PlaylistMeta[]>([])
const loading = ref(false)
const error = ref('')
const creating = ref(false)
const newName = ref('')
const submittingId = ref('')
const duplicateIds = ref<Set<string>>(new Set())
let duplicateToken = 0

async function load(): Promise<void> {
  if (!props.open) return
  loading.value = true
  error.value = ''
  try {
    const all = unwrap(await window.lychee.playlist.listMine())
    playlists.value = all.filter(
      (playlist) => playlist.editable && playlist.kind !== 'favorites'
    )
    void detectDuplicates()
  } catch (err) {
    error.value = describeError(err)
  } finally {
    loading.value = false
  }
}

/**
 * 本地缓存机制：上游没有“一次检查歌曲是否在全部歌单中”的接口，
 * 只对已有完整缓存的歌单做成员判断；缓存不完整时保持可点击，
 * 由写入后的业务状态与 Toast 兜底。
 */
async function detectDuplicates(): Promise<void> {
  const mids = props.songMids
  const request = ++duplicateToken
  if (mids.length === 0) {
    duplicateIds.value = new Set()
    return
  }
  const found = new Set<string>()
  await Promise.all(
    playlists.value.map(async (playlist) => {
      try {
        const cached = unwrap(await window.lychee.playlist.getCached(playlist.id))
        if (!cached?.complete) return
        const members = new Set(cached.songs.map((song) => song.songMid))
        if (mids.every((mid) => members.has(mid))) found.add(playlist.id)
      } catch {
        // 单个歌单缓存读取失败不影响其余判断。
      }
    })
  )
  if (request === duplicateToken) duplicateIds.value = found
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
    if (duplicateIds.value.has(id) || (await isDuplicate(id))) {
      toast.show('已添加')
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
      duplicateIds.value = new Set()
      void load()
    }
  },
  { immediate: true }
)

watch(
  () => props.songMids.join('|'),
  () => {
    if (props.open) void detectDuplicates()
  }
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
              :class="{ duplicate: duplicateIds.has(playlist.id) }"
              :disabled="Boolean(submittingId) || duplicateIds.has(playlist.id)"
              @click="addTo(playlist.id)"
            >
              <CoverArt :src="playlist.coverUrl" image-class="cover-thumb" :icon-size="16" />
              <span class="picker-text">
                <span class="picker-name">{{ playlist.name }}</span>
                <span class="picker-sub">{{ playlistSubtitle(playlist) }}</span>
              </span>
              <span v-if="duplicateIds.has(playlist.id)" class="picker-dup">已添加</span>
              <span v-else-if="submittingId === playlist.id" class="spinner" />
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
