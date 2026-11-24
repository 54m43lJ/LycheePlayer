import { describe, expect, it } from 'vitest'
import { matchesSearchQuery, normalizeSearchText } from '../src/renderer/utils/local-filter'

describe('本地筛选宽松匹配', () => {
  it('忽略撇号、连字符、点号与中间点等标点', () => {
    expect(matchesSearchQuery(["ain't"], 'aint')).toBe(true)
    expect(matchesSearchQuery(['aint'], "ain't")).toBe(true)
    expect(matchesSearchQuery(['Jay-Z'], 'jayz')).toBe(true)
    expect(matchesSearchQuery(['S.H.E'], 'she')).toBe(true)
    expect(matchesSearchQuery(['A·B'], 'ab')).toBe(true)
    expect(matchesSearchQuery(['R&B'], 'r&b')).toBe(true)
  })

  it('按空白拆成多个关键词，全部命中即可且顺序不限', () => {
    const fields = ['晴天', '周杰伦', '叶惠美']
    expect(matchesSearchQuery(fields, '叶惠美 晴天')).toBe(true)
    expect(matchesSearchQuery(fields, '  周杰伦   叶惠美 ')).toBe(true)
    expect(matchesSearchQuery(fields, '晴天 不存在')).toBe(false)
  })

  it('忽略大小写、全角 / 半角与重音差异', () => {
    expect(matchesSearchQuery(['ＢＥＹＯＮＣÉ'], 'beyonce')).toBe(true)
    expect(matchesSearchQuery(['Beyoncé'], 'BEYONCE')).toBe(true)
    expect(matchesSearchQuery(['Ｈｅｙ　Ｊｕｄｅ'], 'hey jude')).toBe(true)
  })

  it('空查询、纯空白与纯标点匹配全部', () => {
    expect(matchesSearchQuery(['晴天'], '')).toBe(true)
    expect(matchesSearchQuery(['晴天'], '   ')).toBe(true)
    expect(matchesSearchQuery(['晴天'], '!!!')).toBe(true)
  })

  it('归一化结果用于调试与断言', () => {
    expect(normalizeSearchText(" Ain't  A—B ")).toBe('aint ab')
    expect(normalizeSearchText('C++')).toBe('c')
  })
})
