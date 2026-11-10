<template>
  <div class="discover-skeleton" aria-hidden="true">
    <div class="discover-skeleton-strip">
      <div v-for="index in 9" :key="index" class="discover-skeleton-item">
        <span class="skeleton discover-skeleton-cover" />
        <span class="discover-skeleton-text">
          <span class="skeleton discover-skeleton-line" />
          <span class="skeleton discover-skeleton-line short" />
        </span>
      </div>
    </div>
    <div class="discover-skeleton-playlists">
      <div v-for="index in 4" :key="index" class="discover-skeleton-playlist">
        <span class="skeleton discover-skeleton-card" />
        <span class="skeleton discover-skeleton-line" />
      </div>
    </div>
  </div>
</template>
