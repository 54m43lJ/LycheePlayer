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
                  subtitle: ' 电影《测试》插曲 ',
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
    expect(result.songs[0].subtitle).toBe('电影《测试》插曲')
    expect(result.songs[1].name).toBe('Company')
    expect(result.songs[1].subtitle).toBe('')
  })

  it('reads the total from top-level meta and maps singer avatars', async () => {
    replay({
      code: 0,
      req_0: {
        code: 0,
        data: {
          meta: { sum: 8, estimate_sum: 8, nextpage: 2 },
          body: {
            singer: {
              list: [
                {
                  singerMID: '0025NhlN2yWrP4',
                  singerName: '周杰伦',
                  singerPic: 'http://y.gtimg.cn/music/photo_new/T001R150x150M0000025NhlN2yWrP4_11.jpg'
                }
              ]
            }
          }
        }
      }
    })

    const { searchByType } = await import('../../src/main/api/search')
    const result = await searchByType({
      type: 'singer',
      keyword: '周杰伦',
      pageNo: 1,
      pageSize: 20
    })

    expect(result.total).toBe(8)
    expect(result.hasMore).toBe(true)
    expect(result.singers[0]).toMatchObject({
      mid: '0025NhlN2yWrP4',
      name: '周杰伦',
      avatarUrl:
        'https://y.gtimg.cn/music/photo_new/T001R150x150M0000025NhlN2yWrP4_11.jpg'
    })
  })

  it('uses the fixed singer page size of 24', async () => {
    const calls = replay({
      code: 0,
      req_0: {
        code: 0,
        data: {
          meta: { sum: 1 },
          body: {
            singer: {
              list: [{ singerMID: 'mid', singerName: '歌手' }]
            }
          }
        }
      }
    })

    const { searchByType } = await import('../../src/main/api/search')
    await searchByType({
      type: 'singer',
      keyword: '歌手',
      pageNo: 1,
      pageSize: 48
    })

    const payload = JSON.parse(
      new URL(calls[0]!.url).searchParams.get('data') ?? '{}'
    ) as { req_0?: { param?: { num_per_page?: number } } }
    expect(payload.req_0?.param?.num_per_page).toBe(24)
  })

  it('routes the mv type to MV search with pagination metadata', async () => {
    replay({
      code: 0,
      req_0: {
        code: 0,
        data: {
          meta: { sum: 598, estimate_sum: 1895, nextpage: -1 },
          body: {
            mv: {
              list: [
                {
                  v_id: 'w0026q7f01a',
                  mv_name: '晴天',
                  mv_pic_url: 'http://y.gtimg.cn/music/photo_new/T015R640x360M10300061J2t0b0PPW.jpg',
                  singer_list: [{ mid: '0025NhlN2yWrP4', name: '周杰伦' }]
                }
              ]
            }
          }
        }
      }
    })

    const { searchByType } = await import('../../src/main/api/search')
    const result = await searchByType({
      type: 'mv',
      keyword: '周杰伦',
      pageNo: 2,
      pageSize: 20
    })

    expect(result.total).toBe(598)
    expect(result.hasMore).toBe(false)
    expect(result.mvs).toEqual([
      {
        mvId: 'w0026q7f01a',
        name: '晴天',
        singerName: '周杰伦',
        singers: [{ mid: '0025NhlN2yWrP4', name: '周杰伦' }],
        coverUrl:
          'https://y.gtimg.cn/music/photo_new/T015R640x360M10300061J2t0b0PPW.jpg'
      }
    ])
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
