<script setup lang="ts">
import { computed } from 'vue'

import { AIRPORT_AREA } from '../data/airports'
import { regionOf } from '../data/regions'
import { useCatalogStore } from '../stores/catalog'

// 地區標籤（DESIGN.md §7.5）：浮在地圖左上。左側是返回鍵，回到首頁的日本地圖。
// 已驗證的台灣直飛航線列在下方（UX-FLOW.md A7）。
const props = defineProps<{ pref: string }>()
const region = computed(() => regionOf(props.pref))
const catalog = useCatalogStore()
const routes = computed(() =>
  catalog.flights
    .filter((f) => AIRPORT_AREA[f.dest] === region.value?.area)
    .map((f) => `${f.origin} → ${f.dest}`),
)
</script>

<template>
  <div
    v-if="region"
    :data-pref="pref"
    class="relative flex shrink-0 flex-col overflow-hidden rounded-card bg-region py-3 pr-4 pl-2 text-on-region shadow-float"
  >
    <span class="absolute -top-9 -right-7 size-[104px] rounded-full bg-region-accent"></span>
    <span class="relative flex items-center gap-2">
      <RouterLink
        to="/"
        aria-label="回到全國地圖"
        title="回到全國地圖"
        class="flex size-11 shrink-0 flex-col items-center justify-center rounded-control text-on-region no-underline hover:bg-region-accent"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span class="text-[10px] leading-none font-bold">全國</span>
      </RouterLink>
      <span class="h-8 w-px shrink-0 bg-on-region opacity-25" aria-hidden="true"></span>
      <span class="flex flex-col pl-1">
        <span lang="ja" class="text-caption tracking-kana opacity-85">{{ region.name.kana }}</span>
        <span lang="ja" class="text-h3 leading-tight font-black tracking-name">{{ region.name.ja }}</span>
      </span>
      <span class="ml-auto flex flex-col items-end self-end">
        <span class="font-latin text-body-sm font-bold tracking-[0.3em] uppercase">{{ region.name.romaji }}</span>
        <span class="text-caption font-bold">{{ region.area_name }}</span>
      </span>
    </span>
    <span v-if="routes.length" class="relative mt-1.5 pl-2 font-latin text-caption font-semibold tracking-[1px]">{{ routes.join('　') }}</span>
  </div>
</template>
