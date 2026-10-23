import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecommendFeed } from '@shared/types'
import { unwrap } from '../api'

export const useRecommendStore = defineStore('recommend', () => {
  const feed = ref<RecommendFeed | null>(null)
  const loading = ref(false)

  async function load(force = false): Promise<void> {
    if (loading.value) return
    if (feed.value && !force) return
    loading.value = true
    try {
      feed.value = unwrap(
        await (force ? window.lychee.recommend.refresh() : window.lychee.recommend.get())
      )
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    feed.value = null
  }

  return { feed, loading, load, reset }
})
