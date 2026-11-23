import { describe, expect, it } from 'vitest'
import type { Song, VipLevel, VipStatus } from '../src/shared/types'
import { playbackPermission } from '../src/shared/permission'

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
    pay_month: null,
    pay_status: null,
    maxQuality: null,
    mvId: '',
    ...overrides
  }
}

function vip(level: VipLevel, state: VipStatus['state'] = 'known'): VipStatus {
  return { state, isVip: level !== 'none', level, expiresAtMs: null }
}

describe('playbackPermission blocking stack', () => {
  it('blocks status 1 and 2 without looking at payment', () => {
    expect(playbackPermission(song({ status: 1 }), vip('svip')).playable).toBe(false)
    expect(playbackPermission(song({ status: 2 }), vip('svip')).playable).toBe(false)
  })

  it('allows songs that do not require a paid play', () => {
    expect(playbackPermission(song({ status: 3, pay_play: 0 }), vip('none')).playable).toBe(true)
    expect(playbackPermission(song({ status: 3 }), vip('none')).playable).toBe(true)
  })

  it('blocks every paid song when VIP state is unknown', () => {
    expect(
      playbackPermission(
        song({ pay_play: 1, pay_month: 1, pay_status: 1 }),
        vip('none', 'unknown')
      ).playable
    ).toBe(false)
  })

  it('requires huge_vip for pay_month 0', () => {
    const paid = { pay_play: 1, pay_month: 0 }
    expect(playbackPermission(song(paid), vip('vip')).playable).toBe(false)
    expect(playbackPermission(song(paid), vip('none')).playable).toBe(false)
    expect(playbackPermission(song(paid), vip('huge_vip')).playable).toBe(true)
    expect(playbackPermission(song(paid), vip('svip')).playable).toBe(true)
  })

  it('requires vip for pay_month 1', () => {
    const paid = { pay_play: 1, pay_month: 1 }
    expect(playbackPermission(song(paid), vip('none')).playable).toBe(false)
    expect(playbackPermission(song(paid), vip('vip')).playable).toBe(true)
    expect(playbackPermission(song(paid), vip('huge_vip')).playable).toBe(true)
  })

  it('treats missing pay_month as unknown below vip', () => {
    const paid = { pay_play: 1, pay_month: null }
    expect(playbackPermission(song(paid), vip('none')).playable).toBe(false)
    expect(playbackPermission(song(paid), vip('vip')).playable).toBe(true)
  })

  it('blocks non-members even when they purchased the song', () => {
    expect(
      playbackPermission(song({ pay_play: 1, pay_month: 1, pay_status: 1 }), vip('none')).playable
    ).toBe(false)
    expect(
      playbackPermission(song({ pay_play: 1, pay_month: null, pay_status: 1 }), vip('none'))
        .playable
    ).toBe(false)
  })

  it('keeps the library max quality for display on blocked songs', () => {
    const permission = playbackPermission(song({ status: 1, maxQuality: 'flac' }), vip('none'))
    expect(permission.playable).toBe(false)
    expect(permission.maxQuality).toBe('flac')
  })
})
