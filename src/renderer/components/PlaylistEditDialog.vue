<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PlaylistMeta } from '@shared/types'
import AppIcon from './AppIcon.vue'

const props = defineProps<{ open: boolean; playlist?: PlaylistMeta | null }>()
const emit = defineEmits<{ close: []; submit: [name: string] }>()

const name = ref('')

watch(
  () => [props.open, props.playlist?.name] as const,
  ([open, playlistName]) => {
    if (open) name.value = props.playlist ? (playlistName ?? '') : ''
  },
  { immediate: true }
)

function submit(): void {
  const value = name.value.trim()
  if (!value) return
  emit('submit', value)
}
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
    <section class="dialog">
      <header class="dialog-head">
        <h2>{{ playlist ? '重命名歌单' : '新建歌单' }}</h2>
        <button class="icon-btn" title="关闭" @click="emit('close')">
          <AppIcon name="close" :size="17" />
        </button>
      </header>
      <div class="dialog-body">
        <label class="field">
          <span class="setting-name">歌单名称</span>
          <input v-model="name" class="input" maxlength="128" autofocus @keydown.enter="submit()" />
        </label>
      </div>
      <footer class="dialog-foot">
        <button class="btn ghost small" @click="emit('close')">取消</button>
        <button class="btn primary small" :disabled="!name.trim()" @click="submit()">
          {{ playlist ? '保存' : '创建' }}
        </button>
      </footer>
    </section>
  </div>
</template>
