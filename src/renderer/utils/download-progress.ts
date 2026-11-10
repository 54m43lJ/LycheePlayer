import type { DownloadTask } from '@shared/types'

export interface DownloadOverallProgress {
  total: number
  done: number
  failed: number
  active: number
  percent: number
}

/** 下载中心顶部整体进度：按任务完成数 / 总数计算，失败任务单独计数。 */
export function downloadOverallProgress(
  tasks: Array<Pick<DownloadTask, 'status'>>
): DownloadOverallProgress {
  let done = 0
  let failed = 0
  let active = 0
  for (const task of tasks) {
    if (task.status === 'done') done += 1
    else if (task.status === 'failed') failed += 1
    else active += 1
  }
  const total = tasks.length
  return {
    total,
    done,
    failed,
    active,
    percent: total > 0 ? Math.round((done / total) * 100) : 0
  }
}
