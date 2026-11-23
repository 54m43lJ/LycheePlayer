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

/** Roboto Regular 大写 V 的字形，已合并为单条轮廓；坐标单位为字体单位。 */
const ROBOTO_V =
  'M29 1456 L238 1456 L663 221 L639 221 L1068 1456 L1277 1456 L738 0 L567 0 Z'
/** 豪华绿钻：V 放在图标右下区域，宽高比保持 Roboto V 的 1248:1456。 */
const V_DELUXE = 'translate(12.8 20.6) scale(0.00590659 -0.00590659) translate(-29 0)'
/** 超级会员：V 水平居中，上下左右均与钻石边框留出间距。 */
const V_SUPER = 'translate(8.4 16.2) scale(0.00576923 -0.00576923) translate(-29 0)'

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
      <path v-if="level === 'deluxe'" class="member-v" :transform="V_DELUXE" :d="ROBOTO_V" />
      <path v-else-if="level === 'super'" class="member-v" :transform="V_SUPER" :d="ROBOTO_V" />
    </svg>
    <span v-if="showLabel" class="member-badge-label">{{ label }}</span>
  </span>
</template>
