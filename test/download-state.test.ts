import { describe, expect, it } from 'vitest'
import type { SongAssetState } from '../src/shared/types'
import { downloadStateIcon, resolveDownloadState } from '../src/renderer/utils/download-state'

function asset(overrides: Partial<SongAssetState>): SongAssetState {
  return {
    songMid: 'song-mid',
    cachedQuality: null,
    downloadedQuality: null,
    maxQuality: null,
    taskStatus: null,
    ...overrides
  }
}

describe('下载按钮状态优先级', () => {
  it('同时存在缓存与下载时只返回下载状态', () => {
    const state = resolveDownloadState(asset({ cachedQuality: 'flac', downloadedQuality: '320k' }))
    expect(state).toBe('downloaded')
    expect(downloadStateIcon(state)).toBe('download-done')
  })

  it('只有缓存时返回缓存状态', () => {
    const state = resolveDownloadState(asset({ cachedQuality: '320k' }))
    expect(state).toBe('cached')
    expect(downloadStateIcon(state)).toBe('download-cached')
  })

  it('没有本机资产时返回普通状态', () => {
    const state = resolveDownloadState(asset({}))
    expect(state).toBe('none')
    expect(downloadStateIcon(state)).toBe('download')
  })

  it('缺少资产信息时按普通状态处理', () => {
    expect(resolveDownloadState(undefined)).toBe('none')
    expect(resolveDownloadState(null)).toBe('none')
  })
})
