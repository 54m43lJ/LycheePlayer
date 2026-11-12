import { describe, expect, it, vi } from 'vitest'
import { fixture } from '../replay'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp', getAppPath: () => '/tmp' },
  safeStorage: { isEncryptionAvailable: () => false },
  protocol: { registerSchemesAsPrivileged: () => undefined },
  net: { fetch: () => Promise.reject(new Error('network disabled')) }
}))

function respond(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}

describe('api/catalog', () => {
  it('maps MV detail with singer, cover and publish date', async () => {
    vi.stubGlobal('fetch', async () => respond(fixture('mv-detail.json')))
    const { getMvDetail } = await import('../../src/main/api/mv')
    const detail = await getMvDetail('w0026q7f01a')
    expect(detail.mvId).toBe('w0026q7f01a')
    expect(detail.name).toBe('晴天')
    expect(detail.singerName).toBe('周杰伦')
    expect(detail.coverUrl.startsWith('https://')).toBe(true)
    expect(detail.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('passes hot / latest order to the artist song list', async () => {
    const orders: number[] = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const parsed = new URL(String(url))
      if (parsed.hostname === 'c.y.qq.com') return respond(fixture('singer-detail.json'))
      const data = parsed.searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { param?: { order?: number } }
      }
      orders.push(Number(payload.req_0?.param?.order))
      return respond(fixture('singer-songs.json'))
    })

    const { getArtist } = await import('../../src/main/api/artist')
    const hot = await getArtist('0025NhlN2yWrP4', 0, 'hot')
    expect(hot.name).toBe('周杰伦')
    expect(orders.at(-1)).toBe(1)
    await getArtist('0025NhlN2yWrP4', 0, 'latest')
    expect(orders.at(-1)).toBe(0)
  })

  it('falls back to singer profile when the legacy detail endpoint fails', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const parsed = new URL(String(url))
      if (parsed.hostname === 'c.y.qq.com') {
        return respond({ code: -1, subcode: -1, msg: '' })
      }
      const data = parsed.searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { method?: string }
      }
      if (payload.req_0?.method === 'GetSingerDetail') {
        return respond({
          code: 0,
          req_0: {
            code: 0,
            data: {
              singer_list: [
                {
                  basic_info: { singer_mid: '000ONBNm2PwShq', name: 'Charlie Jeer' },
                  ex_info: { desc: '萨克斯演奏家' },
                  pic: { pic: 'http://y.gtimg.cn/music/photo_new/T001R300x300M000000ONBNm2PwShq_1.jpg' }
                }
              ]
            }
          }
        })
      }
      return respond(fixture('singer-songs.json'))
    })

    const { getArtist } = await import('../../src/main/api/artist')
    const artist = await getArtist('000ONBNm2PwShq')
    expect(artist.name).toBe('Charlie Jeer')
    expect(artist.description).toBe('萨克斯演奏家')
    expect(artist.coverUrl).toBe(
      'https://y.gtimg.cn/music/photo_new/T001R300x300M000000ONBNm2PwShq_1.jpg'
    )
    expect(artist.songs.length).toBeGreaterThan(0)
  })

  it('loads artist songs without refetching artist info', async () => {
    const hosts: string[] = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const parsed = new URL(String(url))
      hosts.push(parsed.hostname)
      return respond(fixture('singer-songs.json'))
    })

    const { getArtistSongs } = await import('../../src/main/api/artist')
    const page = await getArtistSongs('0025NhlN2yWrP4', 0, 'latest')
    expect(page.songs.length).toBeGreaterThan(0)
    expect(page.total).toBeGreaterThan(0)
    expect(hosts).toEqual(['u.y.qq.com'])
  })

  it('loads artist albums, passes hot / latest order and maps album types', async () => {
    const orders: number[] = []
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { param?: { order?: number } }
      }
      orders.push(Number(payload.req_0?.param?.order))
      return respond({
        code: 0,
        req_0: {
          code: 0,
          data: {
            total: 4,
            albumList: [
              { albumMid: 'lp', albumName: 'LP', albumType: '录音室专辑', publishDate: '2020-01-01' },
              { albumMid: 'ep', albumName: 'EP', albumType: 'EP', publishDate: '2021-01-01' },
              { albumMid: 'live', albumName: 'Live', albumType: '演唱会', publishDate: '2022-01-01' },
              { albumMid: 'single', albumName: 'Single', albumType: 'Single', publishDate: '2023-01-01' }
            ]
          }
        }
      })
    })

    const { getArtistAlbums } = await import('../../src/main/api/artist')
    const hot = await getArtistAlbums('0025NhlN2yWrP4', 0, 'hot')
    expect(orders.at(-1)).toBe(1)
    expect(hot.total).toBe(4)
    expect(hot.hasMore).toBe(false)
    expect(hot.albums.map((album) => album.kind)).toEqual(['lp', 'ep', 'live', 'single'])
    expect(hot.albums[0]?.coverUrl).toContain('T002R500x500M000lp.jpg')

    await getArtistAlbums('0025NhlN2yWrP4', 0, 'latest')
    expect(orders.at(-1)).toBe(0)
  })

  it('uses detail and song-list responses for albums', async () => {
    vi.stubGlobal('fetch', async (url: string | URL) => {
      const data = new URL(String(url)).searchParams.get('data')
      const payload = JSON.parse(data ?? '{}') as {
        req_0?: { module?: string }
      }
      const module = payload.req_0?.module ?? ''
      return respond(
        module.includes('AlbumInfo')
          ? fixture('album-detail.json')
          : fixture('album-songs.json')
      )
    })
    const { getAlbum } = await import('../../src/main/api/album')
    const album = await getAlbum('000MkMni19ClKG')
    expect(album.name).toBe('叶惠美')
    expect(album.publishDate).toBe('2003-07-31')
    expect(album.singers).toEqual([{ mid: '0025NhlN2yWrP4', name: '周杰伦' }])
    expect(album.total).toBe(11)
    expect(album.songs).toHaveLength(5)
    expect(album.songs[0].songMid).toBe('003BkwkH0iS8Ko')
  })
})
