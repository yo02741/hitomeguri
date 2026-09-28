<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { CATEGORY_GROUPS, categoryGroup } from '../data/categories'
import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'

// 地區的景點清單：精選／全部（同時決定地圖上顯示哪些大點）與地區特色。
// 類型列可篩選（清單與地圖一起）；不篩選時清單依類型分段排列。
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

function pick(t: 'featured' | 'all' | 'specialties') {
  showSpecialties.value = t === 'specialties'
  if (t !== 'specialties') explore.featuredOnly = t === 'featured'
}

const base = computed(() => (explore.featuredOnly ? featured.value : majors.value))
// 依類型分段（CATEGORY_GROUPS 的順序），段內依分數
const sections = computed(() =>
  CATEGORY_GROUPS.map((g) => ({ ...g, rows: base.value.filter((s) => categoryGroup(s.c) === g.key) })).filter(
    (g) => g.rows.length,
  ),
)
watch(sections, (list) => {
  if (explore.category && !list.some((g) => g.key === explore.category)) explore.category = null
})
const shown = computed(() =>
  explore.category ? sections.value.filter((g) => g.key === explore.category) : sections.value,
)

const failed = ref(new Set<string>())
const tabClass = 'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-control text-label'
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

    <!-- 類型：文字索引列，選中的加底線；再點一次取消 -->
    <nav
      v-if="tab !== 'specialties' && sections.length > 1"
      class="flex shrink-0 flex-wrap gap-x-3.5 gap-y-1 border-b border-line-soft px-2.5 pt-2.5 pb-2"
      aria-label="類型"
    >
      <button
        type="button"
        class="border-b-2 pb-0.5 text-label"
        :class="explore.category === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink'"
        :aria-pressed="explore.category === null"
        @click="explore.category = null"
      >
        不限
      </button>
      <button
        v-for="g in sections"
        :key="g.key"
        type="button"
        class="border-b-2 pb-0.5 text-label"
        :class="explore.category === g.key ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink'"
        :aria-pressed="explore.category === g.key"
        @click="explore.category = explore.category === g.key ? null : g.key"
      >
        {{ g.label }}
      </button>
    </nav>

    <div
      v-if="tab !== 'specialties'"
      class="scroll-quiet flex min-h-0 flex-col overflow-y-auto pr-3 pb-1 pl-1.5"
      role="tabpanel"
      @mouseleave="emit('highlight', null)"
    >
      <template v-for="g in shown" :key="g.key">
        <h3
          class="sticky top-0 z-[1] flex shrink-0 items-baseline gap-1.5 bg-paper px-1.5 pt-2.5 pb-1 text-caption font-bold tracking-section text-sub"
        >
          {{ g.label }}<span class="font-latin font-normal tracking-normal">{{ g.rows.length }}</span>
        </h3>
        <button
          v-for="s in g.rows"
          :key="s.id"
          type="button"
          class="flex min-h-tap shrink-0 items-center gap-3 rounded-control px-1.5 py-1.5 text-left text-ink hover:bg-surface"
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
          <span v-if="s.c && g.tags.length > 1" class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
        </button>
      </template>
      <p v-if="!shown.length" class="px-1.5 py-3 text-body-sm text-sub">資料準備中。</p>
    </div>

    <div v-else class="scroll-quiet flex min-h-0 flex-col overflow-y-auto pr-3 pb-1 pl-2.5" role="tabpanel">
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
