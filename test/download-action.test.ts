import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const startMany = vi.fn()
const removeSong = vi.fn()
const assetStates = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', {
    lychee: { download: { startMany, removeSong, assetStates } },
    setInterval: vi.fn(() => 1),
    clearInterval: vi.fn(),
    setTimeout: vi.fn(() => 1),
    clearTimeout: vi.fn()
  })
  setActivePinia(createPinia())
  startMany.mockReset()
  removeSong.mockReset()
  assetStates.mockReset()
  startMany.mockResolvedValue({ ok: true, data: [] })
  removeSong.mockResolvedValue({ ok: true, data: null })
  assetStates.mockResolvedValue({ ok: true, data: [] })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('下载按钮共用机制', () => {
  it('已下载时弹出删除确认，确认后调用 removeSong', async () => {
    const { useDownloadStore } = await import('../src/renderer/stores/download')
    const { useDownloadAction } = await import('../src/renderer/composables/download-action')
    const store = useDownloadStore()
    store.assets = {
      mid: {
        songMid: 'mid',
        cachedQuality: null,
        downloadedQuality: 'flac',
        maxQuality: 'flac',
        taskStatus: null
      }
    }
    const { pendingDelete, requestDownload, confirmDownloadDelete } = useDownloadAction()

    await requestDownload({ songMid: 'mid', name: '晴天' }, 'flac')
    expect(startMany).not.toHaveBeenCalled()
    expect(pendingDelete.value).toEqual({ songMid: 'mid', name: '晴天' })

    await confirmDownloadDelete()
    expect(removeSong).toHaveBeenCalledWith('mid')
    expect(pendingDelete.value).toBeNull()
  })

  it('未下载时加入统一队列，取消删除不改动任何状态', async () => {
    const { useDownloadStore } = await import('../src/renderer/stores/download')
    const { useDownloadAction } = await import('../src/renderer/composables/download-action')
    const store = useDownloadStore()
    store.assets = {
      mid: {
        songMid: 'mid',
        cachedQuality: null,
        downloadedQuality: null,
        maxQuality: null,
        taskStatus: null
      }
    }
    const { pendingDelete, requestDownload, cancelDownloadDelete } = useDownloadAction()

    await requestDownload({ songMid: 'mid', name: '晴天' }, 'flac')
    expect(startMany).toHaveBeenCalledWith(['mid'], 'flac')
    expect(pendingDelete.value).toBeNull()

    pendingDelete.value = { songMid: 'mid', name: '晴天' }
    cancelDownloadDelete()
    expect(pendingDelete.value).toBeNull()
    expect(removeSong).not.toHaveBeenCalled()
  })

  it('模块级确认状态在多个调用方之间共享', async () => {
    const { useDownloadAction } = await import('../src/renderer/composables/download-action')
    const first = useDownloadAction()
    const second = useDownloadAction()

    first.pendingDelete.value = { songMid: 'mid', name: '晴天' }
    expect(second.pendingDelete.value).toEqual({ songMid: 'mid', name: '晴天' })
    second.cancelDownloadDelete()
    expect(first.pendingDelete.value).toBeNull()
  })
})
