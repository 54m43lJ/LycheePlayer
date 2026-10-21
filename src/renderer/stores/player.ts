import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { MprisCommand, PlayerState, Quality, Song } from '@shared/types'
import { IpcCallError, describeError, unwrap } from '../api'
import { createAudioEngine } from '../audio/engine'
import { useToast } from '../composables/toast'
import { useAuthStore } from './auth'
import { useSettingsStore } from './settings'

export type PlayMode = 'sequence' | 'repeat-all' | 'repeat-one' | 'shuffle'

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  sequence: '顺序播放',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放'
}

const MODES: PlayMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle']

// 推荐值 900 ms；播放状态推送的节流窗口。
const PLAYER_STATE_THROTTLE_MS = 900

export const usePlayerStore = defineStore('player', () => {
  const settings = useSettingsStore()
  const auth = useAuthStore()
  const toast = useToast()

  const current = ref<Song | null>(null)
  /** 完整播放顺序；current 位于 index，queue 是 index 之后的切片。 */
  const playOrder = ref<Song[]>([])
  const index = ref(-1)
  const status = ref<'stopped' | 'playing' | 'paused'>('stopped')
  const positionMs = ref(0)
  const durationMs = ref(0)
  const volume = ref(clampVolume(Number(localStorage.getItem('lychee.volume') ?? 0.8)))
  const mode = ref<PlayMode>('sequence')
  const quality = ref<Quality>('320k')
  const requestedQuality = ref<Quality>('320k')
  const loading = ref(false)
  /** 当前歌曲是否拿到过播放链接；NO_STREAM 时置为 false，阻止 play / resume。 */
  const playable = ref(false)

  let loadToken = 0
  let lastSentAt = 0

  function clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0.8
    return Math.min(1, Math.max(0, value))
  }

  /** 默认音质：auto 时按登录态取档——已登录默认无损（降档链兜底），未登录 320k。 */
  const defaultQuality = computed<Quality>(() => {
    const pref = settings.settings.defaultQuality
    if (pref !== 'auto') return pref
    return auth.loggedIn ? 'flac' : '320k'
  })

  const queue = computed(() =>
    index.value >= 0 ? playOrder.value.slice(index.value + 1) : playOrder.value.slice()
  )

  const loopStatus = computed<'None' | 'Track' | 'Playlist'>(() => {
    if (mode.value === 'repeat-one') return 'Track'
    if (mode.value === 'repeat-all' || mode.value === 'shuffle') return 'Playlist'
    return 'None'
  })

  const canPlay = computed(() => {
    if (current.value) return playable.value
    return playOrder.value.length > 0
  })

  const progress = computed(() => {
    const total = durationMs.value || current.value?.durationMs || 0
    return total > 0 ? Math.min(100, (positionMs.value / total) * 100) : 0
  })

  function statePayload(): PlayerState {
    return {
      song: current.value ? (toRaw(current.value) as Song) : null,
      status: status.value,
      positionMs: Math.round(positionMs.value),
      quality: quality.value,
      volume: volume.value,
      loopStatus: loopStatus.value,
      shuffle: mode.value === 'shuffle'
    }
  }

  function sendState(): void {
    lastSentAt = Date.now()
    try {
      window.lychee.player.sendState(statePayload())
    } catch (err) {
      // 主进程不可用时播放不应中断。
      console.error('[player] state send failed', err)
    }
  }

  function sendStateThrottled(): void {
    if (Date.now() - lastSentAt >= PLAYER_STATE_THROTTLE_MS) sendState()
  }

  const engine = createAudioEngine({
    onTimeUpdate(position) {
      if (loading.value) return
      positionMs.value = position
      sendStateThrottled()
    },
    onDurationChange(duration) {
      durationMs.value = duration
    },
    onPlay() {
      if (status.value !== 'playing') {
        status.value = 'playing'
        sendState()
      }
    },
    onPause() {
      if (status.value === 'playing') {
        status.value = 'paused'
        sendState()
      }
    },
    onEnded() {
      if (mode.value === 'repeat-one') {
        seek(0)
        void resume()
        return
      }
      next(true)
    },
    onError() {
      if (!current.value || !engine.sourceUrl) return
      toast.error('音频加载失败，可能链接已过期')
      status.value = 'paused'
      sendState()
    }
  })
  engine.setVolume(volume.value)

  function shuffleUpcoming(): void {
    const start = index.value + 1
    if (start >= playOrder.value.length) return
    const tail = playOrder.value.slice(start)
    for (let cursor = tail.length - 1; cursor > 0; cursor -= 1) {
      const swap = Math.floor(Math.random() * (cursor + 1))
      const value = tail[cursor]
      tail[cursor] = tail[swap]
      tail[swap] = value
    }
    playOrder.value = [...playOrder.value.slice(0, start), ...tail]
  }

  async function loadAndPlay(song: Song, forcedQuality?: Quality): Promise<void> {
    const token = ++loadToken
    status.value = 'stopped'
    engine.stop()
    loading.value = true
    current.value = song
    playable.value = true
    positionMs.value = 0
    durationMs.value = song.durationMs
    sendState()

    try {
      const qualityToUse = forcedQuality ?? defaultQuality.value
      requestedQuality.value = qualityToUse
      const results = unwrap(await window.lychee.song.getUrls([song.songMid], qualityToUse))
      const result = results.find((item) => item.songMid === song.songMid) ?? results[0]
      if (!result?.url) {
        throw new IpcCallError({ code: 'NO_STREAM', message: '没有可用的播放链接' })
      }
      if (token !== loadToken) return

      quality.value = result.quality
      await engine.loadAndPlay(result.url)
      if (token !== loadToken) return
      status.value = 'playing'
      sendState()
    } catch (err) {
      if (token !== loadToken) return
      playable.value = !(err instanceof IpcCallError && err.code === 'NO_STREAM')
      status.value = 'stopped'
      toast.error(describeError(err))
      sendState()
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  function playAt(target: number): void {
    if (target < 0 || target >= playOrder.value.length) return
    index.value = target
    void loadAndPlay(playOrder.value[target])
  }

  /** 双击、单曲播放与“播放全部”都替换播放顺序；startIndex 成为当前歌曲。 */
  function playList(songs: Song[], startIndex = 0): void {
    if (songs.length === 0) return
    const start = Math.min(Math.max(0, startIndex), songs.length - 1)
    playOrder.value = songs.slice()
    index.value = start
    if (mode.value === 'shuffle') shuffleUpcoming()
    playAt(index.value)
  }

  /** 下一首播放：插入当前歌曲之后；已在队列中则移动，当前歌曲本身不操作。 */
  function playNext(song: Song): void {
    if (!current.value) {
      playList([song])
      return
    }
    if (song.songMid === current.value.songMid) return

    const existing = playOrder.value.findIndex((item) => item.songMid === song.songMid)
    if (existing >= 0) {
      playOrder.value.splice(existing, 1)
      if (existing < index.value) index.value -= 1
    }
    playOrder.value.splice(index.value + 1, 0, song)
  }

  function removeFromQueue(queueIndex: number): void {
    if (queueIndex < 0 || queueIndex >= queue.value.length) return
    playOrder.value.splice(index.value + 1 + queueIndex, 1)
  }

  function clearQueue(): void {
    if (index.value < 0) {
      playOrder.value = []
      return
    }
    playOrder.value.splice(index.value + 1)
  }

  async function resume(): Promise<void> {
    if (!canPlay.value) return
    if (!current.value) {
      playAt(0)
      return
    }
    try {
      await engine.play()
      status.value = 'playing'
      sendState()
    } catch {
      status.value = 'paused'
    }
  }

  function pause(): void {
    engine.pause()
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

  function stopAtEnd(): void {
    engine.pause()
    status.value = 'stopped'
    positionMs.value = durationMs.value
    sendState()
  }

  function next(_auto = false): void {
    if (playOrder.value.length === 0) return
    if (index.value < playOrder.value.length - 1) {
      playAt(index.value + 1)
      return
    }
    if (mode.value === 'repeat-all') {
      playAt(0)
      return
    }
    stopAtEnd()
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
    if (mode.value === 'repeat-all' && playOrder.value.length > 0) {
      playAt(playOrder.value.length - 1)
      return
    }
    seek(0)
  }

  function seek(targetMs: number): void {
    if (!current.value) return
    const max = Math.max(0, durationMs.value || current.value.durationMs)
    const nextPosition = Math.min(max, Math.max(0, targetMs))
    engine.seek(nextPosition)
    positionMs.value = nextPosition
    sendState()
  }

  function setVolume(value: number): void {
    volume.value = clampVolume(value)
    engine.setVolume(volume.value)
    localStorage.setItem('lychee.volume', String(volume.value))
    sendState()
  }

  /** 手动切换音质：重载当前曲目，实际音质以上游回退结果为准。 */
  function setQuality(nextQuality: Quality): void {
    requestedQuality.value = nextQuality
    if (current.value) {
      void loadAndPlay(current.value, nextQuality)
    } else {
      quality.value = nextQuality
    }
  }

  function setLoopStatus(nextStatus: 'None' | 'Track' | 'Playlist'): void {
    if (nextStatus === 'Track') mode.value = 'repeat-one'
    else if (nextStatus === 'None') mode.value = 'sequence'
    else if (mode.value !== 'shuffle') mode.value = 'repeat-all'
    sendState()
  }

  function setShuffle(enabled: boolean): void {
    if (enabled) {
      if (mode.value !== 'shuffle') {
        mode.value = 'shuffle'
        shuffleUpcoming()
      }
    } else if (mode.value === 'shuffle') {
      mode.value = 'repeat-all'
    }
    sendState()
  }

  function cycleMode(): void {
    const currentIndex = MODES.indexOf(mode.value)
    mode.value = MODES[(currentIndex + 1) % MODES.length]
    if (mode.value === 'shuffle') shuffleUpcoming()
    toast.show(PLAY_MODE_LABEL[mode.value])
    sendState()
  }

  function applySettings(): void {
    requestedQuality.value = defaultQuality.value
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
    } else if ('seekTo' in command) {
      seek(command.seekTo)
    } else if ('setVolume' in command) {
      setVolume(command.setVolume)
    } else if ('setLoopStatus' in command) {
      setLoopStatus(command.setLoopStatus)
    } else if ('setShuffle' in command) {
      setShuffle(command.setShuffle)
    }
  }

  return {
    current,
    playOrder,
    queue,
    index,
    status,
    positionMs,
    durationMs,
    volume,
    mode,
    quality,
    requestedQuality,
    defaultQuality,
    loading,
    canPlay,
    progress,
    playList,
    playNext,
    playAt,
    toggle,
    pause,
    next,
    previous,
    seek,
    setVolume,
    setQuality,
    setLoopStatus,
    setShuffle,
    cycleMode,
    applySettings,
    handleCommand,
    removeFromQueue,
    clearQueue
  }
})
