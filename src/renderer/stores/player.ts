import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import type { MprisCommand, PlayerState, Quality, Settings, Song } from '@shared/types'
import {
  NO_STREAM_SKIP_LIMIT,
  PLAYER_STATE_THROTTLE_MS,
  PLAY_HISTORY_MAX,
  PREVIOUS_RESTART_THRESHOLD_MS
} from '@shared/constants'
import { IpcCallError, describeError, unwrap } from '../api'
import { createAudioEngine, type AudioEngine, type AudioEngineHandlers } from '../audio/engine'
import { useToast } from '../composables/toast'
import { useAuthStore } from './auth'
import { useHistoryStore } from './history'
import { useSettingsStore, QUALITY_PREFERENCE_OPTIONS } from './settings'

export type PlayMode = 'sequence' | 'repeat-all' | 'repeat-one' | 'shuffle'

export interface QueueSource {
  kind: 'playlist' | 'radio'
  id: string
}

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  sequence: '顺序播放',
  'repeat-all': '列表循环',
  'repeat-one': '单曲循环',
  shuffle: '随机播放'
}

const MODES: PlayMode[] = ['sequence', 'repeat-all', 'repeat-one', 'shuffle']

export const usePlayerStore = defineStore('player', () => {
  const settings = useSettingsStore()
  const auth = useAuthStore()
  const toast = useToast()

  const current = ref<Song | null>(null)
  /** 完整播放顺序；current 位于 index，queue 是 index 之后的切片。 */
  const playOrder = ref<Song[]>([])
  /** 规范顺序；随机模式只改 playOrder，退出随机时据此恢复歌单原始顺序。 */
  const baseOrder = ref<Song[]>([])
  const index = ref(-1)
  const status = ref<'stopped' | 'playing' | 'paused'>('stopped')
  const positionMs = ref(0)
  const durationMs = ref(0)
  const bufferedMs = ref(0)
  const volume = ref(clampVolume(Number(localStorage.getItem('lychee.volume') ?? 0.8)))
  const mode = ref<PlayMode>('sequence')
  const quality = ref<Quality>('320k')
  const requestedQuality = ref<Quality>('320k')
  const loading = ref(false)
  const playable = ref(false)
  const queueSource = ref<QueueSource | null>(null)
  const queueBuilding = ref(false)
  const playHistory = ref<Song[]>([])

  /** 猜你喜欢连续队列锁定顺序播放，不能切换播放模式。 */
  const modeLocked = computed(() => queueSource.value?.kind === 'radio')
  let radioPage = 1
  let radioSession = 0
  let radioFetchingSession = 0

  let loadToken = 0
  let lastSentAt = 0
  let lastErrorRetry = { songMid: '', at: 0 }
  let noStreamStreak = 0
  let seekWatch: number | null = null
  let engine: AudioEngine

  function clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0.8
    return Math.min(1, Math.max(0, value))
  }

  const defaultQuality = computed<Quality>(() => {
    const pref = settings.settings.defaultQuality
    if (pref !== 'auto') return pref
    return auth.loggedIn ? 'flac' : '320k'
  })
  /** 用户偏好（可能为 auto）；播放条与设置页共用。 */
  const qualityPreference = computed<Settings['defaultQuality']>(
    () => settings.settings.defaultQuality
  )

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

  const handlers: AudioEngineHandlers = {
    onTimeUpdate(position) {
      if (loading.value) return
      positionMs.value = position
      sendStateThrottled()
    },
    onDurationChange(duration) {
      durationMs.value = duration
    },
    onBufferChange(buffered) {
      bufferedMs.value = buffered
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
      playNext()
    },
    onError() {
      const song = current.value
      if (!song || !engine.sourceUrl) return
      const now = Date.now()
      // 链接过期或代理流断开时，刷新一次播放链接并从原位置继续。
      if (lastErrorRetry.songMid !== song.songMid || now - lastErrorRetry.at > 30_000) {
        lastErrorRetry = { songMid: song.songMid, at: now }
        void loadAndPlay(song, requestedQuality.value, positionMs.value)
        return
      }
      toast.error('音频加载失败，可能链接已过期')
      status.value = 'paused'
      sendState()
    }
  }

  engine = createAudioEngine(handlers)
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

  /** 退出随机模式：按规范顺序重排，并把 index 定位到当前曲。 */
  function restoreNormalOrder(): void {
    const currentSong = current.value
    const order = baseOrder.value.slice()
    const known = new Set(order.map((song) => song.songMid))
    for (const song of playOrder.value) {
      if (known.has(song.songMid)) continue
      known.add(song.songMid)
      order.push(song)
    }
    if (currentSong && !known.has(currentSong.songMid)) order.push(currentSong)
    playOrder.value = order
    index.value = currentSong
      ? order.findIndex((song) => song.songMid === currentSong.songMid)
      : -1
  }

  function pushHistory(song: Song): void {
    if (playHistory.value.length > 0 && playHistory.value[playHistory.value.length - 1].songMid === song.songMid) {
      return
    }
    playHistory.value.push(song)
    if (playHistory.value.length > PLAY_HISTORY_MAX) playHistory.value.shift()
  }

  async function loadAndPlay(
    song: Song,
    forcedQuality?: Quality,
    resumeAtMs = 0
  ): Promise<void> {
    const token = ++loadToken
    if (seekWatch !== null) {
      window.clearTimeout(seekWatch)
      seekWatch = null
    }
    status.value = 'stopped'
    engine.stop()
    loading.value = true
    current.value = song
    playable.value = true
    positionMs.value = 0
    durationMs.value = song.durationMs
    bufferedMs.value = 0
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
      noStreamStreak = 0
      if (resumeAtMs > 0) seek(resumeAtMs)
      status.value = 'playing'
      // 链接就绪并真正开始播放后才写入用户可见的播放历史。
      useHistoryStore().record(song)
      sendState()
    } catch (err) {
      if (token !== loadToken) return
      if (err instanceof IpcCallError && err.code === 'NO_STREAM') {
        playable.value = false
        noStreamStreak += 1
        if (noStreamStreak >= NO_STREAM_SKIP_LIMIT) {
          status.value = 'stopped'
          toast.error(
            `连续 ${NO_STREAM_SKIP_LIMIT} 首无法播放，已停止。可能是登录失效或触发风控，请重新登录或稍后重试。`
          )
          sendState()
          return
        }
        if (noStreamStreak === 1) toast.error(describeError(err))
        if (queue.value.length > 0) {
          loading.value = false
          advance(false, false)
          return
        }
      } else {
        toast.error(describeError(err))
      }
      status.value = 'stopped'
      sendState()
    } finally {
      if (token === loadToken) loading.value = false
    }
  }

  /** 低层定位与加载；不写播放历史。 */
  function playAt(target: number): void {
    if (target < 0 || target >= playOrder.value.length) return
    index.value = target
    void loadAndPlay(playOrder.value[target])
    if (queueSource.value?.kind === 'radio' && target === playOrder.value.length - 1) {
      void ensureRadioBatch()
    }
  }

  function resetRadioSession(): void {
    radioSession += 1
    radioFetchingSession = 0
  }

  /** 双击、单曲播放与“播放全部”都替换播放顺序；startIndex 成为当前歌曲。 */
  function playList(songs: Song[], startIndex = 0): void {
    if (songs.length === 0) return
    resetRadioSession()
    noStreamStreak = 0
    const start = Math.min(Math.max(0, startIndex), songs.length - 1)
    playOrder.value = songs.slice()
    baseOrder.value = songs.slice()
    index.value = start
    playHistory.value = []
    queueSource.value = null
    queueBuilding.value = false
    if (mode.value === 'shuffle') shuffleUpcoming()
    playAt(index.value)
  }

  /** 从歌单开始播放：记录队列来源，后续由视图用可用性快照补齐队列。 */
  function startPlaylistPlayback(song: Song, source: QueueSource): void {
    resetRadioSession()
    noStreamStreak = 0
    playOrder.value = [song]
    baseOrder.value = [song]
    index.value = 0
    playHistory.value = []
    queueSource.value = source
    queueBuilding.value = true
    void loadAndPlay(song)
  }

  /** 猜你喜欢连续队列：以已有 5 首作为初始队列，播放模式固定为顺序。 */
  function startRadioQueue(songs: Song[]): void {
    if (songs.length === 0) return
    resetRadioSession()
    noStreamStreak = 0
    mode.value = 'sequence'
    playOrder.value = songs.slice()
    baseOrder.value = songs.slice()
    index.value = 0
    playHistory.value = []
    queueSource.value = { kind: 'radio', id: 'guess' }
    queueBuilding.value = false
    // 初始 5 首来自发现页 loadGuess 的第 1 页。
    radioPage = 2
    playAt(0)
  }

  /** 队尾预取下一批猜你喜欢；同一次队列只保留一个进行中的请求。 */
  async function ensureRadioBatch(): Promise<void> {
    if (queueSource.value?.kind !== 'radio') return
    const session = radioSession
    if (radioFetchingSession === session) return
    radioFetchingSession = session
    try {
      const existing = new Set(playOrder.value.map((song) => song.songMid))
      const additions: Song[] = []
      // 最多翻 3 页：只在整页都是重复歌曲时继续，避免上游分页重复导致死循环。
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const batch = unwrap(await window.lychee.recommend.guess(radioPage))
        if (session !== radioSession || queueSource.value?.kind !== 'radio') return
        radioPage += 1
        if (batch.length === 0) break
        for (const song of batch) {
          if (!song.songMid || existing.has(song.songMid)) continue
          existing.add(song.songMid)
          additions.push(song)
        }
        if (additions.length > 0) break
      }
      if (session !== radioSession || queueSource.value?.kind !== 'radio') return
      if (additions.length === 0) {
        toast.error('猜你喜欢暂时没有更多歌曲')
        return
      }
      const wasAtEnd = index.value === playOrder.value.length - 1
      playOrder.value = [...playOrder.value, ...additions]
      baseOrder.value = [...baseOrder.value, ...additions]
      // 预取较慢时队尾可能已经停止，补入新歌后继续播放；加载中的 stopped 不算结束。
      if (wasAtEnd && status.value === 'stopped' && !loading.value) playAt(index.value + 1)
    } catch (err) {
      if (session !== radioSession) return
      toast.error(describeError(err))
    } finally {
      if (radioFetchingSession === session) radioFetchingSession = 0
    }
  }

  /** 用调用方给出的已过滤快照增量补齐队列；不做可用性检测或清理。 */
  function appendPlaylistQueue(currentSong: Song, fullSongs: Song[]): void {
    if (
      queueSource.value?.kind !== 'playlist' ||
      currentSong.songMid !== current.value?.songMid
    ) {
      return
    }
    const position = fullSongs.findIndex((song) => song.songMid === currentSong.songMid)
    if (position < 0) return
    const tail = fullSongs
      .slice(position + 1)
      .filter((song) => song.songMid && song.songMid !== currentSong.songMid)
    const queued = new Set(playOrder.value.map((song) => song.songMid))
    const additions = tail.filter((song) => !queued.has(song.songMid))
    if (additions.length > 0) {
      const baseQueued = new Set(baseOrder.value.map((song) => song.songMid))
      baseOrder.value = [
        ...baseOrder.value,
        ...additions.filter((song) => !baseQueued.has(song.songMid))
      ]
      playOrder.value = [...playOrder.value, ...additions]
      if (mode.value === 'shuffle') shuffleUpcoming()
    }
    queueBuilding.value = false
  }

  /** 用最终快照替换当前曲之后的队列；当前曲与进度不变。 */
  function replacePlaylistQueue(
    currentSong: Song,
    fullSongs: Song[],
    previousMids?: Set<string>
  ): void {
    if (
      queueSource.value?.kind !== 'playlist' ||
      currentSong.songMid !== current.value?.songMid
    ) {
      return
    }
    const head = playOrder.value.slice(0, index.value + 1)
    const upcoming = playOrder.value.slice(index.value + 1)
    const manual = previousMids
      ? upcoming.filter((song) => !previousMids.has(song.songMid))
      : []
    const position = fullSongs.findIndex((song) => song.songMid === currentSong.songMid)
    if (position >= 0) {
      const nextCurrent = fullSongs[position]
      current.value = nextCurrent
      if (index.value >= 0 && index.value < head.length) head[index.value] = nextCurrent
      sendState()
    }
    const tail = (position >= 0 ? fullSongs.slice(position + 1) : fullSongs).filter(
      (song) => song.songMid && song.songMid !== currentSong.songMid
    )
    const merged: Song[] = [...head]
    const seen = new Set(head.map((song) => song.songMid))
    for (const song of [...manual, ...tail]) {
      if (seen.has(song.songMid)) continue
      seen.add(song.songMid)
      merged.push(song)
    }
    playOrder.value = merged
    if (mode.value === 'shuffle') {
      const mergedMids = new Set(merged.map((song) => song.songMid))
      const nextBase = baseOrder.value.filter((song) => mergedMids.has(song.songMid))
      const baseMids = new Set(nextBase.map((song) => song.songMid))
      for (const song of merged) {
        if (baseMids.has(song.songMid)) continue
        baseMids.add(song.songMid)
        nextBase.push(song)
      }
      baseOrder.value = nextBase
      shuffleUpcoming()
    } else {
      baseOrder.value = merged.slice()
    }
    queueBuilding.value = false
  }

  /** 下一首播放：插入当前歌曲之后；不切歌、不写历史。无当前歌曲时直接播放。 */
  function addNext(song: Song): void {
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
    const baseExisting = baseOrder.value.findIndex((item) => item.songMid === song.songMid)
    if (baseExisting >= 0) baseOrder.value.splice(baseExisting, 1)
    const baseCurrent = baseOrder.value.findIndex(
      (item) => item.songMid === current.value?.songMid
    )
    if (baseCurrent >= 0) baseOrder.value.splice(baseCurrent + 1, 0, song)
    else baseOrder.value.push(song)
  }

  function removeFromQueue(queueIndex: number): void {
    if (queueIndex < 0 || queueIndex >= queue.value.length) return
    const [removed] = playOrder.value.splice(index.value + 1 + queueIndex, 1)
    if (removed) {
      baseOrder.value = baseOrder.value.filter(
        (song) => song.songMid !== removed.songMid
      )
    }
  }

  function clearQueue(): void {
    if (index.value < 0) {
      playOrder.value = []
      baseOrder.value = []
      return
    }
    const pending = new Set(
      playOrder.value.slice(index.value + 1).map((song) => song.songMid)
    )
    playOrder.value.splice(index.value + 1)
    baseOrder.value = baseOrder.value.filter((song) => !pending.has(song.songMid))
  }

  function clearPlayHistory(): void {
    playHistory.value = []
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

  function advance(recordHistory: boolean, allowWrap = true): void {
    if (playOrder.value.length === 0) return
    if (recordHistory && current.value) pushHistory(current.value)
    if (index.value < playOrder.value.length - 1) {
      playAt(index.value + 1)
      return
    }
    if (allowWrap && (mode.value === 'repeat-all' || mode.value === 'shuffle')) {
      playAt(0)
      return
    }
    stopAtEnd()
  }

  /** 手动 / 自动续播到下一首；列表循环回绕，队尾停止。 */
  function playNext(): void {
    noStreamStreak = 0
    if (mode.value === 'repeat-one') {
      seek(0)
      void resume()
      return
    }
    advance(true)
  }

  function previous(): void {
    if (!current.value) return
    noStreamStreak = 0
    if (positionMs.value > PREVIOUS_RESTART_THRESHOLD_MS) {
      seek(0)
      return
    }
    const historySong = playHistory.value.pop()
    if (historySong) {
      const position = playOrder.value.findIndex((song) => song.songMid === historySong.songMid)
      if (position >= 0) {
        index.value = position
        void loadAndPlay(historySong)
      } else {
        playOrder.value.splice(Math.max(0, index.value), 0, historySong)
        const baseCurrent = baseOrder.value.findIndex(
          (song) => song.songMid === current.value?.songMid
        )
        if (baseOrder.value.findIndex((song) => song.songMid === historySong.songMid) < 0) {
          baseOrder.value.splice(Math.max(0, baseCurrent), 0, historySong)
        }
        index.value = Math.max(0, index.value)
        void loadAndPlay(historySong)
      }
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

    // 少量流在连续 Range 定位时会保持旧连接；1.2 秒后仍未到达目标则再触发一次 seek。
    if (seekWatch !== null) window.clearTimeout(seekWatch)
    if (status.value === 'playing') {
      seekWatch = window.setTimeout(() => {
        seekWatch = null
        if (!current.value || status.value !== 'playing') return
        if (Math.abs(engine.positionMs - nextPosition) > 2500) {
          engine.seek(nextPosition)
        }
      }, 1200)
    }
  }

  function setVolume(value: number): void {
    volume.value = clampVolume(value)
    engine.setVolume(volume.value)
    localStorage.setItem('lychee.volume', String(volume.value))
    sendState()
  }

  /** 手动切换音质：重载当前曲目，实际音质以上游回退结果为准。 */
  function setQuality(nextQuality: Quality): void {
    noStreamStreak = 0
    requestedQuality.value = nextQuality
    if (current.value) {
      void loadAndPlay(current.value, nextQuality)
    } else {
      quality.value = nextQuality
    }
  }

  /**
   * 设置默认音质偏好（含 auto）；设置页与播放条共用此入口，
   * 持久化后立即作用于当前曲目或下一次播放。
   */
  async function updateDefaultQuality(next: Settings['defaultQuality']): Promise<void> {
    if (settings.settings.defaultQuality === next) return
    await settings.update({ defaultQuality: next })
    applySettings()
    if (current.value) setQuality(defaultQuality.value)
  }

  /** revealer 按钮点击：按共享选项的固定顺序循环切换音质偏好。 */
  async function cycleQualityPreference(): Promise<void> {
    const index = QUALITY_PREFERENCE_OPTIONS.findIndex(
      (option) => option.value === settings.settings.defaultQuality
    )
    const next = QUALITY_PREFERENCE_OPTIONS[(index + 1) % QUALITY_PREFERENCE_OPTIONS.length]
    if (next) await updateDefaultQuality(next.value)
  }

  function setLoopStatus(nextStatus: 'None' | 'Track' | 'Playlist'): void {
    if (nextStatus === 'Track') applyMode('repeat-one')
    else if (nextStatus === 'None') applyMode('sequence')
    else if (mode.value !== 'shuffle') applyMode('repeat-all')
    sendState()
  }

  function setShuffle(enabled: boolean): void {
    if (enabled) applyMode('shuffle')
    else if (mode.value === 'shuffle') applyMode('repeat-all')
    sendState()
  }

  /** 切换播放模式；离开随机时恢复规范顺序，进入随机时只打乱待播部分。 */
  function applyMode(next: PlayMode): void {
    if (modeLocked.value || next === mode.value) return
    const enteringShuffle = next === 'shuffle'
    if (enteringShuffle) baseOrder.value = playOrder.value.slice()
    const leavingShuffle = mode.value === 'shuffle'
    mode.value = next
    if (leavingShuffle && !enteringShuffle) restoreNormalOrder()
    else if (enteringShuffle) shuffleUpcoming()
  }

  function setMode(next: PlayMode): void {
    applyMode(next)
    sendState()
  }

  function cycleMode(): void {
    const currentIndex = MODES.indexOf(mode.value)
    setMode(MODES[(currentIndex + 1) % MODES.length])
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
      playNext()
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
    bufferedMs,
    volume,
    mode,
    quality,
    requestedQuality,
    qualityPreference,
    defaultQuality,
    loading,
    canPlay,
    progress,
    queueSource,
    queueBuilding,
    playHistory,
    modeLocked,
    playList,
    startPlaylistPlayback,
    startRadioQueue,
    appendPlaylistQueue,
    replacePlaylistQueue,
    addNext,
    playNext,
    playAt,
    toggle,
    pause,
    previous,
    clearPlayHistory,
    seek,
    setVolume,
    setQuality,
    updateDefaultQuality,
    cycleQualityPreference,
    setLoopStatus,
    setShuffle,
    setMode,
    cycleMode,
    applySettings,
    handleCommand,
    removeFromQueue,
    clearQueue
  }
})
