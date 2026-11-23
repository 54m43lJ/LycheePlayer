import { onBeforeUnmount, watch } from 'vue'
import type { Router } from 'vue-router'

type Dismiss = () => void

/** 已打开浮层的关闭函数；后注册者位于栈顶。 */
const popupStack: Dismiss[] = []
/** 页面访问栈；最后一项是当前页面。 */
const pageStack: string[] = []
let routerRef: Router | null = null
let homePath = '/discover'
let navigatingBack = false

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
  if (!path || path === '/' || path === '/login') return
  if (pageStack.length === 0) {
    if (path !== homePath) pageStack.push(homePath)
    pageStack.push(path)
    return
  }
  if (pageStack[pageStack.length - 1] === path) return
  pageStack.push(path)
}

/**
 * 安装页面访问栈：每次路由切换把最终路径压栈，供 goBack() 使用。
 * 登录页不进入页面栈，避免登录后后退回到登录页。
 */
export function installPageHistory(router: Router, home = '/discover'): () => void {
  routerRef = router
  homePath = home
  pageStack.length = 0
  navigatingBack = false
  const initial = router.currentRoute.value.fullPath
  if (initial) recordPage(initial)
  const removeAfterEach = router.afterEach((to, _from, failure) => {
    if (navigatingBack) {
      navigatingBack = false
      return
    }
    if (!failure) recordPage(to.fullPath)
  })
  return () => {
    removeAfterEach()
    if (routerRef === router) routerRef = null
    pageStack.length = 0
    navigatingBack = false
  }
}

/** 后退：优先关闭浮层；没有浮层时按页面访问栈返回上一页。 */
export function goBack(): void {
  if (dismissTopPopup()) return
  const router = routerRef
  if (!router) return
  const current = router.currentRoute.value.fullPath
  if (pageStack[pageStack.length - 1] === current) pageStack.pop()
  const target = pageStack[pageStack.length - 1] ?? homePath
  if (!target || target === current) return
  navigatingBack = true
  void router.replace(target)
}

/**
 * 安装全局后退处理：优先关闭最上层浮层，否则按页面访问栈返回上一页。
 * 返回卸载函数。主进程只转发系统手势，导航决策留在渲染层。
 */
export function installBackNavigation(router: Router, home = '/discover'): () => void {
  const removePageHistory = installPageHistory(router, home)
  let lastBackAt = 0

  function runBack(): void {
    // Linux 的鼠标后退会分别上报按下 / 抬起；同一次操作只处理一次。
    const now = Date.now()
    if (now - lastBackAt < 200) return
    lastBackAt = now
    goBack()
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
    removePageHistory()
    offBack()
    document.removeEventListener('keydown', onKeydown)
    window.removeEventListener('mouseup', onMouseUp, true)
  }
}
