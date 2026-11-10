import { onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Song, SongAvailability } from '@shared/types'
import {
  PROBE_EMPTY_BATCH_LIMIT,
  PROBE_IDLE_FALLBACK_MS,
  PROBE_IDLE_TIMEOUT_MS,
  PROBE_MIDS_MAX
} from '@shared/constants'
import { IpcCallError, unwrap } from '../api'
import { useAuthStore } from '../stores/auth'

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
  const auth = useAuthStore()
  const availability = ref<Record<string, SongAvailability>>({})
  const loading = ref(false)
  let generation = 0
  let scheduled = 0
  let running = false
  let rerun = false
  let emptyBatchStreak = 0
  let suspended = false
  const covered = new Set<string>()

  async function probe(mids: string[], force: boolean): Promise<void> {
    const unique = [...new Set(mids)].filter((mid) => Boolean(mid))
    const targets = force ? unique : unique.filter((mid) => !covered.has(mid))
    if (targets.length === 0) return
    const token = generation
    loading.value = true
    try {
      for (let start = 0; start < targets.length; start += PROBE_MIDS_MAX) {
        if (token !== generation) return
        const batch = targets.slice(start, start + PROBE_MIDS_MAX)
        const results = unwrap(await window.lychee.song.probe(batch, { force }))
        if (token !== generation) return
        const next = { ...availability.value }
        for (const item of results) {
          next[item.songMid] = item
          covered.add(item.songMid)
        }
        availability.value = next

        if (results.length >= PROBE_MIDS_MAX && results.every((item) => !item.playable)) {
          emptyBatchStreak += 1
          if (emptyBatchStreak >= PROBE_EMPTY_BATCH_LIMIT) {
            // 连续整批不可播通常意味着登录/风控异常；停止本轮探测，避免继续轰炸上游。
            suspended = true
            break
          }
        } else {
          emptyBatchStreak = 0
        }
      }
    } catch (err) {
      // 可用性获取失败时静默保留未知状态；限流、鉴权或网络拒绝则暂停探测，避免继续轰炸上游。
      if (
        err instanceof IpcCallError &&
        (err.code === 'QUOTA_LIMITED' ||
          err.code === 'AUTH_EXPIRED' ||
          err.code === 'UPSTREAM_NETWORK')
      ) {
        suspended = true
      }
    } finally {
      if (token === generation) loading.value = false
    }
  }

  async function runProbe(force: boolean): Promise<void> {
    if (suspended && !force) return
    if (running) {
      rerun = true
      return
    }
    running = true
    try {
      let nextForce = force
      do {
        rerun = false
        await probe(
          songs.value.map((song) => song.songMid),
          nextForce
        )
        nextForce = false
      } while (rerun && !suspended)
    } finally {
      running = false
    }
  }

  function schedule(): void {
    generation += 1
    if (suspended) return
    const mids = songs.value.map((song) => song.songMid).filter(Boolean)
    if (mids.length === 0) return
    if (scheduled) {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(scheduled)
      else window.clearTimeout(scheduled)
    }
    scheduled = idle(() => {
      scheduled = 0
      void runProbe(false)
    })
  }

  watch(
    () => songs.value.map((song) => song.songMid).join('\u0000'),
    schedule,
    { immediate: true }
  )

  watch(
    () => auth.musicid,
    () => {
      covered.clear()
      emptyBatchStreak = 0
      suspended = false
      availability.value = {}
      schedule()
    }
  )

  async function refresh(): Promise<void> {
    covered.clear()
    emptyBatchStreak = 0
    suspended = false
    await runProbe(true)
  }

  // 离开歌单页后立即取消待执行的探测，并让进行中的批次在下一批前停止。
  onScopeDispose(() => {
    generation += 1
    if (scheduled) {
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(scheduled)
      else window.clearTimeout(scheduled)
      scheduled = 0
    }
  })

  return { availability, loading, refresh }
}
