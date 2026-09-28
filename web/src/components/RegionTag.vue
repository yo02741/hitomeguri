<script setup lang="ts">
import { computed } from 'vue'

import { AIRPORT_AREA } from '../data/airports'
import { regionOf } from '../data/regions'
import { useCatalogStore } from '../stores/catalog'

// 地區標籤（DESIGN.md §7.5）：浮在地圖左上，整塊是回到首頁日本地圖的按鈕。
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
  <RouterLink
    v-if="region"
    to="/"
    aria-label="切換地區"
    :data-pref="pref"
    class="relative flex shrink-0 flex-col overflow-hidden rounded-card bg-region px-4 py-3 text-on-region no-underline shadow-float"
  >
    <span class="absolute -top-9 -right-7 size-[104px] rounded-full bg-region-accent"></span>
    <span class="relative flex items-end gap-3">
      <span class="flex flex-col">
        <span lang="ja" class="text-caption tracking-kana opacity-85">{{ region.name.kana }}</span>
        <span lang="ja" class="text-h3 leading-tight font-black tracking-name">{{ region.name.ja }}</span>
      </span>
      <span class="ml-auto flex flex-col items-end">
        <span class="font-latin text-body-sm font-bold tracking-[0.3em] uppercase">{{ region.name.romaji }}</span>
        <span class="text-caption font-bold">{{ region.area_name }}</span>
      </span>
    </span>
    <span v-if="routes.length" class="relative mt-1.5 font-latin text-caption font-semibold tracking-[1px]">{{ routes.join('　') }}</span>
  </RouterLink>
</template>
