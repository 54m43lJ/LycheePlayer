import { describe, expect, it } from 'vitest'
import type { Song } from '../src/shared/types'
import { canDownloadSong, canStartPlayback, songPlayState } from '../src/shared/permission'

function song(overrides: Partial<Song> = {}): Song {
  return {
    songMid: 'm1',
    songId: '1',
    name: 'Song',
    singers: [],
    album: { mid: 'a1', name: 'Album' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false },
    status: null,
    pay_play: null,
    payDown: null,
    playSwitch: null,
    sizeTry: null,
    tryStartMs: null,
    tryEndMs: null,
    maxQuality: null,
    mvId: '',
    ...overrides
  }
}

describe('songPlayState', () => {
  it('treats status 1 and 2 as disabled regardless of switch', () => {
    expect(songPlayState(song({ status: 1, playSwitch: 81683 }))).toBe('disabled')
    expect(songPlayState(song({ status: 2, playSwitch: 81683 }))).toBe('disabled')
  })

  it('treats missing, zero or non-finite switch as unknown', () => {
    expect(songPlayState(song())).toBe('unknown')
    expect(songPlayState(song({ playSwitch: 0 }))).toBe('unknown')
    expect(songPlayState(song({ playSwitch: Number.NaN }))).toBe('unknown')
  })

  it('is playable when any play bit is set', () => {
    for (const bit of [1, 2, 3, 17]) {
      expect(songPlayState(song({ playSwitch: 2 ** bit }))).toBe('playable')
    }
  })

  it('treats the lowest play bit as playable even without higher qualities', () => {
    expect(songPlayState(song({ playSwitch: 81683 }))).toBe('playable')
  })

  it('is paywall when no play bit but a pay path exists', () => {
    expect(songPlayState(song({ playSwitch: 65537, pay_play: 1 }))).toBe('paywall')
    expect(songPlayState(song({ playSwitch: 65537, payDown: 1 }))).toBe('paywall')
    expect(songPlayState(song({ playSwitch: 16897793, pay_play: 1 }))).toBe('paywall')
  })

  it('is trial when the try bit is set and a try file exists', () => {
    expect(
      songPlayState(song({ playSwitch: 2 ** 14, sizeTry: 960887 }))
    ).toBe('trial')
    expect(songPlayState(song({ playSwitch: 2 ** 14, sizeTry: 0 }))).toBe('disabled')
  })

  it('is disabled when no play, pay or try condition is met', () => {
    expect(songPlayState(song({ playSwitch: 134283265 }))).toBe('disabled')
    expect(songPlayState(song({ playSwitch: 2 ** 8 }))).toBe('disabled')
  })
})

describe('play state helpers', () => {
  it('only starts playable, trial and unknown songs automatically', () => {
    expect(canStartPlayback('playable')).toBe(true)
    expect(canStartPlayback('trial')).toBe(true)
    expect(canStartPlayback('unknown')).toBe(true)
    expect(canStartPlayback('paywall')).toBe(false)
    expect(canStartPlayback('disabled')).toBe(false)
  })

  it('only downloads playable and unknown songs', () => {
    expect(canDownloadSong('playable')).toBe(true)
    expect(canDownloadSong('unknown')).toBe(true)
    expect(canDownloadSong('trial')).toBe(false)
    expect(canDownloadSong('paywall')).toBe(false)
    expect(canDownloadSong('disabled')).toBe(false)
  })
})
