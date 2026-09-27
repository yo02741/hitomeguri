<script setup lang="ts">
import { computed } from 'vue'

import { THEMES } from '../data/themes'
import type { MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import RegionHero from './RegionHero.vue'
import ThemeBadge from './ThemeBadge.vue'

const props = defineProps<{ pref: string; spots: MapSpot[]; selectedId?: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const explore = useExploreStore()
const catalog = useCatalogStore()
const specialties = computed(() => catalog.specialties.filter((s) => s.prefecture === props.pref))
const CATEGORY_LABEL: Record<string, string> = { food: '料理', drink: '飲品', craft: '工藝', fruit: '水果' }

const majors = computed(() => props.spots.filter((s) => s.k === 'major'))
const featured = computed(() => majors.value.filter((s) => s.f === 1).sort((a, b) => b.s - a.s))
const themeCounts = computed(() => {
  const c: Record<string, number> = {}
  for (const s of props.spots) for (const t of s.t ?? []) c[t] = (c[t] ?? 0) + 1
  return c
})
// 有資料的主題才列出
const themeRows = computed(() => THEMES.filter((t) => themeCounts.value[t.key]))
</script>

<template>
  <div class="flex min-h-0 flex-col">
    <RegionHero :pref="pref" class="max-lg:hidden" />
    <div class="flex flex-col px-5 pt-2.5 pl-6">
      <span class="mt-1 mb-0.5 text-caption tracking-section text-sub">主題</span>
      <label class="flex h-10 items-center gap-3 border-b border-line-soft">
        <ThemeBadge theme="major" />
        <span class="text-body-sm" :class="explore.showMajor ? 'font-bold' : 'text-sub'">大點</span>
        <span class="ml-auto text-caption text-sub">{{ majors.length }}</span>
        <input v-model="explore.showMajor" type="checkbox" class="size-5 accent-[var(--region-strong)]" />
      </label>
      <label v-if="explore.showMajor" class="flex h-10 items-center gap-3 border-b border-line-soft pl-[38px]">
        <span class="text-body-sm">只看精選</span>
        <input v-model="explore.featuredOnly" type="checkbox" class="ml-auto size-5 accent-[var(--region-strong)]" />
      </label>
      <label
        v-for="t in themeRows"
        :key="t.key"
        class="flex h-10 items-center gap-3 border-b border-line-soft"
      >
        <ThemeBadge :theme="t.key" />
        <span class="text-body-sm" :class="explore.themes.includes(t.key) ? 'font-bold' : 'text-sub'">{{ t.label }}</span>
        <span class="ml-auto text-caption text-sub">{{ themeCounts[t.key] }}</span>
        <input
          type="checkbox"
          class="size-5 accent-[var(--region-strong)]"
          :checked="explore.themes.includes(t.key)"
          @change="explore.toggleTheme(t.key)"
        />
      </label>
    </div>
    <div class="flex min-h-0 flex-col overflow-y-auto px-5 pb-4 pl-6">
      <span class="mt-4 mb-1 text-caption tracking-section text-sub">精選</span>
      <button
        v-for="s in featured"
        :key="s.id"
        type="button"
        class="flex min-h-tap items-center gap-3 border-b border-line-soft py-2 text-left text-ink"
        :class="s.id === selectedId ? 'font-bold' : ''"
        :aria-current="s.id === selectedId ? 'true' : undefined"
        @click="emit('select', s.id)"
      >
        <span class="flex min-w-0 flex-col">
          <span v-if="s.h" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ s.h }}</span>
          <span lang="ja" class="truncate text-body-sm font-bold">{{ s.n }}</span>
        </span>
        <span v-if="s.c" class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
      </button>
      <p v-if="!featured.length" class="py-3 text-body-sm text-sub">資料準備中。</p>

      <template v-if="specialties.length">
        <span class="mt-5 mb-1 text-caption tracking-section text-sub">地區特色</span>
        <div
          v-for="sp in specialties"
          :key="sp.id"
          class="flex min-h-tap items-center gap-3 border-b border-line-soft py-2"
        >
          <span class="flex min-w-0 flex-col">
            <span v-if="sp.name.kana" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ sp.name.kana }}</span>
            <span lang="ja" class="truncate text-body-sm font-bold">{{ sp.name.ja }}</span>
            <span v-if="sp.name.zh_tw !== sp.name.ja" class="truncate text-caption text-sub">{{ sp.name.zh_tw }}</span>
          </span>
          <span class="ml-auto shrink-0 text-caption text-sub">{{ CATEGORY_LABEL[sp.category] ?? sp.category }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
