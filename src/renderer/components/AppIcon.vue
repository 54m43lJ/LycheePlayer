<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 20 })

const ICONS: Record<string, string[]> = {
  search: ['M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M16.5 16.5 21 21'],
  library: [
    'M4 5.5h10',
    'M4 12h10',
    'M4 18.5h7',
    'M17.5 5.5v10.2',
    'M17.5 15.7a2.3 2.3 0 1 0 2.5 2.3V5.5l-2.5.5'
  ],
  settings: [
    'M4 7h9',
    'M17 7h3',
    'M4 17h3',
    'M11 17h9',
    'M15 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
    'M9 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z'
  ],
  play: ['M8 5v14l11-7z'],
  pause: ['M8 5h3v14H8z', 'M13 5h3v14h-3z'],
  previous: ['M6 5h2v14H6z', 'M19 5v14L9 12z'],
  next: ['M18 5h-2v14h2z', 'M5 5v14l10-7z'],
  volume: [
    'M4 9.5v5h3.5L12 18V6L7.5 9.5H4z',
    'M15.5 8.5a5 5 0 0 1 0 7',
    'M18 6a8.5 8.5 0 0 1 0 12'
  ],
  mute: ['M4 9.5v5h3.5L12 18V6L7.5 9.5H4z', 'M16 9l5 6', 'M21 9l-5 6'],
  lyrics: ['M5 6h9', 'M5 11h14', 'M5 16h10', 'M5 20h6'],
  close: ['M6 6l12 12', 'M18 6l-12 12'],
  refresh: ['M20 11a8 8 0 1 0-2.3 6.4', 'M20 5v6h-6'],
  logout: ['M14 5h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-4', 'M10 8l-4 4 4 4', 'M6 12h9'],
  login: ['M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4', 'M14 8l4 4-4 4', 'M18 12H9'],
  music: ['M12 3v10.55A4 4 0 1 0 14 17V7h6V3h-8z'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M4.5 21a7.5 7.5 0 0 1 15 0'],
  'chevron-left': ['M14.5 6 9 12l5.5 6'],
  'chevron-right': ['M9.5 6 15 12l-5.5 6'],
  repeat: ['M17 3l3 3-3 3', 'M4 11V9a3 3 0 0 1 3-3h13', 'M7 21l-3-3 3-3', 'M20 13v2a3 3 0 0 1-3 3H4'],
  'repeat-one': [
    'M17 3l3 3-3 3',
    'M4 11V9a3 3 0 0 1 3-3h13',
    'M7 21l-3-3 3-3',
    'M20 13v2a3 3 0 0 1-3 3H4',
    'M11.5 10.5l1.5-1v5'
  ],
  shuffle: ['M4 7h3c4 0 6 10 10 10h3', 'M17 14l3 3-3 3', 'M4 17h3c1.5 0 2.7-1.4 3.7-3', 'M15.5 7H20', 'M17 4l3 3-3 3'],
  list: ['M8 6h12', 'M8 12h12', 'M8 18h12', 'M4 6h.01', 'M4 12h.01', 'M4 18h.01'],
  check: ['M5 12.5 9.5 17 19 7'],
  qrcode: [
    'M4 4h6v6H4z',
    'M14 4h6v6h-6z',
    'M4 14h6v6H4z',
    'M14 14h2v2h-2z',
    'M18 14h2v2h-2z',
    'M14 18h2v2h-2z',
    'M18 18h2v2h-2z'
  ]
}

const FILLED = new Set(['play', 'pause', 'previous', 'next', 'music'])

const paths = computed(() => ICONS[props.name] ?? [])
const filled = computed(() => FILLED.has(props.name))
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    :stroke="filled ? 'none' : 'currentColor'"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path v-for="(path, index) in paths" :key="index" :d="path" />
  </svg>
</template>
