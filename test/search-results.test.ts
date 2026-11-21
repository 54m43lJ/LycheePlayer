import { describe, expect, it } from 'vitest'
import type { SearchResult } from '../src/shared/types'
import { mergeSearchResult } from '../src/renderer/utils/search-results'

function empty(): SearchResult {
  return { songs: [], singers: [], albums: [], playlists: [], mvs: [], total: 0 }
}

describe('search-result merge', () => {
  it('deduplicates appended pages by type key', () => {
    const previous: SearchResult = {
      ...empty(),
      singers: [
        { mid: 'a', name: 'A' },
        { mid: 'b', name: 'B' }
      ],
      total: 2
    }
    const next: SearchResult = {
      ...empty(),
      singers: [
        { mid: 'b', name: 'B' },
        { mid: 'c', name: 'C' }
      ],
      total: 3
    }

    const merged = mergeSearchResult(previous, next)
    expect(merged.singers.map((singer) => singer.mid)).toEqual(['a', 'b', 'c'])
    expect(merged.total).toBe(3)
  })
})
