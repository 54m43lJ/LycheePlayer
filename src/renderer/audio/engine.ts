/**
 * 渲染进程播放引擎边界：播放器 store 只依赖 AudioEngine 接口。
 * 唯一实现为 HTML5 Audio。
 */

export interface AudioEngineHandlers {
  onTimeUpdate(positionMs: number): void
  onDurationChange(durationMs: number): void
  /** 已缓冲到的媒体时间；用于进度条的缓冲 overlay。 */
  onBufferChange?(bufferedMs: number): void
  onPlay(): void
  onPause(): void
  onEnded(): void
  onError(): void
}

export interface AudioEngine {
  loadAndPlay(url: string): Promise<void>
  play(): Promise<void>
  pause(): void
  stop(): void
  seek(positionMs: number): void
  setVolume(volume: number): void
  readonly positionMs: number
  readonly sourceUrl: string | null
}

/** HTML5 Audio 实现：未挂载 DOM 的 Audio 元素，preload=auto。 */
export function createAudioEngine(handlers: AudioEngineHandlers): AudioEngine {
  const audio = new Audio()
  audio.preload = 'auto'

  function reportBuffered(): void {
    if (!handlers.onBufferChange) return
    const ranges = audio.buffered
    let end = 0
    for (let index = 0; index < ranges.length; index += 1) {
      const value = ranges.end(index)
      if (Number.isFinite(value)) end = Math.max(end, value)
    }
    handlers.onBufferChange(Math.max(0, end * 1000))
  }

  audio.addEventListener('timeupdate', () => {
    handlers.onTimeUpdate(Number.isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0)
  })
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      handlers.onDurationChange(audio.duration * 1000)
    }
  })
  audio.addEventListener('progress', reportBuffered)
  audio.addEventListener('loadedmetadata', reportBuffered)
  audio.addEventListener('canplay', reportBuffered)
  audio.addEventListener('seeked', reportBuffered)
  audio.addEventListener('emptied', () => handlers.onBufferChange?.(0))
  audio.addEventListener('play', () => handlers.onPlay())
  audio.addEventListener('pause', () => handlers.onPause())
  audio.addEventListener('ended', () => handlers.onEnded())
  audio.addEventListener('error', () => {
    if (audio.src) handlers.onError()
  })

  return {
    loadAndPlay(url) {
      audio.src = url
      audio.load()
      return audio.play()
    },
    play() {
      return audio.play()
    },
    pause() {
      audio.pause()
    },
    stop() {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    },
    seek(positionMs) {
      const target = Math.max(0, positionMs) / 1000
      try {
        const duration = audio.duration
        audio.currentTime = Number.isFinite(duration) && duration > 0 ? Math.min(target, duration) : target
      } catch {
        // 元数据尚未就绪时忽略本次定位；下一次播放会从当前位置继续。
      }
    },
    setVolume(volume) {
      audio.volume = Math.min(1, Math.max(0, volume))
    },
    get positionMs() {
      return Number.isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0
    },
    get sourceUrl() {
      return audio.src || null
    }
  }
}
