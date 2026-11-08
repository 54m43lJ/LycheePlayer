import { defineStore } from 'pinia'
import { ref } from 'vue'
import type {
  DownloadBatch,
  DownloadStorageInfo,
  DownloadTask,
  Quality,
  SongAssetState
} from '@shared/types'
import { DOWNLOAD_POLL_MS, IPC_SONG_MIDS_MAX } from '@shared/constants'
import { unwrap } from '../api'

export const useDownloadStore = defineStore('download', () => {
  const tasks = ref<DownloadTask[]>([])
  const batches = ref<DownloadBatch[]>([])
  const assets = ref<Record<string, SongAssetState>>({})
  const storage = ref<DownloadStorageInfo | null>(null)
  const open = ref(false)
  let timer: number | null = null

  async function load(): Promise<void> {
    try {
      tasks.value = unwrap(await window.lychee.download.list())
      batches.value = unwrap(await window.lychee.download.batches())
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
    return (
      tasks.value.some(
        (task) =>
          task.status === 'downloading' ||
          task.status === 'pending' ||
          task.status === 'paused'
      ) || batches.value.some((batch) => batch.status === 'downloading' || batch.status === 'pending')
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

  function replaceBatch(batch: DownloadBatch): void {
    batches.value = batches.value.some((item) => item.id === batch.id)
      ? batches.value.map((item) => (item.id === batch.id ? batch : item))
      : [batch, ...batches.value]
  }

  async function start(songMid: string, quality: Quality): Promise<void> {
    const task = unwrap(await window.lychee.download.start(songMid, quality))
    replace(task)
    setOpen(true)
    void refreshAssets([songMid])
  }

  async function startBatch(request: {
    source: 'playlist'
    playlistId: string
    playlistName?: string
    songMids: string[]
  }): Promise<DownloadBatch> {
    const batch = unwrap(await window.lychee.download.startBatch(request))
    replaceBatch(batch)
    setOpen(true)
    void refreshAssets(request.songMids)
    return batch
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

  async function pauseBatch(batchId: string): Promise<void> {
    replaceBatch(unwrap(await window.lychee.download.pauseBatch(batchId)))
    await load()
  }

  async function resumeBatch(batchId: string): Promise<void> {
    replaceBatch(unwrap(await window.lychee.download.resumeBatch(batchId)))
    await load()
  }

  async function removeBatch(batchId: string): Promise<void> {
    const mids = tasks.value.filter((task) => task.batchId === batchId).map((task) => task.songMid)
    unwrap(await window.lychee.download.removeBatch(batchId))
    batches.value = batches.value.filter((item) => item.id !== batchId)
    tasks.value = tasks.value.filter((task) => task.batchId !== batchId)
    void refreshAssets(mids)
  }

  async function retryFailed(batchId: string): Promise<void> {
    replaceBatch(unwrap(await window.lychee.download.retryFailed(batchId)))
    await load()
  }

  async function clearCompleted(): Promise<void> {
    unwrap(await window.lychee.download.clearCompleted())
    tasks.value = tasks.value.filter((item) => item.status !== 'done')
    await load()
  }

  function batchOf(task: DownloadTask): DownloadBatch | undefined {
    return task.batchId ? batches.value.find((batch) => batch.id === task.batchId) : undefined
  }

  return {
    tasks,
    batches,
    assets,
    storage,
    open,
    load,
    setOpen,
    refreshAssets,
    start,
    startBatch,
    pause,
    resume,
    remove,
    pauseBatch,
    resumeBatch,
    removeBatch,
    retryFailed,
    clearCompleted,
    batchOf
  }
})
