import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MvDetail, MvStream } from '@shared/types'
import { unwrap } from '../api'

export const useMvStore = defineStore('mv', () => {
  const detail = ref<MvDetail | null>(null)
  const stream = ref<MvStream | null>(null)
  const loading = ref(false)
  const quality = ref<MvStream['quality']>('hd')

  async function load(mvId: string, nextQuality?: MvStream['quality']): Promise<void> {
    if (!mvId) return
    loading.value = true
    try {
      if (!detail.value || detail.value.mvId !== mvId) {
        detail.value = unwrap(await window.lychee.mv.getDetail(mvId))
      }
      if (nextQuality) quality.value = nextQuality
      stream.value = unwrap(await window.lychee.mv.getStream(mvId, quality.value))
    } finally {
      loading.value = false
    }
  }

  async function setQuality(nextQuality: MvStream['quality']): Promise<void> {
    if (!detail.value) return
    quality.value = nextQuality
    stream.value = unwrap(
      await window.lychee.mv.getStream(detail.value.mvId, nextQuality)
    )
  }

  return { detail, stream, loading, quality, load, setQuality }
})
