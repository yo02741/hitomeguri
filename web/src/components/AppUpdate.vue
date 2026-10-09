<script setup lang="ts">
import { registerSW } from 'virtual:pwa-register'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { whenIdle } from '../services/idle'
import { pageLoadError } from '../services/pageLoad'
import { dismissToast, holdToast, releaseToast, toast, undoToast } from '../services/toast'
import { afterSplash } from '../services/splash'

// 底部一行的提示，同一個位置一次一則：頁面載入失敗 > 可以復原的移除（services/toast.ts）> 有新版本。
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

// 底部貼著的工作列（景點 sheet 的收藏・去過・清單・行程、經縣值的級數條…，標 data-toast-above 或 .bottom-dock）
// 在畫面上時，提示改放在它上面，不蓋住主要按鈕。提示出現期間每一格量一次（sheet 拖動、換頁、轉向都跟得上）。
const showing = computed(() => Boolean(pageLoadError.value || toast.value || needRefresh.value))
const lift = ref(0)
let raf = 0
function measure() {
  const vh = window.innerHeight
  const own = document.querySelector<HTMLElement>('[data-app-toast]')?.getBoundingClientRect()
  let top = vh
  for (const el of document.querySelectorAll<HTMLElement>('[data-toast-above], .bottom-dock')) {
    const r = el.getBoundingClientRect()
    if (!r.height || !r.width || r.top >= vh || r.bottom <= 0) continue
    // 只算貼在畫面下半部的列
    if (r.top < vh / 2) continue
    // 左右沒有重疊（桌機的景點面板在右邊）就不用讓
    if (own && (r.right <= own.left || r.left >= own.right)) continue
    top = Math.min(top, r.top)
  }
  const next = top < vh ? Math.round(vh - top) + 12 : 0
  if (next !== lift.value) lift.value = next
  raf = window.requestAnimationFrame(measure)
}
watch(
  showing,
  (on) => {
    window.cancelAnimationFrame(raf)
    if (on) measure()
    else lift.value = 0
  },
  { immediate: true },
)
onBeforeUnmount(() => window.cancelAnimationFrame(raf))
// 工作列本身貼在分頁列上方，所以抬起來的位置一定比原本（分頁列上方 1.5rem）高
const liftStyle = computed(() => (lift.value ? { bottom: `${lift.value}px` } : undefined))
</script>

<template>
  <!-- 頁面程式載入失敗（services/pageLoad.ts）：同一個位置、同一個樣式，優先於新版本提示 -->
  <div
    v-if="pageLoadError"
    data-reduce="fade"
    :style="liftStyle"
    data-app-toast
    class="fixed bottom-[calc(var(--spacing-tabbar)+1.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 animate-pop-up items-center gap-3 rounded-card bg-ink py-2 pr-2 pl-4 text-body-sm whitespace-nowrap text-paper shadow-float lg:bottom-6 print:hidden"
    role="status"
  >
    {{ pageLoadError === 'offline' ? '離線中，無法開啟這一頁' : '無法開啟這一頁' }}
    <button v-if="pageLoadError === 'failed'" type="button" class="h-9 rounded-control bg-paper px-3 text-body-sm font-bold text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="reloadOnce">重新整理</button>
    <button type="button" class="grid size-9 place-items-center rounded-control text-paper/80 hover:text-paper active:not-disabled:translate-y-px pointer-coarse:size-tap" aria-label="關閉" @click="pageLoadError = null">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
  <!-- 復原：key 換成新的一則時重播出現的動畫。左右各留 16px 再置中（left-1/2 的寫法寬度只剩半個畫面，清單名會被截掉） -->
  <div
    v-else-if="toast"
    :key="toast.id"
    data-reduce="fade"
    :style="liftStyle"
    data-app-toast
    class="fixed inset-x-4 bottom-[calc(var(--spacing-tabbar)+1.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex w-fit max-w-[min(520px,calc(100vw-2rem))] animate-pop-up items-center gap-3 rounded-card bg-ink py-2 pr-2 pl-4 text-body-sm text-paper shadow-float lg:bottom-6 print:hidden"
    role="status"
    @pointerenter="holdToast"
    @pointerleave="releaseToast"
    @focusin="holdToast"
    @focusout="releaseToast"
  >
    <span class="min-w-0 truncate">{{ toast.text }}</span>
    <button v-if="toast.undo" type="button" class="h-9 shrink-0 rounded-control bg-paper px-3 text-body-sm font-bold text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="undoToast">復原</button>
    <button type="button" class="grid size-9 shrink-0 place-items-center rounded-control text-paper/80 hover:text-paper active:not-disabled:translate-y-px pointer-coarse:size-tap" aria-label="關閉" @click="dismissToast">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
  <div
    v-else-if="needRefresh"
    data-reduce="fade"
    :style="liftStyle"
    data-app-toast
    class="fixed bottom-[calc(var(--spacing-tabbar)+1.5rem+env(safe-area-inset-bottom))] left-1/2 z-[60] flex -translate-x-1/2 animate-pop-up items-center gap-3 rounded-card bg-ink py-2 pr-2 pl-4 text-body-sm text-paper shadow-float lg:bottom-6 print:hidden"
    role="status"
  >
    有新版本
    <button type="button" class="h-9 rounded-control bg-paper px-3 text-body-sm font-bold text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="updateServiceWorker">重新整理</button>
    <button type="button" class="grid size-9 place-items-center rounded-control text-paper/80 hover:text-paper active:not-disabled:translate-y-px pointer-coarse:size-tap" aria-label="稍後" @click="needRefresh = false">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
</template>
