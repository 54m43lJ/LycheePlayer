import { reactive } from 'vue'
import { TOAST_DURATION_MS } from '@shared/constants'

export type ToastKind = 'info' | 'error'

export interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

const state = reactive<{ items: ToastItem[] }>({ items: [] })
let sequence = 0

function dismiss(id: number): void {
  const index = state.items.findIndex((item) => item.id === id)
  if (index >= 0) state.items.splice(index, 1)
}

function show(message: string, kind: ToastKind = 'info'): void {
  const id = ++sequence
  state.items.push({ id, message, kind })
  window.setTimeout(() => dismiss(id), TOAST_DURATION_MS)
}

export function useToast() {
  return {
    toasts: state.items,
    show,
    error: (message: string) => show(message, 'error'),
    dismiss
  }
}
