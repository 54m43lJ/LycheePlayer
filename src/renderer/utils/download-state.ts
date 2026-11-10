import type { SongAssetState } from '@shared/types'

export type DownloadState = 'downloaded' | 'cached' | 'none'

/**
 * 下载按钮只允许一个展示状态：本机已下载优先，其次播放缓存，最后普通。
 * 即使资产同时带有 cachedQuality 与 downloadedQuality，也不得叠加两种状态。
 */
export function resolveDownloadState(asset: SongAssetState | null | undefined): DownloadState {
  if (asset?.downloadedQuality) return 'downloaded'
  if (asset?.cachedQuality) return 'cached'
  return 'none'
}

export function downloadStateIcon(
  state: DownloadState
): 'download-done' | 'download-cached' | 'download' {
  if (state === 'downloaded') return 'download-done'
  if (state === 'cached') return 'download-cached'
  return 'download'
}
