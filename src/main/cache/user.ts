import type { UserCacheInfo } from '../../shared/types'
import { clearAudioCacheForUser, listAudioCacheScopes } from './audio'
import { clearPlaylistCacheForUser, listPlaylistCacheScopes } from './playlist'

/** 汇总歌单缓存与播放缓存，按账号返回设置页可管理的缓存占用。 */
export async function listUserCaches(): Promise<UserCacheInfo[]> {
  const users = new Map<string, UserCacheInfo>()
  const row = (musicid: string): UserCacheInfo => {
    let item = users.get(musicid)
    if (!item) {
      item = {
        musicid,
        audioBytes: 0,
        audioFiles: 0,
        playlistBytes: 0,
        playlistFiles: 0
      }
      users.set(musicid, item)
    }
    return item
  }

  const [audio, playlist] = await Promise.all([
    listAudioCacheScopes(),
    listPlaylistCacheScopes()
  ])
  for (const item of audio) {
    const target = row(item.musicid)
    target.audioBytes += item.bytes
    target.audioFiles += item.files
  }
  for (const item of playlist) {
    const target = row(item.musicid)
    target.playlistBytes += item.bytes
    target.playlistFiles += item.files
  }

  return [...users.values()].sort((a, b) => {
    const totalA = a.audioBytes + a.playlistBytes
    const totalB = b.audioBytes + b.playlistBytes
    return totalB - totalA || a.musicid.localeCompare(b.musicid)
  })
}

/** 删除指定账号的两类主进程缓存；本地 localStorage 由渲染层一并清理。 */
export async function clearUserCache(musicid: string): Promise<void> {
  await Promise.all([
    clearAudioCacheForUser(musicid),
    clearPlaylistCacheForUser(musicid)
  ])
}
