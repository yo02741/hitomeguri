<script setup lang="ts">
import { computed, ref } from 'vue'

import type { MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'

// 地區的精選與地區特色：浮動面板，平常收合，點標籤展開其中一個清單。
const props = defineProps<{ pref: string; spots: MapSpot[]; selectedId?: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()
const catalog = useCatalogStore()
const specialties = computed(() => catalog.specialties.filter((s) => s.prefecture === props.pref))
const CATEGORY_LABEL: Record<string, string> = { food: '料理', drink: '飲品', craft: '工藝', fruit: '水果' }

const featured = computed(() =>
  props.spots.filter((s) => s.k === 'major' && s.f === 1).sort((a, b) => b.s - a.s),
)
const open = ref<'featured' | 'specialties' | null>(null)
function toggle(tab: 'featured' | 'specialties') {
  open.value = open.value === tab ? null : tab
}

const tab = 'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control text-label'
</script>

<template>
  <section class="flex min-h-0 flex-col rounded-card bg-paper p-1.5 shadow-float">
    <div class="flex shrink-0 gap-1" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="open === 'featured'"
        :class="[tab, open === 'featured' ? 'bg-region-tint font-bold text-ink' : 'text-sub hover:text-ink']"
        @click="toggle('featured')"
      >
        精選<span class="font-latin">{{ featured.length }}</span>
      </button>
      <button
        v-if="specialties.length"
        type="button"
        role="tab"
        :aria-selected="open === 'specialties'"
        :class="[tab, open === 'specialties' ? 'bg-region-tint font-bold text-ink' : 'text-sub hover:text-ink']"
        @click="toggle('specialties')"
      >
        地區特色<span class="font-latin">{{ specialties.length }}</span>
      </button>
    </div>

    <div v-if="open === 'featured'" class="flex min-h-0 flex-col overflow-y-auto px-2.5 pb-1" role="tabpanel">
      <button
        v-for="s in featured"
        :key="s.id"
        type="button"
        class="flex min-h-tap shrink-0 items-center gap-3 border-b border-line-soft py-1.5 text-left text-ink last:border-b-0"
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
    </div>

    <div v-else-if="open === 'specialties'" class="flex min-h-0 flex-col overflow-y-auto px-2.5 pb-1" role="tabpanel">
      <div
        v-for="sp in specialties"
        :key="sp.id"
        class="flex min-h-tap shrink-0 items-center gap-3 border-b border-line-soft py-1.5 last:border-b-0"
      >
        <span class="flex min-w-0 flex-col">
          <span v-if="sp.name.kana" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ sp.name.kana }}</span>
          <span lang="ja" class="truncate text-body-sm font-bold">{{ sp.name.ja }}</span>
          <span v-if="sp.name.zh_tw !== sp.name.ja" class="truncate text-caption text-sub">{{ sp.name.zh_tw }}</span>
        </span>
        <span class="ml-auto shrink-0 text-caption text-sub">{{ CATEGORY_LABEL[sp.category] ?? sp.category }}</span>
      </div>
    </div>
  </section>
</template>
