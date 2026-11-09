<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { DownloadTask } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import { useDownloadStore } from '../stores/download'
import { useToast } from '../composables/toast'
import { downloadOverallProgress } from '../utils/download-progress'
import { formatBytes } from '../utils/format'

const downloads = useDownloadStore()
const toast = useToast()

const tasks = computed(() => downloads.tasks)
const progress = computed(() => downloadOverallProgress(tasks.value))
const storage = computed(() => downloads.storage)
const activeText = computed(() =>
  progress.value.active > 0 ? `${progress.value.active} 个任务进行中` : '没有进行中的任务'
)

function percent(task: DownloadTask): number {
  if (!task.totalBytes) return task.status === 'done' ? 100 : 0
  return Math.min(100, (task.receivedBytes / task.totalBytes) * 100)
}

function statusLabel(status: DownloadTask['status']): string {
  if (status === 'downloading') return '下载中'
  if (status === 'paused') return '已暂停'
  if (status === 'done') return '已完成'
  if (status === 'failed') return '失败'
  return '等待中'
}

function sourceLabel(task: DownloadTask): string {
  return task.source === 'cache' ? '缓存转移' : '网络下载'
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

function confirmRemoveTask(task: DownloadTask): void {
  if (!window.confirm(`删除「${task.name}」及其下载文件？`)) return
  void run(() => downloads.remove(task.id), '下载已删除')
}

function confirmClearCompleted(): void {
  void run(() => downloads.clearCompleted(), '已清除完成记录')
}

function confirmClearDirectory(): void {
  const directory = downloads.storage?.directory ?? '下载目录'
  if (
    !window.confirm(
      `确定清空下载目录「${directory}」？\n将删除目录内的全部文件与下载记录（包括其他账号在同目录的下载）；播放缓存不受影响。`
    )
  ) {
    return
  }
  void run(() => downloads.clearDirectory(), '下载目录已清空')
}

onMounted(() => downloads.setVisible(true))
onBeforeUnmount(() => downloads.setVisible(false))
</script>

<template>
  <div class="downloads-page">
    <div class="downloads-progress">
      <div class="downloads-progress-meta">
        <span class="downloads-progress-title">整体进度</span>
        <span class="downloads-progress-count">
          ({{ progress.done }}/{{ progress.total }})
          <template v-if="progress.failed > 0"> · 失败 {{ progress.failed }}</template>
        </span>
      </div>
      <div
        class="downloads-progress-track"
        role="progressbar"
        :aria-valuenow="progress.percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${progress.percent}%` }" />
      </div>
    </div>

    <div class="page">
      <div class="page-head">
        <div>
          <div class="eyebrow">Downloads</div>
          <h1 class="page-title">下载中心</h1>
          <p class="page-sub">
            {{ activeText }}
            <template v-if="storage">
              · 已用 {{ formatBytes(storage.bytes) }} · 剩余 {{ formatBytes(storage.freeBytes) }}
            </template>
          </p>
        </div>
        <div class="page-head-actions">
          <button
            class="btn ghost small"
            :disabled="progress.total === 0"
            @click="confirmClearCompleted()"
          >
            清除已完成
          </button>
          <button class="btn ghost small" @click="confirmClearDirectory()">清空目录</button>
          <button class="btn small" @click="openFolder()">
            <AppIcon name="folder" :size="14" />
            打开文件夹
          </button>
        </div>
      </div>

      <div v-if="progress.total === 0" class="empty">
        <div class="empty-icon"><AppIcon name="download" :size="28" /></div>
        <h3>还没有下载任务</h3>
        <p>在歌单或歌曲表中点击下载按钮，任务会显示在这里。</p>
      </div>

      <div v-else class="panel downloads-panel">
        <div class="downloads-list">
          <article v-for="task in tasks" :key="task.id" class="download-row">
            <div class="download-main">
              <div class="song-text">
                <div class="song-title">{{ task.name }}</div>
                <div class="song-artist">
                  {{ task.quality.toUpperCase() }} · {{ sourceLabel(task) }} ·
                  {{ statusLabel(task.status) }}
                  <template v-if="task.error"> · {{ task.error }}</template>
                </div>
              </div>
              <span class="download-size">
                {{ formatBytes(task.receivedBytes)
                }}<template v-if="task.totalBytes"> / {{ formatBytes(task.totalBytes) }}</template>
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
              <button class="btn ghost small" @click="confirmRemoveTask(task)">删除</button>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>
</template>
