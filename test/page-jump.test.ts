import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  JUMP_TRANSITION_MS,
  cancelJumpScroll,
  jumpProgress,
  jumpVisibility,
  scrollWithTransition
} from '../src/renderer/utils/page-jump'

describe('jumpVisibility', () => {
  it('hides both buttons when the content fits', () => {
    expect(jumpVisibility(0, 500, 500)).toEqual({ top: false, bottom: false })
  })

  it('shows only the bottom button near the top', () => {
    expect(jumpVisibility(0, 500, 1400)).toEqual({ top: false, bottom: true })
  })

  it('shows only the top button near the bottom', () => {
    expect(jumpVisibility(900, 500, 1400)).toEqual({ top: true, bottom: false })
  })

  it('hides both buttons in the middle band around the threshold', () => {
    expect(jumpVisibility(120, 500, 740)).toEqual({ top: false, bottom: false })
  })
})

describe('jumpProgress', () => {
  it('runs from 0 to 1 over the fixed 400ms duration', () => {
    expect(JUMP_TRANSITION_MS).toBe(400)
    expect(jumpProgress(0)).toBe(0)
    expect(jumpProgress(JUMP_TRANSITION_MS / 2)).toBeCloseTo(0.875)
    expect(jumpProgress(JUMP_TRANSITION_MS)).toBe(1)
    expect(jumpProgress(JUMP_TRANSITION_MS * 2)).toBe(1)
  })
})

describe('scrollWithTransition', () => {
  afterEach(() => {
    cancelJumpScroll()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function fakeScroller(): HTMLElement {
    return { scrollTop: 0, scrollHeight: 2000, clientHeight: 500 } as HTMLElement
  }

  it('reaches the clamped target when the 400ms transition ends', () => {
    const frames: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback)
      return frames.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const el = fakeScroller()

    scrollWithTransition(el, Number.MAX_SAFE_INTEGER)
    expect(el.scrollTop).toBe(0)

    frames.shift()?.(1200)
    expect(el.scrollTop).toBeCloseTo(1312.5)

    frames.shift()?.(1400)
    expect(el.scrollTop).toBe(1500)
    expect(frames).toHaveLength(0)
  })

  it('cancels the previous transition when a new jump starts', () => {
    vi.stubGlobal('requestAnimationFrame', () => 1)
    const cancel = vi.fn()
    vi.stubGlobal('cancelAnimationFrame', cancel)
    vi.spyOn(performance, 'now').mockReturnValue(1000)
    const el = fakeScroller()

    scrollWithTransition(el, 1500)
    scrollWithTransition(el, 0)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(el.scrollTop).toBe(0)
  })
})
