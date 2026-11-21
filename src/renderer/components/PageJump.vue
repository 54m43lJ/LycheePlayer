<script setup lang="ts">
import AppIcon from './AppIcon.vue'

defineProps<{ showTop: boolean; showBottom: boolean }>()
const emit = defineEmits<{ top: []; bottom: [] }>()
</script>

<template>
  <div v-if="showTop || showBottom" class="page-jump">
    <button
      v-if="showTop"
      type="button"
      class="page-jump-btn"
      title="跳转到顶部"
      aria-label="跳转到顶部"
      @click="emit('top')"
    >
      <AppIcon name="to-top" :size="17" />
    </button>
    <button
      v-if="showBottom"
      type="button"
      class="page-jump-btn"
      title="跳转到底部"
      aria-label="跳转到底部"
      @click="emit('bottom')"
    >
      <AppIcon name="to-bottom" :size="17" />
    </button>
  </div>
</template>
