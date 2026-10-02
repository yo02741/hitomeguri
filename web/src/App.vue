<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

import AppHeader from './components/AppHeader.vue'
import AppUpdate from './components/AppUpdate.vue'
import TabBar from './components/TabBar.vue'
import { walkerOn } from './services/walker'
import { useExploreStore } from './stores/explore'
import { useUserStore } from './stores/user'

// 整頁地區色由根元素的 data-pref 決定（DESIGN.md §3.4）；沒有地區語境時不設，落到 :root 的全國色。
const explore = useExploreStore()
const userStore = useUserStore()

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
    <!-- 列印（旅前小書）時攤開固定高度的捲動版面，否則只印得出第一頁 -->
    <main class="flex min-h-0 flex-1 flex-col overflow-y-auto print:block print:overflow-visible">
      <RouterView />
    </main>
    <TabBar />
    <AppUpdate />
    <template v-if="userStore.user">
      <CardReveal />
      <DollDefs />
      <DollWalker v-if="walkerOn" />
    </template>
  </div>
</template>
