import { describe, expect, it } from 'vitest'
import type { DownloadTask } from '../src/shared/types'
import { downloadOverallProgress } from '../src/renderer/utils/download-progress'

function task(status: DownloadTask['status']): Pick<DownloadTask, 'status'> {
  return { status }
}

describe('下载中心整体进度', () => {
  it('没有任务时进度为 0', () => {
    expect(downloadOverallProgress([])).toEqual({
      total: 0,
      done: 0,
      failed: 0,
      active: 0,
      percent: 0
    })
  })

  it('按已完成任务数计算整体进度', () => {
    expect(
      downloadOverallProgress([
        task('done'),
        task('downloading'),
        task('pending'),
        task('failed')
      ])
    ).toEqual({
      total: 4,
      done: 1,
      failed: 1,
      active: 2,
      percent: 25
    })
  })

  it('全部完成时进度为 100', () => {
    expect(downloadOverallProgress([task('done'), task('done')])).toMatchObject({
      total: 2,
      done: 2,
      percent: 100
    })
  })
})
