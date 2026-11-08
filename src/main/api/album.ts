import type { AlbumDetail, Singer, Song } from '../../shared/types'
import { CATALOG_PAGE_SIZE } from '../../shared/constants'
import { UpstreamError, musicu } from './client'
import { rawSongToSong } from './song'

interface AlbumInfoData {
  basicInfo?: {
    albumMid?: string
    albumName?: string
    publishDate?: string
    desc?: string
  }
  singer?: {
    singerList?: Array<{ mid?: string; name?: string }>
  }
}

interface AlbumSongData {
  totalNum?: number
  songList?: Array<{ songInfo?: unknown }>
}

function albumCover(mid: string): string {
  return mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${mid}.jpg` : ''
}

async function fetchAlbumInfo(mid: string): Promise<AlbumInfoData> {
  const data = await musicu<AlbumInfoData>(
    'music.musichallAlbum.AlbumInfoServer',
    'GetAlbumDetail',
    { albumMid: mid }
  )
  if (!data.basicInfo) {
    throw new UpstreamError('UPSTREAM_CHANGED', '专辑详情响应缺少 basicInfo')
  }
  return data
}

async function fetchAlbumSongs(
  mid: string,
  offset: number
): Promise<{ songs: Song[]; total: number; hasMore: boolean }> {
  const data = await musicu<AlbumSongData>(
    'music.musichallAlbum.AlbumSongList',
    'GetAlbumSongList',
    {
      albumMid: mid,
      order: 0,
      begin: Math.max(0, Math.floor(offset)),
      num: CATALOG_PAGE_SIZE
    }
  )
  const list = data.songList ?? []
  const total = Number(data.totalNum ?? list.length)
  const songs = list
    .map((item) => item.songInfo)
    .filter((song): song is Record<string, unknown> => Boolean(song))
    .map(rawSongToSong)
  return {
    songs,
    total,
    hasMore: songs.length === CATALOG_PAGE_SIZE && offset + songs.length < total
  }
}

export async function getAlbum(mid: string, offset = 0): Promise<AlbumDetail> {
  const id = mid.trim()
  if (!id) throw new UpstreamError('UPSTREAM_CHANGED', '专辑 mid 为空')
  const [info, page] = await Promise.all([fetchAlbumInfo(id), fetchAlbumSongs(id, offset)])
  const singers: Singer[] = (info.singer?.singerList ?? [])
    .map((singer) => ({ mid: singer.mid ?? '', name: (singer.name ?? '').trim() }))
    .filter((singer) => singer.name.length > 0 || singer.mid.length > 0)
  return {
    mid: info.basicInfo?.albumMid || id,
    name: info.basicInfo?.albumName ?? '',
    coverUrl: albumCover(id),
    description: info.basicInfo?.desc ?? '',
    publishDate: info.basicInfo?.publishDate ?? '',
    singers,
    songs: page.songs,
    total: page.total,
    hasMore: page.hasMore
  }
}
