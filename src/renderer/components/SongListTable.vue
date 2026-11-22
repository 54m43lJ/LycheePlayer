<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Song, SongAvailability } from '@shared/types'
import PlaylistPicker from './PlaylistPicker.vue'
import SongTable from './SongTable.vue'
import { useDownloadAction } from '../composables/download-action'
import { useDownloadStore } from '../stores/download'
import { usePlayerStore } from '../stores/player'
import { usePlaylistEditStore } from '../stores/playlist-edit'

/**
 * 歌曲表页面的共用接线：收藏、下载、下一首播放与“添加到歌单”选择器。
 * 播放由页面通过 play 事件提供，因为歌单详情需要同时构建播放队列。
 */
const props = withDefaults(
  defineProps<{
    songs: Song[]
    activeMid?: string | null
    showAlbum?: boolean
    availability?: Record<string, SongAvailability>
    removable?: boolean
    canAddToPlaylist?: boolean
    downloadable?: boolean
  }>(),
  {
    activeMid: null,
    showAlbum: true,
    availability: () => ({}),
    removable: false,
    canAddToPlaylist: false,
    downloadable: true
  }
)

const emit = defineEmits<{
  play: [index: number]
  remove: [index: number]
  added: [id: string]
}>()

const player = usePlayerStore()
const playlistEdit = usePlaylistEditStore()
const download = useDownloadStore()
const { requestDownload } = useDownloadAction()

const favoriteMids = computed(() => [...playlistEdit.favorites])
const assetStates = computed(() => download.assets)
const pickerOpen = ref(false)
const pickerIndex = ref(-1)
const pickerMids = computed(() => {
  const song = props.songs[pickerIndex.value]
  return song ? [song.songMid] : []
})
const pickerName = computed(() => props.songs[pickerIndex.value]?.name ?? '')

function addNextAt(index: number): void {
  const song = props.songs[index]
  if (song) player.addNext(song)
}

async function toggleFavorite(index: number): Promise<void> {
  const song = props.songs[index]
  if (song) await playlistEdit.toggleFavorite(song.songMid)
}

async function downloadAt(index: number): Promise<void> {
  const song = props.songs[index]
  if (song) await requestDownload(song, player.requestedQuality)
}

function openPicker(index: number): void {
  pickerIndex.value = index
  pickerOpen.value = true
}

function onAdded(id: string): void {
  pickerOpen.value = false
  emit('added', id)
}
</script>

<template>
  <SongTable
    :songs="songs"
    :active-mid="activeMid"
    :show-album="showAlbum"
    :availability="availability"
    :favorite-mids="favoriteMids"
    :asset-states="assetStates"
    :downloadable="downloadable"
    :removable="removable"
    :can-add-to-playlist="canAddToPlaylist"
    @play="emit('play', $event)"
    @play-next="addNextAt"
    @toggle="player.toggle()"
    @favorite="toggleFavorite"
    @download="downloadAt"
    @remove="emit('remove', $event)"
    @add-to-playlist="openPicker"
  />

  <PlaylistPicker
    :open="pickerOpen"
    :song-mids="pickerMids"
    :song-name="pickerName"
    @close="pickerOpen = false"
    @added="onAdded"
  />
</template>
