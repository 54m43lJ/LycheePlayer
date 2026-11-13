<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    playing?: boolean
    paused?: boolean
    label?: string
    pauseLabel?: string
    resumeLabel?: string
  }>(),
  {
    loading: false,
    playing: false,
    paused: false,
    label: '播放整个歌单',
    pauseLabel: '暂停播放',
    resumeLabel: '继续播放'
  }
)

const emit = defineEmits<{ play: [] }>()

const labelText = computed(() => {
  if (props.loading) return '正在加载歌单'
  if (props.playing) return props.pauseLabel
  if (props.paused) return props.resumeLabel
  return props.label
})
</script>

<template>
  <button
    type="button"
    class="card-play"
    :title="labelText"
    :aria-label="labelText"
    :disabled="loading"
    @click.stop="emit('play')"
    @keydown.stop
  >
    <span v-if="loading" class="spinner" />
    <AppIcon v-else :name="playing ? 'pause' : 'play'" :size="17" />
  </button>
</template>
