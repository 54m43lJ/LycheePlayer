import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  DownloadStorageInfo,
  DownloadTask,
  Quality,
  SongAssetState
} from '@shared/types'
import { DOWNLOAD_POLL_MS, IPC_SONG_MIDS_MAX } from '@shared/constants'
import { unwrap } from '../api'

export const useDownloadStore = defineStore('download', () => {
  const tasks = ref<DownloadTask[]>([])
  const assets = ref<Record<string, SongAssetState>>({})
  const storage = ref<DownloadStorageInfo | null>(null)
  const visible = ref(false)
  let timer: number | null = null
  let hydrated = false
  const knownStatuses = new Map<string, DownloadTask['status']>()

  /**
   * 轮询只需刷新状态发生变化的任务资产，避免大批量下载时每 1.5 秒
   * 对数以千计的歌曲重复调用 download.assetStates。
   */
  function trackStatuses(next: DownloadTask[]): string[] {
    const changed: string[] = []
    if (hydrated) {
      for (const task of next) {
        if (knownStatuses.get(task.id) !== task.status) changed.push(task.songMid)
      }
    }
    knownStatuses.clear()
    for (const task of next) knownStatuses.set(task.id, task.status)
    hydrated = true
    return changed
  }

  async function load(): Promise<void> {
    try {
      const next = unwrap(await window.lychee.download.list())
      const changed = trackStatuses(next)
      tasks.value = next
      // 目录用量扫描较重，只在下载中心可见时刷新；不可见时保留上一次快照。
      if (visible.value) storage.value = unwrap(await window.lychee.download.storage())
      if (changed.length > 0) void refreshAssets(changed)
      if (!visible.value && !hasActive()) stopPolling()
    } catch {
      // 下载列表不可用时保持上一次快照。
    }
  }

  async function refreshAssets(songMids: string[]): Promise<void> {
    const unique = [...new Set(songMids.filter(Boolean))]
    if (unique.length === 0) return
    const next = { ...assets.value }
    for (let start = 0; start < unique.length; start += IPC_SONG_MIDS_MAX) {
      const chunk = unique.slice(start, start + IPC_SONG_MIDS_MAX)
      try {
        const states = unwrap(await window.lychee.download.assetStates(chunk))
        for (const state of states) next[state.songMid] = state
      } catch {
        // 资产状态查询失败时保持未知状态。
      }
    }
    assets.value = next
  }

  function startPolling(): void {
    if (timer !== null) return
    timer = window.setInterval(() => void load(), DOWNLOAD_POLL_MS)
  }

  function stopPolling(): void {
    if (timer === null) return
    window.clearInterval(timer)
    timer = null
  }

  function hasActive(): boolean {
    return tasks.value.some(
      (task) =>
        task.status === 'downloading' || task.status === 'pending' || task.status === 'paused'
    )
  }

  function setVisible(next: boolean): void {
    visible.value = next
    if (next) {
      void load()
      startPolling()
    } else if (!hasActive()) {
      stopPolling()
    }
  }

  function replace(task: DownloadTask): void {
    knownStatuses.set(task.id, task.status)
    // 新任务追加到末尾，页面按数组倒序展示；主进程队列仍按入队顺序处理。
    tasks.value = tasks.value.some((item) => item.id === task.id)
      ? tasks.value.map((item) => (item.id === task.id ? task : item))
      : [...tasks.value, task]
  }

  async function startMany(songMids: string[], quality: Quality): Promise<DownloadTask[]> {
    const next = unwrap(await window.lychee.download.startMany(songMids, quality))
    for (const task of next) replace(task)
    // “下载全部”不自动打开下载中心；仅在有活动任务时轮询以更新歌曲表图标。
    startPolling()
    void refreshAssets(songMids)
    return next
  }

  async function start(songMid: string, quality: Quality): Promise<void> {
    await startMany([songMid], quality)
  }

  async function pause(id: string): Promise<void> {
    replace(unwrap(await window.lychee.download.pause(id)))
  }

  async function resume(id: string): Promise<void> {
    replace(unwrap(await window.lychee.download.resume(id)))
  }

  /** 继续全部暂停任务；主进程一次完成状态切换，避免逐条 IPC。 */
  async function resumeAll(): Promise<void> {
    const next = unwrap(await window.lychee.download.resumeAll())
    for (const task of next) replace(task)
    if (next.length > 0) startPolling()
  }

  async function remove(id: string): Promise<void> {
    const task = tasks.value.find((item) => item.id === id)
    unwrap(await window.lychee.download.remove(id))
    knownStatuses.delete(id)
    tasks.value = tasks.value.filter((item) => item.id !== id)
    if (task) void refreshAssets([task.songMid])
  }

  /** 删除某首歌的全部已完成下载；歌单中再次点击已下载歌曲的下载按钮时使用。 */
  async function removeSong(songMid: string): Promise<void> {
    unwrap(await window.lychee.download.removeSong(songMid))
    for (const task of tasks.value) {
      if (task.songMid === songMid && task.status === 'done') knownStatuses.delete(task.id)
    }
    tasks.value = tasks.value.filter(
      (task) => !(task.songMid === songMid && task.status === 'done')
    )
    await refreshAssets([songMid])
  }

  async function clearCompleted(): Promise<void> {
    unwrap(await window.lychee.download.clearCompleted())
    tasks.value = tasks.value.filter((item) => item.status !== 'done')
    await load()
  }

  /** 清空下载目录内的文件与下载记录；不影响播放缓存。 */
  async function clearDirectory(): Promise<void> {
    unwrap(await window.lychee.download.clearDirectory())
    tasks.value = []
    assets.value = {}
    knownStatuses.clear()
    hydrated = false
    storage.value = unwrap(await window.lychee.download.storage())
  }

  function reset(): void {
    tasks.value = []
    assets.value = {}
    storage.value = null
    knownStatuses.clear()
    hydrated = false
    if (visible.value) {
      // 下载页仍然可见（例如登录态刷新触发重置）时立即重新加载，避免页面停在空列表。
      void load()
    } else {
      stopPolling()
    }
  }

  return {
    tasks,
    assets,
    storage,
    visible,
    load,
    setVisible,
    refreshAssets,
    start,
    startMany,
    pause,
    resume,
    resumeAll,
    remove,
    removeSong,
    clearCompleted,
    clearDirectory,
    reset
  }
})
