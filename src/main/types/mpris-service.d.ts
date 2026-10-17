declare module 'mpris-service' {
  import type { EventEmitter } from 'node:events'

  interface MprisOptions {
    name: string
    identity: string
    supportedUriSchemes?: string[]
    supportedMimeTypes?: string[]
    supportedInterfaces?: string[]
    canRaise?: boolean
    canQuit?: boolean
    desktopEntry?: string
  }

  interface MprisPlayer extends EventEmitter {
    playbackStatus: 'Playing' | 'Paused' | 'Stopped'
    metadata: Record<string, unknown>
    canGoNext: boolean
    canGoPrevious: boolean
    canPlay: boolean
    canPause: boolean
    canSeek: boolean
    canControl: boolean
    volume: number
    objectPath(segment: string): string
    getPosition(): number
    seeked(position: number): void
    on(event: string, listener: (...args: any[]) => void): this
  }

  function mpris(options: MprisOptions): MprisPlayer
  export = mpris
}
