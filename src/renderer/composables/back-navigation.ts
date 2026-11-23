import { onBeforeUnmount, watch } from 'vue'
import type { Router } from 'vue-router'

type Dismiss = () => void

/** 已打开浮层的关闭函数；后注册者位于栈顶。 */
const popupStack: Dismiss[] = []
/** 页面访问栈；最后一项是当前页面。 */
const pageStack: string[] = []
/** 后退时弹出的页面；前进时按后进先出恢复。 */
const forwardStack: string[] = []
let routerRef: Router | null = null
let homePath = '/discover'
let navigatingHistory = false

/** 注册一个可被“后退”关闭的浮层；返回注销函数。 */
export function pushBackDismiss(dismiss: Dismiss): () => void {
  popupStack.push(dismiss)
  let released = false
  return () => {
    if (released) return
    released = true
    const index = popupStack.lastIndexOf(dismiss)
    if (index !== -1) popupStack.splice(index, 1)
  }
}

/** 关闭最上层浮层；没有浮层时返回 false。 */
export function dismissTopPopup(): boolean {
  const dismiss = popupStack[popupStack.length - 1]
  if (!dismiss) return false
  dismiss()
  return true
}

/** 当前是否有打开的浮层；前进时用于避免在浮层背后导航。 */
export function hasOpenPopup(): boolean {
  return popupStack.length > 0
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

function recordPage(path: string): void {
  if (!path || path === '/') return
  // 任何普通页面导航都会截断前进链，等价于浏览器的新导航。
  forwardStack.length = 0
  if (path === '/login') return
  if (pageStack.length === 0) {
    if (path !== homePath) pageStack.push(homePath)
    pageStack.push(path)
    return
  }
  if (pageStack[pageStack.length - 1] === path) return
  pageStack.push(path)
}

/**
 * 安装页面访问栈：每次路由切换把最终路径压栈，供 goBack() / goForward() 使用。
 * 登录页不进入页面栈，避免登录后后退回到登录页。
 */
export function installPageHistory(router: Router, home = '/discover'): () => void {
  routerRef = router
  homePath = home
  pageStack.length = 0
  forwardStack.length = 0
  navigatingHistory = false
  const initial = router.currentRoute.value.fullPath
  if (initial) recordPage(initial)
  const removeAfterEach = router.afterEach((to, _from, failure) => {
    if (navigatingHistory) {
      navigatingHistory = false
      return
    }
    if (!failure) recordPage(to.fullPath)
  })
  return () => {
    removeAfterEach()
    if (routerRef === router) routerRef = null
    pageStack.length = 0
    forwardStack.length = 0
    navigatingHistory = false
  }
}

function navigateHistory(target: string): void {
  const router = routerRef
  if (!router) return
  navigatingHistory = true
  try {
    void router.replace(target)
  } catch {
    navigatingHistory = false
  }
}

/** 后退：优先关闭浮层；没有浮层时按页面访问栈返回上一页，并压入前进栈。 */
export function goBack(): void {
  if (dismissTopPopup()) return
  const router = routerRef
  if (!router) return
  const current = router.currentRoute.value.fullPath
  let target = pageStack[pageStack.length - 1] ?? homePath
  if (pageStack[pageStack.length - 1] === current) {
    target = pageStack[pageStack.length - 2] ?? homePath
    if (target === current) return
    pageStack.pop()
    forwardStack.push(current)
  }
  if (!target || target === current) return
  navigateHistory(target)
}

/** 前进：浮层打开时不动作；否则恢复最近一次后退前的页面。 */
export function goForward(): void {
  if (hasOpenPopup()) return
  const router = routerRef
  if (!router) return
  const target = forwardStack.pop()
  if (!target) return
  const current = router.currentRoute.value.fullPath
  if (target === current) return
  if (pageStack[pageStack.length - 1] !== target) pageStack.push(target)
  navigateHistory(target)
}

/**
 * 安装全局后退 / 前进处理：后退优先关闭最上层浮层，否则按页面访问栈返回上一页；
 * 前进在无浮层时恢复后退前的页面。返回卸载函数。主进程只转发系统手势，导航决策留在渲染层。
 */
export function installBackNavigation(router: Router, home = '/discover'): () => void {
  const removePageHistory = installPageHistory(router, home)
  let lastBackAt = 0
  let lastForwardAt = 0

  function debounced(kind: 'back' | 'forward'): void {
    const now = Date.now()
    if (kind === 'back') {
      // Linux 的鼠标后退会分别上报按下 / 抬起；同一次操作只处理一次。
      if (now - lastBackAt < 200) return
      lastBackAt = now
      goBack()
      return
    }
    if (now - lastForwardAt < 200) return
    lastForwardAt = now
    goForward()
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!event.altKey) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      debounced('back')
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      debounced('forward')
    }
  }

  function onMouseUp(event: MouseEvent): void {
    // 拦掉 Chromium 自带的鼠标侧键历史导航；后退 / 前进统一由主进程推送后处理。
    if (event.button !== 3 && event.button !== 4) return
    event.preventDefault()
    event.stopPropagation()
  }

  const offBack = window.lychee.navigation.onBack(() => debounced('back'))
  const offForward = window.lychee.navigation.onForward(() => debounced('forward'))
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('mouseup', onMouseUp, true)

  return () => {
    removePageHistory()
    offBack()
    offForward()
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('mouseup', onMouseUp, true)
  }
}
