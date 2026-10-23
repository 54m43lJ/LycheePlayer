import { computed, ref, watch } from 'vue'
import type { Lyric } from '@shared/types'
import { unwrap } from '../api'
import { activeLyricIndex, parseLyric, type LyricLine } from '../utils/lrc'
import { parseQrcLyric } from '../utils/qrc'
import { usePlayerStore } from '../stores/player'

const cache = new Map<string, LyricLine[]>()
const lines = ref<LyricLine[]>([])
const loading = ref(false)
const error = ref('')
let token = 0

function parse(lyric: Lyric): LyricLine[] {
  if (lyric.format === 'qrc') return parseQrcLyric(lyric.text, lyric.trans)
  return parseLyric(lyric.text, lyric.trans)
}

export function useLyrics() {
  const player = usePlayerStore()

  async function load(songMid: string): Promise<void> {
    const cached = cache.get(songMid)
    if (cached) {
      lines.value = cached
      error.value = ''
      return
    }
    const currentToken = ++token
    loading.value = true
    error.value = ''
    try {
      const lyric = unwrap(await window.lychee.lyric.get(songMid))
      if (currentToken !== token) return
      const parsed = parse(lyric)
      cache.set(songMid, parsed)
      lines.value = parsed
    } catch {
      if (currentToken !== token) return
      lines.value = []
      error.value = '歌词加载失败'
    } finally {
      if (currentToken === token) loading.value = false
    }
  }

  watch(
    () => player.current?.songMid ?? null,
    (songMid) => {
      token += 1
      if (!songMid) {
        lines.value = []
        return
      }
      void load(songMid)
    },
    { immediate: true }
  )

  const activeIndex = computed(() => activeLyricIndex(lines.value, player.positionMs))

  return {
    lines,
    loading,
    error,
    activeIndex,
    reload: () => (player.current ? load(player.current.songMid) : null)
  }
}
