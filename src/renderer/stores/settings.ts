import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@shared/types'
import { AUDIO_CACHE_DEFAULT_BYTES } from '@shared/constants'
import { unwrap } from '../api'

export function defaultSettings(): Settings {
  return {
    defaultQuality: 'auto',
    closeToTray: true,
    theme: 'dark',
    audioCacheEnabled: true,
    audioCacheMaxBytes: AUDIO_CACHE_DEFAULT_BYTES
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>(defaultSettings())
  const loaded = ref(false)

  function applyTheme(): void {
    const theme = settings.value.theme === 'light' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('lychee.theme', theme)
    } catch {
      // localStorage 不可用时只应用当前会话。
    }
  }

  async function load(): Promise<void> {
    try {
      settings.value = { ...defaultSettings(), ...unwrap(await window.lychee.settings.get()) }
    } finally {
      applyTheme()
      loaded.value = true
    }
  }

  async function update(patch: Partial<Settings>): Promise<void> {
    settings.value = unwrap(await window.lychee.settings.set(patch))
    applyTheme()
  }

  return { settings, loaded, load, update, applyTheme }
})
