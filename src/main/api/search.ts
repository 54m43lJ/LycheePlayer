import type { PlaylistMeta, SearchRequest, SearchResult, Singer } from '../../shared/types'
import { UpstreamError, musicu } from './client'
import { rawSongToSong } from './song'

interface RawSinger {
  singerMID?: string
  mid?: string
  singerName?: string
  name?: string
}

interface RawAlbum {
  albumMID?: string
  mid?: string
  albumName?: string
  name?: string
}

interface RawPlaylist {
  dissid?: string | number
  disstid?: string | number
  id?: string | number
  dissname?: string
  name?: string
  imgurl?: string
  picurl?: string
  cover?: string
  song_count?: number
  songnum?: number
}

interface SearchData {
  body?: {
    song?: { list?: unknown[] }
    singer?: { list?: RawSinger[] }
    album?: { list?: RawAlbum[] }
    songlist?: { list?: RawPlaylist[] }
    meta?: { sum?: number; estimate_sum?: number }
  }
}

const SEARCH_TYPE = {
  song: 0,
  singer: 1,
  album: 2,
  playlist: 3
} as const

// 推荐值 350 ms；搜索空结果重试延迟。
const SEARCH_EMPTY_RETRY_MS = 350
// 推荐值 1；搜索空结果重试次数。
const SEARCH_EMPTY_RETRY_COUNT = 1
// 推荐值 100；search.byType 页码上限。
const SEARCH_PAGE_NO_MAX = 100
// 推荐值 20；搜索每页默认条数。
const SEARCH_PAGE_SIZE_DEFAULT = 20
// 推荐值 50；搜索每页最大条数。
const SEARCH_PAGE_SIZE_MAX = 50

function coverUrl(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

function toSinger(raw: RawSinger): Singer {
  return {
    mid: raw.singerMID ?? raw.mid ?? '',
    name: raw.singerName ?? raw.name ?? ''
  }
}

function toPlaylist(raw: RawPlaylist): PlaylistMeta {
  return {
    id: String(raw.dissid ?? raw.disstid ?? raw.id ?? ''),
    name: raw.dissname ?? raw.name ?? '',
    coverUrl: coverUrl(raw.imgurl ?? raw.picurl ?? raw.cover),
    songCount: Number(raw.song_count ?? raw.songnum ?? 0)
  }
}

function parseSearch(data: SearchData): SearchResult {
  const body = data.body
  if (!body) {
    throw new UpstreamError('UPSTREAM_CHANGED', '搜索响应缺少 body')
  }
  return {
    songs: (body.song?.list ?? []).map(rawSongToSong),
    singers: (body.singer?.list ?? []).map(toSinger).filter((singer) => singer.mid.length > 0),
    albums: (body.album?.list ?? [])
      .map((album) => ({
        mid: album.albumMID ?? album.mid ?? '',
        name: album.albumName ?? album.name ?? ''
      }))
      .filter((album) => album.mid.length > 0),
    playlists: (body.songlist?.list ?? [])
      .map(toPlaylist)
      .filter((playlist) => playlist.id.length > 0),
    total: Number(body.meta?.sum ?? body.meta?.estimate_sum ?? 0)
  }
}

function isEmpty(result: SearchResult): boolean {
  return (
    result.songs.length === 0 &&
    result.singers.length === 0 &&
    result.albums.length === 0 &&
    result.playlists.length === 0
  )
}

/** 类型搜索；上游偶发返回空结果，空页重试一次以区分真空与瞬时异常。 */
export async function searchByType(req: SearchRequest): Promise<SearchResult> {
  const keyword = req.keyword.trim()
  if (!keyword) {
    return { songs: [], singers: [], albums: [], playlists: [], total: 0 }
  }
  const pageNo = Math.max(1, Math.min(SEARCH_PAGE_NO_MAX, Math.floor(req.pageNo) || 1))
  const pageSize = Math.max(
    1,
    Math.min(SEARCH_PAGE_SIZE_MAX, Math.floor(req.pageSize) || SEARCH_PAGE_SIZE_DEFAULT)
  )
  const body = {
    num_per_page: pageSize,
    page_num: pageNo,
    query: keyword,
    search_type: SEARCH_TYPE[req.type],
    searchid: String(Date.now())
  }

  for (let attempt = 0; attempt <= SEARCH_EMPTY_RETRY_COUNT; attempt += 1) {
    const data = await musicu<SearchData>(
      'music.search.SearchCgiService',
      'DoSearchForQQMusicDesktop',
      body,
      { comm: false }
    )
    const result = parseSearch(data)
    if (!isEmpty(result) || attempt === SEARCH_EMPTY_RETRY_COUNT) return result
    await new Promise((resolve) => setTimeout(resolve, SEARCH_EMPTY_RETRY_MS))
  }
  return { songs: [], singers: [], albums: [], playlists: [], total: 0 }
}
