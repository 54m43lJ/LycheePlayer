import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Settings } from '@shared/types'
import { unwrap } from '../api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<Settings>({ defaultQuality: '320k', closeToTray: false })
  const loaded = ref(false)

  async function load(): Promise<void> {
    try {
      settings.value = unwrap(await window.qqy.settings.get())
    } finally {
      loaded.value = true
    }
  }

  async function update(patch: Partial<Settings>): Promise<void> {
    settings.value = unwrap(await window.qqy.settings.set(patch))
  }

  return { settings, loaded, load, update }
})
