<script setup lang="ts">
import { ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    src?: string
    imageClass?: string
    iconSize?: number
  }>(),
  { src: '', imageClass: '', iconSize: 24 }
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  }
)
</script>

<template>
  <img
    v-if="src && !failed"
    :class="imageClass"
    :src="src"
    alt=""
    loading="lazy"
    @error="failed = true"
  />
  <div v-else :class="[imageClass, 'cover-fallback']">
    <AppIcon name="music" :size="iconSize" />
  </div>
</template>
