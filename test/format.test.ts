import { describe, expect, it } from 'vitest'
import type { Song } from '../src/shared/types'
import { appTitle, singerNames } from '../src/renderer/utils/format'

function song(singers: Song['singers'], name = 'Song'): Song {
  return {
    songMid: 'm1',
    songId: '1',
    name,
    singers,
    album: { mid: 'a1', name: 'Album' },
    durationMs: 0,
    pay: { free: true, vip: false, album: false }
  }
}

describe('singerNames', () => {
  it('保留有名字但没有歌手页 mid 的歌手', () => {
    expect(singerNames(song([{ mid: '', name: '无页歌手' }]))).toBe('无页歌手')
  })

  it('跳过空名称并保持多歌手分隔符', () => {
    expect(
      singerNames(
        song([
          { mid: 'a', name: '甲' },
          { mid: '', name: '  ' },
          { mid: '', name: '乙' }
        ])
      )
    ).toBe('甲 / 乙')
  })

  it('全部为空时返回空字符串，不再显示未知歌手', () => {
    expect(singerNames(song([{ mid: 'a', name: '' }]))).toBe('')
  })
})

describe('appTitle', () => {
  it('无当前歌曲时回退应用名', () => {
    expect(appTitle(null)).toBe('Lychee Player')
  })

  it('显示歌名与歌手，并保留应用名', () => {
    expect(appTitle(song([{ mid: 'a', name: '周杰伦' }], '晴天'))).toBe(
      '晴天 - 周杰伦 · Lychee Player'
    )
  })

  it('歌手为空时只显示歌名', () => {
    expect(appTitle(song([], '晴天'))).toBe('晴天 · Lychee Player')
  })
})
