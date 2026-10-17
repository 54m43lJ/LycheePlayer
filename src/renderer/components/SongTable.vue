<script setup lang="ts">
import type { Song } from '@shared/types'
import AppIcon from './AppIcon.vue'
import CoverArt from './CoverArt.vue'
import { formatDuration, singerNames, songCover } from '../utils/format'

withDefaults(
  defineProps<{
    songs: Song[]
    activeMid?: string | null
    showAlbum?: boolean
  }>(),
  { activeMid: null, showAlbum: true }
)

const emit = defineEmits<{ play: [index: number] }>()
</script>

<template>
  <table class="song-table">
    <thead>
      <tr>
        <th class="song-index">#</th>
        <th>标题</th>
        <th v-if="showAlbum">专辑</th>
        <th style="width: 70px; text-align: right">时长</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(song, index) in songs"
        :key="`${song.songMid}-${index}`"
        class="song-row"
        :class="{ active: song.songMid === activeMid }"
        @dblclick="emit('play', index)"
      >
        <td class="song-index">
          <button class="song-play" title="播放" @click.stop="emit('play', index)">
            <AppIcon name="play" :size="13" />
          </button>
        </td>
        <td>
          <div class="song-main">
            <CoverArt :src="songCover(song, 300)" image-class="cover-thumb" :icon-size="16" />
            <div class="song-text">
              <div class="song-title">
                {{ song.name }}
                <span v-if="song.pay.album" class="pay-badge album">数字专辑</span>
                <span v-else-if="song.pay.vip" class="pay-badge">VIP</span>
                <span v-else-if="!song.pay.free" class="pay-badge">付费</span>
              </div>
              <div class="song-artist">{{ singerNames(song) }}</div>
            </div>
          </div>
        </td>
        <td v-if="showAlbum">
          <div class="song-album" :title="song.album.name">{{ song.album.name || '—' }}</div>
        </td>
        <td class="song-duration">{{ formatDuration(song.durationMs) }}</td>
      </tr>
    </tbody>
  </table>
</template>
