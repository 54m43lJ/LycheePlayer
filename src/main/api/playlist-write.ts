import type { PlaylistMeta } from '../../shared/types'
import { getCredential } from '../credential'
import { UpstreamError, musicu } from './client'
import { fetchPlaylistPage } from './playlist'
import { rawSongToSong } from './song'

interface WriteResult {
  retCode?: number
  result?: {
    dirId?: number | string
    tid?: number | string
    dirName?: string
  }
  msg?: string
}

interface TrackInfo {
  id?: number | string
  mid?: string
  type?: number
}

function assertWrite(data: WriteResult, action: string): void {
  const code = Number(data.retCode ?? 0)
  if (code === 0) return
  if (code === 1000 || code === 301) {
    throw new UpstreamError('AUTH_EXPIRED', '登录已失效，请重新登录')
  }
  if (code === 403) {
    throw new UpstreamError('NO_PERMISSION', '当前账号无权编辑该歌单')
  }
  throw new UpstreamError(
    'UPSTREAM_CHANGED',
    `${action}失败：上游返回错误码 ${code}${data.msg ? `（${data.msg}）` : ''}`,
    false,
    code
  )
}

function numericId(id: string): number {
  const value = Number(id)
  if (!Number.isFinite(value) || value <= 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', `非法歌单 ID：${id}`)
  }
  return value
}

/** 写入接口的 dirId 是当前账号下的目录 ID，与歌单 ID（tid/disstid）不是同一个值。 */
function playlistDirId(meta: PlaylistMeta): number {
  const value = Number(meta.dirId ?? 0)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', '无法确认歌单目录 ID，写操作已取消')
  }
  return value
}

async function writeBase(
  method: 'AddPlaylist' | 'EditPlaylist' | 'DelPlaylist',
  param: Record<string, unknown>,
  action: string
): Promise<WriteResult> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '未登录')
  const data = await musicu<WriteResult>(
    'music.musicasset.PlaylistBaseWrite',
    method,
    param
  )
  assertWrite(data, action)
  return data
}

async function readMeta(id: string): Promise<PlaylistMeta> {
  const page = await fetchPlaylistPage(id, 0)
  return page.meta
}

async function fetchTrackIdentities(
  mids: string[]
): Promise<Array<{ songId: number; songType: number }>> {
  const unique = [...new Set(mids.filter(Boolean))]
  const result: Array<{ songId: number; songType: number }> = []
  for (const mid of unique) {
    const data = await musicu<{ track_info?: TrackInfo }>(
      'music.pf_song_detail_svr',
      'get_song_detail_yqq',
      { song_mid: mid }
    )
    const info = data.track_info
    const songId = String(info?.id ?? '')
    const songType = Number(info?.type ?? 0)
    if (!info || !/^\d+$/.test(songId) || !Number.isSafeInteger(songType) || songType < 0) {
      throw new UpstreamError('UPSTREAM_CHANGED', '无法确认歌曲 ID，写操作已取消')
    }
    result.push({ songId: Number(songId), songType })
  }
  return result
}

async function writeDetail(
  method: 'AddSonglist' | 'DelSonglist',
  id: string,
  dirId: number,
  mids: string[],
  action: string
): Promise<void> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '未登录')
  const info = await fetchTrackIdentities(mids)
  if (info.length === 0) return
  const data = await musicu<WriteResult>(
    'music.musicasset.PlaylistDetailWrite',
    method,
    {
      dirId,
      tid: numericId(id),
      bFmtUtf8: 1,
      v_songInfo: info
    }
  )
  assertWrite(data, action)
}

/** 读取歌单成员 mid 用于写后读回校验；最多读取 20 页。 */
async function readMemberMids(id: string): Promise<Set<string>> {
  const mids = new Set<string>()
  let offset = 0
  for (let page = 0; page < 20; page += 1) {
    const result = await fetchPlaylistPage(id, offset)
    for (const song of result.songs) if (song.songMid) mids.add(song.songMid)
    if (!result.hasMore || result.songs.length === 0) break
    offset += result.songs.length
  }
  return mids
}

export async function createPlaylist(name: string): Promise<PlaylistMeta> {
  const data = await writeBase(
    'AddPlaylist',
    { bFmtUtf8: 1, dirName: name },
    '新建歌单'
  )
  const dirId = Number(data.result?.dirId ?? 0)
  const tid = Number(data.result?.tid ?? 0)
  if (
    !Number.isSafeInteger(dirId) ||
    dirId <= 0 ||
    !Number.isSafeInteger(tid) ||
    tid <= 0
  ) {
    throw new UpstreamError('UPSTREAM_CHANGED', '新建歌单响应缺少 dirId / tid')
  }
  return {
    id: String(tid),
    dirId,
    name: data.result?.dirName || name,
    coverUrl: '',
    songCount: 0,
    kind: 'normal',
    editable: true
  }
}

export async function renamePlaylist(id: string, name: string): Promise<PlaylistMeta> {
  const meta = await readMeta(id)
  await writeBase(
    'EditPlaylist',
    {
      bFmtUtf8: 1,
      dirId: playlistDirId(meta),
      dirNewName: name,
      dirShow: 1,
      mask: 1
    },
    '歌单改名'
  )
  return readMeta(id)
}

export async function removePlaylist(id: string): Promise<void> {
  const meta = await readMeta(id)
  await writeBase(
    'DelPlaylist',
    { bFmtUtf8: 1, dirId: playlistDirId(meta), dirName: meta.name },
    '删除歌单'
  )
}

export async function addSongs(id: string, mids: string[]): Promise<PlaylistMeta> {
  const before = await readMemberMids(id)
  const target = [...new Set(mids.filter((mid) => mid && !before.has(mid)))]
  const meta = await readMeta(id)
  let writeError: unknown = null
  try {
    await writeDetail('AddSonglist', meta.id, playlistDirId(meta), target, '添加歌曲')
  } catch (err) {
    // 80092：歌曲已存在等业务状态；以写后读回为准。
    if (err instanceof UpstreamError && err.upstreamCode === 80092) writeError = err
    else throw err
  }
  const after = await readMemberMids(id)
  const missing = target.filter((mid) => !after.has(mid))
  if (missing.length > 0) {
    if (writeError) {
      throw new UpstreamError(
        'UPSTREAM_CHANGED',
        '添加歌曲未生效：上游返回 80092（歌曲可能已在歌单中或歌单状态已变化）',
        false,
        80092
      )
    }
    throw new UpstreamError('UPSTREAM_CHANGED', '上游尚未确认添加结果，请稍后刷新')
  }
  return readMeta(id)
}

export async function removeSongs(id: string, mids: string[]): Promise<PlaylistMeta> {
  const before = await readMemberMids(id)
  const target = [...new Set(mids.filter((mid) => mid && before.has(mid)))]
  const meta = await readMeta(id)
  let writeError: unknown = null
  try {
    await writeDetail('DelSonglist', meta.id, playlistDirId(meta), target, '移除歌曲')
  } catch (err) {
    // 80092：歌曲不存在等业务状态；以写后读回为准。
    if (err instanceof UpstreamError && err.upstreamCode === 80092) writeError = err
    else throw err
  }
  const after = await readMemberMids(id)
  const remaining = target.filter((mid) => after.has(mid))
  if (remaining.length > 0) {
    if (writeError) {
      throw new UpstreamError(
        'UPSTREAM_CHANGED',
        '移除歌曲未生效：上游返回 80092（歌曲可能已不在歌单中或歌单状态已变化）',
        false,
        80092
      )
    }
    throw new UpstreamError('UPSTREAM_CHANGED', '上游尚未确认移除结果，请稍后刷新')
  }
  return readMeta(id)
}

/** 供收藏等需要真实 songType 的模块复用。 */
export async function resolveTrackIdentities(
  mids: string[]
): Promise<Array<{ songId: number; songType: number }>> {
  return fetchTrackIdentities(mids)
}

/** 供推荐等只读路径复用原始歌曲映射。 */
export function toSong(raw: unknown): ReturnType<typeof rawSongToSong> {
  return rawSongToSong(raw)
}
