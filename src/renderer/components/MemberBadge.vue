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

/**
 * 以 Roboto Black 的 V 为参照重建的对称字形：左右镜像，保证两侧笔画等宽。
 * 豪华绿钻放在右下区域。
 */
const V_DELUXE = 'M12.2 12 L14.44 12 L16.2 18.498 L17.96 12 L20.2 12 L16.92 20.55 L15.48 20.55 Z'
/** 超级会员：V 水平居中，上下左右均与钻石边框留出间距。 */
const V_SUPER = 'M8.2 7.9 L10.328 7.9 L12 14.077 L13.672 7.9 L15.8 7.9 L12.684 16.028 L11.316 16.028 Z'

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
      <path class="member-diamond" d="M7.8 4H16.2L21.6 9.4L12 20L2.4 9.4Z" />
      <path v-if="level === 'deluxe'" class="member-v" :d="V_DELUXE" />
      <path v-else-if="level === 'super'" class="member-v" :d="V_SUPER" />
    </svg>
    <span v-if="showLabel" class="member-badge-label">{{ label }}</span>
  </span>
</template>
