import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import '@fontsource/noto-sans-yi/yi-400.css'
import './styles/main.css'

createApp(App).use(createPinia()).use(router).mount('#app')
