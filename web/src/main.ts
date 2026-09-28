import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import { sealSplash, trackSplash, webfontsReady } from './services/splash'
import './styles/theme.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
trackSplash(webfontsReady(), 'fonts')
trackSplash(router.isReady(), 'router')
app.mount('#app')
// 初始路由的頁面在 isReady 後的 microtask 內渲染、登記要等的資料與地圖；
// 用 setTimeout 排在那之後再封口
void router.isReady().then(() => setTimeout(sealSplash, 0))
