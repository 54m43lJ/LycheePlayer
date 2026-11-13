<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppIcon from './AppIcon.vue'
import { useLyrics } from '../composables/lyrics'
import { usePlayerStore } from '../stores/player'
import type { LyricWord } from '../utils/lrc'
import { resolveSwipeIntent, SWIPE_CLICK_SUPPRESS_MS } from '../utils/swipe'

const player = usePlayerStore()
const { current } = storeToRefs(player)
const { lines, loading, error, activeIndex, hasTranslation, translationVisible, toggleTranslation } =
  useLyrics()
const listRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const DRAG_THRESHOLD = 6
let pressing = false
let pressPointerId: number | null = null
let dragStartX = 0
let dragStartY = 0
let dragStartScroll = 0
let moved = 0
let suppressClickUntil = 0

const hasSong = computed(() => Boolean(current.value))

function wordActive(word: LyricWord): boolean {
  return player.positionMs >= word.startMs && player.positionMs < word.startMs + word.durationMs
}

async function centerActive(): Promise<void> {
  await nextTick()
  const active = listRef.value?.querySelector<HTMLElement>('.lyric-line.active')
  active?.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function onToggleTranslation(): void {
  toggleTranslation()
  void centerActive()
}

watch(activeIndex, (index) => {
  // 按住歌词准备点击或拖拽时，不自动回中，避免和用户的手势抢滚动位置。
  if (index >= 0 && !dragging.value && !pressing) void centerActive()
})

watch(
  () => current.value?.songMid ?? null,
  () => void centerActive()
)

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !listRef.value) return
  // 所有指针类型都记录起点，用于在 pointerup 时判断本次手势是否横向拖动了分页。
  pressPointerId = event.pointerId
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartScroll = listRef.value.scrollTop
  // 触屏交给原生滚动，保留惯性；自定义纵向拖拽只处理鼠标 / 触控笔。
  if (event.pointerType === 'touch') return
  pressing = true
  dragging.value = false
  moved = 0
}

function onPointerMove(event: PointerEvent): void {
  if (!pressing || !listRef.value) return
  const delta = event.clientY - dragStartY
  const deltaX = event.clientX - dragStartX
  // 只有纵向位移超过阈值且明确大于横向时才进入拖拽；否则保留原生 click，
  // 也避免和歌词 / 评论分页的横向拖动抢手势。
  if (!dragging.value) {
    if (Math.abs(delta) <= DRAG_THRESHOLD) return
    if (Math.abs(delta) <= Math.abs(deltaX)) return
    dragging.value = true
    listRef.value.setPointerCapture(event.pointerId)
  }
  moved = Math.max(moved, Math.abs(delta))
  listRef.value.scrollTop = dragStartScroll - delta
}

function onPointerUp(event: PointerEvent): void {
  if (!pressing) return
  pressing = false
  const wasDragging = dragging.value
  dragging.value = false
  if (!wasDragging) return
  if (moved > DRAG_THRESHOLD) suppressNextClick()
  listRef.value?.releasePointerCapture(event.pointerId)
}

function onPointerCancel(): void {
  pressing = false
  dragging.value = false
  pressPointerId = null
}

function onPointerLeave(): void {
  if (!dragging.value) pressing = false
}

function suppressNextClick(): void {
  suppressClickUntil = Date.now() + SWIPE_CLICK_SUPPRESS_MS
}

/**
 * 横向分页捕获指针后，pointerup 不再经过歌词列表；在窗口级判断本次手势是否横向拖动，
 * 并清理歌词列表的按下态。
 */
function onWindowPointerEnd(event: PointerEvent, cancelled: boolean): void {
  const pointer = pressPointerId
  pressPointerId = null
  if (!cancelled && pointer !== null && pointer === event.pointerId) {
    const dx = event.clientX - dragStartX
    const dy = event.clientY - dragStartY
    if (resolveSwipeIntent(dx, dy) === 'horizontal') suppressNextClick()
  }
  if (!pressing) return
  pressing = false
  dragging.value = false
}

function onWindowPointerUp(event: PointerEvent): void {
  onWindowPointerEnd(event, false)
}

function onWindowPointerCancel(event: PointerEvent): void {
  onWindowPointerEnd(event, true)
}

function seekLine(timeMs: number): void {
  if (Date.now() < suppressClickUntil) return
  player.seek(timeMs)
}

onMounted(() => {
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerCancel)
})

onBeforeUnmount(() => {
  pressing = false
  dragging.value = false
  pressPointerId = null
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerCancel)
})
</script>

<template>
  <section class="lyrics-page-side lyrics-side">
    <div v-if="!hasSong" class="lyrics-empty">
      <AppIcon name="lyrics" :size="26" />
      <span>播放歌曲后显示歌词</span>
    </div>
    <div v-else-if="loading" class="lyrics-empty">
      <span class="spinner" />
      <span>正在加载歌词</span>
    </div>
    <div v-else-if="lines.length === 0" class="lyrics-empty">
      <AppIcon name="lyrics" :size="26" />
      <span>{{ error || '这首歌还没有歌词' }}</span>
    </div>
    <div v-else class="lyrics-scroll-wrap">
      <div
        ref="listRef"
        class="lyrics-list lyrics-page-list"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerCancel"
        @pointerleave="onPointerLeave"
      >
        <button
          v-for="(line, index) in lines"
          :key="`${line.timeMs}-${index}`"
          class="lyric-line"
          :class="{ active: index === activeIndex }"
          @click="seekLine(line.timeMs)"
        >
          <template v-if="line.words">
            <span
              v-for="(word, wordIndex) in line.words"
              :key="wordIndex"
              class="lyric-word"
              :class="{ active: wordActive(word) }"
              >{{ word.text }}</span
            >
          </template>
          <template v-else>{{ line.text || '♪' }}</template>
          <span v-if="line.trans && translationVisible" class="lyric-trans">{{ line.trans }}</span>
        </button>
      </div>
      <button
        v-if="hasTranslation"
        class="lyrics-trans-toggle"
        :class="{ on: translationVisible }"
        :aria-pressed="translationVisible"
        :title="translationVisible ? '隐藏译文' : '显示译文'"
        @click="onToggleTranslation()"
      >
        <span>译文</span>
        <span class="lyrics-trans-switch" aria-hidden="true" />
      </button>
    </div>
  </section>
</template>
