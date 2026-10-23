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
  return song.singers.map((singer) => singer.name).join(' / ') || '未知歌手'
}

export function playlistSubtitle(playlist: PlaylistMeta): string {
  return `${playlist.songCount} 首歌曲`
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
