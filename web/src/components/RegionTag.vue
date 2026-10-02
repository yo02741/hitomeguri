<script setup lang="ts">
import { computed } from 'vue'

import { AIRPORT_AREA } from '../data/airports'
import { regionOf, regions } from '../data/regions'
import { theme } from '../services/theme'
import { useCatalogStore } from '../stores/catalog'
import RegionMotif from './RegionMotif.vue'

// 地區標籤（DESIGN.md §7.5）：浮在地圖左上。左側是返回鍵，回到首頁的日本地圖。
// 已驗證的台灣直飛航線列在下方（UX-FLOW.md A7）。
// 年代主題（DESIGN.md §13）換成車站的站名標：大字假名、上面漢字、下面羅馬拼音，
// 底下的色帶兩端是前後一個縣（都道府縣代碼順），可以直接換過去。
const props = defineProps<{ pref: string }>()
const region = computed(() => regionOf(props.pref))
const neighbors = computed(() => {
  const i = regions.findIndex((r) => r.prefecture === props.pref)
  return { prev: i > 0 ? regions[i - 1] : undefined, next: i >= 0 ? regions[i + 1] : undefined }
})
const catalog = useCatalogStore()
const routes = computed(() =>
  catalog.flights
    .filter((f) => AIRPORT_AREA[f.dest] === region.value?.area)
    .map((f) => `${f.origin} → ${f.dest}`),
)
</script>

<template>
  <div
    v-if="region && theme !== 'modern'"
    :data-pref="pref"
    class="relative flex shrink-0 flex-col overflow-hidden rounded-card bg-paper text-ink shadow-float [view-transition-name:region-hero]"
  >
    <span class="relative flex flex-col items-center px-3 pt-2.5 pb-2">
      <RouterLink
        to="/"
        aria-label="回到全國地圖"
        title="回到全國地圖"
        class="absolute top-1 left-1 flex min-h-tap items-center gap-0.5 rounded-control px-1.5 text-caption font-bold text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        全國
      </RouterLink>
      <span class="absolute top-2.5 right-3 rounded-tag border border-ink px-1.5 text-caption font-bold">{{ region.area_name }}</span>
      <span lang="ja" class="text-body-sm font-bold tracking-[0.3em] [view-transition-name:region-name]">{{ region.name.ja }}</span>
      <span lang="ja" class="font-display text-h1 leading-tight tracking-[0.12em] whitespace-nowrap [view-transition-name:region-kana]">{{ region.name.kana }}</span>
      <span class="font-sans text-caption font-bold tracking-[0.4em] uppercase [view-transition-name:region-romaji]">{{ region.name.romaji }}</span>
    </span>
    <span class="flex h-8 items-center justify-between bg-region-strong px-1 text-caption font-bold text-white">
      <RouterLink
        v-if="neighbors.prev"
        :to="`/map/${neighbors.prev.prefecture}`"
        class="flex h-full items-center gap-1 px-1.5 text-white no-underline active:not-disabled:translate-y-px"
        :aria-label="`前一個縣：${neighbors.prev.name.ja}`"
      >
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M8 0L0 5l8 5z" fill="currentColor" /></svg>
        <span lang="ja">{{ neighbors.prev.name.kana }}</span>
      </RouterLink>
      <span v-else></span>
      <RouterLink
        v-if="neighbors.next"
        :to="`/map/${neighbors.next.prefecture}`"
        class="flex h-full items-center gap-1 px-1.5 text-white no-underline active:not-disabled:translate-y-px"
        :aria-label="`下一個縣：${neighbors.next.name.ja}`"
      >
        <span lang="ja">{{ neighbors.next.name.kana }}</span>
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0l8 5-8 5z" fill="currentColor" /></svg>
      </RouterLink>
    </span>
    <span v-if="routes.length" class="px-3 py-1 font-latin text-caption tracking-[1px]">{{ routes.join('　') }}</span>
  </div>
  <div
    v-else-if="region"
    :data-pref="pref"
    class="paper-grain relative flex shrink-0 flex-col overflow-hidden rounded-card bg-region py-3 pr-4 pl-2 text-on-region shadow-float [view-transition-name:region-hero]"
  >
    <RegionMotif :pref="pref" class="absolute -top-9 -right-7 size-[104px] [view-transition-name:region-motif]" />
    <span class="relative flex items-center gap-2">
      <RouterLink
        to="/"
        aria-label="回到全國地圖"
        title="回到全國地圖"
        class="flex size-11 shrink-0 flex-col items-center justify-center rounded-control text-on-region no-underline hover:bg-region-accent active:not-disabled:translate-y-px"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span class="text-micro leading-none font-bold">全國</span>
      </RouterLink>
      <span class="h-8 w-px shrink-0 bg-on-region opacity-25" aria-hidden="true"></span>
      <span class="flex shrink-0 flex-col pl-1 whitespace-nowrap">
        <span lang="ja" class="w-fit text-caption tracking-kana opacity-85 [view-transition-name:region-kana]">{{ region.name.kana }}</span>
        <span lang="ja" class="w-fit text-h3 leading-tight font-black tracking-name [view-transition-name:region-name]">{{ region.name.ja }}</span>
      </span>
      <span class="ml-auto flex min-w-0 flex-col items-end self-end">
        <!-- 長的羅馬拼音（KAGOSHIMA 等）收緊字距，縣名不換行 -->
        <span
          class="font-latin text-body-sm font-bold whitespace-nowrap uppercase [view-transition-name:region-romaji]"
          :class="region.name.romaji.length > 7 ? 'tracking-[0.12em]' : 'tracking-[0.3em]'"
          >{{ region.name.romaji }}</span
        >
        <span class="text-caption font-bold">{{ region.area_name }}</span>
      </span>
    </span>
    <span v-if="routes.length" class="relative mt-1.5 pl-2 font-latin text-caption font-semibold tracking-[1px]">{{ routes.join('　') }}</span>
  </div>
</template>
