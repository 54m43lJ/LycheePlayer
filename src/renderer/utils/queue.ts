import type { Song, SongAvailability } from '@shared/types'

/**
 * 生成队列快照：在数据进入队列前剔除已知不可播歌曲。
 * `keepMid` 用于保留当前曲在快照中的位置，队列本身不再做可用性检测或清理。
 */
export function filterQueueSnapshot(
  songs: Song[],
  availability: Record<string, SongAvailability>,
  keepMid?: string | null
): Song[] {
  return songs.filter(
    (song) =>
      song.songMid === keepMid || availability[song.songMid]?.playable !== false
  )
}
