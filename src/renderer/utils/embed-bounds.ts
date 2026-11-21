import type { EmbedRect } from '@shared/types'

/**
 * 把登录组件的页面矩形夹到当前可见内容区内。
 * 返回宽 / 高为 0 表示完全不可见，主进程据此隐藏 WebContentsView，
 * 但不取消登录流程；这与 setEmbedBounds(null) 的语义不同。
 */
export function clampEmbedRect(rect: EmbedRect, area: EmbedRect): EmbedRect {
  const left = Math.max(rect.x, area.x)
  const top = Math.max(rect.y, area.y)
  const right = Math.min(rect.x + rect.width, area.x + area.width)
  const bottom = Math.min(rect.y + rect.height, area.y + area.height)
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}
