import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import MemberBadge from '../src/renderer/components/MemberBadge.vue'
import type { VipLevel, VipStatus } from '../src/shared/types'

function status(level: VipLevel, state: VipStatus['state'] = 'known'): VipStatus {
  return { state, isVip: level !== 'none', level, expiresAtMs: null }
}

function render(props: { status: VipStatus | null; showLabel?: boolean }): Promise<string> {
  return renderToString(createSSRApp(MemberBadge, props))
}

describe('MemberBadge', () => {
  it('renders a labelled green diamond for 绿钻', async () => {
    const html = await render({ status: status('vip') })
    expect(html).toContain('member-vip')
    expect(html).toContain('aria-label="绿钻"')
    expect(html).toContain('role="img"')
    expect(html).not.toContain('member-badge-label')
  })

  it('renders 豪华绿钻 with its label and lower-right V', async () => {
    const html = await render({ status: status('deluxe'), showLabel: true })
    expect(html).toContain('member-deluxe')
    expect(html).toContain('豪华绿钻')
    expect(html).toContain('member-badge-label')
    expect(html).toContain('member-v')
  })

  it('renders 超级会员 with the gold diamond and centered V', async () => {
    const html = await render({ status: status('super'), showLabel: true })
    expect(html).toContain('member-super')
    expect(html).toContain('超级会员')
    expect(html).toContain('member-v')
  })

  it('renders nothing for unknown, non-member or missing status', async () => {
    expect(await render({ status: status('vip', 'unknown') })).not.toContain('member-badge')
    expect(await render({ status: status('none') })).not.toContain('member-badge')
    expect(await render({ status: null })).not.toContain('member-badge')
  })
})
