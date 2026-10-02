<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { CATEGORY_GROUPS, categoryGroup } from '../data/categories'
import { regionOf } from '../data/regions'
import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import CollapseChevron from './CollapseChevron.vue'
import SkeletonRows from './SkeletonRows.vue'
import VisitedToggle from './VisitedToggle.vue'

// 地區的景點清單（全部大點）。地區特色在深度探索頁（views/RegionView.vue）。
// 類型列可篩選（清單與地圖一起）；不篩選時清單依類型分段排列。
// 清單與地圖連動：滑過一列在地圖上標出，點選則選取並飛過去。每列右側是「去過」快捷鈕。
// 讀取中放佔位；讀不到（旅途中網路不穩）寫出來並可以重試；讀好了真的沒有景點才寫「資料準備中」。
const props = withDefaults(
  defineProps<{ pref: string; spots: MapSpot[]; selectedId?: string | null; state?: 'loading' | 'failed' | 'ready' }>(),
  { selectedId: null, state: 'ready' },
)
const emit = defineEmits<{ select: [id: string]; highlight: [id: string | null] }>()
const explore = useExploreStore()
const catalog = useCatalogStore()
const prefName = computed(() => regionOf(props.pref)?.name.zh_tw ?? '')
function retry() {
  catalog.loadMap(props.pref).catch(() => {})
}

const majors = computed(() => props.spots.filter((s) => s.k === 'major').sort((a, b) => b.s - a.s))
// 依類型分段（CATEGORY_GROUPS 的順序），段內依分數
const sections = computed(() =>
  CATEGORY_GROUPS.map((g) => ({ ...g, rows: majors.value.filter((s) => categoryGroup(s.c) === g.key) })).filter(
    (g) => g.rows.length,
  ),
)
watch(sections, (list) => {
  if (explore.category && !list.some((g) => g.key === explore.category)) explore.category = null
})
const shown = computed(() =>
  explore.category ? sections.value.filter((g) => g.key === explore.category) : sections.value,
)

const isOpen = (key: string) => !explore.collapsed.includes(`cat:${key}`)

const failed = ref(new Set<string>())
</script>

<template>
  <section v-if="!majors.length && state === 'loading'" class="rounded-card bg-paper p-1.5 shadow-float">
    <SkeletonRows :rows="6" thumb />
  </section>
  <section
    v-else-if="!majors.length && state === 'failed'"
    class="flex flex-wrap items-center gap-x-3 rounded-card bg-paper px-4 py-1.5 text-body-sm text-sub shadow-float"
  >
    讀不到{{ prefName }}的景點。
    <button type="button" class="h-tap px-3 text-body-sm font-bold text-region-strong active:not-disabled:translate-y-px" @click="retry">重試</button>
  </section>
  <section v-else-if="!majors.length" class="rounded-card bg-paper px-4 py-3 text-body-sm text-sub shadow-float">
    資料準備中。
  </section>
  <section v-else class="flex min-h-0 flex-col rounded-card bg-paper p-1.5 shadow-float">
    <h2 class="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-control bg-region-tint text-label font-bold text-ink">
      景點
    </h2>

    <!-- 類型：文字索引列，選中的加底線；再點一次取消 -->
    <nav
      v-if="sections.length > 1"
      class="flex shrink-0 flex-wrap gap-x-3.5 gap-y-1 border-b border-line-soft px-2.5 pt-2.5 pb-2"
      aria-label="類型"
    >
      <button
        type="button"
        class="border-b-2 pb-0.5 text-label"
        :class="explore.category === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
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
        :class="explore.category === g.key ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="explore.category === g.key"
        @click="explore.category = explore.category === g.key ? null : g.key"
      >
        {{ g.label }}
      </button>
    </nav>

    <div
      class="scroll-quiet flex min-h-0 flex-col overflow-y-auto pr-1.5 pb-1 pl-1.5"
      @mouseleave="emit('highlight', null)"
    >
      <template v-for="g in shown" :key="g.key">
        <h3 class="sticky top-0 z-[1] shrink-0 bg-paper">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-1.5 pt-2.5 pb-1 text-left text-caption font-bold tracking-section text-sub hover:text-ink active:text-ink"
            :aria-expanded="isOpen(g.key)"
            @click="explore.toggleCollapsed(`cat:${g.key}`)"
          >
            <CollapseChevron :open="isOpen(g.key)" />
            {{ g.label }}<span class="font-latin font-normal tracking-normal">{{ g.rows.length }}</span>
          </button>
        </h3>
        <div
          v-for="s in isOpen(g.key) ? g.rows : []"
          :key="s.id"
          class="flex min-h-tap shrink-0 items-center rounded-control"
          :class="s.id === selectedId ? 'bg-region-tint' : 'hover:bg-surface active:bg-surface'"
          @mouseenter="emit('highlight', s.id)"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-start gap-3 px-1.5 py-1.5 text-left text-ink"
            :aria-current="s.id === selectedId ? 'true' : undefined"
            @focus="emit('highlight', s.id)"
            @click="emit('select', s.id)"
          >
            <span class="size-11 shrink-0 overflow-hidden rounded-control bg-placeholder">
              <img
                v-if="s.i && !failed.has(s.i)"
                data-photo
                :src="mapThumbUrl(s.i)"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                class="size-full object-cover"
                @error="failed = new Set(failed).add(s.i)"
              />
            </span>
            <span class="flex min-w-0 flex-col">
              <span v-if="s.h" lang="ja" class="truncate text-caption tracking-kana text-sub" :title="s.h">{{ s.h }}</span>
              <span lang="ja" class="line-clamp-2 text-body-sm font-bold break-words">{{ s.n }}</span>
            </span>
            <span v-if="s.c && g.tags.length > 1" class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
          </button>
          <VisitedToggle :spot="{ id: s.id, pref, name: s.n }" />
        </div>
      </template>
      <p v-if="!shown.length" class="px-1.5 py-3 text-body-sm text-sub">資料準備中。</p>
    </div>

  </section>
</template>
