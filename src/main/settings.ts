import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Quality, Settings } from '../shared/types'
import { AUDIO_CACHE_DEFAULT_BYTES, normalizeAudioCacheLimitBytes } from '../shared/constants'

const QUALITIES: Quality[] = ['128k', '320k', 'flac']

function defaultDownloadDir(): string {
  return join(app.getPath('music'), 'Lychee Player')
}

export function createDefaultSettings(): Settings {
  return {
    defaultQuality: 'auto',
    closeToTray: true,
    theme: 'dark',
    audioCacheEnabled: true,
    audioCacheMaxBytes: AUDIO_CACHE_DEFAULT_BYTES,
    downloadDir: defaultDownloadDir()
  }
}

let current: Settings | null = null

function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
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
    audioCacheMaxBytes: normalizeAudioCacheLimitBytes(raw.audioCacheMaxBytes),
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

export function saveSettings(next: Settings): void {
  current = sanitize(next)
  const file = settingsFile()
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.part`
  writeFileSync(temp, JSON.stringify(current, null, 2), { mode: 0o600 })
  renameSync(temp, file)
}
