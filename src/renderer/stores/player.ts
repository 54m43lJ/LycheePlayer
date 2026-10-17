import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { MprisCommand, PlayerState, Quality, Song } from '@shared/types'
import { IpcCallError, describeError, unwrap } from '../api'
import { useToast } from '../composables/toast'
import { useSettingsStore } from './settings'

export type PlayMode = 'sequence' | 'repeat-all' | 'repeat-one' | 'shuffle'

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  sequence: '顺序播放',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放'
}

const MODES: PlayMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle']

export const usePlayerStore = defineStore('player', () => {
  const settings = useSettingsStore()
  const toast = useToast()

  const audio = new Audio()
  audio.preload = 'auto'

  const current = ref<Song | null>(null)
  const queue = ref<Song[]>([])
  const index = ref(-1)
  const status = ref<'stopped' | 'playing' | 'paused'>('stopped')
  const positionMs = ref(0)
  const durationMs = ref(0)
  const volume = ref(clampVolume(Number(localStorage.getItem('qqy.volume') ?? 0.8)))
  const mode = ref<PlayMode>('sequence')
  const quality = ref<Quality>('320k')
  const requestedQuality = ref<Quality>('320k')
  const loading = ref(false)

  let loadToken = 0
  let lastSentAt = 0

  audio.volume = volume.value

  function clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0.8
    return Math.min(1, Math.max(0, value))
  }

  function statePayload(): PlayerState {
    return {
      song: current.value ? (toRaw(current.value) as Song) : null,
      status: status.value,
      positionMs: Math.round(positionMs.value),
      quality: quality.value
    }
  }

  function sendState(): void {
    lastSentAt = Date.now()
    try {
      window.qqy.player.sendState(statePayload())
    } catch (err) {
      // 主进程不可用时播放不应中断。
      console.error('[player] state send failed', err)
    }
  }

  function sendStateThrottled(): void {
    if (Date.now() - lastSentAt >= 900) sendState()
  }

  function updatePosition(): void {
    positionMs.value = Number.isFinite(audio.currentTime) ? audio.currentTime * 1000 : 0
    sendStateThrottled()
  }

  audio.addEventListener('timeupdate', updatePosition)
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      durationMs.value = audio.duration * 1000
    }
  })
  audio.addEventListener('play', () => {
    if (status.value !== 'playing') {
      status.value = 'playing'
      sendState()
    }
  })
  audio.addEventListener('pause', () => {
    if (status.value === 'playing') {
      status.value = 'paused'
      sendState()
    }
  })
  audio.addEventListener('ended', () => {
    if (mode.value === 'repeat-one') {
      seek(0)
      void resume()
      return
    }
    void next(true)
  })
  audio.addEventListener('error', () => {
    if (!current.value || !audio.src) return
    toast.error('音频加载失败，可能链接已过期')
    status.value = 'paused'
    sendState()
  })

  async function loadAndPlay(song: Song, forcedQuality?: Quality): Promise<void> {
    const token = ++loadToken
    loading.value = true
    current.value = song
    status.value = 'stopped'
    positionMs.value = 0
    durationMs.value = song.durationMs
    sendState()

    try {
      const qualityToUse = forcedQuality ?? settings.settings.defaultQuality
      requestedQuality.value = qualityToUse
      const results = unwrap(await window.qqy.song.getUrls([song.songMid], qualityToUse))
      const result = results.find((item) => item.songMid === song.songMid) ?? results[0]
      if (!result?.url) {
        throw new IpcCallError({ code: 'NO_STREAM', message: '没有可用的播放链接' })
      }
      if (token !== loadToken) return

      quality.value = result.quality
      audio.src = result.url
      audio.load()
      await audio.play()
      status.value = 'playing'
      sendState()
    } catch (err) {
      if (token !== loadToken) return
      status.value = 'stopped'
      toast.error(describeError(err))
      sendState()
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  function playAt(target: number): void {
    if (target < 0 || target >= queue.value.length) return
    index.value = target
    void loadAndPlay(queue.value[target])
  }

  /** 列表播放：双击歌曲或“播放全部”走此入口。 */
  function playList(songs: Song[], startIndex = 0): void {
    if (songs.length === 0) return
    queue.value = songs.slice()
    playAt(Math.min(Math.max(0, startIndex), songs.length - 1))
  }

  function playSong(song: Song): void {
    const existing = queue.value.findIndex((item) => item.songMid === song.songMid)
    if (existing >= 0) {
      playAt(existing)
      return
    }
    queue.value.push(song)
    playAt(queue.value.length - 1)
  }

  async function resume(): Promise<void> {
    if (!current.value) {
      if (queue.value.length > 0) playAt(Math.max(0, index.value))
      return
    }
    try {
      await audio.play()
      status.value = 'playing'
      sendState()
    } catch {
      status.value = 'paused'
    }
  }

  function pause(): void {
    audio.pause()
    status.value = 'paused'
    sendState()
  }

  function toggle(): void {
    if (status.value === 'playing') {
      pause()
      return
    }
    void resume()
  }

  function next(auto = false): void {
    if (queue.value.length === 0) return
    if (mode.value === 'shuffle' && queue.value.length > 1) {
      let target = index.value
      while (target === index.value) target = Math.floor(Math.random() * queue.value.length)
      playAt(target)
      return
    }
    if (index.value < queue.value.length - 1) {
      playAt(index.value + 1)
      return
    }
    if (mode.value === 'repeat-all' || !auto) {
      playAt(0)
      return
    }
    status.value = 'stopped'
    positionMs.value = durationMs.value
    audio.pause()
    sendState()
  }

  function previous(): void {
    if (positionMs.value > 3000) {
      seek(0)
      return
    }
    if (index.value > 0) {
      playAt(index.value - 1)
      return
    }
    if (mode.value === 'repeat-all' && queue.value.length > 0) {
      playAt(queue.value.length - 1)
      return
    }
    seek(0)
  }

  function seek(targetMs: number): void {
    if (!current.value) return
    const max = Math.max(0, durationMs.value || current.value.durationMs)
    const nextPosition = Math.min(max, Math.max(0, targetMs))
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = nextPosition / 1000
    }
    positionMs.value = nextPosition
    sendState()
  }

  function setVolume(value: number): void {
    volume.value = clampVolume(value)
    audio.volume = volume.value
    localStorage.setItem('qqy.volume', String(volume.value))
  }

  /** 手动切换音质：重载当前曲目，实际音质以上游降档结果为准。 */
  function setQuality(nextQuality: Quality): void {
    requestedQuality.value = nextQuality
    if (current.value) {
      void loadAndPlay(current.value, nextQuality)
    } else {
      quality.value = nextQuality
    }
  }

  function cycleMode(): void {
    const currentIndex = MODES.indexOf(mode.value)
    mode.value = MODES[(currentIndex + 1) % MODES.length]
    toast.show(PLAY_MODE_LABEL[mode.value])
    sendState()
  }

  function applySettings(): void {
    requestedQuality.value = settings.settings.defaultQuality
    if (!current.value) quality.value = requestedQuality.value
  }

  function handleCommand(command: MprisCommand): void {
    if (command === 'play') {
      void resume()
    } else if (command === 'pause') {
      pause()
    } else if (command === 'toggle') {
      toggle()
    } else if (command === 'next') {
      next()
    } else if (command === 'previous') {
      previous()
    } else if (typeof command === 'object' && 'seekTo' in command) {
      seek(command.seekTo)
    }
  }

  const canPlay = computed(() => queue.value.length > 0)
  const progress = computed(() => {
    const total = durationMs.value || current.value?.durationMs || 0
    return total > 0 ? Math.min(100, (positionMs.value / total) * 100) : 0
  })

  return {
    current,
    queue,
    index,
    status,
    positionMs,
    durationMs,
    volume,
    mode,
    quality,
    requestedQuality,
    loading,
    canPlay,
    progress,
    playList,
    playSong,
    playAt,
    toggle,
    pause,
    next,
    previous,
    seek,
    setVolume,
    setQuality,
    cycleMode,
    applySettings,
    handleCommand
  }
})
