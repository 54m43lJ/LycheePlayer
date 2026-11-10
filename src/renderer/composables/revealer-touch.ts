import { nextTick, ref, type Ref } from 'vue'

const TOUCH_THRESHOLD = 8

export interface RevealerTouchOptions {
  /** 包含按钮与弹层选项的容器。 */
  container: Ref<HTMLElement | null>
  open: () => void
  close: () => void
  confirm: (index: number) => void
}

/**
 * Revealer 触屏手势：从按钮开始上下滑动时打开弹层，按手指位置高亮最近的选项，
 * 松开确认；普通轻点不拦截原生 click，仍执行按钮原有行为。
 */
export function useRevealerTouch(options: RevealerTouchOptions) {
  const highlighted = ref(-1)
  let pressing = false
  let active = false
  let startY = 0
  let pointerId: number | null = null
  let suppressClick = false

  function optionElements(): HTMLElement[] {
    return Array.from(
      options.container.value?.querySelectorAll<HTMLElement>('[data-revealer-option]') ?? []
    )
  }

  function highlightAt(clientY: number): void {
    const elements = optionElements()
    if (elements.length === 0) return
    let best = 0
    let bestDistance = Number.POSITIVE_INFINITY
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect()
      const distance = Math.abs((rect.top + rect.bottom) / 2 - clientY)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    highlighted.value = best
  }

  function onPointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') return
    pressing = true
    active = false
    startY = event.clientY
    pointerId = event.pointerId
    highlighted.value = -1
  }

  function onPointerMove(event: PointerEvent): void {
    if (!pressing || event.pointerId !== pointerId) return
    if (!active) {
      if (Math.abs(event.clientY - startY) <= TOUCH_THRESHOLD) return
      active = true
      ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
      options.open()
      void nextTick().then(() => highlightAt(event.clientY))
    }
    highlightAt(event.clientY)
    event.preventDefault()
  }

  function finish(event: PointerEvent, cancelled: boolean): void {
    if (!pressing || event.pointerId !== pointerId) return
    const wasActive = active
    const index = highlighted.value
    pressing = false
    active = false
    highlighted.value = -1
    pointerId = null
    if (!wasActive) return
    ;(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId)
    suppressClick = true
    window.setTimeout(() => {
      suppressClick = false
    }, 0)
    if (!cancelled && index >= 0) options.confirm(index)
    else options.close()
  }

  function onPointerUp(event: PointerEvent): void {
    finish(event, false)
  }

  function onPointerCancel(event: PointerEvent): void {
    finish(event, true)
  }

  function onClickCapture(event: Event): void {
    if (!suppressClick) return
    event.preventDefault()
    event.stopPropagation()
  }

  return {
    highlighted,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClickCapture
  }
}
