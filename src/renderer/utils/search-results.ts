import type { SearchResult } from '@shared/types'

/** 翻页结果按类型主键去重后追加。 */
export function mergeSearchResult(previous: SearchResult, next: SearchResult): SearchResult {
  const append = <T, K>(current: T[], incoming: T[], key: (item: T) => K): T[] => {
    const seen = new Set(current.map(key))
    return [...current, ...incoming.filter((item) => !seen.has(key(item)))]
  }
  return {
    songs: append(previous.songs, next.songs, (song) => song.songMid),
    singers: append(previous.singers, next.singers, (singer) => singer.mid),
    albums: append(previous.albums, next.albums, (album) => album.mid),
    playlists: append(previous.playlists, next.playlists, (playlist) => playlist.id),
    mvs: append(previous.mvs ?? [], next.mvs ?? [], (mv) => mv.mvId),
    total: next.total > 0 ? next.total : previous.total
  }
}
