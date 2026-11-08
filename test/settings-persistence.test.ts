import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
})
