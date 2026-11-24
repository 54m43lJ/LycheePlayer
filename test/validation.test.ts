import { describe, expect, it } from 'vitest'
import type { PlaylistCacheEntry, PlaylistMeta, RecentPlaylist, Song } from '../src/shared/types'
import {
  isPlaylistCacheEntry,
  isRecentPlaylist,
  isSong
} from '../src/shared/validation'

function song(mid: string): Song {
  return {
    songMid: mid,
    songId: mid,
    name: mid,
    singers: [{ mid: 's', name: 'S' }],
    album: { mid: 'a', name: 'A' },
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
    mvId: ''
  }
}

const meta: PlaylistMeta = {
  id: 'liked',
  name: '我喜欢',
  coverUrl: '',
  songCount: 1,
  kind: 'favorites',
  editable: true
}

describe('cache validators', () => {
  it('accepts the current Song model', () => {
    expect(isSong(song('1'))).toBe(true)
  })

  it('rejects a Song missing a required nested field', () => {
    const old = { ...song('1'), pay: { free: true } }
    expect(isSong(old)).toBe(false)
  })

  it('rejects a Song from the pre-permission cache shape', () => {
    const old = song('1') as Partial<Song>
    delete old.playSwitch
    expect(isSong(old)).toBe(false)
  })

  it('accepts a complete playlist cache entry', () => {
    const entry: PlaylistCacheEntry = {
      meta,
      songs: [song('1')],
      total: 1,
      complete: true,
      fetchedAtMs: 1
    }
    expect(isPlaylistCacheEntry(entry)).toBe(true)
  })

  it('rejects a playlist cache entry with an old song shape', () => {
    const entry = {
      meta,
      songs: [{ ...song('1'), pay: undefined }],
      total: 1,
      complete: true,
      fetchedAtMs: 1
    }
    expect(isPlaylistCacheEntry(entry)).toBe(false)
  })

  it('accepts a current recent playlist entry', () => {
    const entry: RecentPlaylist = { ...meta, visitedAtMs: 1 }
    expect(isRecentPlaylist(entry)).toBe(true)
  })

  it('rejects a recent playlist entry without visitedAtMs', () => {
    expect(isRecentPlaylist({ ...meta })).toBe(false)
  })
})
