import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import ConfirmDialog from '../src/renderer/components/ConfirmDialog.vue'

describe('ConfirmDialog', () => {
  it('renders the title, message and danger action when open', async () => {
    const app = createSSRApp(ConfirmDialog, {
      open: true,
      title: '从歌单删除',
      message: '确定删除「晴天」？',
      confirmLabel: '删除',
      danger: true
    })
    const html = await renderToString(app)

    expect(html).toContain('从歌单删除')
    expect(html).toContain('确定删除「晴天」？')
    expect(html).toContain('danger')
    expect(html).toContain('删除')
  })

  it('renders nothing when closed', async () => {
    const app = createSSRApp(ConfirmDialog, {
      open: false,
      title: '从歌单删除',
      message: '确定删除「晴天」？'
    })
    const html = await renderToString(app)

    expect(html).not.toContain('dialog-backdrop')
  })
})
