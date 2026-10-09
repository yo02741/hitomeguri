<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AIRPORT_AREA } from '../data/airports'
import { prefectureFullName, regionOf } from '../data/regions'
import { SPECIALTY_GROUPS, specialtyGroup } from '../data/specialties'
import type { Festival, Specialty } from '../services/bundles'
import { FESTIVAL_MONTHS, festivalAnchor, festivalGroups, revealFestival } from '../services/festivals'
import { narrow, wide } from '../services/viewport'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import CollapseChevron from '../components/CollapseChevron.vue'
import FestivalList from '../components/FestivalList.vue'
import RegionMotif from '../components/RegionMotif.vue'
import SeasonDrift from '../components/SeasonDrift.vue'
import SectionNav from '../components/SectionNav.vue'
import SeasonCalendar from '../components/SeasonCalendar.vue'
import WebSearchLink from '../components/WebSearchLink.vue'
import SummaryText from '../components/SummaryText.vue'
import TimedList from '../components/TimedList.vue'
import ChainSearch from '../components/ChainSearch.vue'
import { type NavItem, useScrollSpy } from '../composables/scrollSpy'
import { currentTimed } from '../services/timed'
import { todayIso } from '../services/userdb'

// 深度探索（UX-FLOW.md A8）：一個縣的季節、祭典、地區特色、期間限定。
// 地圖頁負責「去哪」，這一頁負責「這個地方有什麼、什麼時候去」。沒有資料的段落不顯示。
const props = defineProps<{ pref: string }>()
const catalog = useCatalogStore()
const explore = useExploreStore()
const region = computed(() => regionOf(props.pref))

watch(
  () => props.pref,
  (p) => {
    explore.setActivePref(regionOf(p) ? p : null)
    if (regionOf(p)) {
      void catalog.loadFestivals(p)
      void catalog.loadSpecialties([p])
    }
  },
  { immediate: true },
)
onMounted(() => {
  catalog.loadExtras()
  void catalog.loadTimed()
  void catalog.loadFlights()
})
// 台灣直飛航線（UX-FLOW.md A7）：手機的地圖頁沒有地區標籤，放在這一頁的海報（桌機在地圖頁的地區標籤）
const routes = computed(() =>
  catalog.flights.filter((f) => AIRPORT_AREA[f.dest] === region.value?.area).map((f) => `${f.origin} → ${f.dest}`),
)
const timed = computed(() => currentTimed(catalog.timed ?? [], todayIso(), props.pref))

// 有照片、有簡介的排前面（資料比較完整），其餘依名稱
function richness(s: Specialty): number {
  return (s.images?.length ? 2 : 0) + (s.summary || s.summary_zh ? 1 : 0)
}
const specialties = computed(() =>
  catalog.specialties
    .filter((s) => s.prefecture === props.pref)
    .sort((a, b) => richness(b) - richness(a) || a.name.ja.localeCompare(b.name.ja, 'ja')),
)
const groups = computed(() =>
  SPECIALTY_GROUPS.map((g) => ({ ...g, items: specialties.value.filter((s) => specialtyGroup(s.category) === g.key) })).filter(
    (g) => g.items.length,
  ),
)
// 每組先顯示幾項，其餘展開
const FIRST = 9
const expanded = ref(new Set<string>())
watch(
  () => props.pref,
  () => (expanded.value = new Set()),
)

const festivals = computed(() => catalog.festivals[props.pref] ?? [])
const festGroups = computed(() => festivalGroups(festivals.value))
const festMonthsWithData = computed(() => new Set(festGroups.value.map((g) => g.key)))

// 祭典的月份篩選與展開的月份：存在這一筆歷史的 state（history.state.fest），
// 去地圖（「在地圖上看」）再返回時照原樣還原（DESIGN.md §7.5c）
interface FestState {
  month: string | null
  expanded: string[]
}
function savedFest(): FestState | null {
  const f = (history.state as { fest?: unknown } | null)?.fest
  if (!f || typeof f !== 'object') return null
  const { month, expanded } = f as Partial<FestState>
  return {
    month: typeof month === 'string' ? month : null,
    expanded: Array.isArray(expanded) ? expanded.filter((k): k is string => typeof k === 'string') : [],
  }
}
const restored = savedFest()
const festMonth = ref<string | null>(restored?.month ?? null)
const festExpanded = ref(new Set<string>(restored?.expanded ?? []))
watch(
  () => props.pref,
  () => {
    const s = savedFest()
    festMonth.value = s?.month ?? null
    festExpanded.value = new Set(s?.expanded ?? [])
  },
)
watch([festMonth, festExpanded], ([month, expanded]) => {
  try {
    history.replaceState({ ...(history.state as object | null), fest: { month, expanded: [...expanded] } }, '')
  } catch {
    // 存不了就只是返回時不還原
  }
})

// 季節：這個縣的觀測站（有平年值的），代表站在前
const stations = computed(() => catalog.seasons?.stations.filter((s) => s.prefecture === props.pref) ?? [])

const sections = computed(() =>
  [
    { id: 'seasons', label: '季節', show: stations.value.length > 0 },
    { id: 'festivals', label: '祭典', show: festivals.value.length > 0 },
    { id: 'specialties', label: '地區特色', show: groups.value.length > 0 },
    { id: 'timed', label: '期間限定', show: true },
  ].filter((s) => s.show),
)

// 左側段落目錄（桌機）／頂部橫列（手機）：點了捲到該段，捲動時標出目前段落
const nav = computed<NavItem[]>(() =>
  sections.value.map((sec) => ({
    id: sec.id,
    label: sec.label,
    // 地區特色依組別（料理・小吃…）再分，捲到這段時目錄展開
    children:
      sec.id === 'specialties' && groups.value.length > 1
        ? groups.value.map((g) => ({ id: `specialties-${g.key}`, label: g.label }))
        : undefined,
  })),
)
const content = ref<HTMLElement | null>(null)
// 手機的段落列在祭典、地區特色時多一列（月份、組別），段落標題要落在兩列下面才算進入
const { active, go } = useScrollSpy(
  content,
  () => nav.value.flatMap((it) => [it.id, ...(it.children ?? []).map((c) => c.id)]),
  () => (wide.value ? 96 : 112),
)
const activeTop = computed(
  () => nav.value.find((it) => it.id === active.value || it.children?.some((c) => c.id === active.value))?.id ?? null,
)

// 網址帶 #段落（地圖頁「期間限定 全部」）或 #fest-{id}（從地圖返回）：資料到了再捲過去。
// 頁面自己捲動時改的 hash（段落目錄、「在地圖上看」）記在 ownHash，不重跳；別的 hash 變化重新跳一次
const route = useRoute()
const router = useRouter()
let jumped = false
let ownHash = ''
async function jump() {
  const id = route.hash.slice(1)
  if (jumped || !id) return
  if (id.startsWith('fest-')) {
    const fid = id.slice('fest-'.length)
    if (!festivals.value.some((f) => f.id === fid)) return
    // 卡片在別的月份篩選、或在收起的部分：先讓它出現
    const next = revealFestival(festGroups.value, fid, { month: festMonth.value, expanded: festExpanded.value })
    if (next) {
      festMonth.value = next.month
      festExpanded.value = next.expanded
    }
  } else if (!nav.value.some((it) => it.id === id)) return
  jumped = true
  await nextTick()
  ownHash = route.hash
  void go(id, false)
}
watch(() => [nav.value.map((it) => it.id).join(), festivals.value] as const, jump, { immediate: true })
watch(
  () => route.hash,
  (h) => {
    if (h && h === ownHash) return
    jumped = false
    void jump()
  },
)
function goSection(id: string) {
  ownHash = `#${id}`
  void go(id)
}

// 「在地圖上看」：先把這一筆歷史的 hash 換成這張卡，返回時捲回來（月份與展開狀態已經在 history.state）
async function toMap(f: Festival) {
  ownHash = `#${festivalAnchor(f.id)}`
  await router.replace({ hash: ownHash })
  await router.push({ path: `/map/${f.prefecture}`, query: { at: `${f.location!.lat},${f.location!.lng}`, label: f.name.ja } })
}

// 手機：海報捲走後段落列換成地區色條，左邊「‹ 縣名」回到縣地圖（決定事項 I2）
const page = ref<HTMLElement | null>(null)
const poster = ref<HTMLElement | null>(null)
const stuck = ref(false)
let io: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === 'undefined' || !poster.value) return
  io = new IntersectionObserver(([e]) => (stuck.value = !!e && !e.isIntersecting), { root: page.value })
  io.observe(poster.value)
})
onBeforeUnmount(() => io?.disconnect())

// 第二列：祭典時是月份（和段落裡的月份列同一個篩選），地區特色時是組別
const subRow = computed<'months' | 'groups' | null>(() => {
  if (!stuck.value) return null
  if (activeTop.value === 'festivals' && festGroups.value.length > 1) return 'months'
  if (activeTop.value === 'specialties' && groups.value.length > 1) return 'groups'
  return null
})
// 第二列出現、或選中的月份／組別換了：把它捲到看得到的地方
const subNav = ref<HTMLElement | null>(null)
watch(
  () => [subRow.value, festMonth.value, active.value] as const,
  async () => {
    await nextTick()
    const nav = subNav.value
    const el = nav?.querySelector<HTMLElement>('[aria-pressed="true"], [aria-current]')
    if (nav && el) nav.scrollTo({ left: el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2 })
  },
)
function pickMonth(m: string | null) {
  festMonth.value = festMonth.value === m ? null : m
  goSection('festivals')
}

const failed = ref(new Set<string>())
function image(s: Specialty) {
  const img = s.images?.[0]
  return img && !failed.value.has(img.url) ? img : undefined
}
function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('wikidata')) return 'Wikidata'
    if (host === 'ja.wikipedia.org') return '維基百科（日文）'
    if (host === 'zh.wikipedia.org') return '維基百科（中文）'
    if (host === 'maff.go.jp') return url.includes('/e/') ? '農林水產省（英文）' : '農林水產省'
    return host
  } catch {
    return url
  }
}
</script>

<template>
  <div v-if="region" ref="page" :data-pref="pref" class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-paper text-ink">
    <!-- 海報區：地區色、正圓裝飾，只用正圓（DESIGN.md §7.5） -->
    <header ref="poster" class="paper-grain relative shrink-0 overflow-hidden bg-region text-on-region [view-transition-name:region-hero]">
      <RegionMotif :pref="pref" class="absolute -top-24 -right-16 size-[320px] max-sm:-top-32 max-sm:-right-28 max-sm:size-[240px] [view-transition-name:region-motif]" />
      <SeasonDrift :pref="pref" />
      <div class="relative mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 pt-5 pb-8">
        <RouterLink
          :to="`/map/${pref}`"
          class="flex h-9 w-fit items-center gap-1 rounded-control pr-2.5 pl-1.5 text-body-sm font-bold text-on-region no-underline hover:bg-region-accent lg:hidden active:not-disabled:translate-y-px pointer-coarse:-my-1 pointer-coarse:h-tap"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          地圖
        </RouterLink>
        <div class="flex flex-wrap items-end gap-x-6 gap-y-1">
          <div class="flex flex-col">
            <span lang="ja" class="w-fit text-body tracking-kana [view-transition-name:region-kana]">{{ region.name.kana }}</span>
            <h1 lang="ja" class="w-fit text-display font-black tracking-name [view-transition-name:region-name]">{{ region.name.ja }}</h1>
          </div>
          <div class="flex flex-col pb-2">
            <span class="w-fit font-latin text-body font-bold tracking-[0.4em] uppercase [view-transition-name:region-romaji]">{{ region.name.romaji }}</span>
            <span lang="ja" class="text-body-sm font-bold">{{ region.area_name }}</span>
          </div>
        </div>
        <p v-if="routes.length" class="-mt-2 flex flex-wrap gap-x-4 font-latin text-caption font-semibold tracking-[1px] lg:hidden">
          <span v-for="r in routes" :key="r" class="whitespace-nowrap">{{ r }}</span>
        </p>
      </div>
    </header>

    <!-- 手機的段落列（DESIGN.md §7.5c）：海報捲走後換成地區色條，左邊「‹ 縣名」回縣地圖；
         祭典、地區特色時下面多一列月份／組別（疊在內容上，不推動版面） -->
    <div v-if="nav.length > 1" class="sticky top-0 z-10 lg:hidden">
      <div
        class="flex items-center gap-1 border-b px-4 py-2 transition-colors duration-300 ease-out-soft pointer-coarse:py-0"
        :class="stuck ? 'border-region bg-region text-on-region' : 'border-line bg-paper'"
      >
        <template v-if="stuck">
          <RouterLink
            :to="`/map/${pref}`"
            class="-ml-2 flex h-8 shrink-0 items-center gap-0.5 rounded-control pr-2 pl-1 text-body-sm font-bold text-on-region no-underline hover:bg-region-accent active:not-disabled:translate-y-px pointer-coarse:h-tap"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            <span lang="ja">{{ region.name.ja }}</span>
          </RouterLink>
          <span class="h-6 w-px shrink-0 bg-on-region opacity-25" aria-hidden="true"></span>
        </template>
        <SectionNav :items="nav" :active="active" variant="bar" :tone="stuck ? 'region' : 'paper'" class="min-w-0 flex-1" @go="goSection" />
      </div>
      <div v-if="subRow" class="absolute inset-x-0 top-full border-b border-region bg-region text-on-region">
        <span class="absolute inset-x-4 top-0 h-px bg-on-region opacity-25" aria-hidden="true"></span>
        <nav
          v-if="subRow === 'months'"
          ref="subNav"
          aria-label="月份"
          class="scroll-quiet relative flex gap-x-0.5 overflow-x-auto overscroll-x-contain px-2.5"
        >
          <button
            type="button"
            class="flex h-9 shrink-0 items-center px-1.5 text-body-sm pointer-coarse:h-tap"
            :class="festMonth === null ? 'border-on-region font-bold' : 'border-transparent'"
            :aria-pressed="festMonth === null"
            @click="pickMonth(null)"
          >
            <span class="block border-b-2 border-inherit pb-0.5">不限</span>
          </button>
          <button
            v-for="m in FESTIVAL_MONTHS"
            :key="m"
            type="button"
            class="flex h-9 shrink-0 items-center px-1.5 font-num text-body-sm disabled:opacity-40 pointer-coarse:h-tap"
            :class="festMonth === String(m) ? 'border-on-region font-bold' : 'border-transparent'"
            :disabled="!festMonthsWithData.has(String(m))"
            :aria-pressed="festMonth === String(m)"
            @click="pickMonth(String(m))"
          >
            <span class="block border-b-2 border-inherit pb-0.5">{{ m }}月</span>
          </button>
        </nav>
        <nav v-else ref="subNav" aria-label="地區特色的組別" class="scroll-quiet relative flex gap-x-0.5 overflow-x-auto overscroll-x-contain px-2.5">
          <a
            v-for="g in groups"
            :key="g.key"
            :href="`#specialties-${g.key}`"
            class="flex h-9 shrink-0 items-center px-1.5 text-body-sm text-on-region no-underline pointer-coarse:h-tap"
            :class="active === `specialties-${g.key}` ? 'border-on-region font-bold' : 'border-transparent'"
            :aria-current="active === `specialties-${g.key}` ? 'location' : undefined"
            @click.prevent="goSection(`specialties-${g.key}`)"
          >
            <span class="block border-b-2 border-inherit pb-0.5 whitespace-nowrap">{{ g.label }}</span>
          </a>
        </nav>
      </div>
    </div>

    <div ref="content" class="mx-auto grid w-full max-w-5xl gap-10 px-6 pt-8 pb-24 lg:grid-cols-[168px_minmax(0,1fr)]">
      <!-- 左欄：回地圖（和地圖頁的「深度探索」同一側）＋段落目錄 -->
      <aside class="max-lg:hidden">
        <div class="sticky top-8 flex flex-col gap-5">
          <RouterLink
            :to="`/map/${pref}`"
            class="flex h-10 items-center gap-2 rounded-control border border-line bg-paper pr-3 pl-2 text-body-sm font-bold text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            地圖
          </RouterLink>
          <SectionNav v-if="nav.length > 1" :items="nav" :active="active" variant="side" @go="goSection" />
        </div>
      </aside>

      <main class="flex min-w-0 flex-col gap-12">
        <section v-if="stations.length" id="seasons" class="flex scroll-mt-16 flex-col lg:scroll-mt-8 gap-4" aria-labelledby="seasons-title">
          <h2 id="seasons-title" class="text-h3 font-black tracking-title">季節</h2>
          <SeasonCalendar :stations="stations" :source-url="catalog.seasons!.source.url" />
        </section>

        <section v-if="festivals.length" id="festivals" class="flex scroll-mt-24 flex-col gap-4 lg:scroll-mt-8" aria-labelledby="festivals-title">
          <h2 id="festivals-title" class="text-h3 font-black tracking-title">祭典</h2>
          <FestivalList v-model:month="festMonth" v-model:expanded="festExpanded" :festivals="festivals" @map="toMap" />
        </section>

        <section v-if="groups.length" id="specialties" class="flex scroll-mt-24 flex-col gap-6 lg:scroll-mt-8" aria-labelledby="specialties-title">
          <h2 id="specialties-title" class="text-h3 font-black tracking-title">地區特色</h2>
          <!-- 畫面外的組先不畫（content-visibility），高度先用估計值，畫過一次就記住實際高度 -->
          <div
            v-for="g in groups"
            :id="`specialties-${g.key}`"
            :key="g.key"
            class="flex scroll-mt-24 flex-col gap-3 cv-auto [contain-intrinsic-size:auto_900px] lg:scroll-mt-8"
          >
            <h3 class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub">
              {{ g.label }}<span class="font-num font-normal tracking-normal">{{ g.items.length }}</span>
            </h3>
            <ul class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <!-- 手機（<640）橫排：左邊 96px 方圖，和祭典卡相同；sm 起照片在上 -->
              <li
                v-for="s in expanded.has(g.key) ? g.items : g.items.slice(0, FIRST)"
                :key="s.id"
                class="flex overflow-hidden rounded-card border border-line bg-paper max-sm:gap-3 max-sm:p-3 sm:flex-col"
              >
                <!-- 沒有照片就不留空白圖框 -->
                <div v-if="s.images?.length" class="shrink-0 bg-placeholder max-sm:size-24 max-sm:overflow-hidden max-sm:rounded-control sm:aspect-[16/10]">
                  <img
                    v-if="image(s)"
                    data-photo
                    :src="image(s)!.url"
                    :alt="s.name.ja"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    class="size-full object-cover"
                    @error="failed = new Set(failed).add(image(s)!.url)"
                  />
                </div>
                <div class="flex min-w-0 flex-1 flex-col gap-2 max-sm:gap-1.5 sm:px-4 sm:pt-3 sm:pb-4">
                  <div class="flex items-start gap-2">
                    <div class="flex min-w-0 flex-1 flex-col">
                      <span v-if="s.name.kana" lang="ja" class="text-caption tracking-kana text-sub max-sm:truncate">{{ s.name.kana }}</span>
                      <span class="flex flex-wrap items-baseline gap-x-2">
                        <span lang="ja" class="text-body font-bold">{{ s.name.ja }}</span>
                        <span v-if="s.name.zh_tw && s.name.zh_tw !== s.name.ja" class="text-body-sm text-sub">{{ s.name.zh_tw }}</span>
                        <!-- 沒有中文名時放英文名（Wikidata、農林水產省英文版） -->
                        <span v-else-if="s.name.en" lang="en" class="text-body-sm text-sub">{{ s.name.en }}</span>
                      </span>
                    </div>
                    <WebSearchLink :name="s.name.ja" :context="prefectureFullName(pref)" class="-mt-1 -mr-2" />
                  </div>
                  <SummaryText v-if="s.summary" :summary="s.summary" :clamp="narrow ? (s.summary.text_zh ? 2 : 3) : s.summary.text_zh ? 3 : 4" />
                  <p v-else-if="s.summary_zh" class="text-body-sm leading-[1.75] max-sm:line-clamp-3 sm:line-clamp-4">{{ s.summary_zh }}</p>
                  <div class="mt-auto flex flex-wrap gap-x-3 pt-1 text-caption text-sub pointer-coarse:-my-3.5 pointer-coarse:items-center">
                    <span v-if="s.summary">{{ s.summary.license }}</span>
                    <a v-for="src in s.sources" :key="src.url" :href="src.url" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-3.5">{{
                      sourceLabel(src.url)
                    }}</a>
                  </div>
                </div>
              </li>
            </ul>
            <button
              v-if="g.items.length > FIRST && !expanded.has(g.key)"
              type="button"
              class="flex h-10 w-fit items-center gap-2 rounded-control border border-line px-4 text-body-sm font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
              @click="expanded = new Set(expanded).add(g.key)"
            >
              <CollapseChevron :open="true" />
              全部 <span class="font-num">{{ g.items.length }}</span> 項
            </button>
          </div>
        </section>

        <p v-if="sections.length === 1" class="text-body-sm text-sub">資料準備中。</p>

        <!-- 期間限定：這個縣的季節觀測，另外可以直接搜尋連鎖店的限定、看自己存的截圖 -->
        <section id="timed" class="flex scroll-mt-16 flex-col lg:scroll-mt-8 gap-4" aria-labelledby="timed-title">
          <h2 id="timed-title" class="text-h3 font-black tracking-title">期間限定</h2>
          <TimedList v-if="timed.length" :items="timed" detailed />
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <ChainSearch />
            <RouterLink to="/limited" class="text-body-sm text-sub active:text-ink pointer-coarse:px-2 pointer-coarse:py-3">截圖</RouterLink>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
