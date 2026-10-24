import { defineStore } from 'pinia'
import { ref } from 'vue'
import { IPC_SONG_MIDS_MAX } from '@shared/constants'
import { unwrap } from '../api'
import { useAuthStore } from './auth'
import { usePlaylistStore } from './playlist'
import { useToast } from '../composables/toast'

export const usePlaylistEditStore = defineStore('playlist-edit', () => {
  const editing = ref(false)
  const busy = ref(false)
  const favorites = ref<Set<string>>(new Set())
  const favoriteVersion = ref(0)
  const auth = useAuthStore()
  const playlist = usePlaylistStore()
  const toast = useToast()

  async function run(action: () => Promise<void>): Promise<void> {
    busy.value = true
    try {
      await action()
    } finally {
      busy.value = false
    }
  }

  async function create(name: string): Promise<void> {
    await run(async () => {
      unwrap(await window.lychee.playlist.create(name))
      toast.show('歌单已创建')
    })
  }

  async function rename(id: string, name: string): Promise<void> {
    await run(async () => {
      const meta = unwrap(await window.lychee.playlist.rename(id, name))
      const feed = playlist.feed
      if (feed?.meta?.id === id) feed.meta = meta
      toast.show('歌单已改名')
    })
  }

  async function remove(id: string): Promise<void> {
    await run(async () => {
      unwrap(await window.lychee.playlist.remove(id))
      toast.show('歌单已删除')
    })
  }

  async function addSongs(id: string, mids: string[]): Promise<void> {
    await run(async () => {
      unwrap(await window.lychee.playlist.addSongs(id, mids))
      toast.show('已添加到歌单')
    })
  }

  async function removeSongs(id: string, mids: string[]): Promise<void> {
    await run(async () => {
      unwrap(await window.lychee.playlist.removeSongs(id, mids))
      toast.show('已从歌单移除')
    })
  }

  async function loadFavorites(mids: string[]): Promise<void> {
    if (!auth.loggedIn || mids.length === 0) {
      favorites.value = new Set()
      return
    }
    try {
      const next = new Set(favorites.value)
      for (let start = 0; start < mids.length; start += IPC_SONG_MIDS_MAX) {
        const batch = mids.slice(start, start + IPC_SONG_MIDS_MAX)
        const states = unwrap(await window.lychee.favorite.get(batch))
        for (const state of states) {
          if (state.favorited) next.add(state.songMid)
          else next.delete(state.songMid)
        }
      }
      favorites.value = next
    } catch {
      // 收藏状态读取失败时保留已显示状态。
    }
  }

  async function toggleFavorite(songMid: string): Promise<void> {
    if (!auth.loggedIn) {
      toast.error('请先登录')
      return
    }
    const before = new Set(favorites.value)
    if (favorites.value.has(songMid)) favorites.value.delete(songMid)
    else favorites.value.add(songMid)
    favorites.value = new Set(favorites.value)
    try {
      const state = unwrap(await window.lychee.favorite.toggle(songMid))
      if (state.favorited) favorites.value.add(songMid)
      else favorites.value.delete(songMid)
      favorites.value = new Set(favorites.value)
      favoriteVersion.value += 1
      playlist.invalidate('liked')
      if (playlist.feed?.meta?.id === 'liked') {
        void playlist.poll('liked')
      }
    } catch (err) {
      favorites.value = before
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }

  return {
    editing,
    busy,
    favorites,
    favoriteVersion,
    create,
    rename,
    remove,
    addSongs,
    removeSongs,
    loadFavorites,
    toggleFavorite
  }
})
