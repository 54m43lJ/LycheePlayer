import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia, setActivePinia } from 'pinia'
import type { DownloadTask } from '../src/shared/types'
import DownloadsView from '../src/renderer/views/DownloadsView.vue'
import { useDownloadStore } from '../src/renderer/stores/download'

function task(id: string): DownloadTask {
  return {
    id,
    songMid: `mid-${id}`,
    name: `Song ${id}`,
    quality: 'flac',
    filePath: `/tmp/${id}.flac`,
    coverPath: null,
    status: 'downloading',
    receivedBytes: 10,
    totalBytes: 100,
    error: '',
    source: 'network'
  }
}

describe('DownloadsView', () => {
  it('renders task rows from the download store', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useDownloadStore()
    store.tasks = [task('a'), task('b')]

    const app = createSSRApp(DownloadsView).use(pinia)
    const html = await renderToString(app)

    expect(html).toContain('Song a')
    expect(html).toContain('Song b')
    expect(html).toContain('downloads-progress-track')
    expect(html).not.toContain('(0/2)')
    expect(html).not.toContain('downloads-progress-count')
    expect(html).toContain('全部开始')
  })
})
