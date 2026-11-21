import { onBeforeUnmount, watch } from 'vue'

type Dismiss = () => void

/** 已打开浮层的关闭函数；后注册者位于栈顶。 */
const stack: Dismiss[] = []

/** 注册一个可被“后退”关闭的浮层；返回注销函数。 */
export function pushBackDismiss(dismiss: Dismiss): () => void {
  stack.push(dismiss)
  let released = false
  return () => {
    if (released) return
    released = true
    const index = stack.lastIndexOf(dismiss)
    if (index !== -1) stack.splice(index, 1)
  }
}

/** 关闭最上层浮层；没有浮层时返回 false。 */
export function dismissTopPopup(): boolean {
  const dismiss = stack[stack.length - 1]
  if (!dismiss) return false
  dismiss()
  return true
}

/** 浮层打开期间注册“后退关闭”，关闭或卸载时自动注销。 */
export function useBackDismiss(isOpen: () => boolean, dismiss: Dismiss): void {
  let release: (() => void) | null = null

  function sync(open: boolean): void {
    release?.()
    release = open ? pushBackDismiss(dismiss) : null
  }

  watch(isOpen, sync, { immediate: true })
  onBeforeUnmount(() => {
    release?.()
    release = null
  })
}

/**
 * 安装全局后退处理：优先关闭最上层浮层，否则沿路由历史后退。
 * 返回卸载函数。主进程只转发系统手势，导航决策留在渲染层。
 */
export function installBackNavigation(fallback: () => void): () => void {
  let lastBackAt = 0

  function runBack(): void {
    // Linux 的鼠标后退会分别上报按下 / 抬起；同一次操作只处理一次。
    const now = Date.now()
    if (now - lastBackAt < 200) return
    lastBackAt = now
    if (dismissTopPopup()) return
    fallback()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!event.altKey || event.key !== 'ArrowLeft') return
    event.preventDefault()
    runBack()
  }

  function onMouseUp(event: MouseEvent): void {
    // 拦掉 Chromium 自带的鼠标侧键历史导航；后退统一由主进程推送后处理。
    if (event.button !== 3) return
    event.preventDefault()
    event.stopPropagation()
  }

  const offBack = window.lychee.navigation.onBack(runBack)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseup', onMouseUp, true)

  return () => {
    offBack()
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('mouseup', onMouseUp, true)
  }
}
