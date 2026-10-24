import { createCipheriv, createHash, randomBytes } from 'node:crypto'
import type { Credential, FavoriteState } from '../../shared/types'
import { PLAYLIST_CACHE_TTL_MS, UPSTREAM_TIMEOUT_MS } from '../../shared/constants'
import { getCredential } from '../credential'
import { invalidatePlaylistCache } from '../cache/playlist'
import { UpstreamError, musicu, upstreamRequest } from './client'
import { hash33 } from './hash'

// 红心 201 目录的 AddSonglist / DelSonglist 需要官网 zzc 签名 + ag-1 加密通道；
// 协议实现参考 jixunmoe/qmweb-sign（MIT），使用 Node 内置 crypto，不新增依赖。

const WEB_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const REQUEST_KEY = Buffer.from([
  189, 48, 95, 16, 208, 255, 116, 182, 239, 84, 218, 184, 53, 181, 225, 207
])
const RESPONSE_KEY = [
  122, 63, 140, 29, 94, 155, 47, 10, 108, 77, 126, 139, 31, 58, 92, 157, 14, 43, 111, 74, 129
]
const SCRAMBLE = [
  89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179
]

interface PlaylistEnvelope<T> {
  code?: number
  playlist?: {
    code?: number
    data?: T & { code?: number; subcode?: number; retCode?: number }
  }
}

interface FavoriteStatusData {
  m_fan?: Record<string, boolean>
}

interface TrackInfo {
  id?: number | string
  mid?: string
  type?: number
}

interface StatusCache {
  musicid: string
  expiresAtMs: number
  statuses: Map<string, boolean>
}

let statusCache: StatusCache | null = null

function cookieHeader(credential: Credential): string {
  return [
    `uin=${credential.musicid}`,
    `qqmusic_uin=${credential.musicid}`,
    `qm_keyst=${credential.musickey}`,
    `qqmusic_key=${credential.musickey}`
  ].join('; ')
}

function commBlock(credential: Credential): Record<string, unknown> {
  const gtk = hash33(credential.musickey, 5381)
  return {
    uin: credential.musicid,
    format: 'json',
    ct: 24,
    cv: 4_747_474,
    authst: credential.musickey,
    platform: 'yqq.json',
    g_tk: gtk,
    g_tk_new_20200303: gtk,
    inCharset: 'utf-8',
    outCharset: 'utf-8',
    notice: 0,
    needNewCode: 1
  }
}

function assertEnvelope<T>(response: PlaylistEnvelope<T>, action: string, write: boolean): T {
  const block = response.playlist
  const data = block?.data
  const codes = [response.code, block?.code, data?.code ?? 0, data?.subcode ?? 0]
  if (write) codes.push(data?.retCode)
  const failed = codes.find((code) => code === undefined || Number(code) !== 0)
  if (failed === undefined) {
    if (!data) throw new UpstreamError('UPSTREAM_CHANGED', `${action}：上游响应缺少 playlist.data`)
    return data
  }
  if (Number(failed) === 1000 || Number(failed) === 301) {
    throw new UpstreamError('AUTH_EXPIRED', '登录已失效，请重新登录')
  }
  throw new UpstreamError('UPSTREAM_CHANGED', `${action}：上游返回错误码 ${failed}`)
}

function webSign(body: string): string {
  const hash = createHash('sha1').update(body).digest('hex').toUpperCase()
  const pick = (indexes: number[]): string =>
    indexes.map((index) => hash[index]).join('')
  const middle = Buffer.from(
    SCRAMBLE.map((value, index) =>
      value ^ Number.parseInt(hash.slice(index * 2, index * 2 + 2), 16)
    )
  )
    .toString('base64')
    .replace(/[\\/+=]/g, '')
  return `zzc${pick([23, 14, 6, 36, 16, 7, 19])}${middle}${pick([16, 1, 32, 12, 19, 27, 8, 5])}`.toLowerCase()
}

function decodeWebResponse(bytes: Uint8Array): unknown {
  const decoded = new TextDecoder().decode(
    bytes.map((value, index) => value ^ RESPONSE_KEY[index % RESPONSE_KEY.length])
  )
  try {
    return JSON.parse(decoded)
  } catch {
    throw new UpstreamError('UPSTREAM_CHANGED', '收藏响应无法解析，请稍后重试')
  }
}

/** 官网 Web 写通道：签名与加密使用同一份 JSON，只用于 201 目录的 Add/Del。 */
async function signedPlaylistWrite(
  credential: Credential,
  method: 'AddSonglist' | 'DelSonglist',
  param: Record<string, unknown>
): Promise<void> {
  const payload = {
    comm: commBlock(credential),
    playlist: {
      module: 'music.musicasset.PlaylistDetailWrite',
      method,
      param
    }
  }
  const body = JSON.stringify(payload)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-128-gcm', REQUEST_KEY, iv)
  const encrypted = Buffer.concat([
    iv,
    cipher.update(body, 'utf8'),
    cipher.final(),
    cipher.getAuthTag()
  ]).toString('base64')

  const url = new URL('https://u6.y.qq.com/cgi-bin/musics.fcg')
  url.searchParams.set('_', String(Date.now()))
  url.searchParams.set('encoding', 'ag-1')
  url.searchParams.set('sign', webSign(body))

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {
        Referer: 'https://y.qq.com/',
        'User-Agent': WEB_USER_AGENT,
        Cookie: cookieHeader(credential),
        'Content-Type': 'text/plain',
        Accept: 'application/octet-stream'
      },
      body: encrypted
    })
  } catch {
    throw new UpstreamError('UPSTREAM_NETWORK', '收藏请求失败，请检查网络')
  }
  if (!response.ok) {
    throw new UpstreamError('UPSTREAM_NETWORK', `收藏请求失败（HTTP ${response.status}）`)
  }
  const data = decodeWebResponse(new Uint8Array(await response.arrayBuffer()))
  assertEnvelope(
    (data ?? {}) as PlaylistEnvelope<Record<string, unknown>>,
    method === 'AddSonglist' ? '收藏' : '取消收藏',
    true
  )
}

async function playlistRead<T>(
  credential: Credential,
  module: string,
  method: string,
  param: Record<string, unknown>
): Promise<T> {
  const payload = {
    comm: commBlock(credential),
    playlist: { module, method, param }
  }
  const response = await upstreamRequest<PlaylistEnvelope<T>>({
    host: 'https://u.y.qq.com',
    path: '/cgi-bin/musicu.fcg',
    params: {},
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(payload),
    credential
  })
  return assertEnvelope(response, `${module}.${method}`, false)
}

async function readStatuses(
  credential: Credential,
  mids: string[]
): Promise<Map<string, boolean>> {
  if (mids.length === 0) return new Map()
  const data = await playlistRead<FavoriteStatusData>(
    credential,
    'music.musicasset.SongFavRead',
    'IsSongFanByMid',
    { v_songMid: mids }
  )
  const fans = data.m_fan
  if (!fans || typeof fans !== 'object') {
    throw new UpstreamError('UPSTREAM_CHANGED', '收藏状态响应缺少 m_fan')
  }
  const result = new Map<string, boolean>()
  for (const mid of mids) {
    if (typeof fans[mid] !== 'boolean') {
      throw new UpstreamError('UPSTREAM_CHANGED', '收藏状态响应不完整')
    }
    result.set(mid, fans[mid])
  }
  return result
}

async function fetchTrackIdentity(songMid: string): Promise<{ songId: string; songType: number }> {
  const data = await musicu<{ track_info?: TrackInfo }>(
    'music.pf_song_detail_svr',
    'get_song_detail_yqq',
    { song_mid: songMid }
  )
  const info = data.track_info
  const songId = String(info?.id ?? '')
  const songType = Number(info?.type ?? 0)
  if (!info || !/^\d+$/.test(songId) || !Number.isSafeInteger(songType) || songType < 0) {
    throw new UpstreamError('UPSTREAM_CHANGED', '无法确认歌曲 ID，收藏操作已取消')
  }
  return { songId, songType }
}

/** 当前账号已收藏的歌曲；未登录或接口失败时按未收藏处理。 */
export async function getFavoriteStates(mids: string[]): Promise<FavoriteState[]> {
  const credential = getCredential()
  if (!credential) return mids.map((songMid) => ({ songMid, favorited: false }))
  const unique = [...new Set(mids)].slice(0, 100)
  try {
    const cached =
      statusCache &&
      statusCache.musicid === credential.musicid &&
      statusCache.expiresAtMs > Date.now()
        ? statusCache.statuses
        : new Map<string, boolean>()
    const missing = unique.filter((songMid) => !cached.has(songMid))
    if (missing.length > 0) {
      const fetched = await readStatuses(credential, missing)
      for (const [songMid, favorited] of fetched) cached.set(songMid, favorited)
      statusCache = {
        musicid: credential.musicid,
        expiresAtMs: Date.now() + PLAYLIST_CACHE_TTL_MS,
        statuses: cached
      }
    }
    return mids.map((songMid) => ({
      songMid,
      favorited: cached.get(songMid) ?? false
    }))
  } catch {
    return mids.map((songMid) => ({ songMid, favorited: false }))
  }
}

/** 收藏 / 取消收藏当前歌曲（“我喜欢”歌单）。 */
export async function toggleFavorite(songMid: string): Promise<FavoriteState> {
  const credential = getCredential()
  if (!credential) throw new UpstreamError('AUTH_EXPIRED', '未登录')

  const before = (await readStatuses(credential, [songMid])).get(songMid) ?? false
  const target = !before
  const identity = await fetchTrackIdentity(songMid)

  await signedPlaylistWrite(credential, target ? 'AddSonglist' : 'DelSonglist', {
    dirId: 201,
    v_songInfo: [{ songId: Number(identity.songId), songType: identity.songType }]
  })

  const after = (await readStatuses(credential, [songMid])).get(songMid) ?? false
  if (after !== target) {
    throw new UpstreamError('UPSTREAM_CHANGED', '上游尚未确认收藏变更，请稍后重试')
  }

  const statuses =
    statusCache && statusCache.musicid === credential.musicid
      ? statusCache.statuses
      : new Map<string, boolean>()
  statuses.set(songMid, target)
  statusCache = {
    musicid: credential.musicid,
    expiresAtMs: Date.now() + PLAYLIST_CACHE_TTL_MS,
    statuses
  }
  await invalidatePlaylistCache('liked')
  return { songMid, favorited: target }
}
