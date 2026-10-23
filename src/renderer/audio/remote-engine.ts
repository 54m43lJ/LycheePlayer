import type { IpcResult } from '@shared/types'
import { unwrap } from '../api'
import type { AudioEngine, AudioEngineHandlers } from './engine'

/** mpv 远程引擎：命令经主进程 JSON IPC 下发，事件经 mpv:event 回传。 */
export function createRemoteEngine(handlers: AudioEngineHandlers): AudioEngine {
  let currentPosition = 0
  let source: string | null = null

  window.lychee.mpv.onEvent((event) => {
    if (event.type === 'time' && typeof event.positionMs === 'number') {
      currentPosition = event.positionMs
      handlers.onTimeUpdate(currentPosition)
    } else if (event.type === 'duration' && typeof event.durationMs === 'number') {
      handlers.onDurationChange(event.durationMs)
    } else if (event.type === 'play') {
      handlers.onPlay()
    } else if (event.type === 'pause') {
      handlers.onPause()
    } else if (event.type === 'ended') {
      handlers.onEnded()
    } else if (event.type === 'error') {
      handlers.onError()
    }
  })

  async function command(action: Promise<IpcResult<null>>): Promise<void> {
    unwrap(await action)
  }

  return {
    async loadAndPlay(url) {
      source = url
      currentPosition = 0
      await command(window.lychee.mpv.loadAndPlay(url))
    },
    async play() {
      await command(window.lychee.mpv.play())
    },
    pause() {
      void window.lychee.mpv.pause()
    },
    stop() {
      source = null
      currentPosition = 0
      void window.lychee.mpv.stop()
    },
    seek(positionMs) {
      currentPosition = Math.max(0, positionMs)
      void window.lychee.mpv.seek(currentPosition)
    },
    setVolume(volume) {
      void window.lychee.mpv.setVolume(volume)
    },
    get positionMs() {
      return currentPosition
    },
    get sourceUrl() {
      return source
    }
  }
}
