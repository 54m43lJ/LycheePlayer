import type { PlaylistMeta, Song } from '@shared/types'

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--:--'
  if (ms === 0) return '0:00'
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatCount(count: number): string {
  if (count >= 100_000_000) return `${(count / 100_000_000).toFixed(1)} 亿`
  if (count >= 10_000) return `${(count / 10_000).toFixed(1)} 万`
  return String(count)
}

export function albumCover(mid: string, size = 300): string {
  return mid ? `https://y.gtimg.cn/music/photo_new/T002R${size}x${size}M000${mid}.jpg` : ''
}

export function songCover(song: Song | null, size = 300): string {
  return song ? albumCover(song.album.mid, size) : ''
}

export function singerNames(song: Song): string {
  // 名称为空的成员跳过；全部为空时返回空字符串，界面不渲染歌手文本。
  return song.singers
    .map((singer) => singer.name.trim())
    .filter((name) => name.length > 0)
    .join(' / ')
}

const APP_TITLE = 'Lychee Player'

/** 窗口 / 任务栏标题：当前歌曲优先，无歌曲时回退应用名。 */
export function appTitle(song: Song | null): string {
  if (!song) return APP_TITLE
  const singers = singerNames(song)
  return `${song.name}${singers ? ` - ${singers}` : ''} · ${APP_TITLE}`
}

export function playlistSubtitle(playlist: PlaylistMeta): string {
  return `${playlist.songCount} 首歌曲`
}

const DAILY_PLAYLIST_SUFFIX = '的今日私享'

/** 上游日推歌单名只返回“的今日私享”，展示时补上当前账号昵称。 */
export function dailyPlaylistName(name: string, nickname: string): string {
  const prefix = nickname.trim()
  if (!prefix || !name.startsWith(DAILY_PLAYLIST_SUFFIX)) return name
  return `${prefix}${name}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}
