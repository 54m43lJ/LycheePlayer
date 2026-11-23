import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const state = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { getPath: () => state.dir }
}))

const MiB = 1024 * 1024

beforeAll(() => {
  state.dir = mkdtempSync(join(tmpdir(), 'lychee-settings-'))
})

afterAll(() => {
  rmSync(state.dir, { recursive: true, force: true })
})

describe('settings persistence', () => {
  it('writes audioCacheMaxBytes to disk and loads it after restart', async () => {
    const { createDefaultSettings, saveSettings, loadSettings } = await import(
      '../src/main/settings'
    )
    const limit = 512 * MiB
    saveSettings({ ...createDefaultSettings(), audioCacheMaxBytes: limit })

    const onDisk = JSON.parse(readFileSync(join(state.dir, 'settings.json'), 'utf8'))
    expect(onDisk.audioCacheMaxBytes).toBe(limit)
    expect(loadSettings().audioCacheMaxBytes).toBe(limit)
  })

  it('normalizes an unsupported persisted value to the nearest preset', async () => {
    const { createDefaultSettings, saveSettings, loadSettings } = await import(
      '../src/main/settings'
    )
    saveSettings({ ...createDefaultSettings(), audioCacheMaxBytes: 700 * MiB })
    expect(loadSettings().audioCacheMaxBytes).toBe(512 * MiB)
  })

  it('persists shortcut overrides and fills missing actions with defaults', async () => {
    const { createDefaultSettings, saveSettings, loadSettings } = await import(
      '../src/main/settings'
    )
    const { DEFAULT_SHORTCUTS, copyShortcuts } = await import('../src/shared/shortcuts')
    const shortcuts = copyShortcuts(DEFAULT_SHORTCUTS)
    shortcuts.favorite = { key: 'f', ctrl: true, alt: false, shift: false, meta: false }
    saveSettings({ ...createDefaultSettings(), shortcuts })

    const loaded = loadSettings()
    expect(loaded.shortcuts.favorite).toEqual({
      key: 'f',
      ctrl: true,
      alt: false,
      shift: false,
      meta: false
    })
    expect(loaded.shortcuts.previous).toEqual(DEFAULT_SHORTCUTS.previous)
  })

  it('falls back to the default binding when a persisted shortcut is malformed', async () => {
    const { createDefaultSettings, loadSettings } = await import('../src/main/settings')
    const { DEFAULT_SHORTCUTS } = await import('../src/shared/shortcuts')
    writeFileSync(
      join(state.dir, 'settings.json'),
      JSON.stringify({
        ...createDefaultSettings(),
        shortcuts: { favorite: { key: 'Control', ctrl: true } }
      })
    )

    expect(loadSettings().shortcuts.favorite).toEqual(DEFAULT_SHORTCUTS.favorite)
  })
})
