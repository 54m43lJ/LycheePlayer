<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppIcon from './AppIcon.vue'
import { useLyrics } from '../composables/lyrics'
import { usePlayerStore } from '../stores/player'
import type { LyricWord } from '../utils/lrc'

const player = usePlayerStore()
const { current } = storeToRefs(player)
const { lines, loading, error, activeIndex } = useLyrics()
const listRef = ref<HTMLElement | null>(null)
const dragging = ref(false)
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

watch(activeIndex, (index) => {
  if (index >= 0 && !dragging.value) void centerActive()
})

watch(
  () => current.value?.songMid ?? null,
  () => void centerActive()
)

function onPointerDown(event: PointerEvent): void {
  if (event.button !== 0 || !listRef.value) return
  dragging.value = true
  moved = 0
  dragStartY = event.clientY
  dragStartScroll = listRef.value.scrollTop
  listRef.value.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || !listRef.value) return
  const delta = event.clientY - dragStartY
  moved = Math.max(moved, Math.abs(delta))
  listRef.value.scrollTop = dragStartScroll - delta
}

function onPointerUp(event: PointerEvent): void {
  if (!dragging.value) return
  dragging.value = false
  suppressClick = moved > 6
  listRef.value?.releasePointerCapture(event.pointerId)
  window.setTimeout(() => {
    suppressClick = false
  }, 0)
}

function seekLine(timeMs: number): void {
  if (suppressClick) return
  player.seek(timeMs)
}

onBeforeUnmount(() => {
  dragging.value = false
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
        @pointercancel="onPointerUp"
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
          <span v-if="line.trans" class="lyric-trans">{{ line.trans }}</span>
        </button>
      </div>
    </div>
  </section>
</template>
