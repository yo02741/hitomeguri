<script setup lang="ts">
import { registerSW } from 'virtual:pwa-register'
import { ref } from 'vue'

import { whenIdle } from '../services/idle'
import { afterSplash } from '../services/splash'

// 有新版本時底部一行提示（service worker 已下載好新版，按了才換，不在操作中途重新整理）
// 開場畫面拿掉、瀏覽器空下來之後才註冊：預先快取約 2.7 MB，不和首次載入的資料搶頻寬
const needRefresh = ref(false)
let update: ((reload?: boolean) => Promise<void>) | null = null
afterSplash(() =>
  whenIdle(() => {
    update = registerSW({ immediate: true, onNeedRefresh: () => (needRefresh.value = true) })
  }),
)
// 按「重新整理」：請等待中的新版接手，接手了就重新整理。
// 不靠 vite-plugin-pwa 的自動重新整理：新版是上次開站時就下載好、這次才跳提示的情況，它不會重新整理（按了沒反應）。
// 別的分頁已經換好版本時不會再換手，所以 3 秒內沒換也直接重新整理。
let reloading = false
function reloadOnce() {
  if (reloading) return
  reloading = true
  window.location.reload()
}
function updateServiceWorker() {
  navigator.serviceWorker?.addEventListener('controllerchange', reloadOnce, { once: true })
  window.setTimeout(reloadOnce, 3000)
  void update?.(false)
}
</script>

<template>
  <div
    v-if="needRefresh"
    data-reduce="fade"
    class="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 animate-pop-up items-center gap-3 rounded-card bg-ink py-2 pr-2 pl-4 text-body-sm text-paper shadow-float md:bottom-6 print:hidden"
    role="status"
  >
    有新版本
    <button type="button" class="h-9 rounded-control bg-paper px-3 text-label font-bold text-ink active:not-disabled:translate-y-px" @click="updateServiceWorker">重新整理</button>
    <button type="button" class="grid size-9 place-items-center rounded-control text-paper/80 hover:text-paper active:not-disabled:translate-y-px" aria-label="稍後" @click="needRefresh = false">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
</template>
