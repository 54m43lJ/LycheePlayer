import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RecommendFeed, RecommendSection } from '@shared/types'
import {
  RECOMMEND_SECTION_IDS,
  RECOMMEND_SECTION_TITLES
} from '@shared/constants'
import { unwrap } from '../api'

type SectionId = RecommendSection['id']

function placeholders(): RecommendSection[] {
  return RECOMMEND_SECTION_IDS.map((id) => ({
    id,
    title: RECOMMEND_SECTION_TITLES[id],
    songs: [],
    playlists: [],
    refreshedAtMs: 0,
    expiresAtMs: 0
  }))
}

function emptyLoading(): Record<SectionId, boolean> {
  return { daily: false, radar: false, guess: false }
}

function emptyErrors(): Record<SectionId, string> {
  return { daily: '', radar: '', guess: '' }
}

export const useRecommendStore = defineStore('recommend', () => {
  const feed = ref<RecommendFeed>({ sections: placeholders() })
  const loadingIds = ref<Record<SectionId, boolean>>(emptyLoading())
  const errors = ref<Record<SectionId, string>>(emptyErrors())
  const loading = computed(() => RECOMMEND_SECTION_IDS.some((id) => loadingIds.value[id]))
  const error = computed(
    () => RECOMMEND_SECTION_IDS.map((id) => errors.value[id]).find(Boolean) ?? ''
  )
  let session = 0
  let requestSeq = 0
  let activeRequest: number | null = null

  function replaceSection(section: RecommendSection): void {
    feed.value = {
      sections: feed.value.sections.map((item) => (item.id === section.id ? section : item))
    }
  }

  function setLoading(id: SectionId, value: boolean): void {
    loadingIds.value = { ...loadingIds.value, [id]: value }
  }

  function setError(id: SectionId, message: string): void {
    errors.value = { ...errors.value, [id]: message }
  }

  /** 一个分区一次请求；页面仍按固定顺序填充，避免并发突增。 */
  async function fetchSection(
    id: SectionId,
    force: boolean,
    sessionToken: number
  ): Promise<void> {
    setLoading(id, true)
    setError(id, '')
    const token = ++requestSeq
    activeRequest = token
    try {
      const result = unwrap(
        force
          ? await window.lychee.recommend.refresh(id, token)
          : await window.lychee.recommend.get(id, token)
      )
      if (sessionToken !== session) return
      const section = result.sections.find((item) => item.id === id)
      if (section) replaceSection(section)
    } catch (err) {
      if (sessionToken !== session) return
      setError(id, err instanceof Error ? err.message : String(err))
    } finally {
      if (activeRequest === token) activeRequest = null
      if (sessionToken === session) setLoading(id, false)
    }
  }

  /** 打开发现页：立即渲染占位，再按 daily → radar → guess 逐块填充。 */
  async function load(force = false): Promise<void> {
    if (loading.value) return
    const token = ++session
    for (const id of RECOMMEND_SECTION_IDS) {
      if (token !== session) return
      // 每日推荐按自然日自动过期，手动刷新不能绕过当天缓存。
      await fetchSection(id, force && id !== 'daily', token)
    }
  }

  /** 只刷新一个分区；每日推荐只允许在占位 / 过期时重新获取，不做强制刷新。 */
  async function refreshSection(id: SectionId): Promise<void> {
    if (loading.value) return
    const daily = feed.value.sections.find((item) => item.id === 'daily')
    if (id === 'daily' && daily && daily.refreshedAtMs > 0 && daily.expiresAtMs > Date.now()) {
      return
    }
    const token = ++session
    await fetchSection(id, id !== 'daily', token)
  }

  /** 每日推荐是否已跨过上海自然日 0 点。 */
  function isDailyExpired(now = Date.now()): boolean {
    const daily = feed.value.sections.find((item) => item.id === 'daily')
    return Boolean(
      daily && daily.refreshedAtMs > 0 && daily.expiresAtMs > 0 && now >= daily.expiresAtMs
    )
  }

  /** 页面跨日打开时由定时器调用；过期后用普通 get 拉取当天日推。 */
  async function refreshDailyIfExpired(): Promise<void> {
    if (loading.value || !isDailyExpired()) return
    const token = ++session
    await fetchSection('daily', false, token)
  }

  /** 离开发现页：取消已排队请求，让进行中的请求在下一批前停止。 */
  function cancel(): void {
    session += 1
    if (activeRequest !== null) {
      const token = activeRequest
      activeRequest = null
      void window.lychee.recommend.cancel(token).catch(() => undefined)
    }
    loadingIds.value = emptyLoading()
  }

  function reset(): void {
    cancel()
    feed.value = { sections: placeholders() }
    errors.value = emptyErrors()
  }

  return {
    feed,
    loading,
    loadingIds,
    errors,
    error,
    load,
    refreshSection,
    isDailyExpired,
    refreshDailyIfExpired,
    cancel,
    reset
  }
})
