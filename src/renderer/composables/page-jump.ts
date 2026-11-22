import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue'
import { cancelJumpScroll, jumpVisibility, scrollWithTransition } from '../utils/page-jump'

/** 页面级“跳转到顶部 / 底部”按钮：跟随 .main 滚动容器与内容尺寸变化。 */
export function usePageJump(rootRef: Ref<HTMLElement | null>): {
  showTop: Ref<boolean>
  showBottom: Ref<boolean>
  scrollToTop: () => void
  scrollToBottom: () => void
} {
  const showTop = ref(false)
  const showBottom = ref(false)
  let scrollRoot: HTMLElement | null = null
  let contentObserver: ResizeObserver | null = null

  function update(): void {
    const el = scrollRoot
    if (!el) {
      showTop.value = false
      showBottom.value = false
      return
    }
    const visible = jumpVisibility(el.scrollTop, el.clientHeight, el.scrollHeight)
    showTop.value = visible.top
    showBottom.value = visible.bottom
  }

  function scrollToTop(): void {
    const el = scrollRoot
    if (el) scrollWithTransition(el, 0)
  }

  function scrollToBottom(): void {
    const el = scrollRoot
    if (el) scrollWithTransition(el, el.scrollHeight)
  }

  onMounted(() => {
    scrollRoot = rootRef.value?.closest<HTMLElement>('.main') ?? null
    scrollRoot?.addEventListener('scroll', update, { passive: true })
    if (rootRef.value) {
      contentObserver = new ResizeObserver(() => update())
      contentObserver.observe(rootRef.value)
    }
    update()
  })

  onBeforeUnmount(() => {
    if (scrollRoot) cancelJumpScroll(scrollRoot)
    scrollRoot?.removeEventListener('scroll', update)
    scrollRoot = null
    contentObserver?.disconnect()
    contentObserver = null
  })

  return { showTop, showBottom, scrollToTop, scrollToBottom }
}
