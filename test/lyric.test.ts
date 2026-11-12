import { describe, expect, it } from 'vitest'
import { activeLyricIndex, parseLyric } from '../src/renderer/utils/lrc'
import { parseQrcLyric } from '../src/renderer/utils/qrc'

describe('歌词译文按时间行展开', () => {
  it('原文与带时间戳的译文各自成为独立行并按时间排序', () => {
    const lines = parseLyric('[00:12.34]Hello', '[00:12.14]你好')
    expect(lines.map((line) => line.text)).toEqual(['你好', 'Hello'])
    expect(lines.map((line) => line.translation)).toEqual([true, false])
  })

  it('时间戳相差较大也不影响译文行存在', () => {
    const lines = parseLyric('[00:12.34]Hello', '[00:10.00]你好')
    expect(lines).toHaveLength(2)
    expect(lines.some((line) => line.translation)).toBe(true)
  })

  it('译文没有时间戳时按行序跟随原文，检测只看译文文本', () => {
    const lines = parseLyric('[00:10.00]First\n[00:20.00]Second', '第一句\n第二句')
    expect(lines.map((line) => `${line.translation ? 'T' : 'O'}:${line.text}`)).toEqual([
      'O:First',
      'T:第一句',
      'O:Second',
      'T:第二句'
    ])
    expect(lines.filter((line) => line.translation).map((line) => line.timeMs)).toEqual([10000, 20000])
  })

  it('原文与译文都没有时间戳时仍按行序展示', () => {
    const lines = parseLyric('Hello\nWorld', '你好\n世界')
    expect(lines).toHaveLength(4)
    expect(lines.some((line) => line.translation)).toBe(true)
  })

  it('没有译文文本时不生成译文行', () => {
    const lines = parseLyric('[00:12.34]Hello', '   ')
    expect(lines).toHaveLength(1)
    expect(lines.some((line) => line.translation)).toBe(false)
  })

  it('QRC 译文作为独立行参与时间排序与就近高亮', () => {
    const lines = parseQrcLyric('[12345,1000]Hello', '[00:12.34]你好')
    expect(lines.map((line) => line.timeMs)).toEqual([12340, 12345])
    expect(activeLyricIndex(lines, 12342)).toBe(0)
    expect(activeLyricIndex(lines, 12350)).toBe(1)
  })
})
