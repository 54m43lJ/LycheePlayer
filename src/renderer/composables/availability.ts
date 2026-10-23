import { ref, watch, type Ref } from 'vue'
import type { Song, SongAvailability } from '@shared/types'
import { PROBE_IDLE_FALLBACK_MS, PROBE_IDLE_TIMEOUT_MS, PROBE_MIDS_MAX } from '@shared/constants'
import { unwrap } from '../api'

function idle(callback: () => void): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: PROBE_IDLE_TIMEOUT_MS })
  }
  return window.setTimeout(callback, PROBE_IDLE_FALLBACK_MS)
}

export function useAvailability(songs: Ref<Song[]>): {
  availability: Ref<Record<string, SongAvailability>>
  loading: Ref<boolean>
  refresh(): Promise<void>
} {
  const availability = ref<Record<string, SongAvailability>>({})
  const loading = ref(false)
  let generation = 0
  let scheduled = 0

  async function probe(mids: string[], force: boolean): Promise<void> {
    const unique = [...new Set(mids)].filter((mid) => Boolean(mid))
    if (unique.length === 0) return
    loading.value = true
    const token = generation
    try {
      for (let start = 0; start < unique.length; start += PROBE_MIDS_MAX) {
        if (token !== generation) return
        const batch = unique.slice(start, start + PROBE_MIDS_MAX)
        const results = unwrap(await window.lychee.song.probe(batch, { force }))
        if (token !== generation) return
        const next = { ...availability.value }
        for (const item of results) next[item.songMid] = item
        availability.value = next
      }
    } catch {
      // 可用性获取失败时静默保留未知状态。
    } finally {
      if (token === generation) loading.value = false
    }
  }

  function schedule(): void {
    generation += 1
    const mids = songs.value.map((song) => song.songMid).filter(Boolean)
    if (mids.length === 0) return
    if (scheduled) {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(scheduled)
      else window.clearTimeout(scheduled)
    }
    scheduled = idle(() => {
      scheduled = 0
      void probe(mids, false)
    })
  }

  watch(
    () => songs.value.map((song) => song.songMid).join('\u0000'),
    schedule,
    { immediate: true }
  )

  async function refresh(): Promise<void> {
    await probe(
      songs.value.map((song) => song.songMid),
      true
    )
  }

  return { availability, loading, refresh }
}
