import type { PlaylistDetail, PlaylistMeta } from '../../shared/types'
import { getCredential } from '../credential'
import { UpstreamError, musicu } from './client'
import { rawSongToSong } from './song'

interface RawPlaylistItem {
  dissid?: string | number
  disstid?: string | number
  tid?: string | number
  dirId?: string | number
  id?: string | number
  dissname?: string
  name?: string
  title?: string
  dirName?: string
  imgurl?: string
  picurl?: string
  cover?: string
  bigpicUrl?: string
  song_count?: number
  songnum?: number
  songNum?: number
  song_cnt?: number
}

interface PlaylistData {
  dirinfo?: {
    id?: string | number
    title?: string
    picurl?: string
    songnum?: number
  }
  songlist?: unknown[]
}

interface MineData {
  v_playlist?: RawPlaylistItem[]
  total?: number
}

function normalizeCover(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

function toMeta(raw: RawPlaylistItem): PlaylistMeta {
  return {
    id: String(raw.dissid ?? raw.disstid ?? raw.tid ?? raw.dirId ?? raw.id ?? ''),
    name: raw.dissname ?? raw.name ?? raw.title ?? raw.dirName ?? '',
    coverUrl: normalizeCover(raw.imgurl ?? raw.picurl ?? raw.cover ?? raw.bigpicUrl),
    songCount: Number(raw.song_count ?? raw.songnum ?? raw.songNum ?? raw.song_cnt ?? 0)
  }
}

/** 拉取歌单全部歌曲（上游单次上限 100，按页补齐）。 */
export async function getPlaylist(id: string): Promise<PlaylistDetail> {
  const playlistId = Number(id)
  if (!Number.isFinite(playlistId) || playlistId <= 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', `非法歌单 ID：${id}`)
  }

  const songs: ReturnType<typeof rawSongToSong>[] = []
  let meta: PlaylistMeta | null = null
  let total = 0

  for (let page = 0; page < 20; page += 1) {
    const data = await musicu<PlaylistData>(
      'music.srfDissInfo.DissInfo',
      'CgiGetDiss',
      {
        disstid: playlistId,
        dirid: 0,
        tag: true,
        song_begin: songs.length,
        song_num: 100,
        userinfo: true,
        orderlist: true,
        onlysonglist: false
      }
    )

    if (!meta) {
      if (!data.dirinfo) {
        throw new UpstreamError('UPSTREAM_CHANGED', '歌单响应缺少 dirinfo')
      }
      total = Number(data.dirinfo.songnum ?? 0)
      meta = {
        id: String(data.dirinfo.id ?? playlistId),
        name: data.dirinfo.title ?? '',
        coverUrl: normalizeCover(data.dirinfo.picurl),
        songCount: total
      }
    }

    const batch = data.songlist ?? []
    songs.push(...batch.map(rawSongToSong))
    if (batch.length === 0 || songs.length >= total || batch.length < 100) break
  }

  if (!meta) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌单响应为空')
  }
  meta.songCount = total || songs.length
  return { meta, songs }
}

/** 当前账号创建/收藏的歌单列表；未登录返回 AUTH_EXPIRED。 */
export async function listMine(): Promise<PlaylistMeta[]> {
  const credential = getCredential()
  if (!credential) {
    throw new UpstreamError('AUTH_EXPIRED', '未登录')
  }
  const data = await musicu<MineData>(
    'music.musicasset.PlaylistBaseRead',
    'GetPlaylistByUin',
    { uin: credential.musicid }
  )
  if (!Array.isArray(data.v_playlist)) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌单列表响应缺少 v_playlist')
  }
  return data.v_playlist
    .map(toMeta)
    .filter((playlist) => playlist.id.length > 0 && playlist.id !== '0')
}
