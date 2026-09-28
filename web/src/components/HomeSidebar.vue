<script setup lang="ts">
import { computed } from 'vue'

import { groupByArea } from '../data/regions'
import RegionChip from './RegionChip.vue'

const props = defineProps<{ prefs: string[] }>()
const groups = computed(() => groupByArea(props.prefs))
</script>

<template>
  <section class="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-card bg-paper px-4 pt-5 pb-3 shadow-float">
    <h1 class="px-1 text-h3 leading-[1.45] font-black tracking-[2px]">來一趟日本，<br />才知道它有多大。</h1>
    <nav v-if="groups.length" class="flex flex-col" aria-label="地區">
      <template v-for="g in groups" :key="g.area">
        <span class="px-2 pt-2.5 pb-1 text-caption font-bold tracking-section text-sub first:pt-0">{{ g.areaName }}</span>
        <RouterLink
          v-for="r in g.items"
          :key="r.prefecture"
          :to="`/map/${r.prefecture}`"
          class="flex h-10 shrink-0 items-center gap-3 rounded-control px-2 text-ink no-underline hover:bg-surface"
        >
          <RegionChip :pref="r.prefecture" />
          <span lang="ja" class="w-12 text-body-sm font-bold">{{ r.name.ja }}</span>
          <span lang="ja" class="text-caption tracking-[1px] text-sub">{{ r.name.kana }}</span>
          <span class="ml-auto font-latin text-[11px] font-bold tracking-[2px] text-sub">{{ r.name.romaji }}</span>
        </RouterLink>
      </template>
    </nav>
    <p v-else class="px-1 text-body-sm text-sub">資料準備中。</p>
  </section>
</template>
