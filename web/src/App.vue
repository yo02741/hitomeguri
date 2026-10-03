<script setup lang="ts">
import { defineAsyncComponent, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppHeader from './components/AppHeader.vue'
import AppUpdate from './components/AppUpdate.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import TabBar from './components/TabBar.vue'
import { confirmRequest } from './services/confirm'
import { theme } from './services/theme'
import { wide } from './services/viewport'
import { walkerOn } from './services/walker'
import { useExploreStore } from './stores/explore'
import { useUserStore } from './stores/user'

// 整頁地區色由根元素的 data-pref 決定（DESIGN.md §3.4）；沒有地區語境時不設，落到 :root 的全國色。
const explore = useExploreStore()
const userStore = useUserStore()
const route = useRoute()

// 手機狀態列與 PWA 標題列跟著 header 色（地區、年代）。讀 custom property，不讀 backgroundColor：
// #app-root 換色有 200ms 過渡，那時讀到的是過渡中的顏色。flush: 'post' 等 data-pref 換上之後再讀。
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]')
  const root = document.getElementById('app-root')
  if (!meta || !root) return
  const header = getComputedStyle(root).getPropertyValue('--region-header').trim()
  if (header) meta.setAttribute('content', header)
}
onMounted(syncThemeColor)
watch([() => explore.activePref, theme], syncThemeColor, { flush: 'post' })

// 登入後才用到的不放進入口程式：新卡入手（開場之後閒下來先抓，main.ts）、紙娃娃的 SVG 定義、散步的旅人。
// 新卡入手登入就掛上：它用的成就 store 要在第一次「去過」之前建好基準（stores/achievements.ts）。
const CardReveal = defineAsyncComponent(() => import('./components/CardReveal.vue'))
const DollDefs = defineAsyncComponent(() => import('./components/DollDefs.vue'))
const DollWalker = defineAsyncComponent(() => import('./components/DollWalker.vue'))
</script>

<template>
  <div
    id="app-root"
    :data-pref="explore.activePref ?? undefined"
    class="flex h-dvh flex-col bg-paper text-ink transition-colors duration-200 print:block print:h-auto"
  >
    <AppHeader />
    <!-- 列印（旅前小書）時攤開固定高度的捲動版面，否則只印得出第一頁。
         id 給換頁的捲動位置用（services/scrollRestore.ts）。
         橫向的瀏海：內容左右讓出安全區；沒有分頁列（≥1024）時底部也讓出。
         data-bleed：地圖頁的地圖本身鋪到瀏海底下，控制項再縮回來（theme.css 的 .map-root） -->
    <main
      id="app-main"
      :data-bleed="route.meta.bleed ? '' : undefined"
      class="flex min-h-0 flex-1 flex-col overflow-y-auto pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] lg:pb-[env(safe-area-inset-bottom)] print:block print:overflow-visible print:p-0"
    >
      <RouterView />
    </main>
    <TabBar />
    <AppUpdate />
    <ConfirmDialog v-if="confirmRequest" :key="confirmRequest.id" :req="confirmRequest" />
    <template v-if="userStore.user">
      <CardReveal />
      <DollDefs />
      <DollWalker v-if="walkerOn && wide" />
    </template>
  </div>
</template>
