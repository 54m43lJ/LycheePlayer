import type { ArtistDetail, Song } from '../../shared/types'
import { CATALOG_PAGE_SIZE } from '../../shared/constants'
import { getCredential } from '../credential'
import { UpstreamError, musicu, upstreamRequest } from './client'
import { rawSongToSong } from './song'

interface ArtistInfo {
  getSingerInfo?: {
    Fsinger_mid?: string
    Fsinger_name?: string
    Fother_name?: string
  }
  singerBrief?: string
  total_song?: number
  total_album?: number
}

interface ArtistSongNode {
  totalNum?: number
  songList?: Array<{ songInfo?: unknown }>
}

interface ArtistSongData extends ArtistSongNode {
  singerSongList?: { data?: ArtistSongNode }
}

function artistCover(mid: string): string {
  return mid ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${mid}.jpg` : ''
}

async function fetchArtistInfo(mid: string): Promise<ArtistInfo> {
  const credential = getCredential()
  const data = await upstreamRequest<ArtistInfo | { data?: ArtistInfo }>({
    host: 'https://c.y.qq.com',
    path: '/v8/fcg-bin/fcg_v8_singer_detail_cp.fcg',
    params: { singermid: mid, format: 'json' },
    credential
  })
  const info = (data as { data?: ArtistInfo }).data ?? (data as ArtistInfo)
  if (!info?.getSingerInfo) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌手详情响应缺少 getSingerInfo')
  }
  return info
}

async function fetchArtistSongs(
  mid: string,
  offset: number
): Promise<{ songs: Song[]; total: number; hasMore: boolean }> {
  const data = await musicu<ArtistSongData>(
    'musichall.song_list_server',
    'GetSingerSongList',
    {
      singerMid: mid,
      order: 1,
      begin: Math.max(0, Math.floor(offset)),
      num: CATALOG_PAGE_SIZE
    }
  )
  const node = data.singerSongList?.data ?? data
  const list = node.songList ?? []
  const total = Number(node.totalNum ?? list.length)
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

export async function getArtist(mid: string, offset = 0): Promise<ArtistDetail> {
  const id = mid.trim()
  if (!id) throw new UpstreamError('UPSTREAM_CHANGED', '歌手 mid 为空')
  const [info, page] = await Promise.all([fetchArtistInfo(id), fetchArtistSongs(id, offset)])
  const name = info.getSingerInfo?.Fsinger_name ?? ''
  return {
    mid: info.getSingerInfo?.Fsinger_mid || id,
    name,
    description: info.singerBrief ?? '',
    coverUrl: artistCover(id),
    songCount: Number(info.total_song ?? page.total),
    albumCount: Number(info.total_album ?? 0),
    songs: page.songs,
    total: page.total,
    hasMore: page.hasMore
  }
}
