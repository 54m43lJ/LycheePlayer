<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { useBackDismiss } from '../composables/back-navigation'
import { formatBytes } from '../utils/format'
import type { UserCacheRow } from '../utils/cache-users'

const props = withDefaults(
  defineProps<{
    open: boolean
    users: UserCacheRow[]
    currentMusicid: string | null
    loading?: boolean
    deleting?: string | null
  }>(),
  { loading: false, deleting: null }
)

const emit = defineEmits<{
  close: []
  refresh: []
  remove: [musicid: string]
}>()

const confirming = ref<string | null>(null)

useBackDismiss(() => props.open, () => emit('close'))

watch(
  () => props.open,
  (open) => {
    if (!open) confirming.value = null
  }
)

watch(
  () => props.users.map((user) => user.musicid).join(','),
  () => {
    if (confirming.value && !props.users.some((user) => user.musicid === confirming.value)) {
      confirming.value = null
    }
  }
)

function label(row: UserCacheRow): string {
  if (row.musicid === 'anonymous') return '未登录 / 匿名'
  return row.musicid === props.currentMusicid
    ? `当前账号 · ${row.musicid}`
    : `账号 ${row.musicid}`
}

function totalBytes(row: UserCacheRow): number {
  return row.audioBytes + row.playlistBytes + row.localBytes
}

const hasUsers = computed(() => props.users.length > 0)

function requestRemove(row: UserCacheRow): void {
  if (props.deleting) return
  if (confirming.value === row.musicid) {
    confirming.value = null
    emit('remove', row.musicid)
    return
  }
  confirming.value = row.musicid
}

function onKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
    <section
      class="dialog cache-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="用户缓存管理"
    >
      <header class="dialog-head">
        <h2>用户缓存管理</h2>
        <button class="icon-btn" title="关闭" @click="emit('close')">
          <AppIcon name="close" :size="17" />
        </button>
      </header>
      <div class="dialog-body">
        <p class="cache-intro">
          按账号删除歌单缓存、播放缓存与本地记录；下载文件和其他账号不受影响。
        </p>
        <div v-if="loading" class="cache-empty">正在统计…</div>
        <div v-else-if="!hasUsers" class="cache-empty">暂无缓存数据</div>
        <div v-else class="cache-user-list">
          <div v-for="row in users" :key="row.musicid" class="cache-user-row">
            <div class="cache-user-main">
              <div class="setting-name">{{ label(row) }}</div>
              <div class="setting-desc">
                共 {{ formatBytes(totalBytes(row)) }} · 播放缓存
                {{ formatBytes(row.audioBytes) }}（{{ row.audioFiles }} 个文件）
              </div>
              <div class="setting-desc">
                歌单缓存 {{ formatBytes(row.playlistBytes) }}（{{ row.playlistFiles }} 个文件）
                · 本地记录 {{ formatBytes(row.localBytes) }}（{{ row.localEntries }} 项）
              </div>
            </div>
            <button
              class="btn small"
              :class="confirming === row.musicid ? 'danger' : 'ghost'"
              :disabled="deleting === row.musicid"
              @click="requestRemove(row)"
            >
              <span v-if="deleting === row.musicid" class="spinner" />
              {{
                deleting === row.musicid
                  ? '删除中'
                  : confirming === row.musicid
                    ? '确认删除'
                    : '删除'
              }}
            </button>
          </div>
        </div>
      </div>
      <footer class="dialog-foot">
        <button class="btn ghost small" :disabled="loading" @click="emit('refresh')">
          刷新
        </button>
        <button class="btn small" @click="emit('close')">关闭</button>
      </footer>
    </section>
  </div>
</template>
