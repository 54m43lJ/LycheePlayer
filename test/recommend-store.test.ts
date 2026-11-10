import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type {
  IpcResult,
  RecommendFeed,
  RecommendSection,
  Song
} from '../src/shared/types'

const noop = (): void => undefined

function song(id: string): Song {
  return {
    songMid: id,
    songId: id,
    name: id,
    singers: [],
    album: { mid: '', name: '' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false }
  }
}

function section(id: RecommendSection['id'], count = 1): RecommendSection {
  return {
    id,
    title: id,
    songs: Array.from({ length: count }, (_, index) => song(`${id}-${index}`)),
    playlists: [],
    refreshedAtMs: Date.now()
  }
}

function ok<T>(data: T): IpcResult<T> {
  return { ok: true, data }
}

function feed(id: RecommendSection['id'], count = 1): RecommendFeed {
  return { sections: [section(id, count)] }
}

let getMock: ReturnType<typeof vi.fn>
let refreshMock: ReturnType<typeof vi.fn>
let cancelMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  setActivePinia(createPinia())
  getMock = vi.fn()
  refreshMock = vi.fn()
  cancelMock = vi.fn(() => Promise.resolve(ok(null)))
  vi.stubGlobal('window', {
    lychee: {
      recommend: {
        get: getMock,
        refresh: refreshMock,
        cancel: cancelMock
      }
    },
    setTimeout,
    clearTimeout
  })
})

describe('recommend store progressive loading', () => {
  it('fills sections one by one instead of waiting for the whole feed', async () => {
    const pending = new Map<string, (value: IpcResult<RecommendFeed>) => void>()
    getMock.mockImplementation(
      (id: string) =>
        new Promise<IpcResult<RecommendFeed>>((resolve) => {
          pending.set(id, resolve)
        })
    )
    const { useRecommendStore } = await import('../src/renderer/stores/recommend')
    const store = useRecommendStore()

    const loading = store.load()
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    expect(getMock.mock.calls[0][0]).toBe('daily')
    expect(store.feed.sections.map((item) => item.id)).toEqual(['daily', 'radar', 'guess'])
    expect(store.feed.sections.every((item) => item.refreshedAtMs === 0)).toBe(true)

    pending.get('daily')?.(ok(feed('daily', 2)))
    await vi.waitFor(() => expect(store.feed.sections[0].songs).toHaveLength(2))
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(2))
    expect(getMock.mock.calls[1][0]).toBe('radar')
    expect(store.feed.sections[1].refreshedAtMs).toBe(0)

    pending.get('radar')?.(ok(feed('radar', 1)))
    await vi.waitFor(() => expect(store.feed.sections[1].songs).toHaveLength(1))
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(3))

    pending.get('guess')?.(ok(feed('guess', 1)))
    await loading
    expect(store.feed.sections.map((item) => item.songs.length)).toEqual([2, 1, 1])
    expect(store.loading).toBe(false)
  })

  it('cancels the in-flight section when leaving the page', async () => {
    let resolveDaily: (value: IpcResult<RecommendFeed>) => void = noop
    getMock.mockReturnValue(
      new Promise<IpcResult<RecommendFeed>>((resolve) => {
        resolveDaily = resolve
      })
    )
    const { useRecommendStore } = await import('../src/renderer/stores/recommend')
    const store = useRecommendStore()

    const loading = store.load()
    await vi.waitFor(() => expect(getMock).toHaveBeenCalledTimes(1))
    const token = getMock.mock.calls[0][1]
    store.cancel()

    expect(cancelMock).toHaveBeenCalledWith(token)
    expect(store.loading).toBe(false)

    resolveDaily(ok(feed('daily', 2)))
    await loading
    expect(store.feed.sections[0].refreshedAtMs).toBe(0)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes a single section through the force endpoint', async () => {
    refreshMock.mockResolvedValue(ok(feed('radar', 3)))
    const { useRecommendStore } = await import('../src/renderer/stores/recommend')
    const store = useRecommendStore()

    await store.refreshSection('radar')

    expect(refreshMock).toHaveBeenCalledTimes(1)
    expect(refreshMock.mock.calls[0][0]).toBe('radar')
    expect(store.feed.sections.find((item) => item.id === 'radar')?.songs).toHaveLength(3)
    expect(getMock).not.toHaveBeenCalled()
  })
})
