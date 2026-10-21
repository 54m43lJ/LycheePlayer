import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const lyricsOpen = ref(false)
  const queueOpen = ref(false)

  function toggleLyrics(): void {
    lyricsOpen.value = !lyricsOpen.value
    if (lyricsOpen.value) queueOpen.value = false
  }

  function closeLyrics(): void {
    lyricsOpen.value = false
  }

  function toggleQueue(): void {
    queueOpen.value = !queueOpen.value
    if (queueOpen.value) lyricsOpen.value = false
  }

  function closeQueue(): void {
    queueOpen.value = false
  }

  return { lyricsOpen, queueOpen, toggleLyrics, closeLyrics, toggleQueue, closeQueue }
})
