import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Quality, Settings } from '../shared/types'

const QUALITIES: Quality[] = ['128k', '320k', 'flac']
const SHORTCUT_KEYS = ['toggleWindow', 'playPause', 'next', 'previous'] as const

function defaultDownloadDir(): string {
  return join(app.getPath('music'), 'Lychee Player')
}

export function createDefaultSettings(): Settings {
  return {
    defaultQuality: 'auto',
    closeToTray: true,
    theme: 'dark',
    audioCacheEnabled: true,
    shortcuts: { playPause: 'Ctrl+Alt+Space' },
    audioEngine: 'auto',
    downloadDir: defaultDownloadDir()
  }
}

let current: Settings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function sanitizeShortcuts(value: unknown): Settings['shortcuts'] {
  if (!value || typeof value !== 'object') return {}
  const raw = value as Record<string, unknown>
  const shortcuts: Settings['shortcuts'] = {}
  for (const key of SHORTCUT_KEYS) {
    const binding = raw[key]
    if (typeof binding === 'string' && binding.trim()) shortcuts[key] = binding.trim()
  }
  return shortcuts
}

function sanitize(value: unknown): Settings {
  const defaults = createDefaultSettings()
  if (!value || typeof value !== 'object') return defaults
  const raw = value as Record<string, unknown>
  return {
    defaultQuality:
      raw.defaultQuality === 'auto' || QUALITIES.includes(raw.defaultQuality as Quality)
        ? (raw.defaultQuality as Settings['defaultQuality'])
        : defaults.defaultQuality,
    closeToTray:
      typeof raw.closeToTray === 'boolean' ? raw.closeToTray : defaults.closeToTray,
    theme: raw.theme === 'light' ? 'light' : 'dark',
    audioCacheEnabled:
      typeof raw.audioCacheEnabled === 'boolean'
        ? raw.audioCacheEnabled
        : defaults.audioCacheEnabled,
    shortcuts:
      raw.shortcuts === undefined ? defaults.shortcuts : sanitizeShortcuts(raw.shortcuts),
    audioEngine:
      raw.audioEngine === 'html5' || raw.audioEngine === 'mpv'
        ? raw.audioEngine
        : defaults.audioEngine,
    downloadDir:
      typeof raw.downloadDir === 'string' && raw.downloadDir.trim()
        ? raw.downloadDir
        : defaults.downloadDir
  }
}

export function loadSettings(): Settings {
  try {
    current = sanitize(JSON.parse(readFileSync(settingsFile(), 'utf8')))
  } catch {
    current = createDefaultSettings()
  }
  return { ...current }
}

export function getSettings(): Settings {
  if (!current) current = createDefaultSettings()
  return { ...current }
}

export function saveSettings(next: Settings): Promise<void> {
  current = sanitize(next)
  const file = settingsFile()
  return mkdir(dirname(file), { recursive: true })
    .then(() => writeFile(file, JSON.stringify(current, null, 2), { mode: 0o600 }))
    .then(() => undefined)
}
