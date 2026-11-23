import type { ShortcutAction, ShortcutBinding, Shortcuts } from './types'

export interface ShortcutActionInfo {
  id: ShortcutAction
  label: string
}

/** 快捷键配置页的固定动作顺序。 */
export const SHORTCUT_ACTIONS: ShortcutActionInfo[] = [
  { id: 'togglePlay', label: '播放 / 暂停' },
  { id: 'previous', label: '上一首' },
  { id: 'next', label: '下一首' },
  { id: 'favorite', label: '喜欢当前歌曲' },
  { id: 'addToPlaylist', label: '收藏到歌单' }
]

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = Object.fromEntries(
  SHORTCUT_ACTIONS.map((action) => [action.id, action.label])
) as Record<ShortcutAction, string>

export const DEFAULT_SHORTCUTS: Shortcuts = {
  togglePlay: { key: ' ', ctrl: false, alt: false, shift: false, meta: false },
  previous: { key: 'ArrowLeft', ctrl: true, alt: false, shift: false, meta: false },
  next: { key: 'ArrowRight', ctrl: true, alt: false, shift: false, meta: false },
  favorite: { key: 'd', ctrl: true, alt: false, shift: false, meta: false },
  addToPlaylist: { key: 's', ctrl: true, alt: false, shift: false, meta: false }
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'CapsLock'])

const KEY_LABELS: Record<string, string> = {
  ' ': '空格',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Home: 'Home',
  End: 'End'
}

/** 与 DOM KeyboardEvent 结构兼容的按键输入；主进程编译单元不引用 DOM 类型。 */
export interface ShortcutKeyInput {
  key: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/** 单字符键统一为小写，其余键名保持原样。 */
export function normalizeShortcutKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key
}

/** 结构校验：拒绝空键、单独的修饰键与过长键名。 */
export function isShortcutBinding(value: unknown): value is ShortcutBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const binding = value as Record<string, unknown>
  return (
    typeof binding.key === 'string' &&
    binding.key.length > 0 &&
    binding.key.length <= 32 &&
    !MODIFIER_KEYS.has(binding.key) &&
    typeof binding.ctrl === 'boolean' &&
    typeof binding.alt === 'boolean' &&
    typeof binding.shift === 'boolean' &&
    typeof binding.meta === 'boolean'
  )
}

export function copyShortcuts(source: Shortcuts): Shortcuts {
  return {
    togglePlay: { ...source.togglePlay },
    previous: { ...source.previous },
    next: { ...source.next },
    favorite: { ...source.favorite },
    addToPlaylist: { ...source.addToPlaylist }
  }
}

export function matchesShortcut(event: ShortcutKeyInput, binding: ShortcutBinding): boolean {
  if (event.key === 'Dead' || event.key === 'Unidentified') return false
  return (
    event.ctrlKey === binding.ctrl &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift &&
    event.metaKey === binding.meta &&
    normalizeShortcutKey(event.key) === normalizeShortcutKey(binding.key)
  )
}

/** 把按键事件转换为绑定；只按下修饰键时返回 null，继续等待主键。 */
export function shortcutFromEvent(event: ShortcutKeyInput): ShortcutBinding | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  if (event.key === 'Dead' || event.key === 'Unidentified') return null
  return {
    key: normalizeShortcutKey(event.key),
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  }
}

export function formatShortcutKey(key: string): string {
  const label = KEY_LABELS[key]
  if (label) return label
  return key.length === 1 ? key.toUpperCase() : key
}

export function formatShortcut(binding: ShortcutBinding): string {
  const parts: string[] = []
  if (binding.ctrl) parts.push('Ctrl')
  if (binding.alt) parts.push('Alt')
  if (binding.shift) parts.push('Shift')
  if (binding.meta) parts.push('Meta')
  parts.push(formatShortcutKey(binding.key))
  return parts.join(' + ')
}
