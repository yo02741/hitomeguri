<script setup lang="ts">
import { computed } from 'vue'

import { groupByArea, regions } from '../data/regions'
import RegionChip from './RegionChip.vue'

// 首頁：47 都道府縣依地方列出；還沒有景點資料的縣也能進入，字色較淡。
const props = defineProps<{ available: string[] }>()
const groups = computed(() => groupByArea(regions.map((r) => r.prefecture)))
const hasData = computed(() => new Set(props.available))
</script>

<template>
  <section class="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-card bg-paper px-4 pt-5 pb-3 shadow-float">
    <h1 class="px-1 text-h3 leading-[1.45] font-black tracking-[2px]">來一趟日本，<br />才知道它有多大。</h1>
    <nav class="flex flex-col" aria-label="地區">
      <template v-for="g in groups" :key="g.area">
        <span class="px-2 pt-2.5 pb-1 text-caption font-bold tracking-section text-sub first:pt-0">{{ g.areaName }}</span>
        <RouterLink
          v-for="r in g.items"
          :key="r.prefecture"
          :to="`/map/${r.prefecture}`"
          class="flex h-9 shrink-0 items-center gap-3 rounded-control px-2 no-underline hover:bg-surface"
          :class="hasData.has(r.prefecture) ? 'text-ink' : 'text-sub'"
        >
          <RegionChip :pref="r.prefecture" :size="18" />
          <span lang="ja" class="w-14 shrink-0 text-body-sm font-bold">{{ r.name.ja }}</span>
          <span lang="ja" class="min-w-0 truncate text-caption tracking-[1px] text-sub">{{ r.name.kana }}</span>
          <span class="ml-auto shrink-0 font-latin text-[11px] font-bold tracking-[2px] text-sub">{{ r.name.romaji }}</span>
        </RouterLink>
      </template>
    </nav>
  </section>
</template>
