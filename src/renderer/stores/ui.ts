import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const lyricsOpen = ref(false)
  const queueOpen = ref(false)
  const downloadOpen = ref(false)

  function closeOthers(keep: 'lyrics' | 'queue' | 'download'): void {
    if (keep !== 'lyrics') lyricsOpen.value = false
    if (keep !== 'queue') queueOpen.value = false
    if (keep !== 'download') downloadOpen.value = false
  }

  function toggleLyrics(): void {
    lyricsOpen.value = !lyricsOpen.value
    if (lyricsOpen.value) closeOthers('lyrics')
  }

  function closeLyrics(): void {
    lyricsOpen.value = false
  }

  function toggleQueue(): void {
    queueOpen.value = !queueOpen.value
    if (queueOpen.value) closeOthers('queue')
  }

  function closeQueue(): void {
    queueOpen.value = false
  }

  function toggleDownload(): void {
    downloadOpen.value = !downloadOpen.value
    if (downloadOpen.value) closeOthers('download')
  }

  function closeDownload(): void {
    downloadOpen.value = false
  }

  function closePanels(): void {
    lyricsOpen.value = false
    queueOpen.value = false
  }

  return {
    lyricsOpen,
    queueOpen,
    downloadOpen,
    toggleLyrics,
    closeLyrics,
    toggleQueue,
    closeQueue,
    toggleDownload,
    closeDownload,
    closePanels
  }
})
