<script setup lang="ts">
import AppIcon from './AppIcon.vue'

withDefaults(defineProps<{ loading?: boolean; label?: string }>(), {
  loading: false,
  label: '播放整个歌单'
})

const emit = defineEmits<{ play: [] }>()
</script>

<template>
  <button
    type="button"
    class="card-play"
    :title="loading ? '正在加载歌单' : label"
    :aria-label="loading ? '正在加载歌单' : label"
    :disabled="loading"
    @click.stop="emit('play')"
    @keydown.stop
  >
    <span v-if="loading" class="spinner" />
    <AppIcon v-else name="play" :size="17" />
  </button>
</template>
