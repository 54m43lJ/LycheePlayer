<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * 文本超出容器宽度时无缝跑马灯滚动，未超出时静止。
 * 测量以首个文本副本为准；悬停暂停由 CSS 提供。
 */
const props = defineProps<{
  text: string
  /** 滚动速度，像素/秒。 */
  speed?: number
}>()

const root = ref<HTMLElement | null>(null)
const textEl = ref<HTMLElement | null>(null)
const scrolling = ref(false)
const duration = ref(12)

let observer: ResizeObserver | null = null

function measure(): void {
  const box = root.value
  const el = textEl.value
  if (!box || !el) return
  const overflow = el.offsetWidth - box.clientWidth
  scrolling.value = overflow > 4
  if (scrolling.value) {
    duration.value = Math.max(8, Math.round((el.offsetWidth + 32) / (props.speed ?? 30)))
  }
}

watch(
  () => props.text,
  async () => {
    await nextTick()
    measure()
  }
)

onMounted(() => {
  observer = new ResizeObserver(() => measure())
  if (root.value) observer.observe(root.value)
  measure()
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="root" class="marquee">
    <div
      class="marquee-track"
      :class="{ scrolling }"
      :style="scrolling ? { animationDuration: `${duration}s` } : undefined"
    >
      <span ref="textEl" class="marquee-text">{{ text }}</span>
      <span v-if="scrolling" class="marquee-text" aria-hidden="true">{{ text }}</span>
    </div>
  </div>
</template>
