import type { FavoriteState } from '../../shared/types'
import { PLAYLIST_CACHE_TTL_MS } from '../../shared/constants'
import { getCredential } from '../credential'
import { invalidatePlaylistCache } from '../cache/playlist'
import { UpstreamError, upstreamRequest } from './client'
import { getDetail } from './song'

interface FavoriteMapResponse {
  code?: number
  msg?: string
  map?: unknown
  mapmid?: unknown
}

interface FavoriteCache {
  musicid: string
  expiresAtMs: number
  favorites: Map<string, string>
}

let cache: FavoriteCache | null = null

function isMid(value: string): boolean {
  return /^[0-9A-Za-z]{8,24}$/.test(value) && /[A-Za-z]/.test(value)
}

function isSongId(value: string): boolean {
  return /^\d{3,}$/.test(value)
}

function flatten(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean)
  }
  if (Array.isArray(value)) return value.flatMap((item) => flatten(item))
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [
      key,
      ...flatten(item)
    ])
  }
  return []
}

function collectFavorites(data: FavoriteMapResponse): Map<string, string> {
  const favorites = new Map<string, string>()
  const mids = flatten(data.mapmid)
  const ids = flatten(data.map)
  if (mids.length === ids.length) {
    for (let index = 0; index < mids.length; index += 1) {
      if (isMid(mids[index]) && isSongId(ids[index])) {
        favorites.set(mids[index], ids[index])
      }
    }
  }
  for (const mid of mids) {
    if (!isMid(mid)) continue
    if (!favorites.has(mid)) favorites.set(mid, '')
  }
  // 部分版本返回以 mid 或 id 为键的映射。
  for (const source of [data.mapmid, data.map]) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) continue
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      if (isMid(key) && isSongId(String(value))) favorites.set(key, String(value))
      if (isMid(String(value)) && isSongId(key)) favorites.set(String(value), key)
    }
  }
  return favorites
}

async function loadFavoriteMap(force = false): Promise<Map<string, string>> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '未登录')
  if (!force && cache && cache.musicid === credential.musicid && cache.expiresAtMs > Date.now()) {
    return cache.favorites
  }

  const data = await upstreamRequest<FavoriteMapResponse>({
    host: 'https://c.y.qq.com',
    path: '/splcloud/fcgi-bin/fcg_musiclist_getmyfav.fcg',
    params: {
      dirid: '201',
      dirinfo: '1',
      g_tk: '5381',
      format: 'json'
    }
  })
  if ((data.code ?? 0) === 1000) {
    throw new UpstreamError('AUTH_EXPIRED', '登录已失效，请重新登录')
  }
  if ((data.code ?? 0) !== 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', `收藏列表接口返回错误码 ${data.code}`)
  }
  const favorites = collectFavorites(data)
  cache = {
    musicid: credential.musicid,
    expiresAtMs: Date.now() + PLAYLIST_CACHE_TTL_MS,
    favorites
  }
  return favorites
}

/** 当前账号已收藏的歌曲；未登录或接口失败时按未收藏处理。 */
export async function getFavoriteStates(mids: string[]): Promise<FavoriteState[]> {
  if (!getCredential()) return mids.map((songMid) => ({ songMid, favorited: false }))
  try {
    const favorites = await loadFavoriteMap()
    return mids.map((songMid) => ({ songMid, favorited: favorites.has(songMid) }))
  } catch {
    return mids.map((songMid) => ({ songMid, favorited: false }))
  }
}

async function addFavorite(songMid: string): Promise<void> {
  const data = await upstreamRequest<{ code?: number; msg?: string }>({
    host: 'https://c.y.qq.com',
    path: '/splcloud/fcgi-bin/fcg_music_add2songdir.fcg',
    params: {
      g_tk: '5381',
      midlist: songMid,
      typelist: '13',
      dirid: '201',
      addtype: '',
      formsender: '4',
      r2: '0',
      r3: '1',
      utf8: '1'
    }
  })
  if ((data.code ?? 0) === 1000) throw new UpstreamError('AUTH_EXPIRED', '登录已失效，请重新登录')
  if ((data.code ?? 0) !== 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', data.msg || `收藏失败（${data.code}）`)
  }
}

async function removeFavorite(songId: string): Promise<void> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '未登录')
  const data = await upstreamRequest<{ code?: number; msg?: string }>({
    host: 'https://c.y.qq.com',
    path: '/qzone/fcg-bin/fcg_music_delbatchsong.fcg',
    params: {
      g_tk: '5381',
      loginUin: credential.musicid,
      hostUin: '0',
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: '0',
      platform: 'yqq.post',
      needNewCode: '0',
      uin: credential.musicid,
      dirid: '201',
      ids: songId,
      source: '103',
      types: '3',
      formsender: '4',
      flag: '2',
      utf8: '1',
      from: '3'
    }
  })
  if ((data.code ?? 0) === 1000) throw new UpstreamError('AUTH_EXPIRED', '登录已失效，请重新登录')
  if ((data.code ?? 0) !== 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', data.msg || `取消收藏失败（${data.code}）`)
  }
}

/** 收藏 / 取消收藏当前歌曲（“我喜欢”歌单）。 */
export async function toggleFavorite(songMid: string): Promise<FavoriteState> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '未登录')

  const favorites = await loadFavoriteMap(true)
  const favorited = favorites.has(songMid)
  if (favorited) {
    let songId = favorites.get(songMid) ?? ''
    if (!songId) {
      const songs = await getDetail([songMid])
      songId = songs[0]?.songId ?? ''
    }
    if (!songId) throw new UpstreamError('UPSTREAM_CHANGED', '无法确定歌曲 ID，取消收藏失败')
    await removeFavorite(songId)
    favorites.delete(songMid)
  } else {
    await addFavorite(songMid)
    let songId = ''
    try {
      const songs = await getDetail([songMid])
      songId = songs[0]?.songId ?? ''
    } catch {
      // 歌曲 ID 只用于后续取消收藏，获取失败不阻断收藏结果。
    }
    favorites.set(songMid, songId)
  }

  cache = {
    musicid: credential.musicid,
    expiresAtMs: Date.now() + PLAYLIST_CACHE_TTL_MS,
    favorites
  }
  await invalidatePlaylistCache('liked')
  return { songMid, favorited: !favorited }
}
