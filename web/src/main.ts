import { createPinia } from 'pinia'
import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import { whenIdle } from './services/idle'
import { afterSplash, sealSplash, trackSplash, webfontsReady } from './services/splash'
import './services/theme'
import { installPageLoadErrors } from './services/pageLoad'
import { installScrollRestore } from './services/scrollRestore'
import { installViewTransitions } from './services/viewTransition'
import './styles/theme.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
installViewTransitions(router)
installScrollRestore(router, () => document.getElementById('app-main'))
installPageLoadErrors(router)
trackSplash(webfontsReady(), 'fonts')
trackSplash(router.isReady(), 'router')
app.mount('#app')
// iOS Safari 要文件上有 touchstart 監聽才套用 :active（按下的 1px 下壓、清單列底色）
document.addEventListener('touchstart', () => {}, { passive: true })
// 初始路由的頁面在 isReady 後的 microtask 內渲染、登記要等的資料與地圖；
// 用 setTimeout 排在那之後再封口。頁面程式載入失敗（services/pageLoad.ts）時也要封口，不然停在開場畫面
void router.isReady().then(
  () => setTimeout(sealSplash, 0),
  () => sealSplash(),
)
// 景點面板與新卡入手不在入口程式裡（ExploreView、App.vue 的 defineAsyncComponent）：
// 開場畫面拿掉、瀏覽器空下來之後先抓，第一次點景點、第一次按「去過」不必等下載
afterSplash(() =>
  whenIdle(() => {
    void import('./components/SpotPanel.vue')
    void import('./components/CardReveal.vue')
  }),
)
