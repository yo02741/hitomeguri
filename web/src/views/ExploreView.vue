<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import FilterPanel from '../components/FilterPanel.vue'
import HomeSidebar from '../components/HomeSidebar.vue'
import MapView, { type MapView as MapViewState } from '../components/MapView.vue'
import RegionLists from '../components/RegionLists.vue'
import RegionTag from '../components/RegionTag.vue'
import SpotPanel from '../components/SpotPanel.vue'
import { regionOf } from '../data/regions'
import type { MapSpot, Spot } from '../services/bundles'
import { loadPrefectureShapes, prefectureAt } from '../services/geo'
import { prefetchThumbs } from '../services/prefetch'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'

const props = defineProps<{ pref?: string }>()
const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const explore = useExploreStore()

const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const selectedId = computed(() => (typeof route.query.spot === 'string' ? route.query.spot : null))
const selectedSpot = shallowRef<Spot | null>(null)
const loadingSpot = ref(false)
const bounds = shallowRef<[number, number, number, number] | null>(null)
// 由平移地圖觸發的縣切換不重新定位地圖
let panSwitch = false

const available = computed(() => Object.keys(catalog.index?.prefectures ?? {}))
const allSpots = computed<MapSpot[]>(() =>
  available.value.flatMap((p) => catalog.mapSpots[p] ?? []),
)
// 顯示規則：大點（可只看精選）＋開啟中主題的景點（UX-FLOW.md A3、A4）
const visibleSpots = computed(() =>
  allSpots.value.filter((s) => {
    if (s.id === selectedId.value) return true
    if (s.t?.some((t) => explore.themes.includes(t))) return true
    if (s.k !== 'major' || !explore.showMajor) return false
    return !explore.featuredOnly || s.f === 1
  }),
)

// 主題開關與 URL query 同步：分享連結與重新整理後保留（A4）
watch(
  () => route.query.themes,
  (q) => {
    const list = typeof q === 'string' && q ? q.split(',') : []
    if (list.join(',') !== explore.themes.join(',')) explore.themes = list
  },
  { immediate: true },
)
watch(
  () => explore.themes,
  (list) => {
    const q = { ...route.query }
    if (list.length) q.themes = list.join(',')
    else delete q.themes
    if ((route.query.themes ?? '') !== (q.themes ?? '')) router.replace({ query: q })
  },
)
const prefSpots = computed(() => (props.pref ? (catalog.mapSpots[props.pref] ?? []) : []))
const filterSpots = computed(() => (props.pref ? prefSpots.value : allSpots.value))

// 桌機：左上浮動面板蓋住地圖左側，地圖定位時扣掉這塊（寬 w-float＋左右間距）
const desktop = ref(false)
const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)') : null
function syncDesktop() {
  desktop.value = mq?.matches ?? false
}
syncDesktop()
mq?.addEventListener('change', syncDesktop)
onBeforeUnmount(() => mq?.removeEventListener('change', syncDesktop))
const FLOAT_INSET = 300 + 16 * 2
const insetLeft = computed(() => (desktop.value ? FLOAT_INSET : 0))

function spotBounds(spots: MapSpot[]): [number, number, number, number] | null {
  if (!spots.length) return null
  let w = 180, s = 90, e = -180, n = -90
  for (const p of spots) {
    w = Math.min(w, p.lng); e = Math.max(e, p.lng)
    s = Math.min(s, p.lat); n = Math.max(n, p.lat)
  }
  return [w, s, e, n]
}

// 照片預先下載：先全部縣的精選，再目前地區的其他大點（依分數）
function thumbsOf(spots: MapSpot[]): string[] {
  return spots
    .filter((s) => s.i && s.k === 'major')
    .sort((a, b) => b.f - a.f || b.s - a.s)
    .map((s) => s.i!)
}

onMounted(async () => {
  catalog.loadExtras()
  await catalog.loadAllMaps()
  if (props.pref && !panSwitch) bounds.value = spotBounds(prefSpots.value.filter((s) => s.f === 1))
  loadPrefectureShapes().catch(() => {})
  prefetchThumbs(thumbsOf(allSpots.value.filter((s) => s.f === 1)))
  if (props.pref) prefetchThumbs(thumbsOf(prefSpots.value), true)
})

watch(
  () => props.pref,
  async (pref) => {
    if (pref) prefetchThumbs(thumbsOf(await catalog.loadMap(pref)), true)
  },
)

// 地區：URL 的 :pref 決定整頁地區色；首頁用全國色（UX-FLOW.md §1.3）。
watch(
  () => props.pref,
  async (pref) => {
    explore.setActivePref(pref && regionOf(pref) ? pref : null)
    if (panSwitch) {
      panSwitch = false
      return
    }
    if (!pref) return
    const spots = await catalog.loadMap(pref)
    bounds.value = spotBounds(spots.filter((s) => s.f === 1)) ?? spotBounds(spots)
  },
  { immediate: true },
)

// 選取景點：卡片用景點自己所在縣的顏色，不改 activePref（UX-FLOW.md §5.3）。
watch(
  selectedId,
  async (id) => {
    if (!id) {
      selectedSpot.value = null
      return
    }
    loadingSpot.value = true
    selectedSpot.value = await catalog.getSpot(id)
    loadingSpot.value = false
  },
  { immediate: true },
)

async function select(id: string) {
  await router.replace({ query: { ...route.query, spot: id } })
  await nextTick()
  const s = allSpots.value.find((x) => x.id === id)
  if (s) mapRef.value?.flyTo(s.lng, s.lat)
}

function closeSpot() {
  const q = { ...route.query }
  delete q.spot
  router.replace({ query: q })
}

// 景點卡片：拉遠到這個縮放以下就關閉
const CLOSE_SPOT_ZOOM = 10
// 取樣格點（每邊）判斷畫面涵蓋哪些縣
const SAMPLE = 7

/**
 * 畫面對應的地區：中心所在的縣。畫面涵蓋太多縣、中心縣又只佔一小部分時不指定（回到全國）。
 * 回傳 undefined 表示判斷不出來（例如全是海），維持原狀。
 */
function regionForView(view: MapViewState): string | null | undefined {
  const [w, s, e, n] = view.bounds
  const counts = new Map<string, number>()
  let land = 0
  for (let i = 0; i < SAMPLE; i++) {
    for (let j = 0; j < SAMPLE; j++) {
      const p = prefectureAt(w + ((e - w) * (i + 0.5)) / SAMPLE, s + ((n - s) * (j + 0.5)) / SAMPLE)
      if (!p) continue
      land++
      counts.set(p, (counts.get(p) ?? 0) + 1)
    }
  }
  if (!land) return undefined
  let main = prefectureAt(view.center.lng, view.center.lat)
  if (!main) main = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  const share = (counts.get(main) ?? 0) / land
  if (counts.size <= 3 || share >= 0.4) return regionOf(main) ? main : null
  return null
}

// 使用者平移、縮放後：地區標籤、地區色、URL 跟著畫面更新（replace，不新增歷史）；拉遠時關閉景點卡片。
function onMoveEnd(view: MapViewState) {
  if (!view.user) return
  if (selectedId.value && view.zoom < CLOSE_SPOT_ZOOM) closeSpot()
  const target = regionForView(view)
  if (target === undefined || target === (props.pref ?? null)) return
  const query = { ...route.query }
  if (view.zoom < CLOSE_SPOT_ZOOM) delete query.spot
  panSwitch = true
  router.replace({ path: target ? `/map/${target}` : '/', query })
  if (target) catalog.loadMap(target)
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 max-lg:flex-col">
    <!-- 手機：頂部海報條（手機版面暫緩，見 PLAN.md §5 RWD） -->
    <RouterLink
      v-if="pref && regionOf(pref)"
      to="/"
      aria-label="切換地區"
      class="flex h-[56px] shrink-0 items-center gap-3 bg-region px-4 text-on-region no-underline lg:hidden"
    >
      <span lang="ja" class="text-h3 font-black tracking-name">{{ regionOf(pref)!.name.ja }}</span>
      <span class="font-latin text-body-sm font-semibold tracking-romaji uppercase">{{ regionOf(pref)!.name.romaji }}</span>
      <span class="ml-auto text-caption">{{ regionOf(pref)!.area_name }}</span>
    </RouterLink>

    <div class="relative min-h-0 flex-1">
      <MapView
        ref="mapRef"
        :spots="visibleSpots"
        :selected-id="selectedId"
        :bounds="bounds"
        :color-key="explore.activePref"
        :themes="explore.themes"
        :inset-left="insetLeft"
        @select="select"
        @moveend="onMoveEnd"
      />

      <!-- 左上浮動面板：地區標籤／地區清單、主題篩選、精選與地區特色 -->
      <div
        class="pointer-events-none absolute top-4 bottom-4 left-4 z-10 flex w-float flex-col gap-2.5 *:pointer-events-auto max-lg:right-4 max-lg:bottom-auto max-lg:w-auto"
      >
        <template v-if="pref && regionOf(pref)">
          <RegionTag :pref="pref" class="max-lg:hidden" />
          <FilterPanel :spots="filterSpots" />
          <RegionLists
            :pref="pref"
            :spots="prefSpots"
            :selected-id="selectedId"
            class="max-lg:hidden"
            @select="select"
          />
        </template>
        <template v-else>
          <HomeSidebar :prefs="available" class="max-lg:max-h-[40dvh]" />
          <FilterPanel v-if="desktop" :spots="filterSpots" />
        </template>
      </div>
    </div>

    <aside
      v-if="selectedId"
      class="shrink-0 border-line lg:w-panel lg:border-l max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:h-[60dvh] max-lg:overflow-hidden max-lg:rounded-t-sheet max-lg:shadow-sheet"
    >
      <SpotPanel :spot="selectedSpot" :loading="loadingSpot" @close="closeSpot" />
    </aside>
  </div>
</template>
