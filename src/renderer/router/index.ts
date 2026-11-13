import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/discover' },
    {
      path: '/search',
      name: 'search',
      component: () => import('../views/SearchView.vue')
    },
    {
      path: '/discover',
      name: 'discover',
      component: () => import('../views/DiscoverView.vue')
    },
    {
      path: '/playlist/:id',
      name: 'playlist',
      component: () => import('../views/PlaylistView.vue')
    },
    {
      path: '/artist/:mid',
      name: 'artist',
      component: () => import('../views/ArtistView.vue')
    },
    {
      path: '/album/:mid',
      name: 'album',
      component: () => import('../views/AlbumView.vue')
    },
    {
      path: '/mv/:id',
      name: 'mv',
      component: () => import('../views/MvView.vue')
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('../views/LibraryView.vue')
    },
    {
      path: '/downloads',
      name: 'downloads',
      component: () => import('../views/DownloadsView.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue')
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue')
    }
  ]
})

export default router
