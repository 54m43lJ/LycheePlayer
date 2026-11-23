import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../src/renderer/stores/ui'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('ui store song picker', () => {
  it('opens the picker for the given songs', () => {
    const ui = useUiStore()
    ui.openSongPicker(['m1', 'm2'], 'Song')
    expect(ui.songPicker).toEqual({ songMids: ['m1', 'm2'], songName: 'Song' })
    ui.closeSongPicker()
    expect(ui.songPicker).toBeNull()
  })

  it('ignores empty song lists', () => {
    const ui = useUiStore()
    ui.openSongPicker(['', ''], 'Song')
    expect(ui.songPicker).toBeNull()
  })
})
