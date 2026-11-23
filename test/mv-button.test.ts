import { describe, expect, it, vi } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import MvButton from '../src/renderer/components/MvButton.vue'

vi.mock('vue-router', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    RouterLink: defineComponent({
      props: { to: { type: String, required: true } },
      setup(props, { slots }) {
        return () => h('a', { href: props.to }, slots.default?.())
      }
    })
  }
})

function render(props: { mvId: string; size?: number }): Promise<string> {
  return renderToString(createSSRApp(MvButton, props))
}

describe('MvButton', () => {
  it('links to the MV page with an accessible name and larger default triangle', async () => {
    const html = await render({ mvId: 'abc123' })
    expect(html).toContain('href="/mv/abc123"')
    expect(html).toContain('aria-label="播放 MV"')
    expect(html).toContain('width="13"')
  })

  it('accepts a custom triangle size', async () => {
    const html = await render({ mvId: 'abc123', size: 15 })
    expect(html).toContain('width="15"')
  })

  it('renders nothing without an MV id', async () => {
    expect(await render({ mvId: '' })).not.toContain('mv-mark')
  })
})
