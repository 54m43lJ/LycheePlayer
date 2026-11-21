import { describe, expect, it } from 'vitest'
import { jumpVisibility } from '../src/renderer/utils/page-jump'

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
