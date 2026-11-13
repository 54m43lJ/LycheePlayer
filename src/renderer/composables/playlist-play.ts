import { ref } from 'vue'
import type { PlaylistMeta, Song } from '@shared/types'
import { describeError, unwrap } from '../api'
import { usePlayerStore, type QueueSource } from '../stores/player'
import { usePlaylistStore } from '../stores/playlist'
import { useToast } from './toast'

/** 跨卡片共享的加载目标：同一次只允许一个歌单进入直接播放流程。 */
const playingId = ref<string | null>(null)

/**
 * 歌单卡片共用行为：先用缓存或第一页歌曲立即起播，再在后台加载完整快照，
 * 由 playlist store 的队列构建流程替换为整个歌单。
 */
export function usePlaylistPlay() {
  const player = usePlayerStore()
  const playlist = usePlaylistStore()
  const toast = useToast()

  function isSourceActive(kind: QueueSource['kind'], id: string): boolean {
    return player.queueSource?.kind === kind && player.queueSource.id === id
  }

  function isSourcePlaying(kind: QueueSource['kind'], id: string): boolean {
    return isSourceActive(kind, id) && player.status === 'playing'
  }

  function isSourcePaused(kind: QueueSource['kind'], id: string): boolean {
    return isSourceActive(kind, id) && player.status === 'paused'
  }

  /** 当前卡片来源正在播放 / 暂停时切换播放状态；否则执行该卡片的起播逻辑。 */
  function toggleSource(
    kind: QueueSource['kind'],
    id: string,
    start: () => void
  ): void {
    if (isSourceActive(kind, id) && player.status !== 'stopped') {
      player.toggle()
      return
    }
    start()
  }

  async function playPlaylist(target: Pick<PlaylistMeta, 'id' | 'name'>): Promise<void> {
    if (!target.id || playingId.value !== null) return
    playingId.value = target.id
    try {
      let songs: Song[] = []
      try {
        const cached = unwrap(await window.lychee.playlist.getCached(target.id))
        if (cached && cached.songs.length > 0) songs = cached.songs
      } catch {
        // 缓存读取失败时回退到第一页。
      }
      if (songs.length === 0) {
        const page = unwrap(await window.lychee.playlist.get(target.id, { offset: 0 }))
        songs = page.songs
      }
      const first = songs.find((song) => song.songMid)
      if (!first) {
        toast.error('这个歌单里还没有可播放的歌曲')
        return
      }
      player.startPlaylistPlayback(first, { kind: 'playlist', id: target.id })
      // 完整快照到达前，先用缓存 / 第一页补齐待播队列；后续快照会去重并替换。
      player.appendPlaylistQueue(first, songs)
      playlist.beginQueueBuild()
      // 完整快照就绪后由 store 替换为整单队列；失败时保留当前已起播的歌曲。
      void playlist.load(target.id)
    } catch (err) {
      toast.error(describeError(err))
    } finally {
      playingId.value = null
    }
  }

  return {
    playingId,
    playPlaylist,
    isSourcePlaying,
    isSourcePaused,
    toggleSource
  }
}
