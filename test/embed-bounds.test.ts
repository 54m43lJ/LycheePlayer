import { describe, expect, it } from 'vitest'
import { clampEmbedRect } from '../src/renderer/utils/embed-bounds'

const area = { x: 224, y: 0, width: 800, height: 600 }

describe('clampEmbedRect', () => {
  it('keeps a fully visible rect unchanged', () => {
    expect(
      clampEmbedRect({ x: 300, y: 120, width: 600, height: 332 }, area)
    ).toEqual({ x: 300, y: 120, width: 600, height: 332 })
  })

  it('clips the bottom to the visible content area', () => {
    expect(
      clampEmbedRect({ x: 300, y: 400, width: 600, height: 332 }, area)
    ).toEqual({ x: 300, y: 400, width: 600, height: 200 })
  })

  it('returns a zero-height rect when the frame is below the content area', () => {
    expect(
      clampEmbedRect({ x: 300, y: 700, width: 600, height: 332 }, area)
    ).toEqual({ x: 300, y: 700, width: 600, height: 0 })
  })
})
