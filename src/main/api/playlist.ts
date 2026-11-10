import type {
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistPage,
  PlaylistSnapshot
} from '../../shared/types'
import {
  FAVORITES_PLAYLIST_ID,
  PLAYLIST_FETCH_MISSING_MIN,
  PLAYLIST_FETCH_MISSING_RATIO,
  PLAYLIST_FETCH_PAGE_MAX,
  PLAYLIST_FETCH_PAGE_SIZE,
  PLAYLIST_PAGE_MAX,
  PLAYLIST_PAGE_SIZE
} from '../../shared/constants'
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
    dirid?: string | number
    owndir?: string | number
    host_uin?: string | number
    creator?: { musicid?: string | number }
  }
  songlist?: unknown[]
}

interface MineData {
  v_playlist?: RawPlaylistItem[]
  total?: number
}

const FAVORITES_NAME = '我喜欢'

function cacheScope(): string {
  return getCredential()?.musicid ?? 'anonymous'
}

function normalizeCover(value: string | undefined): string {
  if (!value) return ''
  return value.startsWith('http://') ? `https://${value.slice(7)}` : value
}

function isFavoritesId(id: string): boolean {
  return id === FAVORITES_PLAYLIST_ID
}

function toMeta(raw: RawPlaylistItem, editable: boolean): PlaylistMeta {
  const dirId = Number(raw.dirId ?? raw.dirid ?? 0)
  const favorites = dirId === 201
  return {
    id: favorites ? FAVORITES_PLAYLIST_ID : String(raw.dissid ?? raw.disstid ?? raw.tid ?? raw.dirId ?? raw.id ?? ''),
    dirId: dirId > 0 ? dirId : undefined,
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

/** 判断歌单详情是否属于当前账号：优先使用上游 owndir 标记，缺失时回退创建者 ID。 */
function canEdit(data: PlaylistData): boolean {
  const credential = getCredential()
  if (!credential) return false
  if (Number(data.dirinfo?.owndir ?? 0) === 1) return true
  const owner = Number(data.dirinfo?.creator?.musicid ?? data.dirinfo?.host_uin ?? 0)
  const me = Number(credential.musicid)
  return Number.isSafeInteger(me) && me > 0 && owner === me
}

async function requestPage(
  id: string,
  offset: number,
  pageSize: number,
  signal?: AbortSignal
): Promise<PlaylistPage> {
  const favorites = isFavoritesId(id)
  const data = await musicu<PlaylistData>(
    'music.srfDissInfo.DissInfo',
    'CgiGetDiss',
    {
      disstid: favorites ? 0 : Number(id),
      dirid: favorites ? 201 : 0,
      tag: true,
      song_begin: offset,
      song_num: pageSize,
      userinfo: true,
      orderlist: true,
      onlysonglist: false
    },
    { signal }
  )

  const total = Number(data.dirinfo?.songnum ?? 0)
  const meta: PlaylistMeta = favorites
    ? {
        id: FAVORITES_PLAYLIST_ID,
        dirId: 201,
        name: FAVORITES_NAME,
        coverUrl: normalizeCover(data.dirinfo?.picurl),
        songCount: total,
        kind: 'favorites',
        editable: true
      }
    : {
        id: String(data.dirinfo?.id ?? id),
        dirId: Number(data.dirinfo?.dirid ?? 0) > 0 ? Number(data.dirinfo?.dirid) : undefined,
        name: data.dirinfo?.title ?? '',
        coverUrl: normalizeCover(data.dirinfo?.picurl),
        songCount: total,
        kind: 'normal',
        editable: canEdit(data)
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
      total === 0 ? songs.length >= pageSize : offset + pageSize < total
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
  return requestPage(id, start, PLAYLIST_PAGE_SIZE)
}

/**
 * 后台拉取完整歌单快照：固定 offset 大页扫描，全部成功且覆盖足够后才返回。
 * 任一分页失败、出现空页、超出页数上限或数量校验不通过都会抛错，调用方保留旧内容。
 */
export async function fetchPlaylistSnapshot(
  id: string,
  signal?: AbortSignal
): Promise<PlaylistSnapshot> {
  if (!validId(id)) {
    throw new UpstreamError('UPSTREAM_CHANGED', `非法歌单 ID：${id}`)
  }
  const songs: PlaylistSnapshot['songs'] = []
  const seen = new Set<string>()
  let meta: PlaylistMeta | null = null
  let total = 0
  let offset = 0
  let pages = 0
  for (;;) {
    signal?.throwIfAborted()
    if (pages >= PLAYLIST_FETCH_PAGE_MAX) {
      throw new UpstreamError('UPSTREAM_CHANGED', '歌单拉取页数超出上限')
    }
    const page = await requestPage(id, offset, PLAYLIST_FETCH_PAGE_SIZE, signal)
    pages += 1
    meta = page.meta
    total = page.total
    if (page.songs.length === 0 && offset < total) {
      throw new UpstreamError('UPSTREAM_CHANGED', `歌单分页为空（${offset}/${total}）`)
    }
    for (const song of page.songs) {
      // 固定 offset 分页理论上不重叠；重复 mid 直接跳过，避免把重叠页写进快照。
      if (song.songMid && seen.has(song.songMid)) continue
      if (song.songMid) seen.add(song.songMid)
      songs.push(song)
    }
    offset += PLAYLIST_FETCH_PAGE_SIZE
    if (offset >= total) break
  }
  if (!meta) {
    throw new UpstreamError('UPSTREAM_CHANGED', '歌单响应缺少 dirinfo')
  }
  const tolerance = Math.max(
    PLAYLIST_FETCH_MISSING_MIN,
    Math.ceil(total * PLAYLIST_FETCH_MISSING_RATIO)
  )
  if (total > 0 && songs.length + tolerance < total) {
    throw new UpstreamError(
      'UPSTREAM_CHANGED',
      `歌单拉取不完整（${songs.length}/${total}）`
    )
  }
  return {
    meta: { ...meta, songCount: songs.length },
    songs,
    total: songs.length,
    sourceTotal: total
  }
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
    sourceTotal: snapshot.sourceTotal,
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
