<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    danger?: boolean
    busy?: boolean
  }>(),
  { confirmLabel: '确定', danger: false, busy: false }
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
const cancelRef = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent): void {
  if (!props.open || event.key !== 'Escape') return
  emit('cancel')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    // 破坏性操作默认聚焦“取消”，避免误按回车直接执行。
    cancelRef.value?.focus()
  }
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('cancel')">
    <section class="dialog confirm-dialog" role="alertdialog" aria-modal="true" :aria-label="title">
      <header class="dialog-head">
        <h2>{{ title }}</h2>
        <button class="icon-btn" title="关闭" @click="emit('cancel')">
          <AppIcon name="close" :size="17" />
        </button>
      </header>
      <div class="dialog-body">
        <p class="confirm-message">{{ message }}</p>
      </div>
      <footer class="dialog-foot">
        <button ref="cancelRef" class="btn ghost small" @click="emit('cancel')">取消</button>
        <button
          class="btn small"
          :class="danger ? 'danger' : 'primary'"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </footer>
    </section>
  </div>
</template>
