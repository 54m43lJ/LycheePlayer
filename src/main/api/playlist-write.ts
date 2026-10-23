import type { PlaylistMeta } from '../../shared/types'
import { UpstreamError } from './client'

// 待实现，可以根据实际情况调整

/**
 * 歌单写入接口尚待 fixture 验证；验证前不写猜测的方法名。
 * 所有写操作在接口确认前都返回 UPSTREAM_CHANGED，界面保留原状态并提示。
 */
function pending(): never {
  throw new UpstreamError('UPSTREAM_CHANGED', '歌单写入接口待探测，暂时无法编辑歌单')
}

export async function createPlaylist(_name: string): Promise<PlaylistMeta> {
  return pending()
}

export async function renamePlaylist(_id: string, _name: string): Promise<PlaylistMeta> {
  return pending()
}

export async function removePlaylist(_id: string): Promise<void> {
  pending()
}

export async function addSongs(_id: string, _mids: string[]): Promise<PlaylistMeta> {
  return pending()
}

export async function removeSongs(_id: string, _mids: string[]): Promise<PlaylistMeta> {
  return pending()
}
