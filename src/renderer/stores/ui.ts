import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 全局“添加到歌单”选择器请求；播放条与快捷键共用。 */
export interface SongPickerRequest {
  songMids: string[]
  songName: string
}

export const useUiStore = defineStore('ui', () => {
  const queueOpen = ref(false)
  const lyricsOpen = ref(false)
  const sidebarOpen = ref(false)
  const songPicker = ref<SongPickerRequest | null>(null)

  function openSongPicker(songMids: string[], songName: string): void {
    const mids = songMids.filter(Boolean)
    if (mids.length === 0) return
    songPicker.value = { songMids: mids, songName }
  }

  function closeSongPicker(): void {
    songPicker.value = null
  }

  function closeOthers(keep: 'queue' | 'sidebar'): void {
    if (keep !== 'queue') queueOpen.value = false
    if (keep !== 'sidebar') sidebarOpen.value = false
  }

  function toggleQueue(): void {
    queueOpen.value = !queueOpen.value
    if (queueOpen.value) closeOthers('queue')
  }

  function closeQueue(): void {
    queueOpen.value = false
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
    lyricsOpen,
    sidebarOpen,
    songPicker,
    openSongPicker,
    closeSongPicker,
    toggleQueue,
    closeQueue,
    toggleLyrics,
    closeLyrics,
    openSidebar,
    closeSidebar,
    toggleSidebar
  }
})
