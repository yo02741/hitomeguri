<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AchvSeal from '../components/AchvSeal.vue'
import NewTag from '../components/NewTag.vue'
import PaperDoll from '../components/PaperDoll.vue'
import { OUTFITS } from '../data/outfits'
import { useAvatarStore } from '../stores/avatar'

import DatePicker from '../components/DatePicker.vue'
import DateRangePicker from '../components/DateRangePicker.vue'
import ExportButtons from '../components/ExportButtons.vue'
import MarkedSpotList from '../components/MarkedSpotList.vue'
import SectionNav from '../components/SectionNav.vue'
import SpotCard from '../components/SpotCard.vue'
import TripCard from '../components/TripCard.vue'
import { type MarkedSpot, useMarkedSpots } from '../composables/markedSpots'
import { useVisitedEntries } from '../composables/visited'
import { useCollection } from '../composables/collection'
import { type NavItem, useScrollSpy } from '../composables/scrollSpy'
import { regions } from '../data/regions'
import { markRow } from '../services/export'
import { whenIdle } from '../services/idle'
import type { MapSpot } from '../services/bundles'
import { TRIP_NAME_MAX } from '../services/trip'
import { todayIso } from '../services/userdb'
import { wide } from '../services/viewport'
import { useAchievementsStore } from '../stores/achievements'
import { useCatalogStore } from '../stores/catalog'
import { KEIKEN_MAX, useKeikenStore } from '../stores/keiken'
import { useMarksStore } from '../stores/marks'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 去過的小地圖在第一屏以外：捲到附近（前後 200px）或瀏覽器空下來才建立，地圖程式也到那時才載入，
// 不擋住紀錄頁第一次畫出來（手機版計畫第二階段 3）
const MapView = defineAsyncComponent(() => import('../components/MapView.vue'))
const mapBox = ref<HTMLElement | null>(null)
const mapOn = ref(false)
let mapIo: IntersectionObserver | null = null
watch(
  mapBox,
  (el) => {
    mapIo?.disconnect()
    mapIo = null
    if (!el || mapOn.value) return
    if (typeof IntersectionObserver === 'undefined') {
      mapOn.value = true
      return
    }
    mapIo = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        mapOn.value = true
        mapIo?.disconnect()
      },
      { rootMargin: '200px 0px' },
    )
    mapIo.observe(el)
    whenIdle(() => (mapOn.value = true))
  },
  { flush: 'post' },
)
onBeforeUnmount(() => mapIo?.disconnect())

// 旅行紀錄（UX-FLOW.md E1、E4、E5、E6）：上方「全部去過」地圖，接著已結束的旅行，最後是去過的景點（依日期新到舊，可批次補日期）。
// 「去過」＝已結束的行程裡的停留點 ∪ 標了去過的景點（UX-FLOW.md §3）。
const userStore = useUserStore()
const marks = useMarksStore()
const trips = useTripsStore()
const catalog = useCatalogStore()
const router = useRouter()
const route = useRoute()
const keiken = useKeikenStore()
// 成就入口（DESIGN.md §7.25）：最近達成的章疊在一起
const achv = useAchievementsStore()
const recentSeals = computed(() => achv.latest.slice(0, 6))
const keikenTotal = computed(() => regions.reduce((n, r) => n + keiken.levelOf(r.prefecture), 0))

const { doneTrips, entries: visitedEntries } = useVisitedEntries()
const { rows, loading } = useMarkedSpots(() => visitedEntries.value)

// 收集冊入口：最近去過的三張卡片疊成扇形（DESIGN.md §7.19）
const { cards, prefDone } = useCollection(() => visitedEntries.value)
const avatar = useAvatarStore()
const fan = computed(() =>
  [...cards.value]
    .sort((a, b) => (b.visitedOn ?? '').localeCompare(a.visitedOn ?? '') || b.score - a.score)
    .slice(0, 3)
    .reverse(),
)
const sorted = computed(() =>
  [...rows.value].sort((a, b) => (b.mark.visited_on ?? '').localeCompare(a.mark.visited_on ?? '')),
)

// 地圖只標去過（印章色小圓點），不畫收藏外圈
const visitedOnly = computed(() => Object.fromEntries(visitedEntries.value.map(([id]) => [id, { visited: true }])))
const spots = computed<MapSpot[]>(() =>
  rows.value.flatMap((r) => catalog.mapSpots[r.pref]?.find((s) => s.id === r.id) ?? []),
)
const bounds = computed<[number, number, number, number] | null>(() => {
  const s = spots.value
  if (!s.length) return null
  const lngs = s.map((x) => x.lng)
  const lats = s.map((x) => x.lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
})

// 補登以前的旅行（UX-FLOW.md E1）：日期在今天以前就直接是紀錄
const name = ref('')
const start = ref('')
const end = ref('')
const today = todayIso()
// 送出中不能再按（雙擊會補登兩趟）
const adding = ref(false)
async function addPast() {
  if (!start.value || adding.value) return
  adding.value = true
  try {
    const e = end.value && end.value >= start.value ? end.value : start.value
    const id = await trips.create({ name: name.value.trim(), start_date: start.value, end_date: e })
    if (id) await router.push(`/trips/${id}`)
  } finally {
    adding.value = false
  }
}

// 批次補日期（UX-FLOW.md E6）：從清單快捷標的去過沒有日期，這裡一次補
const picking = ref(false)
const selected = ref(new Set<string>())
const batchDate = ref('')
const applying = ref(false)
const undated = computed(() => rows.value.filter((r) => !r.mark.visited_on))
function startPicking() {
  picking.value = true
  selected.value = new Set(undated.value.map((r) => r.id))
}
// 從成就的「補日期」來（/log?fill=1）：打開批次補日期、捲到「去過」
watch(
  () => route.query.fill === '1' && marks.loaded && !loading.value,
  async (ok) => {
    if (!ok) return
    if (rows.value.length) startPicking()
    await nextTick()
    document.getElementById('visited-title')?.scrollIntoView({ block: 'start' })
    void router.replace({ query: {} })
  },
  { immediate: true },
)
// 「沒有日期的 n」「全選／全不選」：桌機在工具列裡，手機在「去過」標題列
const pickButtons = computed(() => [
  {
    key: 'undated',
    label: '沒有日期的',
    count: undated.value.length as number | null,
    disabled: !undated.value.length,
    run: () => (selected.value = new Set(undated.value.map((r) => r.id))),
  },
  {
    key: 'all',
    label: selected.value.size === rows.value.length ? '全不選' : '全選',
    count: null,
    disabled: false,
    run: () => (selected.value = selected.value.size === rows.value.length ? new Set() : new Set(rows.value.map((r) => r.id))),
  },
])
function toggleRow(r: MarkedSpot) {
  const next = new Set(selected.value)
  if (next.has(r.id)) next.delete(r.id)
  else next.add(r.id)
  selected.value = next
}
async function applyDate() {
  const spots = rows.value.filter((r) => selected.value.has(r.id)).map((r) => ({ id: r.id, pref: r.pref, name: r.name }))
  if (!spots.length || !batchDate.value) return
  applying.value = true
  await marks.setVisitedOnMany(spots, batchDate.value)
  applying.value = false
  selected.value = new Set()
}

// 手機的段落列（決定事項 K2）：旅行・去過
const root = ref<HTMLElement | null>(null)
const nav = computed<NavItem[]>(() => [
  { id: 'log-trips', label: '旅行' },
  { id: 'log-visited', label: '去過' },
])
const { active, go } = useScrollSpy(root, () => nav.value.map((it) => it.id))

function open(id: string) {
  const r = rows.value.find((x) => x.id === id)
  if (r) void router.push({ path: `/map/${r.pref}`, query: { spot: id } })
}
</script>

<template>
  <section ref="root" class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 pt-9 pb-24">
    <h1 class="text-h2 font-black tracking-title">紀錄</h1>

    <template v-if="userStore.user">
      <!-- 手機與平板（<1024，決定事項 K2）：收集冊一張 96 高，經縣值、旅人、成就三格排一列 -->
      <div class="grid grid-cols-3 gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-4">
      <RouterLink
        to="/log/cards"
        class="collect paper-grain group relative col-span-3 flex h-[132px] items-center gap-3 overflow-hidden rounded-card bg-region pr-5 text-on-region no-underline active:not-disabled:translate-y-px max-lg:h-24 lg:col-span-1"
      >
        <div class="relative h-full w-[172px] shrink-0 max-lg:w-[136px]" aria-hidden="true">
          <template v-if="fan.length">
            <div
              v-for="(e, i) in fan"
              :key="e.face.id"
              class="fan-card pointer-events-none absolute top-[20px] left-[48px] w-[76px] @container max-lg:top-[14px] max-lg:left-[38px] max-lg:w-[60px]"
              :style="{ '--k': i - (fan.length - 1) / 2 }"
            >
              <SpotCard :card="e.face" :rarity="e.rarity" :label="e.label" :number="e.number" size="fluid" />
            </div>
          </template>
          <template v-else>
            <div
              v-for="k in 3"
              :key="k"
              class="fan-card absolute top-[20px] left-[48px] aspect-[5/7] w-[76px] rounded-[8px] border-2 border-dashed border-on-region/40 max-lg:top-[14px] max-lg:left-[38px] max-lg:w-[60px]"
              :style="{ '--k': k - 2 }"
            ></div>
          </template>
        </div>
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="text-title font-black tracking-title">收集冊</span>
          <span class="flex flex-wrap gap-x-3 text-label">
            <span class="whitespace-nowrap"><span class="font-latin text-body-sm font-semibold">{{ cards.length }}</span> 張</span>
            <span class="whitespace-nowrap">都道府縣 <span class="font-latin"><span class="text-body-sm font-semibold">{{ prefDone.size }}</span> / 47</span></span>
          </span>
        </div>
        <svg class="ml-auto shrink-0 transition-transform group-hover:translate-x-1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
      <!-- 經縣值入口（DESIGN.md §7.21） -->
      <RouterLink
        to="/log/keiken"
        class="group flex h-[132px] flex-col justify-center gap-2 rounded-card border border-line bg-paper px-5 text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px max-lg:h-[104px] max-lg:justify-between max-lg:gap-1 max-lg:p-3"
      >
        <span class="flex items-center text-title font-black tracking-title max-lg:text-body">
          經縣值
          <svg class="ml-auto shrink-0 max-lg:hidden transition-transform group-hover:translate-x-1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </span>
        <span class="flex items-baseline gap-1 font-latin"><span class="text-h2 font-bold max-lg:text-title">{{ keikenTotal }}</span><span class="text-body-sm text-sub max-lg:text-caption">/ {{ KEIKEN_MAX }}</span></span>
        <span class="flex h-2 overflow-hidden max-lg:h-1.5 rounded-full bg-surface" aria-hidden="true">
          <span class="h-full bg-keiken-3" :style="{ width: `${(keikenTotal / KEIKEN_MAX) * 100}%` }"></span>
        </span>
      </RouterLink>
      <!-- 旅人入口（DESIGN.md §7.24） -->
      <RouterLink
        to="/log/avatar"
        class="group flex h-[132px] items-center gap-3 rounded-card border border-line bg-paper px-4 text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px max-lg:relative max-lg:h-[104px] max-lg:items-stretch max-lg:p-3"
      >
        <span class="paper-grain relative h-[108px] w-[92px] shrink-0 overflow-hidden rounded-control bg-region-tint max-lg:absolute max-lg:top-2 max-lg:right-2 max-lg:h-[50px] max-lg:w-[43px]" aria-hidden="true">
          <PaperDoll :parts="avatar.parts" :equipped="{ ...avatar.equipped, buddy: undefined }" crop="36 8 168 196" class="absolute inset-0 size-full" />
        </span>
        <span class="flex min-w-0 flex-col gap-0.5 max-lg:justify-between">
          <span class="text-title font-black tracking-title max-lg:text-body">旅人</span>
          <span class="text-label"><span class="max-lg:sr-only">服裝 </span><span class="whitespace-nowrap font-latin"><span class="text-body-sm font-semibold max-lg:text-title max-lg:font-bold">{{ avatar.ownedIds.size }}</span> <span class="max-lg:text-caption max-lg:text-sub">/ {{ OUTFITS.length }}</span></span></span>
        </span>
        <svg class="ml-auto shrink-0 max-lg:hidden transition-transform group-hover:translate-x-1" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
      <!-- 成就入口（DESIGN.md §7.25） -->
      <RouterLink
        to="/log/achievements"
        class="group relative flex h-[96px] items-center gap-4 rounded-card border border-line bg-paper px-5 text-ink no-underline hover:bg-surface lg:col-span-3 active:not-disabled:translate-y-px max-lg:h-[104px] max-lg:items-stretch max-lg:p-3"
      >
        <span class="flex shrink-0 flex-col max-lg:justify-between">
          <span class="text-title font-black tracking-title max-lg:text-body">成就</span>
          <span class="whitespace-nowrap font-latin"><span class="text-h3 font-bold max-lg:text-title">{{ achv.counts.n }}</span><span class="text-body-sm text-sub max-lg:text-caption"> / {{ achv.counts.N }}</span></span>
        </span>
        <span class="flex min-w-0 items-center pl-2 max-lg:absolute max-lg:top-2 max-lg:right-2 max-lg:pl-0" aria-hidden="true">
          <template v-if="recentSeals.length">
            <AchvSeal
              v-for="(s, i) in recentSeals"
              :key="s.def.id"
              :def="s.def"
              status="done"
              :size="wide ? 56 : 40"
              class="-ml-3 first:ml-0"
              :class="i >= 1 ? 'max-lg:hidden' : ''"
              :style="{ zIndex: recentSeals.length - i }"
            />
          </template>
          <template v-else>
            <span v-for="k in 3" :key="k" class="-ml-3 block size-14 rounded-full border-2 border-dashed border-line first:ml-0 max-lg:size-10 max-lg:[&:not(:first-child)]:hidden"></span>
          </template>
        </span>
        <NewTag v-if="achv.hasNew" class="absolute -top-1.5 -left-1.5" />
        <svg class="ml-auto shrink-0 transition-transform group-hover:translate-x-1 max-lg:hidden" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
      </div>

      <!-- 手機：收藏與清單的入口（桌機在頭像選單），下面是 sticky 的段落列 -->
      <RouterLink
        to="/me"
        class="-mt-3 flex min-h-tap items-center gap-2 rounded-card border border-line bg-paper px-4 text-body-sm text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px lg:hidden"
      >
        收藏<span class="font-latin font-semibold">{{ marks.favorites.length }}</span>
        <span class="text-sub" aria-hidden="true">・</span>
        清單<span class="font-latin font-semibold">{{ marks.lists.length }}</span>
        <svg class="ml-auto shrink-0 text-sub" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
      <div class="sticky top-0 z-10 -mx-6 -my-3 border-b border-line bg-paper px-4 py-2 lg:hidden">
        <SectionNav :items="nav" :active="active" variant="bar" @go="go" />
      </div>

      <div ref="mapBox" class="relative h-[360px] overflow-hidden rounded-card border border-line bg-placeholder max-md:h-[260px]">
        <MapView v-if="mapOn" :spots="spots" :bounds="bounds" :marked="visitedOnly" no-terrain @select="open" />
      </div>

      <section id="log-trips" class="flex flex-col gap-3 max-lg:scroll-mt-16" aria-labelledby="trips-title">
        <h2 id="trips-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-title">
          旅行<span class="font-latin text-body font-normal tracking-normal text-sub">{{ doneTrips.length }}</span>
        </h2>
        <ul v-if="doneTrips.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li v-for="t in doneTrips" :key="t.id"><TripCard :trip="t" /></li>
        </ul>
        <form class="flex flex-wrap items-end gap-3" @submit.prevent="addPast">
          <label class="flex min-w-[180px] flex-1 flex-col gap-1 text-caption text-sub">
            補登旅行
            <input
              v-model="name"
              type="text"
              :maxlength="TRIP_NAME_MAX"
              placeholder="名稱"
              class="h-10 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong pointer-coarse:h-tap"
            />
          </label>
          <div class="flex flex-col gap-1 text-caption text-sub">
            <span>日期</span>
            <DateRangePicker label="日期" :start="start" :end="end" :max="today" @change="(s, e) => ((start = s), (end = e))" />
          </div>
          <button
            type="submit"
            :disabled="!start || adding"
            :aria-busy="adding"
            class="h-10 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
          >
            新增
          </button>
        </form>
      </section>

      <section id="log-visited" class="flex flex-col gap-3 max-lg:scroll-mt-16" aria-labelledby="visited-title">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="visited-title" class="flex items-baseline max-lg:scroll-mt-16 gap-1.5 text-h3 font-black tracking-title">
            去過<span class="font-latin text-body font-normal tracking-normal text-sub">{{ rows.length }}</span>
          </h2>
          <div class="ml-auto flex flex-wrap gap-2">
            <button
              v-if="rows.length && !picking"
              type="button"
              class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
              @click="startPicking"
            >
              補日期
            </button>
            <!-- 手機補日期時：選取的快捷鈕放在標題列，底部工具列只留一行 -->
            <template v-if="picking && !wide">
              <button
                v-for="b in pickButtons"
                :key="b.key"
                type="button"
                class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
                :disabled="b.disabled"
                @click="b.run"
              >
                {{ b.label }}<span v-if="b.count != null" class="ml-1 font-latin">{{ b.count }}</span>
              </button>
            </template>
            <ExportButtons v-else title="ひとめぐり 去過" :rows="sorted.map(markRow)" />
          </div>
        </div>

        <!-- 批次補日期：勾選景點 → 選日期 → 套用。桌機是清單上方的 sticky 列；
             手機（<1024）貼在分頁列上方一行：已選 n・日期・套用・完成 -->
        <div
          v-if="picking"
          class="z-10 flex items-center gap-2 rounded-card bg-paper p-2 shadow-float"
          :class="wide ? 'sticky top-2 flex-wrap' : 'bottom-dock fixed right-[max(0.75rem,env(safe-area-inset-right))] left-[max(0.75rem,env(safe-area-inset-left))] z-30 mx-auto max-w-[560px] animate-pop-up'"
          :data-reduce="wide ? undefined : 'fade'"
          role="group"
          aria-label="補日期"
        >
          <template v-if="wide">
            <button
              v-for="b in pickButtons"
              :key="b.key"
              type="button"
              class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
              :disabled="b.disabled"
              @click="b.run"
            >
              {{ b.label }}<span v-if="b.count != null" class="ml-1 font-latin">{{ b.count }}</span>
            </button>
          </template>
          <span class="shrink-0 px-1 text-label whitespace-nowrap text-sub" aria-live="polite">已選 <span class="font-latin text-ink">{{ selected.size }}</span></span>
          <DatePicker
            v-model="batchDate"
            label="去過日期"
            size="sm"
            :max="today"
            :clearable="false"
            :class="wide ? 'ml-auto' : 'min-w-0 flex-1'"
          >
            <template v-if="!wide" #default="{ text }">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-sub" aria-hidden="true">
                <path d="M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4" />
              </svg>
              <span v-if="text" class="truncate font-latin text-ink">{{ batchDate.replaceAll('-', '/') }}</span>
              <span v-else class="truncate text-sub">日期</span>
            </template>
          </DatePicker>
          <button
            type="button"
            class="h-9 shrink-0 rounded-control bg-region-strong px-3.5 text-label font-bold text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 pointer-coarse:h-tap"
            :disabled="!selected.size || !batchDate || applying"
            @click="applyDate"
          >
            套用
          </button>
          <button type="button" class="h-9 shrink-0 rounded-control px-3 text-label text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="picking = false">
            完成
          </button>
        </div>

        <MarkedSpotList
          v-if="rows.length"
          :rows="sorted"
          :loading="loading"
          show-date
          :selected="picking ? selected : null"
          @toggle="toggleRow"
        />
        <p v-else-if="marks.loaded" class="flex flex-wrap items-center gap-x-3 text-body-sm text-sub">還沒有去過的地方<RouterLink to="/" class="inline-flex min-h-tap items-center font-bold text-region-strong active:not-disabled:translate-y-px">到地圖找地方</RouterLink></p>
        <p v-if="marks.error" class="text-caption text-danger" role="alert">{{ marks.error }}</p>
      </section>
    </template>
    <div v-else class="flex flex-col items-start gap-4">
      <p class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
      <button
        type="button"
        class="h-11 rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!userStore.ready || !userStore.canSignIn"
        @click="userStore.signIn()"
      >
        登入
      </button>
    </div>
  </section>
</template>

<style scoped>
/* 收集冊入口的扇形：滑過時展開 */
.fan-card {
  transform-origin: 50% 130%;
  transform: rotate(calc(var(--k) * 11deg)) translateX(calc(var(--k) * 10px));
  transition: transform 0.35s var(--ease-out-soft);
}
.collect:focus-visible .fan-card {
  transform: translateY(-6px) rotate(calc(var(--k) * 15deg)) translateX(calc(var(--k) * 16px));
}
/* 觸控點過後 :hover 會黏住，只給有滑鼠的裝置 */
@media (hover: hover) and (pointer: fine) {
  .collect:hover .fan-card {
    transform: translateY(-6px) rotate(calc(var(--k) * 15deg)) translateX(calc(var(--k) * 16px));
  }
}
</style>
