import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DownloadStorageInfo, DownloadTask, Quality } from '@shared/types'
import { DOWNLOAD_POLL_MS } from '@shared/constants'
import { unwrap } from '../api'

export const useDownloadStore = defineStore('download', () => {
  const tasks = ref<DownloadTask[]>([])
  const storage = ref<DownloadStorageInfo | null>(null)
  const open = ref(false)
  let timer: number | null = null

  async function load(): Promise<void> {
    try {
      tasks.value = unwrap(await window.lychee.download.list())
      storage.value = unwrap(await window.lychee.download.storage())
    } catch {
      // 下载列表不可用时保持上一次快照。
    }
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

  function setOpen(next: boolean): void {
    open.value = next
    if (next) {
      void load()
      startPolling()
    } else {
      stopPolling()
    }
  }

  async function start(songMid: string, quality: Quality): Promise<void> {
    const task = unwrap(await window.lychee.download.start(songMid, quality))
    tasks.value = [task, ...tasks.value.filter((item) => item.id !== task.id)]
    setOpen(true)
  }

  async function pause(id: string): Promise<void> {
    const task = unwrap(await window.lychee.download.pause(id))
    replace(task)
  }

  async function resume(id: string): Promise<void> {
    const task = unwrap(await window.lychee.download.resume(id))
    replace(task)
  }

  async function remove(id: string): Promise<void> {
    unwrap(await window.lychee.download.remove(id))
    tasks.value = tasks.value.filter((item) => item.id !== id)
  }

  async function clearCompleted(): Promise<void> {
    unwrap(await window.lychee.download.clearCompleted())
    tasks.value = tasks.value.filter((item) => item.status !== 'done')
  }

  function replace(task: DownloadTask): void {
    tasks.value = tasks.value.map((item) => (item.id === task.id ? task : item))
  }

  return {
    tasks,
    storage,
    open,
    load,
    setOpen,
    start,
    pause,
    resume,
    remove,
    clearCompleted
  }
})
