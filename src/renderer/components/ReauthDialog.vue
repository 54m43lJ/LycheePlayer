<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ReauthReason } from '@shared/types'
import AppIcon from './AppIcon.vue'
import { useBackDismiss } from '../composables/back-navigation'

const props = defineProps<{
  open: boolean
  reason: ReauthReason | null
}>()

const emit = defineEmits<{ login: []; dismiss: [] }>()
const loginRef = ref<HTMLButtonElement | null>(null)

useBackDismiss(() => props.open, () => emit('dismiss'))

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    loginRef.value?.focus()
  }
)

const title = computed(() =>
  props.reason === 'v1' ? '登录凭证需要更新' : '登录已失效'
)
const message = '请重新登录。'

function onKeydown(event: KeyboardEvent): void {
  if (props.open && event.key === 'Escape') emit('dismiss')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="open" class="dialog-backdrop" @click.self="emit('dismiss')">
    <section
      class="dialog confirm-dialog"
      role="alertdialog"
      aria-modal="true"
      :aria-label="title"
    >
      <header class="dialog-head">
        <h2>{{ title }}</h2>
        <button class="icon-btn" title="关闭" @click="emit('dismiss')">
          <AppIcon name="close" :size="17" />
        </button>
      </header>
      <div class="dialog-body">
        <p class="confirm-message">{{ message }}</p>
      </div>
      <footer class="dialog-foot">
        <button class="btn ghost small" @click="emit('dismiss')">稍后</button>
        <button ref="loginRef" class="btn primary small" @click="emit('login')">
          重新登录
        </button>
      </footer>
    </section>
  </div>
</template>
