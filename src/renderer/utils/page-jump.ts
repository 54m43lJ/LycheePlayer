export const PAGE_JUMP_THRESHOLD = 120
/** 顶部 / 底部跳转的固定过渡时长（毫秒）。 */
export const JUMP_TRANSITION_MS = 400

let active: { el: HTMLElement; frame: number } | null = null

/** 取消正在进行的跳转过渡；传入元素时只取消该元素的过渡。 */
export function cancelJumpScroll(el?: HTMLElement): void {
  if (!active || (el && active.el !== el)) return
  cancelAnimationFrame(active.frame)
  active = null
}

/** 跳转过渡的缓出进度（0–1），时长固定为 JUMP_TRANSITION_MS。 */
export function jumpProgress(elapsedMs: number, duration = JUMP_TRANSITION_MS): number {
  if (duration <= 0) return 1
  const t = Math.min(1, Math.max(0, elapsedMs / duration))
  return 1 - (1 - t) ** 3
}

/**
 * 以固定时长把滚动容器滚到目标位置。
 * 重复调用会先取消上一段过渡；目标值夹在容器的可滚动范围内。
 */
export function scrollWithTransition(
  el: HTMLElement,
  top: number,
  duration = JUMP_TRANSITION_MS
): void {
  cancelJumpScroll()
  const max = Math.max(0, el.scrollHeight - el.clientHeight)
  const target = Math.min(Math.max(0, top), max)
  const from = el.scrollTop
  if (duration <= 0 || from === target) {
    el.scrollTop = target
    return
  }
  const start = performance.now()
  const step = (now: number): void => {
    const progress = jumpProgress(now - start, duration)
    el.scrollTop = from + (target - from) * progress
    if (progress < 1) {
      active = { el, frame: requestAnimationFrame(step) }
      return
    }
    active = null
  }
  active = { el, frame: requestAnimationFrame(step) }
}

/** 按滚动位置判断是否显示顶部 / 底部跳转按钮。 */
export function jumpVisibility(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = PAGE_JUMP_THRESHOLD
): { top: boolean; bottom: boolean } {
  return {
    top: scrollTop > threshold,
    bottom: scrollTop + clientHeight < scrollHeight - threshold
  }
}
