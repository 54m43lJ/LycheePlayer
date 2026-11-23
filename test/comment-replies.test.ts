import { describe, expect, it } from 'vitest'
import { hotRepliesFirst, replyPageCount, replyPageLinks } from '../src/renderer/utils/comment-replies'

describe('replyPageCount', () => {
  it('uses the actual replies after the upstream says there is no next page', () => {
    expect(
      replyPageCount({
        itemCount: 30,
        loadedPageCount: 3,
        total: 36,
        hasMore: false,
        loaded: true
      })
    ).toBe(3)
  })

  it('keeps the upstream total while more pages remain', () => {
    expect(
      replyPageCount({
        itemCount: 10,
        loadedPageCount: 1,
        total: 36,
        hasMore: true,
        loaded: true
      })
    ).toBe(4)
  })

  it('keeps at least one page when the loaded reply list is empty', () => {
    expect(
      replyPageCount({
        itemCount: 0,
        loadedPageCount: 1,
        total: 0,
        hasMore: false,
        loaded: true
      })
    ).toBe(1)
  })

  it('reserves one page ahead when only hasMore is known', () => {
    expect(
      replyPageCount({
        itemCount: 10,
        loadedPageCount: 1,
        total: 0,
        hasMore: true,
        loaded: true
      })
    ).toBe(2)
  })
})

describe('replyPageLinks', () => {
  it('shows at most ten nearby pages and clamps at the first page', () => {
    expect(replyPageLinks(1, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('centers the window around the current page', () => {
    expect(replyPageLinks(8, 20)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('clamps at the last page and shrinks when fewer pages exist', () => {
    expect(replyPageLinks(20, 20)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20])
    expect(replyPageLinks(1, 3)).toEqual([1, 2, 3])
  })
})

describe('hotRepliesFirst', () => {
  const reply = (id: string) => ({
    id,
    nickname: id,
    avatarUrl: '',
    content: id,
    likedCount: 0,
    replyCount: 0,
    createdAtMs: 0
  })

  it('places hot replies first and removes duplicated normal replies', () => {
    const a = reply('a')
    const b = reply('b')
    const c = reply('c')
    const hot = [c, a]

    expect(hotRepliesFirst(hot, [a, b, c]).map((item) => item.id)).toEqual([
      'c',
      'a',
      'b'
    ])
  })

  it('returns the normal replies unchanged when there are no hot replies', () => {
    const normal = [reply('a'), reply('b')]

    expect(hotRepliesFirst([], normal)).toBe(normal)
  })
})
