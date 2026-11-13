<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppIcon from './AppIcon.vue'
import { useLyrics } from '../composables/lyrics'
import { usePlayerStore } from '../stores/player'
import type { LyricWord } from '../utils/lrc'

const player = usePlayerStore()
const { current } = storeToRefs(player)
const { lines, loading, error, activeIndex, hasTranslation, translationVisible, toggleTranslation } =
  useLyrics()
const listRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
const DRAG_THRESHOLD = 6
let pressing = false
let dragStartX = 0
let dragStartY = 0
let dragStartScroll = 0
let moved = 0
let suppressClick = false

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
  // 触屏交给原生滚动，保留惯性；自定义拖拽只处理鼠标 / 触控笔。
  if (event.button !== 0 || event.pointerType === 'touch' || !listRef.value) return
  pressing = true
  dragging.value = false
  moved = 0
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragStartScroll = listRef.value.scrollTop
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
  suppressClick = moved > DRAG_THRESHOLD
  listRef.value?.releasePointerCapture(event.pointerId)
  window.setTimeout(() => {
    suppressClick = false
  }, 0)
}

function onPointerCancel(): void {
  pressing = false
  dragging.value = false
}

function onPointerLeave(): void {
  if (!dragging.value) pressing = false
}

/** 横向分页捕获指针后，pointerup 不再经过歌词列表，需要在窗口级清理按下态。 */
function onWindowPointerUp(): void {
  if (!pressing) return
  pressing = false
  dragging.value = false
}

function seekLine(timeMs: number): void {
  if (suppressClick) return
  player.seek(timeMs)
}

onMounted(() => {
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
})

onBeforeUnmount(() => {
  pressing = false
  dragging.value = false
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
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
