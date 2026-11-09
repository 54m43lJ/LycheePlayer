import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const queueOpen = ref(false)
  const downloadOpen = ref(false)
  const lyricsOpen = ref(false)
  const sidebarOpen = ref(false)

  function closeOthers(keep: 'queue' | 'download' | 'sidebar'): void {
    if (keep !== 'queue') queueOpen.value = false
    if (keep !== 'download') downloadOpen.value = false
    if (keep !== 'sidebar') sidebarOpen.value = false
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

  function openSidebar(): void {
    sidebarOpen.value = true
    closeOthers('sidebar')
  }

  function closeSidebar(): void {
    sidebarOpen.value = false
  }

  function toggleSidebar(): void {
    sidebarOpen.value = !sidebarOpen.value
    if (sidebarOpen.value) closeOthers('sidebar')
  }

  function toggleLyrics(): void {
    lyricsOpen.value = !lyricsOpen.value
  }

  function closeLyrics(): void {
    lyricsOpen.value = false
  }

  return {
    queueOpen,
    downloadOpen,
    lyricsOpen,
    sidebarOpen,
    toggleQueue,
    closeQueue,
    toggleDownload,
    closeDownload,
    toggleLyrics,
    closeLyrics,
    openSidebar,
    closeSidebar,
    toggleSidebar
  }
})
