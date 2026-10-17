import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const lyricsOpen = ref(false)

  function toggleLyrics(): void {
    lyricsOpen.value = !lyricsOpen.value
  }

  function closeLyrics(): void {
    lyricsOpen.value = false
  }

  return { lyricsOpen, toggleLyrics, closeLyrics }
})
