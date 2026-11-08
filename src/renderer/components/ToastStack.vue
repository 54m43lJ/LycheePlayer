<script setup lang="ts">
import { useToast } from '../composables/toast'

const { toasts } = useToast()
</script>

<template>
  <div class="toast-stack">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.kind">
      {{ toast.message }}
    </div>
  </div>
</template>
