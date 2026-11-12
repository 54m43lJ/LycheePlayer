import { describe, expect, it } from 'vitest'
import { activeLyricIndex, parseLyric } from '../src/renderer/utils/lrc'
import { parseQrcLyric } from '../src/renderer/utils/qrc'

describe('歌词译文按行序附加', () => {
  it('译文与原文同一行，时间戳不同也不影响配对', () => {
    const lines = parseLyric('[00:12.34]Hello', '[00:10.00]你好')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.text).toBe('Hello')
    expect(lines[0]?.trans).toBe('你好')
  })

  it('多行译文按顺序附加到原文行', () => {
    const lines = parseLyric(
      '[00:10.00]First\n[00:20.00]Second',
      '[00:09.90]第一句\n[00:20.10]第二句'
    )
    expect(lines.map((line) => [line.text, line.trans])).toEqual([
      ['First', '第一句'],
      ['Second', '第二句']
    ])
  })

  it('译文没有时间戳时仍按行序附加', () => {
    const lines = parseLyric('[00:10.00]First\n[00:20.00]Second', '第一句\n第二句')
    expect(lines.map((line) => line.trans)).toEqual(['第一句', '第二句'])
  })

  it('原文与译文都没有时间戳时仍按行序配对', () => {
    const lines = parseLyric('Hello\nWorld', '你好\n世界')
    expect(lines.map((line) => line.trans)).toEqual(['你好', '世界'])
  })

  it('没有译文文本时保持 null', () => {
    const lines = parseLyric('[00:12.34]Hello', '   ')
    expect(lines[0]?.trans).toBeNull()
    expect(lines.some((line) => Boolean(line.trans))).toBe(false)
  })

  it('纯斜杠占位显示为三个大圆点', () => {
    const lines = parseLyric('[00:10.00]First\n[00:20.00]Second', '[00:10.00]//\n[00:20.00]第二句')
    expect(lines.map((line) => line.trans)).toEqual(['●●●', '第二句'])
  })

  it('QRC 译文附加到对应原文行并共享活动行', () => {
    const lines = parseQrcLyric('[12345,1000]Hello', '[00:12.34]你好')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.trans).toBe('你好')
    expect(activeLyricIndex(lines, 12345)).toBe(0)
  })
})
