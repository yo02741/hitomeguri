<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AchvDetail from '../components/AchvDetail.vue'
import AchvRules from '../components/AchvRules.vue'
import AchvSeal from '../components/AchvSeal.vue'
import NewTag from '../components/NewTag.vue'
import PrefStamp from '../components/PrefStamp.vue'
import RollingNumber from '../components/RollingNumber.vue'
import SectionNav from '../components/SectionNav.vue'
import { type NavItem, useScrollSpy } from '../composables/scrollSpy'
import { ACHIEVEMENTS, GROUPS, type AchvGroup, hasProgress } from '../data/achievements'
import { AREA_ZH, regions, type Region } from '../data/regions'
import { type AchvState, dotDate, type PrefStampState } from '../services/achievements'
import { useAchievementsStore } from '../stores/achievements'
import { useCatalogStore } from '../stores/catalog'
import { useFreshStore } from '../stores/fresh'
import { useMarksStore } from '../stores/marks'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 成就（DESIGN.md §7.25）：一本紀念章帳。第一頁「初訪」是 47 格縣的紀念章，後面 7 組是成就的章。
// 達成的用印泥蓋上、寫旅行時的那天；還沒達成的是預印的虛線框，下面寫進度。
const userStore = useUserStore()
const marks = useMarksStore()
const trips = useTripsStore()
const catalog = useCatalogStore()
const fresh = useFreshStore()
const achv = useAchievementsStore()

onMounted(() => void achv.loadData())

const loading = computed(() => !marks.loaded || !trips.loaded)
const stampsDone = computed(() => achv.stamps.filter((s) => s.done).length)
const tripCount = computed(() => achv.derived.trips.length)
const sinceYear = computed(() => achv.derived.dates[0]?.slice(0, 4) ?? null)
const hero = computed(() => achv.latest[0] ?? null)
const progress = computed(() => (achv.counts.N ? achv.counts.n / achv.counts.N : 0))

/** 沒有日期、讓達成日算不出來的地方 */
const undatedSpots = computed(() => [...achv.derived.first.values()].filter((b) => b.lo === null).length)
const hasUndatedSeal = computed(
  () => achv.states.some((s) => s.status === 'done' && s.at === null && s.undated > 0) || achv.stamps.some((s) => s.done && s.at === null),
)

// ---- 段落 ----
const ORDER = new Map(ACHIEVEMENTS.map((a, i) => [a.id, i]))
interface Section {
  key: AchvGroup
  id: string
  label: string
  items: AchvState[]
  done: number
  dataState: 'ok' | 'loading' | 'failed'
}
const sections = computed<Section[]>(() =>
  GROUPS.flatMap((g) => {
    const items = achv.visible
      .filter((s) => s.def.group === g.key)
      .sort((a, b) => Number(b.status === 'done') - Number(a.status === 'done') || ORDER.get(a.def.id)! - ORDER.get(b.def.id)!)
    if (!items.length) return []
    const data = items.some((s) => s.def.dep === 'data')
    const dataState = !data || catalog.achv ? 'ok' : catalog.achvState === 'failed' ? 'failed' : 'loading'
    return [{ key: g.key, id: `achv-${g.key}`, label: g.label, items, done: items.filter((s) => s.status === 'done').length, dataState }]
  }),
)
const areaGroups = computed(() => {
  const out: Array<{ area: string; items: Array<{ region: Region; stamp: PrefStampState }> }> = []
  for (const r of regions) {
    let g = out.find((x) => x.area === r.area)
    if (!g) out.push((g = { area: r.area, items: [] }))
    g.items.push({ region: r, stamp: achv.stampByPref.get(r.prefecture)! })
  }
  return out
})
const nav = computed<NavItem[]>(() => [{ id: 'achv-pref', label: '初訪' }, ...sections.value.map((s) => ({ id: s.id, label: s.label }))])
const root = ref<HTMLElement | null>(null)
const { active, go, refresh } = useScrollSpy(root, () => nav.value.map((it) => it.id))
// 資料到了、段落變多之後重新判斷目前的段落（載入中頁面很短，會先標到最後一段）
watch([loading, () => nav.value.length], () => void nextTick(refresh))

// ---- aria-label ----
function sealLabel(s: AchvState): string {
  if (s.status === 'unknown') return `${s.def.name}，載入中`
  if (s.status === 'done') return s.at ? `${s.def.name}，${dotDate(s.at)}` : s.def.name
  return hasProgress(s.def) ? `${s.def.name}，還沒達成，${Math.min(s.have, s.need)} / ${s.need}` : `${s.def.name}，還沒達成`
}
function stampLabel(r: Region, s: PrefStampState): string {
  if (!s.done) return `${r.name.ja}，還沒去過`
  return s.at ? `${r.name.ja} 初訪 ${dotDate(s.at)}` : `${r.name.ja} 初訪`
}

// ---- 蓋章：這次進頁面時有 NEW 的蓋一次；這台裝置第一次打開時，達成的依序蓋上 ----
const press = ref(new Map<string, number>())
let pressed = false
watch(
  () => achv.ready.core && !loading.value,
  async (ok) => {
    if (!ok || pressed) return
    pressed = true
    // 等 store 這一輪的比對（NEW、看過的）跑完
    await nextTick()
    const order = [
      ...achv.stamps.filter((s) => s.done).map((s) => `pref-${s.pref}`),
      ...sections.value.flatMap((sec) => sec.items.filter((s) => s.status === 'done').map((s) => s.def.id)),
    ]
    const next = new Map<string, number>()
    if (achv.firstOpen) {
      order.slice(0, 40).forEach((id, i) => next.set(id, i * 30))
      achv.markOpened()
    } else {
      order.filter((id) => achv.isNew(id)).forEach((id, i) => next.set(id, i * 120))
    }
    press.value = next
  },
  { immediate: true },
)
const pressStyle = (id: string) => {
  const d = press.value.get(id)
  return d === undefined ? undefined : { animationDelay: `${d}ms` }
}

// ---- 詳細、規則 ----
const openId = ref<string | null>(null)
const openState = computed(() => (openId.value && !openId.value.startsWith('pref-') ? (achv.byId.get(openId.value) ?? null) : null))
const openStamp = computed(() => (openId.value?.startsWith('pref-') ? (achv.stampByPref.get(openId.value.slice(5)) ?? null) : null))
let trigger: HTMLElement | null = null
function openDetail(id: string, e: Event) {
  trigger = e.currentTarget as HTMLElement
  openId.value = id
}
function closeDetail() {
  openId.value = null
  void nextTick(() => trigger?.focus())
}
const showRules = ref(false)
const rulesBtn = ref<HTMLButtonElement | null>(null)
function closeRules() {
  showRules.value = false
  void nextTick(() => rulesBtn.value?.focus())
}

// 離開成就頁：NEW 全部算看過（和收集卡、服裝「看過就拿掉」一致）
onBeforeUnmount(() => fresh.seen([...fresh.keys].filter((k) => k.startsWith('a:'))))
</script>

<template>
  <section ref="root" class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 py-9 max-sm:px-4">
    <header class="paper-grain relative overflow-hidden rounded-card bg-region p-6 text-on-region max-sm:p-5">
      <div class="relative grid grid-cols-[minmax(0,1fr)_160px] items-center gap-6 max-md:grid-cols-1">
        <div class="flex min-w-0 flex-col gap-4">
          <RouterLink to="/log" class="flex w-fit items-center gap-1 text-label font-bold text-on-region no-underline hover:underline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
            紀錄
          </RouterLink>
          <h1 class="flex items-baseline gap-3 text-h1 font-black tracking-[4px]">
            成就<RollingNumber :value="achv.counts.n" class="font-latin text-h3 font-semibold tracking-normal" /><span class="-ml-1.5 font-latin text-body-sm tracking-normal">/ {{ achv.counts.N }}</span>
          </h1>
          <div class="h-3.5 max-w-[420px] overflow-hidden rounded-[2px] bg-paper/55" aria-hidden="true">
            <div class="h-full rounded-[2px] bg-on-region transition-[width] duration-500 ease-out-soft" :style="{ width: `${progress * 100}%` }"></div>
          </div>
          <p class="flex flex-wrap gap-x-4 text-label font-bold">
            <span>初訪 <span class="font-latin text-body-sm">{{ stampsDone }} / 47</span></span>
            <span v-if="tripCount">旅行 <span class="font-latin text-body-sm">{{ tripCount }}</span> 趟</span>
            <span v-if="sinceYear"><span class="font-latin text-body-sm">{{ sinceYear }}</span> 年起</span>
          </p>
          <button ref="rulesBtn" type="button" class="-ml-2 h-8 w-fit rounded-control px-2 text-label font-bold hover:bg-paper/20" aria-haspopup="dialog" @click="showRules = true">規則</button>
        </div>
        <div class="max-md:hidden" aria-hidden="true">
          <AchvSeal v-if="hero" :def="hero.def" status="done" :at="hero.at" class="w-[140px] justify-self-center" />
          <span v-else class="mx-auto block size-[140px] rounded-full border-2 border-dashed border-on-region/50"></span>
        </div>
      </div>
    </header>

    <template v-if="userStore.user">
      <div class="sticky top-0 z-10 -mx-6 -my-3 border-b border-line bg-paper px-4 py-2 md:hidden max-sm:-mx-4">
        <SectionNav :items="nav" :active="active" variant="bar" @go="go" />
      </div>

      <p v-if="hasUndatedSeal && undatedSpots" class="-mt-3 text-label text-sub">
        沒有日期的地方 <span class="font-latin">{{ undatedSpots }}</span> 處
        <RouterLink to="/log?fill=1" class="ml-2 font-bold text-ink underline-offset-2 hover:underline">補日期</RouterLink>
      </p>

      <!-- 初訪：47 格 -->
      <section id="achv-pref" class="flex scroll-mt-14 flex-col gap-3" aria-labelledby="achv-pref-title">
        <h2 id="achv-pref-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
          初訪<span class="font-latin text-body font-normal tracking-normal text-sub">{{ stampsDone }} / 47</span>
        </h2>
        <div class="dot-sheet paper-grain flex flex-col gap-4 rounded-card border border-line bg-paper p-4 sm:p-5">
          <div v-for="g in areaGroups" :key="g.area" class="flex flex-col gap-2">
            <h3 class="text-caption font-bold tracking-section text-sub">{{ AREA_ZH[g.area] }}</h3>
            <ul class="grid grid-cols-5 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(84px,1fr))]">
              <li v-for="{ region: r, stamp: s } in g.items" :key="r.prefecture">
                <div v-if="loading" class="skeleton aspect-square w-full rounded-full"></div>
                <button
                  v-else
                  type="button"
                  class="relative block w-full rounded-full p-0.5 hover:bg-surface"
                  aria-haspopup="dialog"
                  :aria-label="stampLabel(r, s)"
                  @click="openDetail(`pref-${r.prefecture}`, $event)"
                >
                  <div
                    v-if="s.done"
                    :data-pref="r.prefecture"
                    :class="press.has(`pref-${r.prefecture}`) ? 'stamp-ring animate-stamp-press rounded-full' : ''"
                    :style="pressStyle(`pref-${r.prefecture}`)"
                  >
                    <PrefStamp :pref="r.prefecture" :date="s.at" aria-hidden="true" />
                  </div>
                  <span v-else class="grid aspect-square w-full place-items-center rounded-full border-2 border-dashed border-line text-body-sm text-sub" lang="ja">{{ r.name.ja }}</span>
                  <NewTag v-if="s.done && achv.isNew(`pref-${r.prefecture}`)" class="absolute -top-1 -left-1" />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 成就：7 組 -->
      <section
        v-for="sec in sections"
        :id="sec.id"
        :key="sec.key"
        class="flex scroll-mt-14 flex-col gap-3"
        :aria-labelledby="`${sec.id}-title`"
      >
        <h2 :id="`${sec.id}-title`" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
          {{ sec.label }}<span v-if="sec.dataState === 'ok' && !loading" class="font-latin text-body font-normal tracking-normal text-sub">{{ sec.done }} / {{ sec.items.length }}</span>
        </h2>
        <div class="dot-sheet paper-grain rounded-card border border-line bg-paper p-4 sm:p-5">
          <p v-if="sec.dataState === 'failed'" class="flex flex-wrap items-center gap-3 text-body-sm text-sub">
            沒有載入
            <button type="button" class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface" @click="achv.loadData()">重新載入</button>
          </p>
          <ul v-else class="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 lg:grid-cols-6">
            <li v-for="s in sec.items" :key="s.def.id">
              <div v-if="loading" class="flex flex-col items-center gap-1 p-1.5">
                <span class="skeleton block aspect-square w-full max-w-[92px] rounded-full"></span>
              </div>
              <button
                v-else
                type="button"
                class="group relative flex min-h-11 w-full flex-col items-center gap-1 rounded-control p-1.5 text-center hover:bg-surface"
                aria-haspopup="dialog"
                :aria-label="sealLabel(s)"
                @click="openDetail(s.def.id, $event)"
              >
                <span
                  class="block aspect-square w-full max-w-[92px]"
                  :class="press.has(s.def.id) ? 'stamp-ring animate-stamp-press rounded-full' : ''"
                  :style="pressStyle(s.def.id)"
                >
                  <AchvSeal :def="s.def" :status="s.status" :at="s.at" class="w-full" />
                </span>
                <span class="line-clamp-2 text-label leading-tight font-bold" :class="s.status === 'done' ? '' : 'text-ink-2'">{{ s.def.name }}</span>
                <span v-if="s.status === 'done' && s.at" class="font-latin text-caption text-sub">{{ dotDate(s.at) }}</span>
                <span v-else-if="s.status === 'locked' && s.note" class="text-caption leading-tight text-sub">{{ s.note }}</span>
                <span v-else-if="s.status === 'locked' && hasProgress(s.def)" class="font-latin text-caption text-sub">{{ Math.min(s.have, s.need) }} / {{ s.need }}</span>
                <NewTag v-if="s.status === 'done' && achv.isNew(s.def.id)" class="absolute -top-1 -left-1" />
              </button>
            </li>
          </ul>
        </div>
      </section>
    </template>
    <p v-else class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>

    <AchvDetail v-if="openState || openStamp" :key="openId ?? ''" :state="openState" :stamp="openStamp" @close="closeDetail" />
    <AchvRules v-if="showRules" @close="closeRules" />
  </section>
</template>

<style scoped>
/* 台紙：紙紋上一層點點方格（和旅人的衣櫃同一條規則）；點點畫在 ::before，不蓋掉 paper-grain */
.dot-sheet {
  position: relative;
  isolation: isolate;
}
.dot-sheet::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background-image: radial-gradient(color-mix(in oklab, var(--color-line) 70%, transparent) 1px, transparent 1.2px);
  background-size: 18px 18px;
  pointer-events: none;
}
</style>
