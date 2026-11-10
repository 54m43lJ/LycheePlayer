import { describe, expect, it, vi } from 'vitest'
import { fixture, replay } from '../replay'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

describe('api/search', () => {
  it('maps upstream song search into the shared SearchResult model', async () => {
    replay(fixture('search-song.json'))
    const { searchByType } = await import('../../src/main/api/search')
    const result = await searchByType({
      type: 'song',
      keyword: '晴天',
      pageNo: 1,
      pageSize: 20
    })

    expect(result.total).toBe(1)
    expect(result.songs).toHaveLength(1)
    expect(result.songs[0]).toMatchObject({
      songMid: '001SongMid',
      songId: '123456',
      name: '晴天',
      durationMs: 269000,
      album: { mid: '001Album', name: '叶惠美' },
      pay: { free: false, vip: true, album: false }
    })
    expect(result.songs[0].singers).toEqual([{ mid: '001Singer', name: '周杰伦' }])
  })

  it('prefers the decorated title and trims trailing whitespace', async () => {
    replay({
      code: 0,
      req_0: {
        code: 0,
        data: {
          body: {
            song: {
              list: [
                {
                  id: 1,
                  mid: '001BigDawgs',
                  name: 'Big Dawgs ',
                  title: 'Big Dawgs (Remix|Explicit)',
                  interval: 200,
                  singer: [{ mid: '001Singer', name: ' Hanumankind ' }],
                  album: { mid: '001Album', name: ' Big Dawgs (Remix) [Explicit] ' },
                  pay: { pay_play: 1, price_album: 0 }
                },
                {
                  id: 2,
                  mid: '002Company',
                  name: '  Company   ',
                  interval: 180,
                  singer: [{ mid: '', name: 'Unknown' }],
                  album: { mid: '', name: '' },
                  pay: { pay_play: 0, price_album: 0 }
                }
              ]
            },
            meta: { sum: 2 }
          }
        }
      }
    })

    const { searchByType } = await import('../../src/main/api/search')
    const result = await searchByType({
      type: 'song',
      keyword: 'Big Dawgs',
      pageNo: 1,
      pageSize: 20
    })
    expect(result.songs[0].name).toBe('Big Dawgs (Remix|Explicit)')
    expect(result.songs[0].album.name).toBe('Big Dawgs (Remix) [Explicit]')
    expect(result.songs[0].singers).toEqual([{ mid: '001Singer', name: 'Hanumankind' }])
    expect(result.songs[1].name).toBe('Company')
  })

  it('returns an empty result for a blank keyword without calling upstream', async () => {
    const calls = replay({})
    const { searchByType } = await import('../../src/main/api/search')
    const result = await searchByType({
      type: 'song',
      keyword: '   ',
      pageNo: 1,
      pageSize: 20
    })
    expect(result.songs).toHaveLength(0)
    expect(calls).toHaveLength(0)
  })
})
