<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { DownloadTask } from '@shared/types'
import AppIcon from '../components/AppIcon.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import MarqueeText from '../components/MarqueeText.vue'
import PageJump from '../components/PageJump.vue'
import { useDownloadStore } from '../stores/download'
import { usePageJump } from '../composables/page-jump'
import { useToast } from '../composables/toast'
import { matchesDownloadKeyword } from '../utils/download-filter'
import { downloadOverallProgress } from '../utils/download-progress'
import { formatBytes } from '../utils/format'

type DownloadFilter = 'all' | 'active' | 'done' | 'failed'

const FILTERS: Array<{ value: DownloadFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'done', label: '已完成' },
  { value: 'failed', label: '未成功' }
]

const route = useRoute()
const router = useRouter()
const downloads = useDownloadStore()
const toast = useToast()
const pageRef = ref<HTMLElement | null>(null)
const { showTop, showBottom, scrollToTop, scrollToBottom } = usePageJump(pageRef)

const tasks = computed(() => downloads.tasks)
const progress = computed(() => downloadOverallProgress(tasks.value))
const pausedCount = computed(
  () => tasks.value.filter((task) => task.status === 'paused').length
)
const resumingAll = ref(false)
const storage = computed(() => downloads.storage)
const activeText = computed(() =>
  progress.value.active > 0 ? `${progress.value.active} 个任务进行中` : '没有进行中的任务'
)
function queryFilter(value: unknown): DownloadFilter {
  const raw = Array.isArray(value) ? value[0] : value
  return FILTERS.some((item) => item.value === raw) ? (raw as DownloadFilter) : 'all'
}

const filter = ref<DownloadFilter>(queryFilter(route.query.filter))

/** 过滤条件写入 URL；同一页面内的切换由页面栈去重。 */
function syncFilterQuery(): void {
  const query = { ...route.query }
  if (filter.value === 'all') delete query.filter
  else query.filter = filter.value
  void router.replace({ path: '/downloads', query })
}

function setFilter(next: DownloadFilter): void {
  if (filter.value === next) return
  filter.value = next
  syncFilterQuery()
}

watch(
  () => route.query.filter,
  () => {
    const next = queryFilter(route.query.filter)
    if (next !== filter.value) filter.value = next
  }
)
// 纯本地搜索：只过滤已加载的任务快照，不发请求、不扫描下载目录。
const searchText = ref('')
// 任务顺序降序展示，新任务在最前；只影响显示，不改变主进程队列处理顺序。
const orderedTasks = computed(() => [...tasks.value].reverse())
const matchedTasks = computed(() => {
  const keyword = searchText.value.trim()
  if (!keyword) return orderedTasks.value
  return orderedTasks.value.filter((task) => matchesDownloadKeyword(task, keyword))
})
const filteredTasks = computed(() => {
  const list = matchedTasks.value
  if (filter.value === 'active') {
    return list.filter(
      (task) =>
        task.status === 'downloading' || task.status === 'pending' || task.status === 'paused'
    )
  }
  if (filter.value === 'done') return list.filter((task) => task.status === 'done')
  if (filter.value === 'failed') return list.filter((task) => task.status === 'failed')
  return list
})
const emptyText = computed(() => {
  if (searchText.value.trim()) {
    return { title: '没有匹配的下载任务', hint: '尝试其他歌名、歌手或专辑关键词。' }
  }
  return { title: '没有符合条件的任务', hint: '切换过滤条件查看其他下载任务。' }
})

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

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action()
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

interface ConfirmState {
  title: string
  message: string
  confirmLabel: string
  action: () => void
}

const confirmState = ref<ConfirmState | null>(null)

function confirmRemoveTask(task: DownloadTask): void {
  confirmState.value = {
    title: '删除下载',
    message: `删除「${task.name}」及其下载文件？`,
    confirmLabel: '删除',
    action: () => void run(() => downloads.remove(task.id))
  }
}

function confirmClearCompleted(): void {
  void run(() => downloads.clearCompleted())
}

function confirmClearTasks(): void {
  const ids = filteredTasks.value.map((task) => task.id)
  if (ids.length === 0) return
  confirmState.value = {
    title: '清空任务',
    message: `确定清空当前显示的 ${ids.length} 个任务？已下载的文件会保留在本机，仅移除任务记录。`,
    confirmLabel: '清空',
    action: () => void run(() => downloads.clearTasks(ids))
  }
}

async function resumeAll(): Promise<void> {
  if (resumingAll.value || pausedCount.value === 0) return
  resumingAll.value = true
  try {
    await downloads.resumeAll()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  } finally {
    resumingAll.value = false
  }
}

function confirmClearDirectory(): void {
  const directory = downloads.storage?.directory ?? '下载目录'
  confirmState.value = {
    title: '清空下载目录',
    message: `确定清空下载目录「${directory}」？\n将删除目录内的全部文件与下载记录（包括其他账号在同目录的下载）；播放缓存不受影响。`,
    confirmLabel: '清空',
    action: () => void run(() => downloads.clearDirectory())
  }
}

function runConfirmed(): void {
  const action = confirmState.value?.action
  confirmState.value = null
  action?.()
}

onMounted(() => downloads.setVisible(true))
onBeforeUnmount(() => downloads.setVisible(false))
</script>

<template>
  <div ref="pageRef" class="downloads-page">
    <div
      class="downloads-progress-track"
      role="progressbar"
      :aria-valuenow="progress.percent"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <span :style="{ width: `${progress.percent}%` }" />
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

      <template v-if="progress.total > 0">
        <div class="panel downloads-panel">
          <div class="downloads-toolbar">
            <div class="downloads-filter" role="group" aria-label="下载任务过滤">
              <button
                v-for="item in FILTERS"
                :key="item.value"
                type="button"
                class="downloads-filter-btn"
                :class="{ active: filter === item.value }"
                @click="setFilter(item.value)"
              >
                {{ item.label }}
              </button>
            </div>
            <div class="downloads-toolbar-actions">
              <button
                class="btn ghost small"
                :disabled="resumingAll || pausedCount === 0"
                @click="resumeAll()"
              >
                <span v-if="resumingAll" class="spinner" />
                <AppIcon v-else name="play" :size="14" />
                全部开始
              </button>
              <button
                class="btn ghost small"
                :disabled="filteredTasks.length === 0"
                @click="confirmClearTasks()"
              >
                清空
              </button>
            </div>
          </div>

          <div class="table-filter downloads-search">
            <span class="search-icon"><AppIcon name="search" :size="16" /></span>
            <input
              v-model="searchText"
              class="input"
              type="search"
              aria-label="搜索下载任务"
              autocomplete="off"
              spellcheck="false"
            />
            <button v-if="searchText" class="btn ghost small" @click="searchText = ''">清除</button>
          </div>

          <div v-if="filteredTasks.length === 0" class="empty compact">
            <div class="empty-icon"><AppIcon name="download" :size="24" /></div>
            <h3>{{ emptyText.title }}</h3>
            <p>{{ emptyText.hint }}</p>
          </div>

          <div v-else class="downloads-list">
            <article v-for="task in filteredTasks" :key="task.id" class="download-row">
              <div class="download-main">
                <div class="song-text">
                  <div class="song-title">
                    <MarqueeText class="song-title-text" :text="task.name" />
                  </div>
                  <MarqueeText class="song-artist">
                    <template v-if="task.singers.length">{{ task.singers.join(' / ') }} · </template>
                    {{ task.quality.toUpperCase() }} · {{ sourceLabel(task) }} ·
                    {{ statusLabel(task.status) }}
                    <template v-if="task.albumName"> · {{ task.albumName }}</template>
                    <template v-if="task.error"> · {{ task.error }}</template>
                  </MarqueeText>
                </div>
                <span class="download-size">
                  {{ formatBytes(task.receivedBytes) }}
                  <template v-if="task.totalBytes">
                    / {{ formatBytes(task.totalBytes) }}
                  </template>
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
      </template>

      <div v-else class="empty">
        <div class="empty-icon"><AppIcon name="download" :size="28" /></div>
        <h3>还没有下载任务</h3>
        <p>在歌单或歌曲表中点击下载按钮，任务会显示在这里。</p>
      </div>
    </div>

    <PageJump
      :show-top="showTop"
      :show-bottom="showBottom"
      @top="scrollToTop"
      @bottom="scrollToBottom"
    />

    <ConfirmDialog
      :open="confirmState !== null"
      :title="confirmState?.title ?? ''"
      :message="confirmState?.message ?? ''"
      :confirm-label="confirmState?.confirmLabel"
      danger
      @confirm="runConfirmed()"
      @cancel="confirmState = null"
    />
  </div>
</template>
