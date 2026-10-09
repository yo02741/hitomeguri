<script setup lang="ts">
import { computed } from 'vue'

import { groupByArea, regions } from '../data/regions'
import { wide } from '../services/viewport'
import { useExploreStore } from '../stores/explore'
import CollapseChevron from './CollapseChevron.vue'
import RegionChip from './RegionChip.vue'

// 首頁：47 都道府縣依地方列出；還沒有景點資料的縣字色較淡，也能進入。
// 桌機一縣一列（地方可以收合）；手機（<1024）是依地方分組的 3 欄站名板格，只放縣名（決定事項 H2）；
// 640 以上（打橫、平板）排 6 欄。
const props = defineProps<{ available: string[] }>()
const explore = useExploreStore()
const isOpen = (area: string) => !explore.collapsed.includes(`area:${area}`)
const groups = computed(() => groupByArea(regions.map((r) => r.prefecture)))
const hasData = computed(() => new Set(props.available))
</script>

<template>
  <section
    class="scroll-quiet flex min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain rounded-card bg-paper px-4 pt-5 pb-3 shadow-float max-lg:gap-2 max-lg:px-3 max-lg:pt-3"
  >
    <h1 class="px-1 text-h3 leading-[1.45] font-black tracking-title max-lg:text-title max-lg:leading-snug">
      來一趟日本，<br class="max-lg:hidden" />才知道它有多大。
    </h1>
    <nav v-if="wide" class="flex flex-col" aria-label="地區">
      <template v-for="g in groups" :key="g.area">
        <button
          type="button"
          class="flex items-center gap-2 rounded-control px-2 pt-2.5 pb-1 text-left text-caption font-bold tracking-section text-sub first:pt-0 hover:text-ink active:text-ink"
          :aria-expanded="isOpen(g.area)"
          @click="explore.toggleCollapsed(`area:${g.area}`)"
        >
          <CollapseChevron :open="isOpen(g.area)" />
          <span lang="ja">{{ g.areaName }}</span>
          <span v-if="!isOpen(g.area)" class="font-latin font-normal tracking-normal">{{ g.items.length }}</span>
        </button>
        <RouterLink
          v-for="r in isOpen(g.area) ? g.items : []"
          :key="r.prefecture"
          :to="`/map/${r.prefecture}`"
          class="flex h-9 shrink-0 items-center gap-2 rounded-control px-2 no-underline hover:bg-surface active:bg-surface"
          :class="hasData.has(r.prefecture) ? 'text-ink' : 'text-sub'"
        >
          <RegionChip :pref="r.prefecture" :size="18" />
          <span lang="ja" class="w-14 shrink-0 text-body-sm font-bold">{{ r.name.ja }}</span>
          <span lang="ja" class="min-w-0 truncate text-caption text-sub" :title="r.name.kana">{{ r.name.kana }}</span>
          <span class="ml-auto shrink-0 font-latin text-caption font-bold tracking-[0.06em] text-sub">{{ r.name.romaji }}</span>
        </RouterLink>
      </template>
    </nav>
    <!-- 手機：左邊一欄地方名，右邊 3 欄站名板（縣名＋底下一條縣色帶，DESIGN.md §7.5） -->
    <nav v-else class="flex flex-col" aria-label="地區">
      <div
        v-for="g in groups"
        :key="g.area"
        role="group"
        :aria-label="g.areaName"
        class="flex gap-1.5 border-t border-line-soft py-1 first:border-t-0 first:pt-0 last:pb-0"
      >
        <!-- 「九州・沖縄」在「・」後面換行 -->
        <span
          lang="ja"
          class="flex h-10 w-12 shrink-0 flex-col justify-center pl-0.5 text-caption leading-tight font-bold tracking-section text-sub pointer-coarse:h-tap"
          aria-hidden="true"
        >
          <span v-for="part in g.areaName.split(/(?<=・)/)" :key="part" class="whitespace-nowrap">{{ part }}</span>
        </span>
        <div class="grid min-w-0 flex-1 grid-cols-3 gap-1 sm:grid-cols-6 land:grid-cols-3">
          <RouterLink
            v-for="r in g.items"
            :key="r.prefecture"
            :to="`/map/${r.prefecture}`"
            class="relative flex h-10 min-w-0 items-center justify-center overflow-hidden rounded-control bg-surface px-1 pb-1 no-underline hover:bg-region-tint active:bg-region-tint active:not-disabled:translate-y-px pointer-coarse:h-tap"
            :class="hasData.has(r.prefecture) ? 'text-ink' : 'text-sub'"
          >
            <span lang="ja" class="truncate text-body-sm font-bold tracking-name">{{ r.name.ja }}</span>
            <span :data-pref="r.prefecture" class="absolute inset-x-0 bottom-0 h-1 bg-region" aria-hidden="true"></span>
          </RouterLink>
        </div>
      </div>
    </nav>
  </section>
</template>
