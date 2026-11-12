import type { DownloadTask } from '@shared/types'

type SearchableTask = Pick<DownloadTask, 'name' | 'songMid' | 'singers' | 'albumName' | 'filePath'>

/** 下载中心的纯本地搜索：不触发任何上游请求，只匹配任务上已有的歌曲元信息。 */
export function matchesDownloadKeyword(task: SearchableTask, keyword: string): boolean {
  const term = keyword.trim().toLowerCase()
  if (!term) return true
  const haystack = [task.name, task.songMid, task.singers.join(' '), task.albumName, task.filePath]
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}
