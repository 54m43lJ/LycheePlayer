import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const trayIcon = readFileSync(join(__dirname, '../resources/tray.png'))

describe('tray icon asset', () => {
  it('ships a 22x22 PNG so StatusNotifierItem exports a 22x22 pixmap', () => {
    expect(trayIcon.subarray(1, 4).toString('ascii')).toBe('PNG')

    const width = trayIcon.readUInt32BE(16)
    const height = trayIcon.readUInt32BE(20)
    expect(width).toBe(22)
    expect(height).toBe(22)
  })

  it('stays a colored RGBA image instead of a monochrome mask', () => {
    const bitDepth = trayIcon[24]
    const colorType = trayIcon[25]
    expect(bitDepth).toBe(8)
    expect(colorType).toBe(6)
  })
})
