import { computed, type Ref } from 'vue'
import type { Song } from '@shared/types'
import { usePlayerStore } from '../stores/player'
import { scrollToSongRow } from '../utils/page-jump'

/**
 * “跳转到当前歌曲”的列表侧能力：只要当前歌曲出现在列表（含筛选结果）中即可用，
 * 不依赖播放来源或队列是否由该列表构建。
 */
export function useCurrentSongJump(rootRef: Ref<HTMLElement | null>, songs: Ref<Song[]>) {
  const player = usePlayerStore()
  const showCurrent = computed(
    () =>
      Boolean(player.current) &&
      songs.value.some((song) => song.songMid === player.current?.songMid)
  )

  function scrollToCurrent(): void {
    const root = rootRef.value
    const mid = player.current?.songMid
    if (root && mid) scrollToSongRow(root, mid)
  }

  return { showCurrent, scrollToCurrent }
}
