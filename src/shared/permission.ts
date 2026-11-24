import type { Song, SongPlayState } from './types'

/** 官方网页端 switch 位图中可播音频的位：play_lq / play_hq / play_sq / play_5_1。 */
const PLAY_BITS = [1, 2, 3, 17] as const
/** switch 位图中的试听位。 */
const TRY_BIT = 14

function bit(flags: number, index: number): boolean {
  return Math.floor(flags / 2 ** index) % 2 === 1
}

/**
 * 按官方网页端公式从元数据派生歌曲可播状态；status 1 / 2 为应用侧显式兜底。
 * switch 缺失、0 或非法时为 unknown：界面保持正常并尝试播放，失败再走 NO_STREAM。
 */
export function songPlayState(song: Song): SongPlayState {
  if (song.status === 1 || song.status === 2) return 'disabled'
  const flags = song.playSwitch
  if (flags === null || !Number.isFinite(flags) || flags <= 0) return 'unknown'
  if (PLAY_BITS.some((index) => bit(flags, index))) return 'playable'
  if (song.pay_play === 1 || song.payDown === 1) return 'paywall'
  if (bit(flags, TRY_BIT) && (song.sizeTry ?? 0) > 0) return 'trial'
  return 'disabled'
}

/** 可以直接开始播放：明确不可播与付费墙内容都不进入自动播放范围。 */
export function canStartPlayback(state: SongPlayState): boolean {
  return state === 'playable' || state === 'trial' || state === 'unknown'
}

/** 可以申请下载：试听片段与付费墙内容不在下载范围内。 */
export function canDownloadSong(state: SongPlayState): boolean {
  return state === 'playable' || state === 'unknown'
}
