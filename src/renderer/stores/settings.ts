import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@shared/types'
import { unwrap } from '../api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ defaultQuality: '320k', closeToTray: false, theme: 'dark' })
  const loaded = ref(false)

  function applyTheme(): void {
    const theme = settings.value.theme === 'light' ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('qqy.theme', theme)
    } catch {
      // localStorage 不可用时只应用当前会话。
    }
  }

  async function load(): Promise<void> {
    try {
      settings.value = unwrap(await window.qqy.settings.get())
    } finally {
      applyTheme()
      loaded.value = true
    }
  }

  async function update(patch: Partial<Settings>): Promise<void> {
    settings.value = unwrap(await window.qqy.settings.set(patch))
    applyTheme()
  }

  return { settings, loaded, load, update, applyTheme }
})
