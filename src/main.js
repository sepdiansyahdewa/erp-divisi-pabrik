import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initAuth } from './auth'

// pulihkan sesi login (dan muat data dari cloud) dulu, baru tampilkan aplikasi
initAuth().finally(() => createApp(App).mount('#app'))
