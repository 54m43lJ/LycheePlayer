import { BrowserWindow, globalShortcut } from 'electron'
import { sendPlayerCommand } from '../ipc'

const registered: string[] = []

function showWindow(): void {
  const window = BrowserWindow.getAllWindows().find((item) => !item.isDestroyed())
  if (!window) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function actionFor(key: string): (() => void) | null {
  if (key === 'toggleWindow') return showWindow
  if (key === 'playPause') return () => sendPlayerCommand('toggle')
  if (key === 'next') return () => sendPlayerCommand('next')
  if (key === 'previous') return () => sendPlayerCommand('previous')
  return null
}

/** 注册全局快捷键；无效或冲突的绑定跳过，不阻塞启动。 */
export function registerShortcuts(bindings: Partial<Record<string, string>>): void {
  unregisterShortcuts()
  for (const [key, accelerator] of Object.entries(bindings)) {
    if (!accelerator) continue
    const action = actionFor(key)
    if (!action) continue
    try {
      if (globalShortcut.register(accelerator, action)) registered.push(accelerator)
    } catch {
      // 非法 accelerator 或系统占用时跳过。
    }
  }
}

export function unregisterShortcuts(): void {
  for (const accelerator of registered) {
    try {
      globalShortcut.unregister(accelerator)
    } catch {
      // 已随进程退出时忽略。
    }
  }
  registered.length = 0
}
