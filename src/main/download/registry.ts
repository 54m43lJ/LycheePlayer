import type { Quality } from '../../shared/types'

export interface DownloadedAudio {
  filePath: string
  quality: Quality
}

type Resolver = (songMid: string, quality: Quality) => Promise<DownloadedAudio | null>

let resolver: Resolver | null = null

/** 下载模块加载后注册查询；播放链路不直接依赖下载模块，避免循环引用。 */
export function setDownloadedAudioResolver(next: Resolver): void {
  resolver = next
}

export async function resolveDownloadedAudio(
  songMid: string,
  quality: Quality
): Promise<DownloadedAudio | null> {
  return resolver ? resolver(songMid, quality) : null
}
