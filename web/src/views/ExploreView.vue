<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import HomeSidebar from '../components/HomeSidebar.vue'
import MapView from '../components/MapView.vue'
import RegionSidebar from '../components/RegionSidebar.vue'
import SpotPanel from '../components/SpotPanel.vue'
import { regionOf } from '../data/regions'
import type { MapSpot, Spot } from '../services/bundles'
import { loadPrefectureShapes, prefectureAt } from '../services/geo'
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

function spotBounds(spots: MapSpot[]): [number, number, number, number] | null {
  if (!spots.length) return null
  let w = 180, s = 90, e = -180, n = -90
  for (const p of spots) {
    w = Math.min(w, p.lng); e = Math.max(e, p.lng)
    s = Math.min(s, p.lat); n = Math.max(n, p.lat)
  }
  return [w, s, e, n]
}

onMounted(async () => {
  catalog.loadExtras()
  await catalog.loadAllMaps()
  if (props.pref && !panSwitch) bounds.value = spotBounds(prefSpots.value.filter((s) => s.f === 1))
  loadPrefectureShapes().catch(() => {})
})

// 地區：URL 的 :pref 決定整頁地區色；首頁用全國色（UX-FLOW.md §1.3）。
watch(
  () => props.pref,
  async (pref) => {
    explore.setActivePref(pref && regionOf(pref) ? pref : null)
    if (!pref) return
    if (panSwitch) {
      panSwitch = false
      return
    }
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

function select(id: string) {
  router.replace({ query: { ...route.query, spot: id } })
  const s = allSpots.value.find((x) => x.id === id)
  if (s) mapRef.value?.flyTo(s.lng, s.lat)
}

function closeSpot() {
  const q = { ...route.query }
  delete q.spot
  router.replace({ query: q })
}

// 平移跨縣界：地圖中心所在的縣改變時，海報區、地區色、URL 一起更新（replace，不新增歷史）。
function onMoveEnd(center: { lng: number; lat: number }, zoom: number) {
  if (!props.pref || zoom < 8) return
  const p = prefectureAt(center.lng, center.lat)
  if (p && p !== props.pref && regionOf(p)) {
    panSwitch = true
    router.replace({ path: `/map/${p}`, query: route.query })
    catalog.loadMap(p)
  }
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 max-lg:flex-col">
    <!-- 手機：頂部海報條 -->
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

    <aside
      class="flex min-h-0 shrink-0 flex-col overflow-y-auto border-line lg:w-sidebar lg:border-r max-lg:order-last max-lg:max-h-[38dvh] max-lg:border-t"
    >
      <RegionSidebar
        v-if="pref && regionOf(pref)"
        :pref="pref"
        :spots="prefSpots"
        :selected-id="selectedId"
        @select="select"
      />
      <HomeSidebar v-else :prefs="available" />
    </aside>

    <div class="relative min-h-0 flex-1">
      <MapView
        ref="mapRef"
        :spots="visibleSpots"
        :selected-id="selectedId"
        :bounds="bounds"
        :color-key="explore.activePref"
        :themes="explore.themes"
        @select="select"
        @moveend="onMoveEnd"
      />
    </div>

    <aside
      v-if="selectedId"
      class="shrink-0 border-line lg:w-panel lg:border-l max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:h-[60dvh] max-lg:overflow-hidden max-lg:rounded-t-sheet max-lg:shadow-sheet"
    >
      <SpotPanel :spot="selectedSpot" :loading="loadingSpot" @close="closeSpot" />
    </aside>
  </div>
</template>
