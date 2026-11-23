<script setup lang="ts">
import { computed } from 'vue'
import type { VipLevel, VipStatus } from '@shared/types'

const props = withDefaults(
  defineProps<{
    /** 全局会员状态；未登录、未知或非会员时不渲染。 */
    status: VipStatus | null
    /** 是否在图标后显示档位文字；默认仅图标。 */
    showLabel?: boolean
    /** 图标边长，像素。 */
    size?: number
  }>(),
  { showLabel: false, size: 16 }
)

const LABELS: Record<Exclude<VipLevel, 'none'>, string> = {
  vip: '绿钻',
  deluxe: '豪华绿钻',
  super: '超级会员'
}

const level = computed<Exclude<VipLevel, 'none'> | null>(() => {
  const status = props.status
  if (!status || status.state !== 'known' || !status.isVip || status.level === 'none') return null
  return status.level
})

const label = computed(() => (level.value ? LABELS[level.value] : ''))
</script>

<template>
  <span
    v-if="level"
    class="member-badge"
    :class="`member-${level}`"
    :role="showLabel ? undefined : 'img'"
    :aria-label="showLabel ? undefined : label"
  >
    <svg
      class="member-badge-icon"
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path class="member-diamond" d="M8 4H16L21 9.5L12 21L3 9.5Z" />
      <path class="member-facet" d="M3 9.5H21" />
      <path v-if="level === 'deluxe'" class="member-v" d="M14.6 13 16 15 17.9 12.6" />
      <path v-else-if="level === 'super'" class="member-v" d="M8.4 11.7 12 15.8 15.6 11.7" />
    </svg>
    <span v-if="showLabel" class="member-badge-label">{{ label }}</span>
  </span>
</template>
