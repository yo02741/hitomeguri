<script setup lang="ts">
import { computed } from 'vue'

import { groupByArea } from '../data/regions'
import RegionChip from './RegionChip.vue'

const props = defineProps<{ prefs: string[] }>()
const groups = computed(() => groupByArea(props.prefs))
</script>

<template>
  <div class="flex flex-col gap-6 px-7 pt-8 pb-6">
    <h1 class="text-h2 leading-[1.45] font-black tracking-[2px]">來一趟日本，<br />才知道它有多大。</h1>
    <nav v-if="groups.length" class="flex flex-col gap-1" aria-label="地區">
      <template v-for="g in groups" :key="g.area">
        <span class="px-2.5 pt-3 pb-1 text-caption font-bold tracking-section text-sub first:pt-0">{{ g.areaName }}</span>
        <RouterLink
          v-for="r in g.items"
          :key="r.prefecture"
          :to="`/map/${r.prefecture}`"
          class="flex min-h-tap items-center gap-3 rounded-control px-2.5 text-ink no-underline hover:bg-surface"
        >
          <RegionChip :pref="r.prefecture" />
          <span lang="ja" class="w-12 text-body font-bold">{{ r.name.ja }}</span>
          <span lang="ja" class="text-caption tracking-[1px] text-sub">{{ r.name.kana }}</span>
          <span class="ml-auto font-latin text-[11px] font-bold tracking-[2px] text-sub">{{ r.name.romaji }}</span>
        </RouterLink>
      </template>
    </nav>
    <p v-else class="text-body-sm text-sub">資料準備中。</p>
  </div>
</template>
