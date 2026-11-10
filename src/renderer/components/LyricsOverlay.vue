<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppIcon from './AppIcon.vue'
import CommentsPanel from './CommentsPanel.vue'
import CoverArt from './CoverArt.vue'
import LyricsPanel from './LyricsPanel.vue'
import { usePlayerStore } from '../stores/player'
import { useUiStore } from '../stores/ui'
import { singerNames, songCover } from '../utils/format'

const player = usePlayerStore()
const ui = useUiStore()
const current = computed(() => player.current)
</script>

<template>
  <div class="lyrics-overlay">
    <div class="lyrics-page">
      <header class="lyrics-page-head">
        <button class="icon-btn" title="关闭歌词与评论" @click="ui.closeLyrics()">
          <AppIcon name="chevron-left" :size="19" />
        </button>
        <CoverArt
          v-if="current"
          :src="songCover(current, 300)"
          image-class="lyrics-cover"
          :icon-size="18"
        />
        <div class="lyrics-page-info">
          <div v-if="current" class="lyrics-page-title">{{ current.name }}</div>
          <div v-else class="lyrics-page-title faint">还没有播放中的歌曲</div>
          <div v-if="current" class="lyrics-page-meta">
            <template v-if="singerNames(current)">
              <template
                v-for="(singer, index) in current.singers.filter((item) => item.name)"
                :key="`${singer.mid}-${index}`"
              >
                <RouterLink v-if="singer.mid" class="inline-link" :to="`/artist/${singer.mid}`">
                  {{ singer.name }}
                </RouterLink>
                <span v-else>{{ singer.name }}</span>
                <span
                  v-if="index < current.singers.filter((item) => item.name).length - 1"
                  class="singer-sep"
                  > / </span
                >
              </template>
            </template>
            <template v-if="current.album.name">
              <span class="singer-sep"> · </span>
              <RouterLink
                v-if="current.album.mid"
                class="inline-link"
                :to="`/album/${current.album.mid}`"
                >{{ current.album.name }}</RouterLink
              >
              <span v-else>{{ current.album.name }}</span>
            </template>
          </div>
        </div>
      </header>

      <div class="lyrics-page-body">
        <LyricsPanel />
        <div class="lyrics-page-divider" />
        <CommentsPanel />
      </div>
    </div>
  </div>
</template>
