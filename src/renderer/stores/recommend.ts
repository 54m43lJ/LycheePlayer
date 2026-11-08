import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RecommendFeed, RecommendSection } from '@shared/types'
import { unwrap } from '../api'

export const useRecommendStore = defineStore('recommend', () => {
  const feed = ref<RecommendFeed | null>(null)
  const loading = ref(false)
  const error = ref('')

  async function load(force = false): Promise<void> {
    if (loading.value) return
    if (feed.value && !force) return
    loading.value = true
    error.value = ''
    try {
      feed.value = unwrap(
        await (force ? window.lychee.recommend.refresh() : window.lychee.recommend.get())
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /** 只刷新一个分区；上游不支持时由主进程退化为全量刷新。 */
  async function refreshSection(id: RecommendSection['id']): Promise<void> {
    error.value = ''
    const result = unwrap(await window.lychee.recommend.refresh(id))
    const current = feed.value
    if (!current) {
      feed.value = result
      return
    }
    const next = new Map(current.sections.map((section) => [section.id, section]))
    for (const section of result.sections) next.set(section.id, section)
    const order: RecommendSection['id'][] = ['daily', 'radar', 'guess']
    feed.value = {
      sections: order
        .map((key) => next.get(key))
        .filter((section): section is RecommendSection => Boolean(section))
    }
  }

  function reset(): void {
    feed.value = null
    error.value = ''
  }

  return { feed, loading, error, load, refreshSection, reset }
})
