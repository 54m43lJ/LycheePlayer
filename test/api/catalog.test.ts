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
