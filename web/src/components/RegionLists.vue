<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { CATEGORY_GROUPS, categoryGroup } from '../data/categories'

import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'

// 地區的景點清單：精選／全部（同時決定地圖上顯示哪些大點）與地區特色。
// 清單與地圖連動：滑過一列在地圖上標出，點選則選取並飛過去。
const props = defineProps<{ pref: string; spots: MapSpot[]; selectedId?: string | null }>()
const emit = defineEmits<{ select: [id: string]; highlight: [id: string | null] }>()
const catalog = useCatalogStore()
const explore = useExploreStore()
const specialties = computed(() => catalog.specialties.filter((s) => s.prefecture === props.pref))
const CATEGORY_LABEL: Record<string, string> = { food: '料理', drink: '飲品', craft: '工藝', fruit: '水果' }

const majors = computed(() => props.spots.filter((s) => s.k === 'major').sort((a, b) => b.s - a.s))
const featured = computed(() => majors.value.filter((s) => s.f === 1))
const showSpecialties = ref(false)
const tab = computed(() => (showSpecialties.value ? 'specialties' : explore.featuredOnly ? 'featured' : 'all'))
const base = computed(() => (explore.featuredOnly ? featured.value : majors.value))
// 類型篩選：只列出目前分頁有景點的類型
const groupCounts = computed(() => {
  const c: Record<string, number> = {}
  for (const s of base.value) {
    const g = categoryGroup(s.c)
    c[g] = (c[g] ?? 0) + 1
  }
  return c
})
const groups = computed(() => CATEGORY_GROUPS.filter((g) => groupCounts.value[g.key]))
watch(groupCounts, (c) => {
  if (explore.category && !c[explore.category]) explore.category = null
})
const rows = computed(() =>
  explore.category ? base.value.filter((s) => categoryGroup(s.c) === explore.category) : base.value,
)

function pick(t: 'featured' | 'all' | 'specialties') {
  showSpecialties.value = t === 'specialties'
  if (t !== 'specialties') explore.featuredOnly = t === 'featured'
}

const failed = ref(new Set<string>())
const tabClass = 'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control text-label'
const chip = 'flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-caption'
const chipOn = 'border-region-strong bg-region-tint font-bold text-ink'
const chipOff = 'border-line text-sub hover:text-ink'
</script>

<template>
  <section v-if="!majors.length && !specialties.length" class="rounded-card bg-paper px-4 py-3 text-body-sm text-sub shadow-float">
    資料準備中。
  </section>
  <section v-else class="flex min-h-0 flex-col rounded-card bg-paper p-1.5 shadow-float">
    <div class="flex shrink-0 gap-1" role="tablist">
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'featured'"
        :class="[tabClass, tab === 'featured' ? 'bg-region-tint font-bold text-ink' : 'text-sub hover:text-ink']"
        @click="pick('featured')"
      >
        精選<span class="font-latin">{{ featured.length }}</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="tab === 'all'"
        :class="[tabClass, tab === 'all' ? 'bg-region-tint font-bold text-ink' : 'text-sub hover:text-ink']"
        @click="pick('all')"
      >
        全部<span class="font-latin">{{ majors.length }}</span>
      </button>
      <button
        v-if="specialties.length"
        type="button"
        role="tab"
        :aria-selected="tab === 'specialties'"
        :class="[tabClass, tab === 'specialties' ? 'bg-region-tint font-bold text-ink' : 'text-sub hover:text-ink']"
        @click="pick('specialties')"
      >
        地區特色<span class="font-latin">{{ specialties.length }}</span>
      </button>
    </div>

    <div v-if="tab !== 'specialties' && groups.length > 1" class="flex shrink-0 flex-wrap gap-1.5 px-1.5 pt-2 pb-1">
      <button
        type="button"
        :class="[chip, explore.category === null ? chipOn : chipOff]"
        :aria-pressed="explore.category === null"
        @click="explore.category = null"
      >
        不限<span class="font-latin font-normal">{{ base.length }}</span>
      </button>
      <button
        v-for="g in groups"
        :key="g.key"
        type="button"
        :class="[chip, explore.category === g.key ? chipOn : chipOff]"
        :aria-pressed="explore.category === g.key"
        @click="explore.category = explore.category === g.key ? null : g.key"
      >
        {{ g.label }}<span class="font-latin font-normal">{{ groupCounts[g.key] }}</span>
      </button>
    </div>

    <div
      v-if="tab !== 'specialties'"
      class="flex min-h-0 flex-col overflow-y-auto pt-1 pr-1 pb-1 pl-1.5 [scrollbar-gutter:stable] [scrollbar-width:thin]"
      role="tabpanel"
      @mouseleave="emit('highlight', null)"
    >
      <button
        v-for="s in rows"
        :key="s.id"
        type="button"
        class="mr-1.5 flex min-h-tap shrink-0 items-center gap-3 rounded-control px-1.5 py-1.5 text-left text-ink hover:bg-surface"
        :class="s.id === selectedId ? 'bg-region-tint' : ''"
        :aria-current="s.id === selectedId ? 'true' : undefined"
        @mouseenter="emit('highlight', s.id)"
        @focus="emit('highlight', s.id)"
        @click="emit('select', s.id)"
      >
        <span class="size-11 shrink-0 overflow-hidden rounded-control bg-placeholder">
          <img
            v-if="s.i && !failed.has(s.i)"
            :src="mapThumbUrl(s.i)"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            class="size-full object-cover"
            @error="failed = new Set(failed).add(s.i)"
          />
        </span>
        <span class="flex min-w-0 flex-col">
          <span v-if="s.h" lang="ja" class="truncate text-caption tracking-kana text-sub">{{ s.h }}</span>
          <span lang="ja" class="truncate text-body-sm font-bold">{{ s.n }}</span>
        </span>
        <span v-if="s.c" class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
      </button>
      <p v-if="!rows.length" class="px-1.5 py-3 text-body-sm text-sub">資料準備中。</p>
    </div>

    <div v-else class="flex min-h-0 flex-col overflow-y-auto pr-1 pb-1 pl-2.5 [scrollbar-gutter:stable] [scrollbar-width:thin]" role="tabpanel">
      <div
        v-for="sp in specialties"
        :key="sp.id"
        class="mr-1.5 flex min-h-tap shrink-0 items-center gap-3 border-b border-line-soft py-1.5 last:border-b-0"
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
