import { describe, expect, it, vi } from 'vitest'
import { fixture, musicuFixture } from '../replay'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

vi.mock('../../src/main/credential', () => ({
  getCredential: () => ({ musicid: '100', musickey: 'key' })
}))

const rawSong = {
  id: 1,
  mid: '001Recommend',
  name: '推荐歌曲',
  interval: 180,
  singer: [{ mid: '001Singer', name: '周杰伦' }],
  album: { mid: '001Album', name: '叶惠美' },
  pay: { pay_play: 0 }
}

function respond(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('api/recommend', () => {
  it('maps radar and guess sections from their upstream payloads', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const module = String(
        (JSON.parse(data ?? '{}') as { req_0?: { module?: string } }).req_0?.module ?? ''
      )
      if (module.includes('RecommendFeed')) return respond(fixture('recommend-anonymous.json'))
      if (module.includes('TrackRelationServer')) {
        return respond(musicuFixture({ VecSongs: [{ Track: rawSong }], HasMore: false }))
      }
      if (module.includes('mb_track_radio_svr')) {
        return respond(musicuFixture({ tracks: [rawSong, rawSong] }))
      }
      return respond(musicuFixture({}))
    })

    const { fetchRecommendFeed, clearRecommendCache } = await import(
      '../../src/main/api/recommend'
    )
    clearRecommendCache()
    const feed = await fetchRecommendFeed(true)
    const radar = feed.sections.find((section) => section.id === 'radar')
    const guess = feed.sections.find((section) => section.id === 'guess')
    expect(radar?.songs[0]).toMatchObject({
      songMid: '001Recommend',
      name: '推荐歌曲',
      singers: [{ mid: '001Singer', name: '周杰伦' }]
    })
    // 猜你喜欢按 mid 去重。
    expect(guess?.songs).toHaveLength(1)
  })

  it('stops before any request when the page signal is already aborted', async () => {
    let calls = 0
    vi.stubGlobal('fetch', async () => {
      calls += 1
      return respond(musicuFixture({}))
    })
    const { fetchRecommendFeed, clearRecommendCache } = await import(
      '../../src/main/api/recommend'
    )
    clearRecommendCache()
    const controller = new AbortController()
    controller.abort()

    await expect(fetchRecommendFeed(true, undefined, controller.signal)).rejects.toThrow()
    expect(calls).toBe(0)
  })
})
