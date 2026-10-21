<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppIcon from './AppIcon.vue'
import CommentsPanel from './CommentsPanel.vue'
import { useLyrics } from '../composables/lyrics'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { singerNames } from '../utils/format'

const player = usePlayerStore()
const ui = useUiStore()
const { current } = storeToRefs(player)
const { lines, loading, error, activeIndex } = useLyrics()
const listRef = ref<HTMLElement | null>(null)

const subtitle = computed(() => (current.value ? `${current.value.name} · ${singerNames(current.value)}` : '暂无歌曲'))

watch(activeIndex, async (index) => {
  if (index < 0 || !ui.lyricsOpen) return
  await nextTick()
  const active = listRef.value?.querySelector<HTMLElement>('.lyric-line.active')
  active?.scrollIntoView({ block: 'center', behavior: 'smooth' })
})

watch(
  () => ui.lyricsOpen,
  async (open) => {
    if (!open) return
    await nextTick()
    listRef.value?.querySelector<HTMLElement>('.lyric-line.active')?.scrollIntoView({ block: 'center' })
  }
)
</script>

<template>
  <aside class="now-playing-panel" :class="{ open: ui.lyricsOpen }">
    <section class="now-playing-side lyrics-side">
      <div class="lyrics-head">
        <div>
          <h2>歌词</h2>
          <p>{{ subtitle }}</p>
        </div>
        <button class="icon-btn" title="关闭" @click="ui.closeLyrics()">
          <AppIcon name="close" :size="18" />
        </button>
      </div>

      <div v-if="loading" class="lyrics-empty">
        <span class="spinner" />
        <span>正在加载歌词</span>
      </div>
      <div v-else-if="lines.length === 0" class="lyrics-empty">
        <AppIcon name="lyrics" :size="26" />
        <span>{{ error || (current ? '这首歌还没有歌词' : '播放歌曲后显示歌词') }}</span>
      </div>
      <div v-else ref="listRef" class="lyrics-list">
        <button
          v-for="(line, index) in lines"
          :key="`${line.timeMs}-${index}`"
          class="lyric-line"
          :class="{ active: index === activeIndex }"
          @click="player.seek(line.timeMs)"
        >
          {{ line.text || '♪' }}
          <span v-if="line.trans" class="lyric-trans">{{ line.trans }}</span>
        </button>
      </div>
    </section>

    <CommentsPanel />
  </aside>
</template>
