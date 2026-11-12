import { describe, expect, it } from 'vitest'
import type { DownloadTask } from '../src/shared/types'
import { matchesDownloadKeyword } from '../src/renderer/utils/download-filter'

function task(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: 'task-1',
    songMid: 'mid-1',
    name: '晴天',
    singers: ['周杰伦'],
    albumName: '叶惠美',
    quality: 'flac',
    filePath: '/tmp/晴天-周杰伦-叶惠美.flac',
    coverPath: null,
    status: 'done',
    receivedBytes: 100,
    totalBytes: 100,
    error: '',
    source: 'network',
    ...overrides
  }
}

describe('下载中心本地搜索', () => {
  it('按歌名、歌手、专辑与 mid 匹配且不区分大小写', () => {
    expect(matchesDownloadKeyword(task(), '晴天')).toBe(true)
    expect(matchesDownloadKeyword(task(), '周杰伦')).toBe(true)
    expect(matchesDownloadKeyword(task(), '叶惠美')).toBe(true)
    expect(matchesDownloadKeyword(task({ name: 'Hey Jude' }), 'hey jude')).toBe(true)
    expect(matchesDownloadKeyword(task(), 'MID-1')).toBe(true)
  })

  it('空关键词匹配全部，无关关键词不匹配', () => {
    expect(matchesDownloadKeyword(task(), '   ')).toBe(true)
    expect(matchesDownloadKeyword(task(), '不存在')).toBe(false)
  })
})
