<script setup lang="ts">
withDefaults(defineProps<{ songs?: number; playlists?: number }>(), {
  songs: 30,
  playlists: 0
})
</script>

<template>
  <div class="discover-skeleton" aria-hidden="true">
    <div class="discover-strip">
      <article v-for="index in songs" :key="`song-${index}`" class="discover-item">
        <span class="discover-cover skeleton" />
        <div class="discover-text">
          <div class="discover-name"><span class="skeleton skeleton-line" /></div>
          <div class="discover-singer"><span class="skeleton skeleton-line short" /></div>
        </div>
      </article>
    </div>
    <div v-if="playlists > 0" class="discover-playlists">
      <div v-for="index in playlists" :key="`playlist-${index}`" class="card discover-playlist">
        <span class="card-cover skeleton" />
        <div class="card-name"><span class="skeleton skeleton-line" /></div>
        <div class="card-sub"><span class="skeleton skeleton-line short" /></div>
      </div>
    </div>
  </div>
</template>
