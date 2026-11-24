import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AudioCacheStored, DownloadTask } from '../src/shared/types'

const list = vi.fn()
const storage = vi.fn()
const assetStates = vi.fn()
const resumeAll = vi.fn()
const onStored = vi.fn(() => () => undefined)

function task(id: string): DownloadTask {
  return {
    id,
    songMid: `mid-${id}`,
    name: `Song ${id}`,
    singers: ['Singer'],
    albumName: 'Album',
    quality: 'flac',
    filePath: `/tmp/${id}.flac`,
    coverPath: null,
    status: 'pending',
    receivedBytes: 0,
    totalBytes: 0,
    error: '',
    source: 'network'
  }
}

beforeEach(() => {
  vi.stubGlobal('window', {
    lychee: { download: { list, storage, assetStates, resumeAll }, audioCache: { onStored } },
    setInterval: vi.fn(() => 1),
    clearInterval: vi.fn()
  })
  setActivePinia(createPinia())
  list.mockReset()
  storage.mockReset()
  assetStates.mockReset()
  resumeAll.mockReset()
  onStored.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('download store visibility', () => {
  it('loads tasks when the download page becomes visible', async () => {
    list.mockResolvedValue({ ok: true, data: [task('a'), task('b')] })
    storage.mockResolvedValue({
      ok: true,
      data: { directory: '/tmp', bytes: 0, freeBytes: 0 }
    })
    const { useDownloadStore } = await import('../src/renderer/stores/download')
    const store = useDownloadStore()

    store.setVisible(true)
    await vi.waitFor(() => expect(store.tasks).toHaveLength(2))
    expect(store.tasks.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('reloads tasks after reset while the page is still visible', async () => {
    list.mockResolvedValue({ ok: true, data: [task('a')] })
    storage.mockResolvedValue({
      ok: true,
      data: { directory: '/tmp', bytes: 0, freeBytes: 0 }
    })
    const { useDownloadStore } = await import('../src/renderer/stores/download')
    const store = useDownloadStore()

    store.setVisible(true)
    await vi.waitFor(() => expect(store.tasks).toHaveLength(1))

    store.reset()
    await vi.waitFor(() => expect(list).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(store.tasks).toHaveLength(1))
  })
})

describe('download store cache sync', () => {
  it('refreshes the song asset when a cache write completes', async () => {
    assetStates.mockResolvedValue({
      ok: true,
      data: [
        {
          songMid: 'mid-a',
          cachedQuality: '320k',
          downloadedQuality: null,
          taskStatus: null
        }
      ]
    })
    const { useDownloadStore } = await import('../src/renderer/stores/download')
    const store = useDownloadStore()
    const push = onStored.mock.calls[0][0] as (stored: AudioCacheStored) => void

    push({ songMid: 'mid-a', quality: '320k' })

    await vi.waitFor(() => expect(store.assets['mid-a']?.cachedQuality).toBe('320k'))
    expect(assetStates).toHaveBeenCalledWith(['mid-a'])
  })
})

describe('download store bulk resume', () => {
  it('resumes all paused tasks through one IPC call', async () => {
    resumeAll.mockResolvedValue({
      ok: true,
      data: [{ ...task('a'), status: 'pending' }, { ...task('b'), status: 'pending' }]
    })
    const { useDownloadStore } = await import('../src/renderer/stores/download')
    const store = useDownloadStore()
    store.tasks = [
      { ...task('a'), status: 'paused' },
      { ...task('b'), status: 'paused' }
    ]

    await store.resumeAll()

    expect(resumeAll).toHaveBeenCalledTimes(1)
    expect(store.tasks.map((item) => item.status)).toEqual(['pending', 'pending'])
  })
})
