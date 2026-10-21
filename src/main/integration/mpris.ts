import { app, BrowserWindow } from 'electron'
import mpris from 'mpris-service'
import type { MprisCommand, PlayerState } from '../../shared/types'

type MprisPlayer = ReturnType<typeof mpris>
type LoopStatus = 'None' | 'Track' | 'Playlist'

let player: MprisPlayer | null = null
let lastState: PlayerState | null = null
let currentTrack = ''

function albumArt(state: PlayerState): string {
  const mid = state.song?.album.mid
  return mid ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${mid}.jpg` : ''
}

function playbackStatus(state: PlayerState | null): 'Playing' | 'Paused' | 'Stopped' {
  if (!state || state.status === 'stopped') return 'Stopped'
  return state.status === 'playing' ? 'Playing' : 'Paused'
}

function trackId(songMid: string): string {
  const segment = songMid.replace(/[^A-Za-z0-9_]/g, '_') || 'unknown'
  return `/org/mpris/MediaPlayer2/track/${segment}`
}

function asLoopStatus(value: unknown): LoopStatus {
  return value === 'Track' || value === 'Playlist' ? value : 'None'
}

/**
 * 初始化 MPRIS 服务；D-Bus 不可用时降级为无集成，不阻塞启动。
 */
export function initMpris(onCommand: (command: MprisCommand) => void): void {
  try {
    player = mpris({
      name: 'lychee',
      identity: 'Lychee Player',
      desktopEntry: 'lychee-player',
      supportedUriSchemes: ['file', 'https'],
      supportedMimeTypes: ['audio/mpeg', 'audio/flac', 'audio/mp4'],
      canRaise: true,
      canQuit: true
    })

    player.canControl = true
    player.canPlay = true
    player.canPause = true
    player.canSeek = true
    player.canGoNext = true
    player.canGoPrevious = true
    player.volume = 1
    player.loopStatus = 'None'
    player.shuffle = false

    const sendLoopStatus = (value: unknown): void => {
      onCommand({ setLoopStatus: asLoopStatus(value) })
    }

    player.on('play', () => onCommand('play'))
    player.on('pause', () => onCommand('pause'))
    player.on('playpause', () => onCommand('toggle'))
    player.on('next', () => onCommand('next'))
    player.on('previous', () => onCommand('previous'))
    player.on('stop', () => onCommand('pause'))
    player.on('seek', (offset: number) => {
      const positionMs = Math.max(0, (lastState?.positionMs ?? 0) + Math.round(offset / 1000))
      onCommand({ seekTo: positionMs })
    })
    player.on('position', (payload: { position: number }) => {
      onCommand({ seekTo: Math.max(0, Math.round(payload.position / 1000)) })
    })
    player.on('volume', (value: number) => {
      onCommand({ setVolume: Math.min(1, Math.max(0, value)) })
    })
    player.on('loopStatus', sendLoopStatus)
    player.on('loopstatus', sendLoopStatus)
    player.on('shuffle', (enabled: boolean) => {
      onCommand({ setShuffle: Boolean(enabled) })
    })
    player.on('raise', () => {
      const window = BrowserWindow.getAllWindows()[0]
      if (window) {
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      }
    })
    player.on('quit', () => app.quit())
    player.on('error', () => {
      // D-Bus 断开时静默降级；播放不受影响。
      player = null
    })

    player.getPosition = (): number => Math.round((lastState?.positionMs ?? 0) * 1000)
  } catch {
    player = null
  }
}

/** 由 player:state 推送驱动 MPRIS 属性；metadata 仅在切歌时更新。 */
export function publishState(state: PlayerState | null): void {
  lastState = state
  if (!player) return

  player.playbackStatus = playbackStatus(state)
  if (!state || !state.song) {
    currentTrack = ''
    player.metadata = {}
    return
  }

  player.volume = state.volume
  player.loopStatus = state.loopStatus
  player.shuffle = state.shuffle

  if (currentTrack !== state.song.songMid) {
    currentTrack = state.song.songMid
    player.metadata = {
      'mpris:trackid': trackId(state.song.songMid),
      'mpris:length': Math.max(0, state.song.durationMs) * 1000,
      'mpris:artUrl': albumArt(state),
      'xesam:title': state.song.name,
      'xesam:artist': state.song.singers.map((singer) => singer.name),
      'xesam:album': state.song.album.name
    }
  }
}
