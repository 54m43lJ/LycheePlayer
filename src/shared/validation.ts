import type {
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistSnapshot,
  RecentPlaylist,
  Song
} from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value)
}

function isQualityOrNull(value: unknown): boolean {
  return value === null || value === '128k' || value === '320k' || value === 'flac'
}

/** 当前 Song 内部模型的结构校验；用于持久化缓存读取。 */
export function isSong(value: unknown): value is Song {
  if (!isRecord(value)) return false
  const singers = value.singers
  const album = value.album
  const pay = value.pay
  return (
    typeof value.songMid === 'string' &&
    value.songMid.length > 0 &&
    typeof value.songId === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(singers) &&
    singers.every(
      (singer) =>
        isRecord(singer) &&
        typeof singer.mid === 'string' &&
        typeof singer.name === 'string'
    ) &&
    isRecord(album) &&
    typeof album.mid === 'string' &&
    typeof album.name === 'string' &&
    isFiniteNumber(value.durationMs) &&
    value.durationMs >= 0 &&
    isRecord(pay) &&
    typeof pay.free === 'boolean' &&
    typeof pay.vip === 'boolean' &&
    typeof pay.album === 'boolean' &&
    isNumberOrNull(value.status) &&
    isNumberOrNull(value.pay_play) &&
    isNumberOrNull(value.payDown) &&
    isNumberOrNull(value.playSwitch) &&
    isNumberOrNull(value.sizeTry) &&
    isNumberOrNull(value.tryStartMs) &&
    isNumberOrNull(value.tryEndMs) &&
    isQualityOrNull(value.maxQuality) &&
    typeof value.mvId === 'string'
  )
}

/** 当前 PlaylistMeta 内部模型的结构校验。 */
export function isPlaylistMeta(value: unknown): value is PlaylistMeta {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    typeof value.coverUrl === 'string' &&
    isFiniteNumber(value.songCount) &&
    value.songCount >= 0 &&
    (value.kind === 'normal' || value.kind === 'favorites') &&
    typeof value.editable === 'boolean' &&
    (value.dirId === undefined || isFiniteNumber(value.dirId))
  )
}

/** 当前 PlaylistSnapshot 内部模型的结构校验。 */
export function isPlaylistSnapshot(value: unknown): value is PlaylistSnapshot {
  if (!isRecord(value)) return false
  return (
    isPlaylistMeta(value.meta) &&
    Array.isArray(value.songs) &&
    value.songs.every(isSong) &&
    isFiniteNumber(value.total) &&
    value.total >= 0 &&
    (value.sourceTotal === undefined ||
      (isFiniteNumber(value.sourceTotal) && value.sourceTotal >= 0))
  )
}

/** 歌单磁盘缓存条目的结构校验。 */
export function isPlaylistCacheEntry(value: unknown): value is PlaylistCacheEntry {
  if (!isRecord(value)) return false
  return (
    isPlaylistSnapshot(value) &&
    typeof value.complete === 'boolean' &&
    isFiniteNumber(value.fetchedAtMs) &&
    value.fetchedAtMs >= 0
  )
}

/** 最近歌单 localStorage 条目的结构校验。 */
export function isRecentPlaylist(value: unknown): value is RecentPlaylist {
  if (!isRecord(value)) return false
  return (
    isPlaylistMeta(value) &&
    isFiniteNumber(value.visitedAtMs) &&
    value.visitedAtMs >= 0 &&
    (value.stale === undefined || typeof value.stale === 'boolean')
  )
}
