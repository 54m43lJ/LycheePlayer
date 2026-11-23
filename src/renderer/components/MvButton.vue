<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppIcon from './AppIcon.vue'

withDefaults(
  defineProps<{
    /** 歌曲绑定的 MV ID；为空时不渲染。 */
    mvId: string
    /** 播放三角形的像素尺寸。 */
    size?: number
  }>(),
  { size: 13 }
)
</script>

<template>
  <RouterLink
    v-if="mvId"
    class="mv-mark"
    :to="`/mv/${mvId}`"
    aria-label="播放 MV"
    @click.stop
    @dblclick.stop
  >
    <AppIcon name="play" :size="size" />
  </RouterLink>
</template>
