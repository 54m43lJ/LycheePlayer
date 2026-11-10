import type { ArtistDetail, ArtistSongPage, ArtistSongSort, Song } from '../../shared/types'
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

interface SingerProfileData {
  singer_list?: Array<{
    basic_info?: { singer_mid?: string; name?: string }
    ex_info?: { desc?: string }
    pic?: { pic?: string }
  }>
}

interface SingerProfile {
  name: string
  description: string
  coverUrl: string
}

function artistCover(mid: string): string {
  return mid ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${mid}.jpg` : ''
}

function normalizeCover(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

async function fetchArtistInfo(mid: string): Promise<ArtistInfo | null> {
  try {
    const credential = getCredential()
    const data = await upstreamRequest<ArtistInfo | { data?: ArtistInfo }>({
      host: 'https://c.y.qq.com',
      path: '/v8/fcg-bin/fcg_v8_singer_detail_cp.fcg',
      params: { singermid: mid, format: 'json' },
      credential
    })
    const info = (data as { data?: ArtistInfo }).data ?? (data as ArtistInfo)
    // 部分歌手（如 Charlie Jeer）该接口只返回 code -1，改由 SingerInfoInter 兜底。
    return info?.getSingerInfo ? info : null
  } catch {
    return null
  }
}

/** 旧详情接口缺失时使用；可同时拿到名称、简介与头像。 */
async function fetchSingerProfile(mid: string): Promise<SingerProfile | null> {
  try {
    const data = await musicu<SingerProfileData>(
      'music.musichallSinger.SingerInfoInter',
      'GetSingerDetail',
      {
        singer_mids: [mid],
        group_singer: 1,
        wiki_singer: 1,
        ex_singer: 1,
        pic: 1,
        photos: 1
      }
    )
    const singer = data.singer_list?.[0]
    if (!singer) return null
    return {
      name: singer.basic_info?.name ?? '',
      description: singer.ex_info?.desc ?? '',
      coverUrl: normalizeCover(singer.pic?.pic)
    }
  } catch {
    return null
  }
}

function singerNameFromSongs(songs: Song[], mid: string): string {
  for (const song of songs) {
    const matched = song.singers.find((singer) => singer.mid === mid && singer.name)
    if (matched) return matched.name
  }
  return songs.find((song) => song.singers[0]?.name)?.singers[0]?.name ?? ''
}

async function fetchArtistSongs(
  mid: string,
  offset: number,
  sort: ArtistSongSort
): Promise<ArtistSongPage> {
  const data = await musicu<ArtistSongData>(
    'musichall.song_list_server',
    'GetSingerSongList',
    {
      singerMid: mid,
      // 实测 order=1 返回最热，0 及其它值都退回最新；这里只暴露两种排序。
      order: sort === 'hot' ? 1 : 0,
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

export async function getArtistSongs(
  mid: string,
  offset = 0,
  sort: ArtistSongSort = 'hot'
): Promise<ArtistSongPage> {
  const id = mid.trim()
  if (!id) throw new UpstreamError('UPSTREAM_CHANGED', '歌手 mid 为空')
  return fetchArtistSongs(id, offset, sort)
}

export async function getArtist(
  mid: string,
  offset = 0,
  sort: ArtistSongSort = 'hot'
): Promise<ArtistDetail> {
  const id = mid.trim()
  if (!id) throw new UpstreamError('UPSTREAM_CHANGED', '歌手 mid 为空')
  const [info, page] = await Promise.all([
    fetchArtistInfo(id),
    fetchArtistSongs(id, offset, sort)
  ])
  let name = info?.getSingerInfo?.Fsinger_name ?? ''
  let description = info?.singerBrief ?? ''
  let coverUrl = artistCover(id)
  const songCount = Number(info?.total_song ?? page.total)
  const albumCount = Number(info?.total_album ?? 0)
  if (!info) {
    const profile = await fetchSingerProfile(id)
    name = profile?.name || singerNameFromSongs(page.songs, id)
    description = profile?.description ?? ''
    coverUrl = profile?.coverUrl || coverUrl
  }
  return {
    mid: info?.getSingerInfo?.Fsinger_mid || id,
    name,
    description,
    coverUrl,
    songCount,
    albumCount,
    songs: page.songs,
    total: page.total,
    hasMore: page.hasMore
  }
}
