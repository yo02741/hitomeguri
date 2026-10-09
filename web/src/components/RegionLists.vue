<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { CATEGORY_GROUPS, categoryGroup } from '../data/categories'
import { regionOf } from '../data/regions'
import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import { spotRef, useMarksStore } from '../stores/marks'
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
const marks = useMarksStore()
const prefName = computed(() => regionOf(props.pref)?.name.zh_tw ?? '')
function retry() {
  catalog.loadMap(props.pref).catch(() => {})
}

const majors = computed(() => [...props.spots].sort((a, b) => b.s - a.s))
// 依類型分段（CATEGORY_GROUPS 的順序），段內依分數
const sections = computed(() =>
  CATEGORY_GROUPS.map((g) => ({ ...g, rows: majors.value.filter((s) => categoryGroup(s.c) === g.key) })).filter(
    (g) => g.rows.length,
  ),
)
watch(sections, (list) => {
  if (explore.category && !list.some((g) => g.key === explore.category)) explore.category = null
})
// 篩選只切換各段的顯示（v-show），不重建清單：切回「不限」時幾百列不用重畫（手機版計畫第二階段 3）
const shown = (key: string) => !explore.category || explore.category === key

const isOpen = (key: string) => !explore.collapsed.includes(`cat:${key}`)

// 只看收藏（地圖上的「收藏」chip）：清單也只留這個縣的收藏，和類型一起篩。
// 一樣只切換顯示（v-show），關掉時清單不重建；捲動位置記下來，關掉時回到原本的位置。
const onlyFav = computed(() => explore.onlyFavorites)
const isFav = (id: string) => Boolean(marks.marks[id]?.favorite)
const rowShown = (id: string) => !onlyFav.value || isFav(id)
const favCount = (rows: MapSpot[]) => rows.filter((s) => isFav(s.id)).length
const sectionShown = (g: { key: string; rows: MapSpot[] }) => shown(g.key) && (!onlyFav.value || favCount(g.rows) > 0)
const favHere = computed(() => (onlyFav.value ? majors.value.filter((s) => isFav(s.id)) : []))
const favEmpty = computed(() => {
  if (!onlyFav.value) return ''
  if (!favHere.value.length) return `${prefName.value}還沒有收藏的地方。`
  if (explore.category && !favHere.value.some((s) => categoryGroup(s.c) === explore.category)) return '這一類沒有收藏的地方。'
  return ''
})
const scroller = ref<HTMLElement | null>(null)
let savedTop = 0
watch(onlyFav, async (on) => {
  if (on) {
    savedTop = scroller.value?.scrollTop ?? 0
    await nextTick()
    if (scroller.value) scroller.value.scrollTop = 0
  } else {
    await nextTick()
    if (scroller.value) scroller.value.scrollTop = savedTop
  }
})

// 手機的類型列是一行橫向捲動：換縣時回到最左邊
const catNav = ref<HTMLElement | null>(null)
watch(
  () => props.pref,
  () => {
    if (catNav.value) catNav.value.scrollLeft = 0
  },
)

// 照片讀不到就把那張藏起來（露出底色）；不用響應式狀態，離線時一次幾十張讀不到也不會整份清單重畫幾十次
function hidePhoto(e: Event) {
  ;(e.target as HTMLElement).hidden = true
}
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
    <!-- 手機不放「景點」標題列（海報條已經寫了縣名），清單多露出一列多（手機版計畫第二階段 6） -->
    <h2 class="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-control bg-region-tint text-body-sm font-bold text-ink max-lg:sr-only">
      景點
    </h2>

    <!-- 類型：文字索引列，選中的加底線；再點一次取消。手機排成一行、橫向捲動 -->
    <nav
      v-if="sections.length > 1"
      ref="catNav"
      class="flex shrink-0 flex-wrap gap-x-3.5 gap-y-1 border-b border-line-soft px-2.5 pt-2.5 pb-2 pointer-coarse:gap-x-0.5 pointer-coarse:gap-y-0 pointer-coarse:px-1 pointer-coarse:py-0 max-lg:scroll-quiet max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:overscroll-x-contain"
      aria-label="類型"
    >
      <button
        type="button"
        class="shrink-0 text-body-sm whitespace-nowrap pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="explore.category === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="explore.category === null"
        @click="explore.category = null"
      >
        <span class="block border-b-2 border-inherit pb-0.5">不限</span>
      </button>
      <button
        v-for="g in sections"
        :key="g.key"
        type="button"
        class="shrink-0 text-body-sm whitespace-nowrap pointer-coarse:px-1.5 pointer-coarse:py-2.5"
        :class="explore.category === g.key ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
        :aria-pressed="explore.category === g.key"
        @click="explore.category = explore.category === g.key ? null : g.key"
      >
        <span class="block border-b-2 border-inherit pb-0.5">{{ g.label }}</span>
      </button>
    </nav>

    <div
      ref="scroller"
      class="scroll-quiet flex min-h-0 flex-col overflow-y-auto overscroll-contain pr-1.5 pb-1 pl-1.5"
      @mouseleave="emit('highlight', null)"
    >
      <p v-if="favEmpty" class="px-1.5 py-3 text-body-sm text-sub">{{ favEmpty }}</p>
      <div v-for="g in sections" v-show="sectionShown(g)" :key="g.key" class="contents">
        <h3 class="sticky top-0 z-[1] shrink-0 bg-paper">
          <button
            type="button"
            class="flex w-full items-center gap-2 px-1.5 pt-2.5 pb-1 text-left text-caption font-bold tracking-section text-sub hover:text-ink active:text-ink pointer-coarse:min-h-tap"
            :aria-expanded="isOpen(g.key)"
            @click="explore.toggleCollapsed(`cat:${g.key}`)"
          >
            <CollapseChevron :open="isOpen(g.key)" />
            {{ g.label }}<span class="font-num font-normal tracking-normal">{{ onlyFav ? favCount(g.rows) : g.rows.length }}</span>
          </button>
        </h3>
        <div
          v-for="s in isOpen(g.key) ? g.rows : []"
          v-show="rowShown(s.id)"
          :key="s.id"
          class="flex min-h-tap shrink-0 items-center rounded-control [contain-intrinsic-size:auto_3.5rem] [content-visibility:auto]"
          :class="s.id === selectedId ? 'bg-region-tint neutral-preview:shadow-[inset_0_0_0_1.5px_var(--region-strong)]' : 'hover:bg-surface active:bg-surface'"
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
                v-if="s.i"
                data-photo
                :src="mapThumbUrl(s.i)"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                class="size-full object-cover"
                @error="hidePhoto"
              />
            </span>
            <span class="flex min-w-0 flex-col">
              <span v-if="s.h" lang="ja" class="truncate text-caption tracking-kana text-sub" :title="s.h">{{ s.h }}</span>
              <span lang="ja" class="line-clamp-2 text-body-sm font-bold break-words">{{ s.n }}</span>
            </span>
            <span v-if="s.c && g.tags.length > 1" class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
          </button>
          <VisitedToggle :spot="spotRef(s.id, pref, s.n)" />
        </div>
      </div>
      <p v-if="!sections.length" class="px-1.5 py-3 text-body-sm text-sub">資料準備中。</p>
    </div>

  </section>
</template>
