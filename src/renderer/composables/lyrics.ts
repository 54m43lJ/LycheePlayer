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
const TRANSLATION_STORAGE_KEY = 'lychee.lyrics.translation'

function readTranslationVisible(): boolean {
  try {
    return localStorage.getItem(TRANSLATION_STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

const translationVisible = ref(readTranslationVisible())
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

  const visibleLines = computed(() =>
    translationVisible.value
      ? lines.value
      : lines.value.filter((line) => !line.translation)
  )
  const activeIndex = computed(() =>
    activeLyricIndex(visibleLines.value, player.positionMs)
  )
  const hasTranslation = computed(() => lines.value.some((line) => line.translation))

  function toggleTranslation(): void {
    translationVisible.value = !translationVisible.value
    try {
      localStorage.setItem(TRANSLATION_STORAGE_KEY, translationVisible.value ? 'on' : 'off')
    } catch {
      // localStorage 不可用时只保留当前会话的选择。
    }
  }

  return {
    lines,
    visibleLines,
    loading,
    error,
    activeIndex,
    hasTranslation,
    translationVisible,
    toggleTranslation,
    reload: () => (player.current ? load(player.current.songMid) : null)
  }
}
