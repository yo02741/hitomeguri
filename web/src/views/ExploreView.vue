<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { type LocationQuery, useRoute, useRouter } from 'vue-router'

import HomeSidebar from '../components/HomeSidebar.vue'
import MapView, { type MapView as MapViewState } from '../components/MapView.vue'
import PackBar from '../components/PackBar.vue'
import PackList from '../components/PackList.vue'
import PackPanel from '../components/PackPanel.vue'
import RegionLists from '../components/RegionLists.vue'
import RegionTag from '../components/RegionTag.vue'
import RollingNumber from '../components/RollingNumber.vue'
import type { NearbyPack } from '../components/SpotPanel.vue'
import TimedList from '../components/TimedList.vue'
import { categoryGroup } from '../data/categories'
import { PACKS, packByKey, packOfId } from '../data/packs'
import { JAPAN_BOUNDS } from '../map/style'
import { regionOf } from '../data/regions'
import type { MapSpot, PackItem, RailBundle, Spot } from '../services/bundles'
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
import { currentTimed } from '../services/timed'
import { todayIso } from '../services/userdb'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import { useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

const props = defineProps<{ pref?: string }>()
// 景點面板（含收藏・去過・行程按鈕、日期選擇、收集卡）選了景點才用到，不放進入口程式；
// 開場之後閒下來先抓（main.ts），第一次點景點不必等
const SpotPanel = defineAsyncComponent(() => import('../components/SpotPanel.vue'))
const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const explore = useExploreStore()
const marks = useMarksStore()
const userStore = useUserStore()

const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const selectedId = computed(() => (typeof route.query.spot === 'string' ? route.query.spot : null))
const selectedSpot = shallowRef<Spot | null>(null)
const loadingSpot = ref(false)
const bounds = shallowRef<[number, number, number, number] | null>(null)
// 由平移地圖觸發的縣切換不重新定位地圖
let panSwitch = false
// 從搜尋選了別縣的景點：進入該縣後飛到這個景點，不做整縣定位
let flyAfterLoad: string | null = null
// 從首頁（全國）選了擴充包的點：進入該縣後飛到這個位置
let flyAfterLoadPoint: { lng: number; lat: number } | null = null

const available = computed(() => Object.keys(catalog.index?.prefectures ?? {}))
// 已載入完整地圖 bundle 的縣用全部大點，其餘縣先用全國總覽（各縣分數前段，bundles/featured.json）
const allSpots = computed<MapSpot[]>(() =>
  available.value.flatMap((p) => catalog.mapSpots[p] ?? catalog.featured[p] ?? []),
)
// 顯示規則：全部大點（可依類型篩選；開啟擴充包時不篩選，變淡當底圖）
const filteredSpots = computed(() =>
  allSpots.value.filter((s) => {
    if (s.k !== 'major') return false
    if (explore.onlyFavorites && !explore.pack) return Boolean(marks.marks[s.id]?.favorite)
    return explore.pack || !explore.category || categoryGroup(s.c) === explore.category
  }),
)
// 選到的景點被篩掉時也要畫出來。選到的本來就在清單裡時沿用同一個陣列，
// 地圖不會因為換選取而把全部景點重送一次（選取由 MapView 的 selectedId 另外處理）
const visibleSpots = computed(() => {
  const id = selectedId.value
  const base = filteredSpots.value
  if (!id || base.some((s) => s.id === id)) return base
  const sel = allSpots.value.find((s) => s.id === id)
  return sel ? [...base, sel] : base
})

// 只看收藏：收藏所在的縣載入完整地圖 bundle（全國總覽只有各縣前段的景點）；登出或沒有收藏時關閉
const favoritePrefs = computed(() => [...new Set(marks.favorites.map(([, m]) => m.pref))])
watch(
  () => [explore.onlyFavorites, favoritePrefs.value] as const,
  ([on, prefs]) => {
    if (on) prefs.forEach((p) => catalog.loadMap(p).catch(() => {}))
  },
  { immediate: true },
)
// 打開時移到看得到全部收藏的範圍
watch(
  () => explore.onlyFavorites,
  async (on) => {
    if (!on) return
    const spots = (await Promise.all(favoritePrefs.value.map((p) => catalog.loadMap(p).catch(() => [] as MapSpot[]))))
      .flat()
      .filter((s) => marks.marks[s.id]?.favorite)
    const b = spotBounds(spots)
    if (b && explore.onlyFavorites) bounds.value = b
  },
)
watch(
  () => marks.loaded && marks.favorites.length === 0,
  (none) => {
    if (none) explore.onlyFavorites = false
  },
)
watch(
  () => userStore.user,
  (u) => {
    if (!u) explore.onlyFavorites = false
  },
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
    // URL 已經是這個擴充包（select() 和景點一起寫進去的）就不再 replace
    if ((route.query.pack ?? '') !== (key ?? '')) {
      const q = { ...route.query }
      if (key) q.pack = key
      else delete q.pack
      router.replace({ query: q })
    }
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
  // 選到的名城已經以景點（有照片）標出，對到的擴充包點不重複畫
  const points = items.filter((it) => (!explore.packGroup || it.g === explore.packGroup) && !(it.s && it.s === selectedId.value))
  return { color: def.color, points }
})

/** 選取中的擴充包點 */
const selectedPack = computed<{ pack: string; item: PackItem } | null>(() => {
  const id = selectedId.value
  const pack = id ? packOfId(id) : undefined
  const item = pack ? catalog.packs[pack]?.find((it) => it.id === id) : undefined
  return pack && item ? { pack, item } : null
})

// 卡片關閉時往下收（手機）：收的那 0.2 秒裡照樣顯示剛才的內容，不閃成載入中
const held = shallowRef<{ pack: { pack: string; item: PackItem } | null; spot: Spot | null }>({ pack: null, spot: null })
watch([selectedPack, selectedSpot], ([pack, spot]) => {
  if (selectedId.value) held.value = { pack, spot }
})
const shownPack = computed(() => (selectedId.value ? selectedPack.value : held.value.pack))
const shownSpot = computed(() => (selectedId.value ? selectedSpot.value : held.value.spot))

// 景點附近（2 km 內）的擴充包點，每個擴充包最多 6 個
const NEARBY_M = 2000
const NEARBY_MAX = 6
const nearby = computed<NearbyPack[]>(() => {
  const s = shownSpot.value
  if (!s) return []
  const { lat, lng } = s.location
  return PACKS.filter((p) => explore.enabledPacks.includes(p.key)).flatMap((p) => {
    const labels = new Map(p.groups.map((g) => [g.key, g.label]))
    const items = (catalog.packs[p.key] ?? [])
      .filter((it) => it.s !== s.id)
      .map((it) => ({ it, d: distanceM(lat, lng, it.lat, it.lng) }))
      .filter((x) => x.d <= NEARBY_M)
      .sort((a, b) => a.d - b.d)
      .slice(0, NEARBY_MAX)
      .map(({ it, d }) => ({ id: it.id, n: it.n, group: labels.get(it.g) ?? '', d: Math.round(d / 10) * 10 }))
    return items.length ? [{ pack: p.key, label: p.label, color: p.color, items }] : []
  })
})
// 景點是名城時：名城番號與スタンプ設置場所（擴充包「城」載入後）
const castleOfSpot = computed(() => {
  const s = shownSpot.value
  const it = s ? catalog.packs.castle?.find((x) => x.s === s.id) : undefined
  if (!it?.no) return undefined
  const label = packByKey.get('castle')?.groups.find((g) => g.key === it.g)?.label ?? ''
  return { no: it.no, label, stamp: it.st ?? [] }
})
const prefSpots = computed(() => (props.pref ? (catalog.mapSpots[props.pref] ?? []) : []))
// 右側卡片換內容時重播淡入：擴充包的點看 id，景點等詳細資料到了才換（載入中不算一次）
const panelKey = computed(() => (shownPack.value ? shownPack.value.item.id : (shownSpot.value?.id ?? 'loading')))
// 手機第一次打開：卡片升上來（sheet transition）時內容不再另外淡入，升上來途中換掉的內容（載入中 → 景點）也不播；
// quietKey 記住這段期間的內容，之後換景點才播 panel-in
const sheetEntering = ref(false)
const quietKey = ref<string | null>(null)
watch(
  selectedId,
  (id, old) => {
    if (id && !old && !desktop.value) {
      sheetEntering.value = true
      quietKey.value = panelKey.value
    }
  },
  { flush: 'pre' },
)
watch(
  panelKey,
  (k) => {
    if (sheetEntering.value) quietKey.value = k
  },
  { flush: 'pre' },
)

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

// 手機：上方的清單卡（擴充包 chip）與下方的景點卡片、祭典小卡蓋住地圖，定位時扣掉這兩塊（MapView insets）
const panel = ref<HTMLElement | null>(null)
const sheet = ref<HTMLElement | null>(null)
const pinCard = ref<HTMLElement | null>(null)
const insets = shallowRef({ top: 0, bottom: 0 })
// 景點卡片的高度：60dvh，但不超過海報條以下的地圖區減 2.5rem（手機打橫時地圖區只有兩百多 px）
const sheetHeight = computed(() => {
  const poster = !!(props.pref && regionOf(props.pref))
  if (shownPack.value) return poster ? 'max-lg:max-h-[min(60dvh,calc(100%-6rem))]' : 'max-lg:max-h-[min(60dvh,calc(100%-2.5rem))]'
  return poster ? 'max-lg:h-[min(60dvh,calc(100%-6rem))]' : 'max-lg:h-[min(60dvh,calc(100%-2.5rem))]'
})
function measureInsets() {
  if (desktop.value) {
    if (insets.value.top || insets.value.bottom) insets.value = { top: 0, bottom: 0 }
    return
  }
  const p = panel.value
  // 清單卡是地圖區塊裡的絕對定位，offsetTop 從地圖上緣算；收起時面板沒有高度
  const top = p && p.offsetHeight ? p.offsetTop + p.offsetHeight : 0
  // 景點卡片貼著地圖下緣；用版面高度（升上來的 transform 不算），祭典小卡從它的上緣算到地圖下緣
  const card = pinCard.value
  const bottom = sheet.value ? sheet.value.offsetHeight : card?.offsetParent ? (card.offsetParent as HTMLElement).clientHeight - card.offsetTop : 0
  if (top !== insets.value.top || bottom !== insets.value.bottom) insets.value = { top, bottom }
}
const insetObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureInsets) : null
watch([panel, sheet, pinCard], (els, old) => {
  old?.forEach((el) => el && insetObserver?.unobserve(el))
  els.forEach((el) => el && insetObserver?.observe(el))
  measureInsets()
})
watch(desktop, measureInsets)
onBeforeUnmount(() => insetObserver?.disconnect())
/** 飛到某個點：先量好清單與卡片蓋住的範圍（剛打開的卡片要等畫出來），再讓點落在看得到的地圖中間 */
async function flyToVisible(lng: number, lat: number, zoom: number) {
  await nextTick()
  measureInsets()
  await nextTick()
  mapRef.value?.flyTo(lng, lat, zoom)
}

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

// 鐵路圖層：地區頁一律顯示該縣的路線與車站（使用者決定，不需開關），轉成地圖用的 GeoJSON
const railBundle = shallowRef<RailBundle | null>(null)
watch(
  () => props.pref,
  async (pref) => {
    if (!pref || !regionOf(pref)) {
      railBundle.value = null
      return
    }
    const data = await catalog.loadRail(pref)
    if (props.pref === pref) railBundle.value = data
  },
  { immediate: true },
)
const railMap = computed(() => {
  const r = railBundle.value
  if (!r) return null
  return {
    lines: {
      type: 'FeatureCollection' as const,
      features: r.lines.map((l) => ({
        type: 'Feature' as const,
        properties: { n: l.n, ...(l.c ? { c: l.c } : {}), k: l.k },
        geometry: { type: 'MultiLineString' as const, coordinates: l.g },
      })),
    },
    stations: {
      type: 'FeatureCollection' as const,
      features: r.stations.map((st) => ({
        type: 'Feature' as const,
        properties: { n: st.n },
        geometry: { type: 'Point' as const, coordinates: [st.lng, st.lat] },
      })),
    },
  }
})

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
// 期間限定（UX-FLOW.md A6）：目前地區的，左側面板列前三筆
const timedHere = computed(() => (props.pref ? currentTimed(catalog.timed ?? [], todayIso(), props.pref) : []))
// 手機的上方清單：打開景點卡片或祭典的地點標記時收起，地圖才看得到選到的點（桌機一直顯示）
const listShown = computed(() => desktop.value || (!selectedId.value && !pin.value))
const currentPack = computed(() => (explore.pack ? packByKey.get(explore.pack) : undefined))

onMounted(() => {
  // 地區標籤只用到直飛航線；地區特色（約 1.8 MB）留給深度探索
  void catalog.loadFlights()
  void catalog.loadTimed()
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
    // 讀不到時清單顯示「讀不到」與重試（RegionLists）；這裡當作沒有景點，不留未處理的 rejection
    const spots = await trackSplash(catalog.loadMap(pref).catch(() => [] as MapSpot[]), 'map-bundle')
    const target = flyAfterLoad ? spots.find((s) => s.id === flyAfterLoad) : flyAfterLoadPoint ?? undefined
    flyAfterLoad = null
    flyAfterLoadPoint = null
    if (target) {
      await flyToVisible(target.lng, target.lat, 15)
      return
    }
    if (pin.value) {
      await flyToVisible(pin.value.lng, pin.value.lat, 14)
      return
    }
    // 看得到整個縣的形狀（主要陸地的縣界）＋主要景點；還沒有資料的縣用縣界範圍定位
    await loadPrefectureShapes().catch(() => {})
    // 清單換成這個縣的景點後再量一次高度，定位才扣得準
    await nextTick()
    measureInsets()
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
      const item = items.find((it) => it.id === id)
      if (item?.s && selectedId.value === id) {
        await router.replace({ query: { ...route.query, spot: item.s } })
        return
      }
      if (!item && selectedId.value === id) closeSpot()
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
  const item = pack ? catalog.packs[pack]?.find((x) => x.id === id) : undefined
  // 從景點卡片的「附近」點進擴充包的點：一併開啟那個擴充包。
  // 不先改 explore.pack：它的 watcher 會用還沒換的 query 再 replace 一次，把 spot 蓋掉；
  // 這裡和 spot 一起寫進同一次導航，explore.pack 由 route.query.pack 的 watcher 跟上
  // 已經是景點的點（名城）：直接開景點卡片，名城番號等顯示在卡片上
  const target = item?.s ?? id
  // 首頁（全國）選了擴充包的點：和搜尋一樣進入那個縣（地圖、地區色、清單都換到該縣）
  if (item && !props.pref && regionOf(item.p)) {
    flyAfterLoadPoint = { lng: item.lng, lat: item.lat }
    await router.push({ path: `/map/${item.p}`, query: { spot: target, pack } })
    return
  }
  // 選了景點就收起地點標記
  const { at: _at, label: _label, ...rest } = route.query
  const query = { ...rest, spot: target, ...(pack ? { pack } : {}) }
  // 手機從「沒有選取」打開卡片時新增一筆歷史，返回手勢先關卡片；之後換景點仍用 replace
  if (!selectedId.value && !desktop.value) await router.push({ query })
  else await router.replace({ query })
  const s = item ?? allSpots.value.find((x) => x.id === id)
  // 縮放 15：群集全部散開（clusterMaxZoom 14），看得出選到的是哪一個點
  if (s) await flyToVisible(s.lng, s.lat, 15)
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

function sameQuery(a: LocationQuery, b: LocationQuery): boolean {
  const norm = (q: LocationQuery) => JSON.stringify(Object.entries(q).sort(([x], [y]) => x.localeCompare(y)))
  return norm(a) === norm(b)
}

function closeSpot() {
  const q = { ...route.query }
  delete q.spot
  // 上一筆歷史就是沒有卡片的同一頁（手機打開卡片時 push 的）：用返回關閉，之後的返回不會再把卡片開回來
  const back = (window.history.state as { back?: unknown } | null)?.back
  if (typeof back === 'string') {
    const prev = router.resolve(back)
    if (prev.path === route.path && sameQuery(prev.query, q)) {
      router.back()
      return
    }
  }
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
  const target = regionForView(view)
  const switching = target !== undefined && target !== (props.pref ?? null)
  // 換縣時下面的 replace 一併拿掉 spot；不換縣才另外關卡片（closeSpot 可能是返回，不能和 replace 同時發）
  if (selectedId.value && view.zoom < CLOSE_SPOT_ZOOM && !switching) closeSpot()
  if (!switching) return
  const query = { ...route.query }
  if (view.zoom < CLOSE_SPOT_ZOOM) delete query.spot
  panSwitch = true
  router.replace({ path: target ? `/map/${target}` : '/', query })
  if (target) catalog.loadMap(target).catch(() => {})
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 max-lg:flex-col">
    <!-- 手機：頂部海報條。左「‹ 全國」、中間縣名（不能點）、右「深度探索 ›」，分隔線和桌機的地區標籤相同（DESIGN.md §7.5） -->
    <div
      v-if="pref && regionOf(pref)"
      class="-mr-[env(safe-area-inset-right)] -ml-[env(safe-area-inset-left)] flex h-[56px] shrink-0 items-center gap-2 bg-region pr-[calc(0.5rem+env(safe-area-inset-right))] pl-[calc(0.25rem+env(safe-area-inset-left))] text-on-region lg:hidden"
    >
      <RouterLink
        to="/"
        aria-label="回到全國地圖"
        class="flex size-11 shrink-0 flex-col items-center justify-center rounded-control text-on-region no-underline hover:bg-region-accent active:not-disabled:translate-y-px"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
        <span class="text-micro leading-none font-bold">全國</span>
      </RouterLink>
      <span class="h-8 w-px shrink-0 bg-on-region opacity-25" aria-hidden="true"></span>
      <span class="flex min-w-0 items-end gap-2 pl-1">
        <span class="flex shrink-0 flex-col whitespace-nowrap">
          <span lang="ja" class="text-caption leading-tight tracking-kana">{{ regionOf(pref)!.name.kana }}</span>
          <span lang="ja" class="text-h3 leading-tight font-black tracking-name">{{ regionOf(pref)!.name.ja }}</span>
        </span>
        <!-- 長的羅馬拼音（KAGOSHIMA、HOKKAIDO）不加字距，360 寬也放得下 -->
        <span
          class="min-w-0 truncate pb-0.5 font-latin text-caption font-semibold uppercase"
          :class="regionOf(pref)!.name.romaji.length > 7 ? 'tracking-normal' : 'tracking-romaji'"
          >{{ regionOf(pref)!.name.romaji }}</span
        >
      </span>
      <span class="ml-auto h-8 w-px shrink-0 bg-on-region opacity-25" aria-hidden="true"></span>
      <RouterLink
        :to="`/region/${pref}`"
        class="flex min-h-tap shrink-0 items-center gap-0.5 rounded-control pr-1.5 pl-2.5 text-label font-bold whitespace-nowrap text-on-region no-underline hover:bg-region-accent active:not-disabled:translate-y-px"
      >
        深度探索
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </RouterLink>
    </div>

    <div class="relative min-h-0 flex-1">
      <MapView
        ref="mapRef"
        :spots="visibleSpots"
        :selected-id="selectedId"
        :bounds="bounds"
        :color-key="explore.activePref"
        :inset-left="insetLeft"
        :insets="insets"
        :controls-lift="pinCard ? insets.bottom : 0"
        :pack="packMap"
        :outline="outline"
        :pin="pin"
        :rail="railMap"
        :marked="marks.marks"
        @select="select"
        @close-pin="closePin"
        @moveend="onMoveEnd"
      />

      <!-- 地圖上方、左側面板旁：只看收藏（登入且有收藏時）＋擴充包列，靠左排（桌機；手機版面暫緩） -->
      <div
        class="pointer-events-none absolute top-4 right-4 z-10 flex flex-wrap items-start gap-2 *:pointer-events-auto max-lg:hidden"
        :style="{ left: `${insetLeft}px` }"
      >
        <button
          v-if="userStore.user && marks.favorites.length"
          type="button"
          class="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-label font-bold shadow-float active:not-disabled:translate-y-px pointer-coarse:h-tap"
          :class="explore.onlyFavorites ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-surface'"
          :aria-pressed="explore.onlyFavorites"
          @click="explore.onlyFavorites = !explore.onlyFavorites"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" :fill="explore.onlyFavorites ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
          </svg>
          收藏<RollingNumber :value="marks.favorites.length" class="font-latin" />
        </button>
        <PackBar :pref="pref && regionOf(pref) ? pref : null" />
      </div>

      <!-- 左上浮動面板：地區標籤／地區清單、主題篩選、景點與地區特色。
           手機打橫時地圖只剩兩百多 px 高，清單右邊留出縮放鈕那一欄，縮放鈕不被清單蓋住 -->
      <div
        ref="panel"
        class="pointer-events-none absolute top-4 bottom-4 left-4 z-10 flex w-float flex-col gap-2.5 *:pointer-events-auto max-lg:right-4 max-lg:bottom-auto max-lg:w-auto max-lg:[@media(orientation:landscape)_and_(max-height:500px)]:right-14"
      >
        <!-- 手機：開著的擴充包（桌機在地圖上方的擴充包列）。點了關閉；完整的 chip 列在第二階段 -->
        <button
          v-if="currentPack"
          type="button"
          class="flex h-9 w-fit shrink-0 items-center gap-1.5 rounded-full bg-(--pack) pr-2.5 pl-3.5 text-label font-bold text-white shadow-float lg:hidden active:not-disabled:translate-y-px pointer-coarse:h-tap"
          :style="{ '--pack': `var(--color-t-${currentPack.color})` }"
          :aria-label="`關閉${currentPack.label}`"
          @click="explore.pack = null"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="currentPack.icon" />
          </svg>
          {{ currentPack.label }}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <RegionTag v-if="pref && regionOf(pref)" :pref="pref" class="max-lg:hidden" />
        <template v-if="pref && regionOf(pref)">
          <section v-if="timedHere.length && !explore.pack" class="shrink-0 rounded-card bg-paper px-3.5 pt-2.5 pb-2 shadow-float max-lg:hidden" aria-labelledby="timed-here">
            <h2 id="timed-here" class="flex items-baseline gap-1.5 text-label font-bold">
              期間限定<span class="font-latin font-normal text-sub">{{ timedHere.length }}</span>
              <RouterLink v-if="timedHere.length > 3" :to="`/region/${pref}#timed`" class="ml-auto text-caption font-normal text-sub active:text-ink">全部</RouterLink>
            </h2>
            <TimedList :items="timedHere.slice(0, 3)" />
          </section>
          <!-- 擴充包開著時清單換成擴充包清單；手機在上方 40dvh，打開景點卡片或地點標記時收起 -->
          <template v-if="listShown">
          <PackList
            v-if="explore.pack"
            :pref="pref"
            :selected-id="selectedId"
            class="max-lg:max-h-[40dvh]"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          <RegionLists
            v-else
            :pref="pref"
            :spots="prefSpots"
            :state="catalog.mapState(pref)"
            :selected-id="selectedId"
            class="max-lg:max-h-[40dvh]"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          </template>
          <!-- 深度探索入口：左欄最下方獨立一顆，和清單分開（使用者決定） -->
          <RouterLink
            :to="`/region/${pref}`"
            class="flex shrink-0 items-center gap-3 rounded-card bg-paper py-2.5 pr-3 pl-2.5 text-ink no-underline shadow-float hover:bg-surface max-lg:hidden active:not-disabled:translate-y-px"
          >
            <span class="grid size-10 shrink-0 place-items-center rounded-full bg-region text-on-region" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 5.5c3-1.3 6-1.3 9 0v14c-3-1.3-6-1.3-9 0z M12 5.5c3-1.3 6-1.3 9 0v14c-3-1.3-6-1.3-9 0z" />
              </svg>
            </span>
            <span class="flex min-w-0 flex-col">
              <span class="text-body-sm font-bold">深度探索</span>
              <span class="truncate text-caption text-sub">季節・祭典・地區特色・期間限定</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto shrink-0 text-sub" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </RouterLink>
        </template>
        <template v-else-if="listShown">
          <PackList
            v-if="explore.pack"
            :selected-id="selectedId"
            class="max-lg:max-h-[40dvh]"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          <HomeSidebar v-else :available="available" class="max-lg:max-h-[40dvh]" />
        </template>
      </div>

      <!-- 手機：深度探索「地圖」打開的祭典地點，下方一張小卡（清單收起）：回到祭典、關閉 -->
      <div
        v-if="pin && !selectedId && pref && regionOf(pref)"
        ref="pinCard"
        class="absolute inset-x-4 bottom-4 z-10 flex items-center gap-1 rounded-card bg-paper p-1 text-ink shadow-float lg:hidden"
      >
        <RouterLink
          :to="`/region/${pref}#festivals`"
          class="flex min-h-tap shrink-0 items-center gap-0.5 rounded-control pr-2.5 pl-1.5 text-label font-bold text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          祭典
        </RouterLink>
        <span class="h-6 w-px shrink-0 bg-line" aria-hidden="true"></span>
        <span lang="ja" class="min-w-0 flex-1 truncate px-2 text-body-sm font-bold">{{ pin.label }}</span>
        <button
          type="button"
          aria-label="關閉標記"
          class="grid size-tap shrink-0 place-items-center rounded-full text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px"
          @click="closePin"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 手機的景點卡片從下方升上來、關閉時往下收；換景點時內容淡入（DESIGN.md §9）。桌機沒有 transition，直接出現與移除 -->
    <Transition name="sheet" @after-enter="sheetEntering = false" @enter-cancelled="sheetEntering = false">
      <!-- 擴充包的點內容短：手機的卡片依內容高度，最高 60dvh（PackPanel 自己捲動）。
           手機打橫時 60dvh 比地圖區還高：再限制在海報條以下、上面留 2.5rem 地圖 -->
      <aside
        v-if="selectedId"
        ref="sheet"
        :data-reduce="desktop ? undefined : 'fade'"
        class="shrink-0 border-line lg:w-panel lg:border-l max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:overflow-hidden max-lg:rounded-t-sheet max-lg:shadow-sheet"
        :class="sheetHeight"
      >
        <div
          :key="panelKey"
          class="h-full"
          :class="panelKey === quietKey ? '' : 'animate-panel-in'"
          :data-reduce="panelKey === quietKey ? undefined : 'fade'"
        >
          <PackPanel
            v-if="shownPack"
            :item="shownPack.item"
            :pack="shownPack.pack"
            @close="closeSpot"
            @open-spot="select"
          />
          <SpotPanel
            v-else
            :spot="shownSpot"
            :loading="loadingSpot"
            :nearby="nearby"
            :castle="castleOfSpot"
            @close="closeSpot"
            @select-pack="select"
          />
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
/* 手機的景點卡片（DESIGN.md §9）：升上來 0.32s、往下收 0.2s；開到一半又關會直接反轉 */
@media (max-width: 1023.98px) {
  .sheet-enter-active {
    transition: transform 0.32s var(--ease-out-soft);
  }
  .sheet-leave-active {
    transition: transform 0.2s var(--ease-out-soft);
  }
  .sheet-enter-from,
  .sheet-leave-to {
    transform: translateY(100%);
  }
}
/* 減少動態：手機的卡片不升降，aside 的 data-reduce="fade" 淡入、關閉時淡出（桌機由內容的 panel-in 淡入） */
@media (max-width: 1023.98px) and (prefers-reduced-motion: reduce) {
  .sheet-enter-active {
    transition: none;
  }
  .sheet-leave-active {
    transition: opacity 0.2s ease;
  }
  .sheet-enter-from,
  .sheet-leave-to {
    transform: none;
    opacity: 0;
  }
}
</style>
