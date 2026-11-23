<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import { useBackDismiss } from '../composables/back-navigation'

const props = defineProps<{ url: string | null }>()
const emit = defineEmits<{ close: [] }>()

const stageRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const natural = ref(false)
const offset = ref({ x: 0, y: 0 })
const dragging = ref(false)

let pointerId: number | null = null
let startX = 0
let startY = 0
let startOffsetX = 0
let startOffsetY = 0
let moved = false
let suppressClick = false

const imageStyle = computed(() => ({
  transform: `translate3d(${offset.value.x}px, ${offset.value.y}px, 0)`
}))

useBackDismiss(() => props.url !== null, () => emit('close'))

function resetView(): void {
  natural.value = false
  offset.value = { x: 0, y: 0 }
  dragging.value = false
  pointerId = null
  moved = false
  suppressClick = false
}

watch(
  () => props.url,
  (url) => {
    if (url) resetView()
  }
)

function clampOffset(x: number, y: number): { x: number; y: number } {
  const image = imageRef.value
  const stage = stageRef.value
  if (!image || !stage) return { x: 0, y: 0 }
  const maxX = Math.max(0, (image.offsetWidth - stage.clientWidth) / 2)
  const maxY = Math.max(0, (image.offsetHeight - stage.clientHeight) / 2)
  return {
    x: Math.min(maxX, Math.max(-maxX, x)),
    y: Math.min(maxY, Math.max(-maxY, y))
  }
}

function toggleSize(): void {
  natural.value = !natural.value
  offset.value = { x: 0, y: 0 }
}

function onImageClick(): void {
  if (suppressClick) {
    suppressClick = false
    return
  }
  toggleSize()
}

function onPointerDown(event: PointerEvent): void {
  if (!natural.value || event.button !== 0) return
  const image = imageRef.value
  const stage = stageRef.value
  if (!image || !stage) return
  if (
    image.offsetWidth <= stage.clientWidth &&
    image.offsetHeight <= stage.clientHeight
  ) {
    return
  }
  event.preventDefault()
  dragging.value = true
  moved = false
  pointerId = event.pointerId
  startX = event.clientX
  startY = event.clientY
  startOffsetX = offset.value.x
  startOffsetY = offset.value.y
  image.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging.value || event.pointerId !== pointerId) return
  const dx = event.clientX - startX
  const dy = event.clientY - startY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
  offset.value = clampOffset(startOffsetX + dx, startOffsetY + dy)
}

function finishDrag(event: PointerEvent): boolean {
  if (!dragging.value || event.pointerId !== pointerId) return false
  const wasMoved = moved
  dragging.value = false
  imageRef.value?.releasePointerCapture(event.pointerId)
  pointerId = null
  suppressClick = true
  window.setTimeout(() => {
    suppressClick = false
  }, 0)
  return !wasMoved
}

function onPointerUp(event: PointerEvent): void {
  // 原尺寸下的单击同样切回适应屏幕；拖动只平移，不切换尺寸。
  if (finishDrag(event)) toggleSize()
}

function onPointerCancel(event: PointerEvent): void {
  finishDrag(event)
}

function onKeydown(event: KeyboardEvent): void {
  if (!props.url || event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown, true))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <Teleport to="body">
    <div v-if="url" class="image-lightbox" role="dialog" aria-modal="true" aria-label="查看评论图片">
      <div ref="stageRef" class="image-lightbox-stage" @click.self="emit('close')">
        <img
          ref="imageRef"
          class="image-lightbox-image"
          :class="{ natural, dragging }"
          :src="url"
          :style="imageStyle"
          alt="评论图片"
          draggable="false"
          @click="onImageClick"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
        />
      </div>
      <button
        class="image-lightbox-close"
        type="button"
        aria-label="关闭"
        @click="emit('close')"
      >
        <AppIcon name="close" :size="20" />
      </button>
    </div>
  </Teleport>
</template>
