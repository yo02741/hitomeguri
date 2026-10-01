<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import CardReveal from './components/CardReveal.vue'
import TabBar from './components/TabBar.vue'
import { useExploreStore } from './stores/explore'

// 整頁地區色由根元素的 data-pref 決定（DESIGN.md §3.4）；沒有地區語境時不設，落到 :root 的全國色。
const explore = useExploreStore()
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
    <CardReveal />
  </div>
</template>
