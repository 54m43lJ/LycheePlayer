import { describe, expect, it } from 'vitest'
import type { Song, SongAvailability } from '../src/shared/types'
import { filterQueueSnapshot } from '../src/renderer/utils/queue'

function song(mid: string): Song {
  return {
    songMid: mid,
    songId: mid,
    name: mid,
    singers: [],
    album: { mid: '', name: '' },
    durationMs: 180000,
    pay: { free: true, vip: false, album: false }
  }
}

function state(mid: string, playable: boolean): SongAvailability {
  return { songMid: mid, playable, maxQuality: null, checkedAtMs: 1 }
}

describe('queue snapshot', () => {
  it('drops known unplayable songs but keeps unknown ones', () => {
    const songs = [song('a'), song('b'), song('c'), song('d')]
    const availability = {
      a: state('a', true),
      b: state('b', false),
      c: state('c', true)
    }

    const result = filterQueueSnapshot(songs, availability, 'a')

    expect(result.map((item) => item.songMid)).toEqual(['a', 'c', 'd'])
  })

  it('keeps the current song for positioning even when it is marked unplayable', () => {
    const songs = [song('a'), song('b'), song('c')]
    const availability = {
      a: state('a', true),
      b: state('b', false),
      c: state('c', true)
    }

    const result = filterQueueSnapshot(songs, availability, 'b')

    expect(result.map((item) => item.songMid)).toEqual(['a', 'b', 'c'])
  })
})
