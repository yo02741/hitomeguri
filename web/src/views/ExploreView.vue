<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import HomeSidebar from '../components/HomeSidebar.vue'
import MapView, { type MapView as MapViewState } from '../components/MapView.vue'
import PackBar from '../components/PackBar.vue'
import PackList from '../components/PackList.vue'
import PackPanel from '../components/PackPanel.vue'
import RegionLists from '../components/RegionLists.vue'
import RegionTag from '../components/RegionTag.vue'
import SpotPanel, { type NearbyPack } from '../components/SpotPanel.vue'
import { categoryGroup } from '../data/categories'
import { PACKS, packByKey, packOfId } from '../data/packs'
import { JAPAN_BOUNDS } from '../map/style'
import { regionOf } from '../data/regions'
import type { MapSpot, PackItem, Spot } from '../services/bundles'
import {
  distanceM,
  loadPrefectureShapes,
  prefectureAt,
  prefectureBounds,
  prefectureMainBounds,
  prefectureShape,
} from '../services/geo'
import type { SearchHit } from '../services/search'
import { trackSplash } from '../services/splash'
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
// 從搜尋選了別縣的景點：進入該縣後飛到這個景點，不做整縣定位
let flyAfterLoad: string | null = null

const available = computed(() => Object.keys(catalog.index?.prefectures ?? {}))
// 已載入完整地圖 bundle 的縣用全部大點，其餘縣先用全國總覽（各縣分數前段，bundles/featured.json）
const allSpots = computed<MapSpot[]>(() =>
  available.value.flatMap((p) => catalog.mapSpots[p] ?? catalog.featured[p] ?? []),
)
// 顯示規則：全部大點（可依類型篩選；開啟擴充包時不篩選，變淡當底圖）
const visibleSpots = computed(() =>
  allSpots.value.filter((s) => {
    if (s.id === selectedId.value) return true
    if (s.k !== 'major') return false
    return explore.pack || !explore.category || categoryGroup(s.c) === explore.category
  }),
)

// 擴充包開關與 URL query 同步：分享連結與重新整理後保留（UX-FLOW.md A4）
watch(
  () => route.query.pack,
  (q) => {
    const key = typeof q === 'string' && packByKey.has(q) ? q : null
    if (key !== explore.pack) explore.pack = key
  },
  { immediate: true },
)
watch(
  () => explore.pack,
  (key) => {
    const q = { ...route.query }
    if (key) q.pack = key
    else delete q.pack
    if ((route.query.pack ?? '') !== (q.pack ?? '')) router.replace({ query: q })
    if (key) catalog.loadPack(key)
  },
)
// 設定中啟用的擴充包先載入：擴充包列要顯示件數、景點卡片要列出附近的點
watch(
  () => explore.enabledPacks,
  (keys) => keys.forEach((k) => catalog.loadPack(k)),
  { immediate: true },
)

const packMap = computed(() => {
  const def = explore.pack ? packByKey.get(explore.pack) : undefined
  if (!def) return null
  const items = catalog.packs[def.key] ?? []
  return { color: def.color, points: items.filter((it) => !explore.packGroup || it.g === explore.packGroup) }
})

/** 選取中的擴充包點 */
const selectedPack = computed<{ pack: string; item: PackItem } | null>(() => {
  const id = selectedId.value
  const pack = id ? packOfId(id) : undefined
  const item = pack ? catalog.packs[pack]?.find((it) => it.id === id) : undefined
  return pack && item ? { pack, item } : null
})

// 景點附近（2 km 內）的擴充包點，每個擴充包最多 6 個
const NEARBY_M = 2000
const NEARBY_MAX = 6
const nearby = computed<NearbyPack[]>(() => {
  const s = selectedSpot.value
  if (!s) return []
  const { lat, lng } = s.location
  return PACKS.filter((p) => explore.enabledPacks.includes(p.key)).flatMap((p) => {
    const labels = new Map(p.groups.map((g) => [g.key, g.label]))
    const items = (catalog.packs[p.key] ?? [])
      .map((it) => ({ it, d: distanceM(lat, lng, it.lat, it.lng) }))
      .filter((x) => x.d <= NEARBY_M)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEARBY_MAX)
      .map(({ it, d }) => ({ id: it.id, n: it.n, group: labels.get(it.g) ?? '', d: Math.round(d / 10) * 10 }))
    return items.length ? [{ pack: p.key, label: p.label, color: p.color, items }] : []
  })
})
const prefSpots = computed(() => (props.pref ? (catalog.mapSpots[props.pref] ?? []) : []))

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

function median(xs: number[]): number {
  const a = [...xs].sort((x, y) => x - y)
  return a[Math.floor(a.length / 2)]!
}

// 定位用範圍：離主要群聚太遠的點（例：東京的小笠原諸島）不算進去，否則畫面會拉得很遠
function spotBounds(all: MapSpot[]): [number, number, number, number] | null {
  if (!all.length) return null
  const cx = median(all.map((p) => p.lng))
  const cy = median(all.map((p) => p.lat))
  const d = all.map((p) => Math.hypot(p.lng - cx, p.lat - cy))
  const limit = Math.max(median(d) * 3, 0.3)
  const spots = all.filter((_, i) => d[i]! <= limit)
  let w = 180, s = 90, e = -180, n = -90
  for (const p of spots) {
    w = Math.min(w, p.lng); e = Math.max(e, p.lng)
    s = Math.min(s, p.lat); n = Math.max(n, p.lat)
  }
  return [w, s, e, n]
}

// 縣界載入後才畫得出目前地區的外框
const shapesReady = ref(false)
const outline = computed(() => (shapesReady.value && props.pref ? prefectureShape(props.pref) : null))

function union(
  a: [number, number, number, number] | null,
  b: [number, number, number, number] | null,
): [number, number, number, number] | null {
  if (!a || !b) return a ?? b
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

// 地點標記（深度探索的祭典「地圖」）：?at=緯度,經度&label=名稱
const pin = computed(() => {
  const at = typeof route.query.at === 'string' ? route.query.at.split(',').map(Number) : []
  const [lat, lng] = at
  if (at.length !== 2 || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat: lat!, lng: lng!, label: typeof route.query.label === 'string' ? route.query.label : '' }
})
function closePin() {
  const q = { ...route.query }
  delete q.at
  delete q.label
  router.replace({ query: q })
}

// 地區頁的定位由下方 props.pref 的 watcher 負責；這裡只載入共用資料
onMounted(() => {
  catalog.loadExtras()
  trackSplash(catalog.loadFeatured(), 'featured')
  loadPrefectureShapes()
    .then(() => (shapesReady.value = true))
    .catch(() => {})
})

// 地區：URL 的 :pref 決定整頁地區色；首頁用全國色（UX-FLOW.md §1.3）。
watch(
  () => props.pref,
  async (pref) => {
    explore.setActivePref(pref && regionOf(pref) ? pref : null)
    if (panSwitch) {
      panSwitch = false
      return
    }
    // 首頁（含點左上地區標籤回來）：拉回整個日本版圖
    if (!pref) {
      bounds.value = [...JAPAN_BOUNDS]
      return
    }
    const spots = await trackSplash(catalog.loadMap(pref), 'map-bundle')
    const target = flyAfterLoad ? spots.find((s) => s.id === flyAfterLoad) : undefined
    flyAfterLoad = null
    if (target) {
      await nextTick()
      mapRef.value?.flyTo(target.lng, target.lat, 15)
      return
    }
    if (pin.value) {
      await nextTick()
      mapRef.value?.flyTo(pin.value.lng, pin.value.lat, 14)
      return
    }
    // 看得到整個縣的形狀（主要陸地的縣界）＋主要景點；還沒有資料的縣用縣界範圍定位
    await loadPrefectureShapes().catch(() => {})
    const main = spotBounds(spots.filter((s) => s.f === 1)) ?? spotBounds(spots)
    bounds.value = union(main, prefectureMainBounds(pref)) ?? prefectureBounds(pref)
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
    // 擴充包的點：確認資料載入後由 selectedPack 顯示
    const pack = packOfId(id)
    if (pack) {
      selectedSpot.value = null
      const items = await catalog.loadPack(pack)
      if (!items.some((it) => it.id === id) && selectedId.value === id) closeSpot()
      return
    }
    loadingSpot.value = true
    selectedSpot.value = await catalog.getSpot(id)
    loadingSpot.value = false
    // 找不到的景點（舊連結、已排除）：關閉卡片
    if (!selectedSpot.value && selectedId.value === id) closeSpot()
  },
  { immediate: true },
)

async function select(id: string) {
  const pack = packOfId(id)
  // 從景點卡片的「附近」點進擴充包的點：一併開啟那個擴充包
  if (pack && explore.pack !== pack) explore.pack = pack
  // 選了景點就收起地點標記
  const { at: _at, label: _label, ...rest } = route.query
  await router.replace({ query: { ...rest, spot: id, ...(pack ? { pack } : {}) } })
  await nextTick()
  const s = pack ? catalog.packs[pack]?.find((x) => x.id === id) : allSpots.value.find((x) => x.id === id)
  // 縮放 15：群集全部散開（clusterMaxZoom 14），看得出選到的是哪一個點
  if (s) mapRef.value?.flyTo(s.lng, s.lat, 15)
}

/** header 搜尋的結果：縣 → 進入地區頁；景點 → 選取並飛過去（別縣先進入該縣） */
watch(
  () => explore.searchPick,
  (hit) => {
    if (!hit) return
    explore.searchPick = null
    onSearch(hit)
  },
  { immediate: true },
)

function onSearch(hit: SearchHit) {
  if (hit.kind === 'pref') {
    router.push(`/map/${hit.pref}`)
    return
  }
  explore.pack = null
  explore.category = null
  if (hit.pref === props.pref) {
    void select(hit.id)
    return
  }
  flyAfterLoad = hit.id
  router.push({ path: `/map/${hit.pref}`, query: { spot: hit.id } })
}

function closeSpot() {
  const q = { ...route.query }
  delete q.spot
  router.replace({ query: q })
}

// 景點卡片：拉遠到這個縮放以下就關閉
const CLOSE_SPOT_ZOOM = 10
// 首頁：縮放到這裡以上才依畫面中心指定地區
const MIN_REGION_ZOOM = 7
// 已選定地區：拉遠看位置時保留，縮放到這裡以下（接近整個日本）才回到全國
const RESET_ZOOM = 5
// 取樣格點（每邊）判斷畫面涵蓋哪些縣
const SAMPLE = 7

function intersects(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3]
}

/**
 * 畫面對應的地區：中心所在的縣。畫面涵蓋太多縣、中心縣又只佔一小部分時不指定（回到全國）。
 * 已選定地區時有遲滯：只要這個縣還在畫面裡就保留（拉遠看它在日本哪裡），
 * 平移到鄰縣且鄰縣佔了畫面主要部分才切換。
 * 回傳 undefined 表示判斷不出來（例如全是海），維持原狀。
 */
function regionForView(view: MapViewState): string | null | undefined {
  const current = props.pref && regionOf(props.pref) ? props.pref : null
  if (current) {
    if (view.zoom < RESET_ZOOM) return null
    const b = prefectureBounds(current)
    // 縣已經移出畫面：和首頁一樣依畫面中心判斷
    if (b && !intersects(b, view.bounds)) return view.zoom < MIN_REGION_ZOOM ? null : (regionForCenter(view) ?? null)
    if (view.zoom < MIN_REGION_ZOOM) return current
    const next = regionForCenter(view)
    return next === undefined || next === null ? current : next
  }
  // 首頁：拉遠到看得到整個日本以上不指定地區（取樣點可能全落在海上，要先判斷）
  if (view.zoom < MIN_REGION_ZOOM) return null
  return regionForCenter(view)
}

function regionForCenter(view: MapViewState): string | null | undefined {
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
        :inset-left="insetLeft"
        :pack="packMap"
        :outline="outline"
        :pin="pin"
        @select="select"
        @close-pin="closePin"
        @moveend="onMoveEnd"
      />

      <!-- 地圖上方：深度探索入口（地區頁）＋擴充包列（桌機；手機版面暫緩） -->
      <div
        class="pointer-events-none absolute top-4 right-4 z-10 flex items-start gap-2 *:pointer-events-auto max-lg:hidden"
        :style="{ left: `${insetLeft}px` }"
      >
        <RouterLink
          v-if="pref && regionOf(pref)"
          :to="`/region/${pref}`"
          :aria-label="`深度探索 ${regionOf(pref)!.name.ja}`"
          class="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-region-strong pr-3 pl-3.5 text-label font-bold text-white no-underline shadow-float hover:opacity-90"
        >
          深度探索
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </RouterLink>
        <span v-if="pref && regionOf(pref)" class="h-9 w-px shrink-0 bg-line" aria-hidden="true"></span>
        <PackBar :pref="pref && regionOf(pref) ? pref : null" />
      </div>

      <!-- 左上浮動面板：地區標籤／地區清單、主題篩選、景點與地區特色 -->
      <div
        class="pointer-events-none absolute top-4 bottom-4 left-4 z-10 flex w-float flex-col gap-2.5 *:pointer-events-auto max-lg:right-4 max-lg:bottom-auto max-lg:w-auto"
      >
        <template v-if="pref && regionOf(pref)">
          <RegionTag :pref="pref" class="max-lg:hidden" />
          <PackList
            v-if="explore.pack"
            :pref="pref"
            :selected-id="selectedId"
            class="max-lg:hidden"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          <RegionLists
            v-else
            :pref="pref"
            :spots="prefSpots"
            :selected-id="selectedId"
            class="max-lg:hidden"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
        </template>
        <template v-else>
          <PackList
            v-if="explore.pack"
            :selected-id="selectedId"
            class="max-lg:hidden"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          <HomeSidebar v-else :available="available" class="max-lg:max-h-[40dvh]" />
        </template>
      </div>
    </div>

    <aside
      v-if="selectedId"
      class="shrink-0 border-line lg:w-panel lg:border-l max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:h-[60dvh] max-lg:overflow-hidden max-lg:rounded-t-sheet max-lg:shadow-sheet"
    >
      <PackPanel v-if="selectedPack" :item="selectedPack.item" :pack="selectedPack.pack" @close="closeSpot" />
      <SpotPanel
        v-else
        :spot="selectedSpot"
        :loading="loadingSpot"
        :nearby="nearby"
        @close="closeSpot"
        @select-pack="select"
      />
    </aside>
  </div>
</template>
