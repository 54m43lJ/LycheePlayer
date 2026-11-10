<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ text: string }>()

const descRef = ref<HTMLElement | null>(null)
const expanded = ref(false)
const overflow = ref(false)
let observer: ResizeObserver | null = null

/** 折叠时检测简介是否超出可视行数；展开后保持切换按钮可收起。 */
function measure(): void {
  const el = descRef.value
  if (!el || expanded.value) return
  overflow.value = el.scrollHeight > el.clientHeight + 1
}

function toggle(): void {
  expanded.value = !expanded.value
  if (!expanded.value) void nextTick().then(measure)
}

watch(
  descRef,
  (el) => {
    observer?.disconnect()
    if (!el) return
    if (!observer) observer = new ResizeObserver(() => measure())
    observer.observe(el)
    measure()
  },
  { flush: 'post' }
)

watch(
  () => props.text,
  async () => {
    expanded.value = false
    overflow.value = false
    await nextTick()
    measure()
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>

<template>
  <div class="catalog-desc-block">
    <p ref="descRef" class="catalog-desc" :class="{ clamped: !expanded }">{{ text }}</p>
    <button
      v-if="overflow"
      type="button"
      class="catalog-desc-toggle"
      :aria-expanded="expanded"
      @click="toggle"
    >
      {{ expanded ? '收起' : '展开' }}
    </button>
  </div>
</template>
