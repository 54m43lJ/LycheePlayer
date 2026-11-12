import { ref } from 'vue'
import type { Quality, Song } from '@shared/types'
import { describeError } from '../api'
import { useDownloadStore } from '../stores/download'
import { useToast } from './toast'

export interface DownloadDeletePrompt {
  songMid: string
  name: string
}

/**
 * 所有下载按钮共用的入口：已下载时弹出删除确认，未下载时加入统一队列。
 * 对话框状态放在模块级，App.vue 只渲染一个 DownloadDeleteDialog，
 * 歌曲表、播放条和新页面不会各自复制一套行为。
 */
const pendingDelete = ref<DownloadDeletePrompt | null>(null)

export function useDownloadAction() {
  const download = useDownloadStore()
  const toast = useToast()

  async function requestDownload(
    song: Pick<Song, 'songMid' | 'name'>,
    quality: Quality
  ): Promise<void> {
    if (download.assets[song.songMid]?.downloadedQuality) {
      pendingDelete.value = { songMid: song.songMid, name: song.name }
      return
    }
    try {
      await download.start(song.songMid, quality)
      toast.show('已加入下载任务')
    } catch (err) {
      toast.error(describeError(err))
    }
  }

  async function confirmDownloadDelete(): Promise<void> {
    const target = pendingDelete.value
    pendingDelete.value = null
    if (!target) return
    try {
      await download.removeSong(target.songMid)
      toast.show('已删除下载')
    } catch (err) {
      toast.error(describeError(err))
    }
  }

  function cancelDownloadDelete(): void {
    pendingDelete.value = null
  }

  return {
    pendingDelete,
    requestDownload,
    confirmDownloadDelete,
    cancelDownloadDelete
  }
}
