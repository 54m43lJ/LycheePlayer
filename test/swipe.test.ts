import { describe, expect, it } from 'vitest'
import { resolveSwipeIntent } from '../src/renderer/utils/swipe'

describe('swipe intent', () => {
  it('waits while both axes stay within the threshold', () => {
    expect(resolveSwipeIntent(0, 0)).toBe('pending')
    expect(resolveSwipeIntent(5, -5)).toBe('pending')
    expect(resolveSwipeIntent(10, 10)).toBe('pending')
  })

  it('locks horizontal while vertical movement stays small', () => {
    expect(resolveSwipeIntent(12, 3)).toBe('horizontal')
    expect(resolveSwipeIntent(-12, -4)).toBe('horizontal')
  })

  it('abandons the swipe when vertical wins first', () => {
    expect(resolveSwipeIntent(3, 12)).toBe('vertical')
    expect(resolveSwipeIntent(-4, -18)).toBe('vertical')
    expect(resolveSwipeIntent(15, 20)).toBe('vertical')
  })

  it('keeps horizontal when it dominates a diagonal drag', () => {
    expect(resolveSwipeIntent(22, 14)).toBe('horizontal')
    expect(resolveSwipeIntent(-26, 12)).toBe('horizontal')
  })

  it('honours a custom threshold', () => {
    expect(resolveSwipeIntent(7, 2, 6)).toBe('horizontal')
    expect(resolveSwipeIntent(5, 5, 6)).toBe('pending')
  })
})
