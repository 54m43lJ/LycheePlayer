<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from './AppIcon.vue'
import CommentsPanel from './CommentsPanel.vue'
import CoverArt from './CoverArt.vue'
import LyricsPanel from './LyricsPanel.vue'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { singerNames, songCover } from '../utils/format'

type OverlayPage = 'lyrics' | 'comments'

const player = usePlayerStore()
const ui = useUiStore()
const current = computed(() => player.current)

const activePage = ref<OverlayPage>('lyrics')
const narrowQuery = window.matchMedia('(max-width: 900px)')
const narrow = ref(narrowQuery.matches)
const trackRef = ref<HTMLElement | null>(null)
const dragOffset = ref(0)
const dragging = ref(false)
let pointerId: number | null = null
let startX = 0
let startY = 0

const trackStyle = computed(() => {
  if (!narrow.value) return undefined
  const base = activePage.value === 'lyrics' ? 0 : -100
  return { transform: `translateX(calc(${base}% + ${dragOffset.value}px))` }
})

function setPage(page: OverlayPage): void {
  activePage.value = page
  dragOffset.value = 0
}

function trackWidth(): number {
  return trackRef.value?.clientWidth ?? window.innerWidth
}

/** 左右边缘只允许少量位移，形成阻力回弹。 */
function clampDrag(dx: number): number {
  const width = trackWidth()
  if (activePage.value === 'lyrics') {
    if (dx > 0) return Math.min(dx * 0.25, width * 0.2)
    return Math.max(dx, -width)
  }
  if (dx < 0) return Math.max(dx * 0.25, -width * 0.2)
  return Math.min(dx, width)
}

function onPointerDown(event: PointerEvent): void {
  if (!narrow.value || event.pointerType !== 'touch' || pointerId !== null) return
  const target = event.target as HTMLElement | null
  if (target?.closest('input, textarea, button, a, [role="button"], .range')) return
  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  dragging.value = false
  dragOffset.value = 0
}

function onPointerMove(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (!dragging.value) {
    // 先满足水平位移且明显大于纵向，避免和普通纵向滚动抢手势。
    if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return
    dragging.value = true
    trackRef.value?.setPointerCapture?.(event.pointerId)
  }
  dragOffset.value = clampDrag(dx)
  event.preventDefault()
}

function finishSwipe(event: PointerEvent, cancelled: boolean): void {
  if (event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const wasDragging = dragging.value
  pointerId = null
  dragging.value = false
  dragOffset.value = 0
  if (wasDragging) trackRef.value?.releasePointerCapture?.(event.pointerId)
  if (cancelled || !wasDragging) return
  const threshold = Math.max(40, Math.min(100, trackWidth() * 0.15))
  if (dx <= -threshold && activePage.value === 'lyrics') activePage.value = 'comments'
  else if (dx >= threshold && activePage.value === 'comments') activePage.value = 'lyrics'
}

function onPointerUp(event: PointerEvent): void {
  finishSwipe(event, false)
}

function onPointerCancel(event: PointerEvent): void {
  finishSwipe(event, true)
}

function onPointerLeave(): void {
  if (dragging.value) return
  pointerId = null
  dragOffset.value = 0
}

function onNarrowChange(event: MediaQueryListEvent): void {
  narrow.value = event.matches
  pointerId = null
  dragging.value = false
  dragOffset.value = 0
}

onMounted(() => narrowQuery.addEventListener('change', onNarrowChange))

onBeforeUnmount(() => {
  narrowQuery.removeEventListener('change', onNarrowChange)
  pointerId = null
  dragging.value = false
})
</script>

<template>
  <div class="lyrics-overlay">
    <div class="lyrics-page">
      <header class="lyrics-page-head">
        <button class="icon-btn" title="关闭歌词与评论" @click="ui.closeLyrics()">
          <AppIcon name="chevron-left" :size="19" />
        </button>
        <CoverArt
          v-if="current"
          :src="songCover(current, 300)"
          image-class="lyrics-cover"
          :icon-size="18"
        />
        <div class="lyrics-page-info">
          <div v-if="current" class="lyrics-page-title">{{ current.name }}</div>
          <div v-else class="lyrics-page-title faint">还没有播放中的歌曲</div>
          <div v-if="current" class="lyrics-page-meta">
            <template v-if="singerNames(current)">
              <template
                v-for="(singer, index) in current.singers.filter((item) => item.name)"
                :key="`${singer.mid}-${index}`"
              >
                <RouterLink v-if="singer.mid" class="inline-link" :to="`/artist/${singer.mid}`">
                  {{ singer.name }}
                </RouterLink>
                <span v-else>{{ singer.name }}</span>
                <span
                  v-if="index < current.singers.filter((item) => item.name).length - 1"
                  class="singer-sep"
                  > / </span
                >
              </template>
            </template>
            <template v-if="current.album.name">
              <span class="singer-sep"> · </span>
              <RouterLink
                v-if="current.album.mid"
                class="inline-link"
                :to="`/album/${current.album.mid}`"
                >{{ current.album.name }}</RouterLink
              >
              <span v-else>{{ current.album.name }}</span>
            </template>
          </div>
        </div>
      </header>

      <div class="lyrics-page-body">
        <div
          ref="trackRef"
          class="lyrics-page-track"
          :class="{ dragging }"
          :style="trackStyle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @pointerleave="onPointerLeave"
        >
          <LyricsPanel
            :inert="narrow && activePage !== 'lyrics'"
            :aria-hidden="narrow && activePage !== 'lyrics'"
          />
          <div class="lyrics-page-divider" />
          <CommentsPanel
            :inert="narrow && activePage !== 'comments'"
            :aria-hidden="narrow && activePage !== 'comments'"
          />
        </div>
        <div class="lyrics-page-dots" role="tablist" aria-label="歌词与评论切换">
          <button
            type="button"
            class="lyrics-page-dot"
            :class="{ active: activePage === 'lyrics' }"
            role="tab"
            aria-label="显示歌词"
            :aria-selected="activePage === 'lyrics'"
            @click="setPage('lyrics')"
          />
          <button
            type="button"
            class="lyrics-page-dot"
            :class="{ active: activePage === 'comments' }"
            role="tab"
            aria-label="显示评论"
            :aria-selected="activePage === 'comments'"
            @click="setPage('comments')"
          />
        </div>
      </div>
    </div>
  </div>
</template>
