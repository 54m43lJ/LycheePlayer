import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHORTCUTS,
  copyShortcuts,
  formatShortcut,
  isShortcutBinding,
  matchesShortcut,
  normalizeShortcutKey,
  shortcutFromEvent,
  type ShortcutKeyInput
} from '../src/shared/shortcuts'

function key(overrides: Partial<ShortcutKeyInput>): ShortcutKeyInput {
  return {
    key: '',
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides
  }
}

describe('shortcut bindings', () => {
  it('formats the default bindings', () => {
    expect(formatShortcut(DEFAULT_SHORTCUTS.togglePlay)).toBe('空格')
    expect(formatShortcut(DEFAULT_SHORTCUTS.previous)).toBe('Ctrl + ←')
    expect(formatShortcut(DEFAULT_SHORTCUTS.next)).toBe('Ctrl + →')
    expect(formatShortcut(DEFAULT_SHORTCUTS.favorite)).toBe('Ctrl + D')
    expect(formatShortcut(DEFAULT_SHORTCUTS.addToPlaylist)).toBe('Ctrl + S')
  })

  it('matches modifiers and normalizes letter case', () => {
    expect(
      matchesShortcut(key({ key: 'd', ctrlKey: true }), DEFAULT_SHORTCUTS.favorite)
    ).toBe(true)
    expect(
      matchesShortcut(key({ key: 'D', ctrlKey: true, shiftKey: true }), DEFAULT_SHORTCUTS.favorite)
    ).toBe(false)
    expect(matchesShortcut(key({ key: 'd' }), DEFAULT_SHORTCUTS.favorite)).toBe(false)
    expect(matchesShortcut(key({ key: ' ' }), DEFAULT_SHORTCUTS.togglePlay)).toBe(true)
  })

  it('captures a binding from a key event', () => {
    expect(shortcutFromEvent(key({ key: 'Control', ctrlKey: true }))).toBeNull()
    expect(shortcutFromEvent(key({ key: 'S', ctrlKey: true, shiftKey: true }))).toEqual({
      key: 's',
      ctrl: true,
      alt: false,
      shift: true,
      meta: false
    })
  })

  it('rejects modifier-only or malformed bindings', () => {
    expect(isShortcutBinding(DEFAULT_SHORTCUTS.togglePlay)).toBe(true)
    expect(isShortcutBinding({ key: 'Control', ctrl: false, alt: false, shift: false, meta: false }))
      .toBe(false)
    expect(isShortcutBinding({ key: '', ctrl: false, alt: false, shift: false, meta: false })).toBe(
      false
    )
    expect(isShortcutBinding({ key: 'a', ctrl: 'yes', alt: false, shift: false, meta: false })).toBe(
      false
    )
  })

  it('copies bindings without sharing objects', () => {
    const copy = copyShortcuts(DEFAULT_SHORTCUTS)
    copy.favorite.ctrl = false
    expect(DEFAULT_SHORTCUTS.favorite.ctrl).toBe(true)
  })

  it('normalizes single-character keys only', () => {
    expect(normalizeShortcutKey('A')).toBe('a')
    expect(normalizeShortcutKey('ArrowLeft')).toBe('ArrowLeft')
  })
})
