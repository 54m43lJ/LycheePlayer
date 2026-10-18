import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Quality, Settings } from '../shared/types'

const QUALITIES: Quality[] = ['128k', '320k', 'flac']

const DEFAULTS: Settings = {
  defaultQuality: 'auto',
  closeToTray: true,
  theme: 'dark'
}

let current: Settings = { ...DEFAULTS }

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function sanitize(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...DEFAULTS }
  const raw = value as Record<string, unknown>
  return {
    defaultQuality:
      raw.defaultQuality === 'auto' || QUALITIES.includes(raw.defaultQuality as Quality)
        ? (raw.defaultQuality as Settings['defaultQuality'])
        : DEFAULTS.defaultQuality,
    closeToTray:
      typeof raw.closeToTray === 'boolean' ? raw.closeToTray : DEFAULTS.closeToTray,
    theme: raw.theme === 'light' ? 'light' : 'dark'
  }
}

export function loadSettings(): Settings {
  try {
    current = sanitize(JSON.parse(readFileSync(settingsFile(), 'utf8')))
  } catch {
    current = { ...DEFAULTS }
  }
  return { ...current }
}

export function getSettings(): Settings {
  return { ...current }
}

export async function saveSettings(next: Settings): Promise<void> {
  current = sanitize(next)
  const file = settingsFile()
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(current, null, 2), { mode: 0o600 })
}
