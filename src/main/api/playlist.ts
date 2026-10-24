import type {
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistPage,
  PlaylistSnapshot
} from '../../shared/types'
import { PLAYLIST_PAGE_MAX, PLAYLIST_PAGE_SIZE } from '../../shared/constants'
import { getCredential } from '../credential'
import { readPlaylistCache, writePlaylistCache } from '../cache/playlist'
import { UpstreamError, musicu } from './client'
import { rawSongToSong } from './song'

interface RawPlaylistItem {
  dissid?: string | number
  disstid?: string | number
  tid?: string | number
  dirId?: string | number
  dirid?: string | number
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

const FAVORITES_ID = 'liked'
const FAVORITES_NAME = '我喜欢'

function cacheScope(): string {
  return getCredential()?.musicid ?? 'anonymous'
}

function normalizeCover(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

function isFavoritesId(id: string): boolean {
  return id === FAVORITES_ID
}

function toMeta(raw: RawPlaylistItem, editable: boolean): PlaylistMeta {
  const dirId = Number(raw.dirId ?? raw.dirid ?? 0)
  const favorites = dirId === 201
  return {
    id: favorites ? FAVORITES_ID : String(raw.dissid ?? raw.disstid ?? raw.tid ?? raw.dirId ?? raw.id ?? ''),
    name: favorites ? FAVORITES_NAME : (raw.dissname ?? raw.name ?? raw.title ?? raw.dirName ?? ''),
    coverUrl: normalizeCover(raw.imgurl ?? raw.picurl ?? raw.cover ?? raw.bigpicUrl),
    songCount: Number(raw.song_count ?? raw.songnum ?? raw.songNum ?? raw.song_cnt ?? 0),
    kind: favorites ? 'favorites' : 'normal',
    editable
  }
}

function validId(id: string): boolean {
  if (isFavoritesId(id)) return true
  const playlistId = Number(id)
  return Number.isFinite(playlistId) && playlistId > 0
}

async function requestPage(id: string, offset: number): Promise<PlaylistPage> {
  const favorites = isFavoritesId(id)
  const data = await musicu<PlaylistData>('music.srfDissInfo.DissInfo', 'CgiGetDiss', {
    disstid: favorites ? 0 : Number(id),
    dirid: favorites ? 201 : 0,
    tag: true,
    song_begin: offset,
    song_num: PLAYLIST_PAGE_SIZE,
    userinfo: true,
    orderlist: true,
    onlysonglist: false
  })

  const total = Number(data.dirinfo?.songnum ?? 0)
  const meta: PlaylistMeta = favorites
    ? {
        id: FAVORITES_ID,
        name: FAVORITES_NAME,
        coverUrl: normalizeCover(data.dirinfo?.picurl),
        songCount: total,
        kind: 'favorites',
        editable: true
      }
    : {
        id: String(data.dirinfo?.id ?? id),
        name: data.dirinfo?.title ?? '',
        coverUrl: normalizeCover(data.dirinfo?.picurl),
        songCount: total,
        kind: 'normal',
        editable: false
      }
  if (!data.dirinfo && !favorites) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌单响应缺少 dirinfo')
  }

  const songs = (data.songlist ?? []).map(rawSongToSong)
  return {
    meta,
    songs,
    offset,
    total: total || offset + songs.length,
    hasMore:
      songs.length === PLAYLIST_PAGE_SIZE && (total === 0 || offset + songs.length < total)
  }
}

/** 拉取歌单分页；分页只服务加载，缓存始终是整份歌单。 */
export async function fetchPlaylistPage(id: string, offset: number): Promise<PlaylistPage> {
  if (!validId(id)) {
    throw new UpstreamError('UPSTREAM_CHANGED', `非法歌单 ID：${id}`)
  }
  const start = Math.max(0, Math.floor(offset / PLAYLIST_PAGE_SIZE) * PLAYLIST_PAGE_SIZE)
  if (start > PLAYLIST_PAGE_MAX * PLAYLIST_PAGE_SIZE) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌单分页超出上限')
  }
  return requestPage(id, start)
}

/** 读取整份歌单缓存；不完整快照通过 complete=false 标记。 */
export function getCachedPlaylist(id: string): PlaylistCacheEntry | null {
  if (!validId(id)) return null
  return readPlaylistCache(cacheScope(), id)
}

/** 整份歌单加载完成后写缓存；分页状态不落盘。 */
export async function savePlaylistSnapshot(
  id: string,
  snapshot: PlaylistSnapshot,
  complete: boolean
): Promise<void> {
  if (!validId(id)) {
    throw new UpstreamError('UPSTREAM_CHANGED', `非法歌单 ID：${id}`)
  }
  if (
    !snapshot ||
    !snapshot.meta ||
    !Array.isArray(snapshot.songs) ||
    !Number.isFinite(snapshot.total)
  ) {
    throw new UpstreamError('INTERNAL', '歌单缓存快照格式错误')
  }
  const meta =
    snapshot.meta.id === id ? snapshot.meta : { ...snapshot.meta, id }
  await writePlaylistCache(cacheScope(), {
    meta,
    songs: snapshot.songs,
    total: snapshot.total,
    complete,
    fetchedAtMs: Date.now()
  })
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
    { uin: credential.musicid },
    { credential }
  )
  if (!Array.isArray(data.v_playlist)) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌单列表响应缺少 v_playlist')
  }
  return data.v_playlist
    .map((item) => toMeta(item, true))
    .filter((playlist) => playlist.id.length > 0 && playlist.id !== '0')
}
