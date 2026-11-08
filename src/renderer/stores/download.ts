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
  const open = ref(false)
  let timer: number | null = null

  async function load(): Promise<void> {
    try {
      tasks.value = unwrap(await window.lychee.download.list())
      storage.value = unwrap(await window.lychee.download.storage())
      const mids = new Set([
        ...Object.keys(assets.value),
        ...tasks.value.map((task) => task.songMid)
      ])
      if (mids.size > 0) void refreshAssets([...mids])
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
        task.status === 'downloading' ||
        task.status === 'pending' ||
        task.status === 'paused'
    )
  }

  function setOpen(next: boolean): void {
    open.value = next
    if (next) {
      void load()
      startPolling()
    } else if (!hasActive()) {
      stopPolling()
    }
  }

  function replace(task: DownloadTask): void {
    tasks.value = tasks.value.some((item) => item.id === task.id)
      ? tasks.value.map((item) => (item.id === task.id ? task : item))
      : [task, ...tasks.value]
  }

  async function startMany(songMids: string[], quality: Quality): Promise<DownloadTask[]> {
    const next = unwrap(await window.lychee.download.startMany(songMids, quality))
    for (const task of next) replace(task)
    setOpen(true)
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

  async function remove(id: string): Promise<void> {
    const task = tasks.value.find((item) => item.id === id)
    unwrap(await window.lychee.download.remove(id))
    tasks.value = tasks.value.filter((item) => item.id !== id)
    if (task) void refreshAssets([task.songMid])
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
    storage.value = unwrap(await window.lychee.download.storage())
  }

  function reset(): void {
    tasks.value = []
    assets.value = {}
    storage.value = null
  }

  return {
    tasks,
    assets,
    storage,
    open,
    load,
    setOpen,
    refreshAssets,
    start,
    startMany,
    pause,
    resume,
    remove,
    clearCompleted,
    clearDirectory,
    reset
  }
})
