<script setup lang="ts">
import { computed } from 'vue'

import { THEMES } from '../data/themes'
import type { MapSpot } from '../services/bundles'
import { useExploreStore } from '../stores/explore'
import ThemeBadge from './ThemeBadge.vue'

// 地圖上的主題篩選（UX-FLOW.md A3、A4）：件數依目前地區，沒有地區時算全部。
const props = defineProps<{ spots: MapSpot[] }>()
const explore = useExploreStore()

const majorCount = computed(() => props.spots.filter((s) => s.k === 'major').length)
const themeCounts = computed(() => {
  const c: Record<string, number> = {}
  for (const s of props.spots) for (const t of s.t ?? []) c[t] = (c[t] ?? 0) + 1
  return c
})
const themeRows = computed(() => THEMES.filter((t) => themeCounts.value[t.key]))

const chip = 'flex h-8 items-center gap-1.5 rounded-full border pr-2.5 pl-1 text-label'
const on = 'border-region-strong bg-region-tint font-bold text-ink'
const off = 'border-line bg-paper text-sub hover:text-ink'
</script>

<template>
  <section class="flex shrink-0 flex-col gap-2 rounded-card bg-paper p-3 shadow-float" aria-label="主題">
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        :class="[chip, explore.showMajor ? on : off]"
        :aria-pressed="explore.showMajor"
        @click="explore.showMajor = !explore.showMajor"
      >
        <ThemeBadge theme="major" :size="22" />大點<span class="font-latin font-normal text-sub">{{ majorCount }}</span>
      </button>
      <button
        v-for="t in themeRows"
        :key="t.key"
        type="button"
        :class="[chip, explore.themes.includes(t.key) ? on : off]"
        :aria-pressed="explore.themes.includes(t.key)"
        @click="explore.toggleTheme(t.key)"
      >
        <ThemeBadge :theme="t.key" :size="22" />{{ t.label }}<span class="font-latin font-normal text-sub">{{ themeCounts[t.key] }}</span>
      </button>
    </div>
    <label v-if="explore.showMajor" class="flex items-center gap-2 px-1 text-label text-sub">
      <input v-model="explore.featuredOnly" type="checkbox" class="size-4 accent-[var(--region-strong)]" />
      大點只看精選
    </label>
  </section>
</template>
