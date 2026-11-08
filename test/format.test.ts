import { describe, expect, it } from 'vitest'
import type { Song } from '../src/shared/types'
import { singerNames } from '../src/renderer/utils/format'

function song(singers: Song['singers']): Song {
  return {
    songMid: 'm1',
    songId: '1',
    name: 'Song',
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
