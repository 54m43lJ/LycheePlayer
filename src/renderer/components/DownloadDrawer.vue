<script setup lang="ts">
import { computed, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { useDownloadStore } from '../stores/download'
import { useUiStore } from '../stores/ui'
import { useToast } from '../composables/toast'
import { formatBytes } from '../utils/format'

const ui = useUiStore()
const downloads = useDownloadStore()
const toast = useToast()

const totalProgress = computed(() => {
  const active = downloads.tasks.filter((task) => task.status === 'downloading')
  if (active.length === 0) return 0
  const total = active.reduce((sum, task) => sum + (task.totalBytes || 0), 0)
  const received = active.reduce((sum, task) => sum + task.receivedBytes, 0)
  return total > 0 ? Math.min(100, (received / total) * 100) : 0
})

function percent(task: { receivedBytes: number; totalBytes: number }): number {
  if (!task.totalBytes) return 0
  return Math.min(100, (task.receivedBytes / task.totalBytes) * 100)
}

function statusLabel(status: string): string {
  if (status === 'downloading') return '下载中'
  if (status === 'paused') return '已暂停'
  if (status === 'done') return '已完成'
  if (status === 'failed') return '失败'
  return '等待中'
}

async function run(action: () => Promise<void>, message?: string): Promise<void> {
  try {
    await action()
    if (message) toast.show(message)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function openFolder(): void {
  void run(async () => {
    const result = await window.lychee.download.openFolder()
    if (!result.ok) throw new Error(result.error.message)
  })
}

watch(
  () => ui.downloadOpen,
  (open) => downloads.setOpen(open),
  { immediate: true }
)
</script>

<template>
  <aside class="download-drawer" :class="{ open: ui.downloadOpen }">
    <div class="lyrics-head">
      <div>
        <h2>下载中心</h2>
        <p>
          {{ downloads.tasks.length }} 个任务
          <template v-if="downloads.storage"> · 已用 {{ formatBytes(downloads.storage.bytes) }} · 剩余
            {{ formatBytes(downloads.storage.freeBytes) }}</template>
        </p>
      </div>
      <button class="icon-btn" title="关闭下载中心" @click="ui.closeDownload()">
        <AppIcon name="close" :size="18" />
      </button>
    </div>

    <div v-if="downloads.tasks.some((task) => task.status === 'downloading')" class="download-total">
      <div class="download-bar"><span :style="{ width: `${totalProgress}%` }" /></div>
    </div>

    <div v-if="downloads.tasks.length === 0" class="lyrics-empty">
      <AppIcon name="download" :size="26" />
      <span>还没有下载任务</span>
    </div>

    <div v-else class="download-list">
      <article v-for="task in downloads.tasks" :key="task.id" class="download-row">
        <div class="download-main">
          <div class="song-text">
            <div class="song-title">{{ task.name }}</div>
            <div class="song-artist">
              {{ task.quality.toUpperCase() }} · {{ statusLabel(task.status) }}
              <template v-if="task.error"> · {{ task.error }}</template>
            </div>
          </div>
          <span class="download-size">
            {{ formatBytes(task.receivedBytes) }}<template v-if="task.totalBytes"> / {{ formatBytes(task.totalBytes) }}</template>
          </span>
        </div>
        <div class="download-bar">
          <span
            :class="{ failed: task.status === 'failed' }"
            :style="{ width: `${percent(task)}%` }"
          />
        </div>
        <div class="download-actions">
          <button
            v-if="task.status === 'downloading'"
            class="btn ghost small"
            @click="run(() => downloads.pause(task.id))"
          >
            暂停
          </button>
          <button
            v-else-if="task.status === 'paused' || task.status === 'failed'"
            class="btn small"
            @click="run(() => downloads.resume(task.id))"
          >
            继续
          </button>
          <button class="btn ghost small" @click="run(() => downloads.remove(task.id))">
            删除
          </button>
        </div>
      </article>

      <div class="download-footer">
        <button class="btn ghost small" @click="run(() => downloads.clearCompleted())">
          清除已完成
        </button>
        <button class="btn small" @click="openFolder()">
          <AppIcon name="folder" :size="14" />
          打开目录
        </button>
      </div>
    </div>
  </aside>
</template>
