<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { type LocationQuery, useRoute, useRouter } from 'vue-router'

import HomeSidebar from '../components/HomeSidebar.vue'
import MapView, { type MapView as MapViewState } from '../components/MapView.vue'
import ChipRail from '../components/ChipRail.vue'
import FocusChip from '../components/FocusChip.vue'
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
import { type Area, areaGroups, areaList, paddedBox, parseArea } from '../services/areas'
import type { MapSpot, MunicipalityBundle, PackItem, RailBundle, ShinkansenBundle, Spot } from '../services/bundles'
import {
  distanceM,
  focusArea,
  loadPrefectureShapes,
  prefectureAt,
  prefectureBounds,
  prefectureMainBounds,
  prefectureShape,
} from '../services/geo'
import { afterPaint } from '../services/idle'
import { releaseVelocity, type Snap, snapAfterDrag, snapHeights, stepSnap } from '../services/sheetSnap'
import type { SearchHit } from '../services/search'
import { trackSplash } from '../services/splash'
import { nearbySpots, sameStation, stationInfo } from '../services/stations'
import { currentTimed } from '../services/timed'
import { todayIso } from '../services/userdb'
import { land } from '../services/viewport'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'
import { useMarksStore } from '../stores/marks'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

const props = defineProps<{ pref?: string }>()
// 景點面板（含收藏・去過・行程按鈕、日期選擇、收集卡）選了景點才用到，不放進入口程式；
// 開場之後閒下來先抓（main.ts），第一次點景點不必等
const SpotPanel = defineAsyncComponent(() => import('../components/SpotPanel.vue'))
// 車站卡片（UX-FLOW.md B5）：點了車站才用到
const StationPanel = defineAsyncComponent(() => import('../components/StationPanel.vue'))
const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()
const explore = useExploreStore()
const marks = useMarksStore()
const trips = useTripsStore()
const userStore = useUserStore()
// 地圖的收藏外圈、去過圓點：已結束的行程裡的景點也算去過（UX-FLOW.md §3）
const markedOnMap = computed(() => {
  const visits = trips.doneVisits
  if (!visits.size) return marks.marks
  const out: Record<string, { favorite?: boolean; visited?: boolean }> = { ...marks.marks }
  for (const id of visits.keys()) out[id] = { ...out[id], visited: true }
  return out
})

const mapRef = ref<InstanceType<typeof MapView> | null>(null)
const selectedId = computed(() => (typeof route.query.spot === 'string' ? route.query.spot : null))
// 車站卡片（?station=路網節點 id，縣地圖才有）：和景點卡片同一個位置，一次開一張
const stationId = computed(() => (props.pref && regionOf(props.pref) && typeof route.query.station === 'string' ? route.query.station : null))
/** 景點、擴充包的點或車站的卡片開著 */
const cardOpen = computed(() => Boolean(selectedId.value || stationId.value))
// 這個縣的鐵路（路線、車站）：地圖的鐵路圖層與車站卡片（下面 props.pref 的 watcher 載入）
const railBundle = shallowRef<RailBundle | null>(null)
const selectedSpot = shallowRef<Spot | null>(null)
const loadingSpot = ref(false)
const bounds = shallowRef<[number, number, number, number] | null>(null)
// 由平移地圖觸發的縣切換不重新定位地圖
let panSwitch = false
// 從搜尋選了別縣的景點：進入該縣後飛到這個景點，不做整縣定位
let flyAfterLoad: string | null = null
// 從首頁（全國）選了擴充包的點：進入該縣後飛到這個位置
let flyAfterLoadPoint: { lng: number; lat: number } | null = null
// 換縣時不帶過去的 query：區、車站是那個縣的，祭典的標記也是
function crossPref(q: LocationQuery): LocationQuery {
  const { area: _a, station: _s, at: _at, label: _l, ...rest } = q
  return rest
}

const available = computed(() => Object.keys(catalog.index?.prefectures ?? {}))
// 目前的縣（區界、地區選單用）
const prefHere = computed(() => (props.pref && regionOf(props.pref) ? props.pref : null))
// 專心模式（UX-FLOW.md §1.3）：進入一縣後地圖鎖在這個縣、只畫這個縣的點；按「‹ 全國」或返回才離開。
// 「只看○○」關掉時和全國一樣：畫全部的縣，拖到別縣時縣跟著換
const focusPref = computed(() => (explore.focusLock ? prefHere.value : null))
// 已載入完整地圖 bundle 的縣用全部大點，其餘縣先用全國總覽（各縣分數前段，bundles/featured.json）
const allSpots = computed<MapSpot[]>(() =>
  (focusPref.value ? [focusPref.value] : available.value).flatMap((p) => catalog.mapSpots[p] ?? catalog.featured[p] ?? []),
)
// 類型篩選：清單與按鈕先換（RegionLists 只切換顯示），地圖等那個畫面畫出來之後才跟上。
// 地圖的點是分群（cluster）的來源，篩選要換掉資料才會重新分群（圖層的 filter、feature-state 只改得到畫不畫，
// 群的數字還是全部），所以仍然 setData，只是不擋住按鈕的回應（手機版計畫第二階段 3）
const mapCategory = ref(explore.category)
watch(
  () => explore.category,
  () => afterPaint(() => (mapCategory.value = explore.category)),
)
// 顯示規則：全部大點（可依類型篩選；開啟擴充包時不篩選，變淡當底圖）
const filteredSpots = computed(() =>
  allSpots.value.filter((s) => {
    if (explore.pack) return true
    // 只看收藏與類型可以一起用（縣的清單也一樣）；全國總覽沒有類型列，只看收藏
    if (explore.onlyFavorites && !marks.marks[s.id]?.favorite) return false
    if (explore.onlyFavorites && !props.pref) return true
    return !mapCategory.value || categoryGroup(s.c) === mapCategory.value
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
// 打開時移到看得到全部收藏的範圍（專心模式只看這個縣的收藏）
watch(
  () => explore.onlyFavorites,
  async (on) => {
    if (!on) return
    const prefs = focusPref.value ? favoritePrefs.value.filter((p) => p === focusPref.value) : favoritePrefs.value
    const spots = (await Promise.all(prefs.map((p) => catalog.loadMap(p).catch(() => [] as MapSpot[]))))
      .flat()
      .filter((s) => marks.marks[s.id]?.favorite)
    const b = spotBounds(spots)
    if (b && explore.onlyFavorites) {
      japanFit = false
      bounds.value = b
    }
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
  const pref = focusPref.value
  // 專心模式只畫這個縣的點；選到的名城已經以景點（有照片）標出，對到的擴充包點不重複畫
  const points = items.filter(
    (it) => (!pref || it.p === pref) && (!explore.packGroup || it.g === explore.packGroup) && !(it.s && it.s === selectedId.value),
  )
  return { color: def.color, points }
})

/** 選取中的擴充包點 */
const selectedPack = computed<{ pack: string; item: PackItem } | null>(() => {
  const id = selectedId.value
  const pack = id ? packOfId(id) : undefined
  const item = pack ? catalog.packs[pack]?.find((it) => it.id === id) : undefined
  return pack && item ? { pack, item } : null
})

// 車站卡片：停靠的路線、附近的景點（最近車站是這一站的；沒有時列 1.5 km 內最近的幾個）
const prefSpotsAll = computed(() => (props.pref ? (catalog.mapSpots[props.pref] ?? []) : []))
const selectedStation = computed(() => {
  const info = stationInfo(railBundle.value, stationId.value)
  return info ? { info, nearby: nearbySpots(prefSpotsAll.value, info) } : null
})
type ShownStation = NonNullable<typeof selectedStation.value>

// 卡片關閉時往下收（手機）：收的那 0.2 秒裡照樣顯示剛才的內容，不閃成載入中
const held = shallowRef<{ pack: { pack: string; item: PackItem } | null; spot: Spot | null; station: ShownStation | null }>({
  pack: null,
  spot: null,
  station: null,
})
watch([selectedPack, selectedSpot, selectedStation], ([pack, spot, station]) => {
  if (cardOpen.value) held.value = { pack, spot, station }
})
const shownPack = computed(() => (cardOpen.value ? selectedPack.value : held.value.pack))
const shownSpot = computed(() => (cardOpen.value ? selectedSpot.value : held.value.spot))
const shownStation = computed(() => (cardOpen.value ? selectedStation.value : held.value.station))

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
const prefSpots = prefSpotsAll
// 景點卡片的「最寄駅」連到車站卡片：景點的 st（最近車站的路網節點）和詳細資料的最近車站同名時
const spotStation = computed(() => {
  const s = shownSpot.value
  const near = s?.nearest_stations?.[0]
  const st = s ? prefSpotsAll.value.find((x) => x.id === s.id)?.st : undefined
  const info = st && s?.prefecture === props.pref ? stationInfo(railBundle.value, st) : null
  return info && near && sameStation(near.name.ja, info.name) ? info.id : null
})
// 右側卡片換內容時重播淡入：擴充包的點看 id，景點等詳細資料到了才換（載入中不算一次）
const panelKey = computed(() =>
  shownPack.value ? shownPack.value.item.id : shownStation.value ? `station:${shownStation.value.info.id}` : (shownSpot.value?.id ?? 'loading'),
)
// 手機第一次打開：卡片升上來（sheet transition）時內容不再另外淡入，升上來途中換掉的內容（載入中 → 景點）也不播；
// quietKey 記住這段期間的內容，之後換景點才播 panel-in
const sheetEntering = ref(false)
const quietKey = ref<string | null>(null)
watch(
  cardOpen,
  (id, old) => {
    if (id && !old && !desktop.value) {
      sheetEntering.value = true
      quietKey.value = panelKey.value
      // 每次打開都從半開開始；開著時換景點維持目前的段
      snap.value = 'half'
      dragH.value = null
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
// 手機打橫（高 ≤500，決定事項 N2）：清單與景點卡片都是左側 300px 的浮動欄（和桌機的浮動面板同寬），地圖一樣扣掉左側
const side = computed(() => !desktop.value && land.value)
const insetLeft = computed(() => (desktop.value || side.value ? FLOAT_INSET : 0))

// 手機景點卡片的三段高度（DESIGN.md §7.13、決定事項 C3）：收合（把手＋名稱帶，名稱帶放「去過」）／半開 55vh／全開。
// 只有把手與名稱帶（SpotPanel 的 data-sheet-drag）可以拖；放開時吸到最近的一段，從收合再往下拉就關閉。
// 擴充包的點內容短，照舊依內容高度、不能拖。
const root = ref<HTMLElement | null>(null)
const poster = ref<HTMLElement | null>(null)
const snap = ref<Snap>('half')
const headPx = ref(0)
const dragH = ref<number | null>(null)
const area = shallowRef({ h: 0, poster: 0, vh: 0 })
function measureArea() {
  const r = root.value
  if (!r) return
  const next = { h: r.clientHeight, poster: poster.value?.offsetHeight ?? 0, vh: window.innerHeight }
  const a = area.value
  if (next.h !== a.h || next.poster !== a.poster || next.vh !== a.vh) area.value = next
}
const areaObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measureArea) : null
watch([root, poster], (els, old) => {
  old?.forEach((el) => el && areaObserver?.unobserve(el))
  els.forEach((el) => el && areaObserver?.observe(el))
  measureArea()
})
onBeforeUnmount(() => areaObserver?.disconnect())
const heights = computed(() => snapHeights(area.value.h, area.value.poster, headPx.value, area.value.vh))
/** 手機的景點卡片（可拖、三段高度）；桌機、手機打橫（側欄）與擴充包的點、車站不是 */
const spotSheet = computed(() => !desktop.value && !side.value && !shownPack.value && !shownStation.value)
// chip 軌道：景點卡片全開，或半開就蓋到軌道（手機打橫）時先收起
const railShown = computed(() => {
  // 打橫：卡片在側欄裡，蓋住軌道的位置
  if (side.value) return !cardOpen.value
  if (!cardOpen.value || !spotSheet.value || snap.value === 'peek') return true
  if (snap.value === 'full') return false
  const a = area.value
  return heights.value.half <= a.h - a.poster - 80
})
// 打橫的左側欄：從海報條下面 16px 到地圖下緣 16px（和桌機的浮動面板一樣是整欄）
const sideStyle = computed(() => ({ top: `${area.value.poster + 16}px`, bottom: '16px' }))
const sheetStyle = computed(() =>
  spotSheet.value && area.value.h ? { height: `${dragH.value ?? heights.value[snap.value]}px` } : undefined,
)

let drag: { id: number; y0: number; h0: number; zone: Element; started: boolean; samples: { t: number; h: number }[] } | null = null
function onSheetDown(e: PointerEvent) {
  if (!spotSheet.value || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
  const zone = (e.target as Element | null)?.closest?.('[data-sheet-drag]')
  if (!zone || !sheet.value) return
  drag = { id: e.pointerId, y0: e.clientY, h0: sheet.value.offsetHeight, zone, started: false, samples: [] }
}
function onSheetMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const dy = e.clientY - drag.y0
  // 動了 6px 以上才算拖，名稱帶上的按鈕照樣點得到
  if (!drag.started) {
    if (Math.abs(dy) < 6) return
    drag.started = true
    drag.zone.setPointerCapture?.(e.pointerId)
  }
  const h = Math.min(heights.value.full, Math.max(40, drag.h0 - dy))
  dragH.value = h
  const now = performance.now()
  drag.samples.push({ t: now, h })
  while (drag.samples.length > 2 && now - drag.samples[0]!.t > 100) drag.samples.shift()
}
function onSheetUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const d = drag
  drag = null
  if (!d.started || dragH.value === null) return
  if (e.type === 'pointercancel') {
    dragH.value = null
    return
  }
  const v = releaseVelocity(d.samples, performance.now())
  const target = snapAfterDrag(heights.value, dragH.value, v)
  if (target === null) {
    // 從目前的高度往下收（dragH 留到收完才清掉）
    closeSpot()
    return
  }
  dragH.value = null
  snap.value = target
}
function onSnapStep(dir: -1 | 0 | 1) {
  snap.value = stepSnap(snap.value, dir)
}
// 換段之後鏡頭跟著：卡片高度變完（0.28s）再量一次蓋住的範圍，選到的點被蓋住就移到剩下的地圖中間
// 手機轉向（直 ↔ 打橫）時卡片從下方換到左側欄（或反過來）：蓋住的範圍變了，同樣再看一次
let revealTimer = 0
function revealSelected() {
  clearTimeout(revealTimer)
  revealTimer = window.setTimeout(async () => {
    measureInsets()
    await nextTick()
    if (!cardOpen.value || (spotSheet.value && snap.value === 'full')) return
    const st = selectedStation.value?.info
    if (stationId.value && st) {
      mapRef.value?.reveal(st.lng, st.lat)
      return
    }
    const id = selectedId.value
    const s = allSpots.value.find((x) => x.id === id)
    const loc = s ? { lng: s.lng, lat: s.lat } : shownSpot.value?.id === id ? shownSpot.value.location : null
    if (loc) mapRef.value?.reveal(loc.lng, loc.lat)
  }, 300)
}
watch(snap, revealSelected)
watch(side, revealSelected)
onBeforeUnmount(() => clearTimeout(revealTimer))
// Esc 關閉景點卡片（手機；焦點在卡片、地圖或沒有焦點時）。卡片裡的選單、對話框自己處理掉的 Esc 不算
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape' || e.defaultPrevented || desktop.value || !cardOpen.value) return
  const t = e.target as Element | null
  if (t?.closest?.('dialog')) return
  if (t && t !== document.body && !root.value?.contains(t)) return
  closeSpot()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// 手機：上方的清單卡（擴充包 chip）與下方的景點卡片、祭典小卡蓋住地圖，定位時扣掉這兩塊（MapView insets）
const panel = ref<HTMLElement | null>(null)
const sheet = ref<HTMLElement | null>(null)
const pinCard = ref<HTMLElement | null>(null)
const insets = shallowRef({ top: 0, bottom: 0 })
// 擴充包的點：依內容高度，最高 60dvh，但不超過海報條以下的地圖區減 2.5rem（手機打橫時地圖區只有兩百多 px）
const sheetHeight = computed(() => {
  const poster = !!(props.pref && regionOf(props.pref))
  if (side.value) return ''
  if (shownPack.value || shownStation.value) return poster ? 'max-lg:max-h-[min(60dvh,calc(100%-6rem))]' : 'max-lg:max-h-[min(60dvh,calc(100%-2.5rem))]'
  // 景點：三段高度由 sheetStyle 給（量到地圖區之前先用半開的 class）
  if (sheetStyle.value) return dragH.value === null ? 'sheet-snap' : ''
  return poster ? 'max-lg:h-[min(55dvh,calc(100%-6rem))]' : 'max-lg:h-[min(55dvh,calc(100%-2.5rem))]'
})
function measureInsets() {
  if (desktop.value || side.value) {
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
watch([desktop, side], measureInsets)
// 首頁的鏡頭是整個日本版圖、使用者還沒動過地圖時：清單卡的高度或左側欄改變（第一次量到、轉向、清單卡收起又出現）
// 就重新定位，日本一直落在清單卡以外看得到的地方
let japanFit = false
// 全國地圖上使用者最後看的範圍（沒有換縣的那一次移動）
let lastNational: [number, number, number, number] | null = null
watch([insets, insetLeft], () => {
  if (japanFit && !props.pref && listShown.value) bounds.value = [...JAPAN_BOUNDS]
})
onBeforeUnmount(() => insetObserver?.disconnect())
/** 飛到某個點：先量好清單與卡片蓋住的範圍（剛打開的卡片要等畫出來），再讓點落在看得到的地圖中間 */
async function flyToVisible(lng: number, lat: number, zoom: number) {
  japanFit = false
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

// 縣內的區（市区町村界，UX-FLOW.md A2b）：進入縣時載入。清單的「地區」、地圖的區界與區名，?area=代碼
const muniBundle = shallowRef<MunicipalityBundle | null>(null)
watch(
  prefHere,
  async (pref) => {
    muniBundle.value = null
    if (!pref) return
    const b = await catalog.loadMunicipalities(pref)
    if (prefHere.value === pref) muniBundle.value = b
  },
  { immediate: true },
)
const areas = computed(() => areaList(muniBundle.value))
// 網址的區：區界載入前先照代碼篩清單（景點的 m），載入後不在這個縣的區界裡就當作沒有
const areaCode = computed(() => {
  const code = parseArea(route.query.area, prefHere.value)
  return code && muniBundle.value && !areas.value.some((a) => a.code === code) ? null : code
})
const selectedArea = computed(() => areas.value.find((a) => a.code === areaCode.value) ?? null)
const areaOptions = computed(() => areaGroups(areas.value, prefSpots.value, areaCode.value))
/** 選區（清單的「地區」、地圖上點區塊）：新增一筆歷史，返回回到上一個區或整個縣 */
function pickArea(code: string | null) {
  if ((code ?? null) === areaCode.value) return
  const q = { ...route.query }
  if (code) q.area = code
  else delete q.area
  void router.push({ query: q })
}
// 定位：選了區就移到那一區（小的區放大到 14），取消就回到整個縣。進入縣的定位由下面 props.pref 的 watcher 負責，
// 它定位好之前（framedArea 是 undefined）這裡不動；網址直接帶 ?area= 時由它定位到那一區
const fitMaxZoom = ref<number | undefined>(undefined)
let framedArea: string | null | undefined
function frameArea(a: Area) {
  japanFit = false
  fitMaxZoom.value = 14
  bounds.value = paddedBox(a.bbox)
}
/** 看得到整個縣的形狀（主要陸地的縣界）＋主要景點；還沒有資料的縣用縣界範圍定位 */
function prefFrame(pref: string, spots: MapSpot[]): [number, number, number, number] | null {
  const main = spotBounds(spots.filter((s) => s.f === 1)) ?? spotBounds(spots)
  return union(main, prefectureMainBounds(pref)) ?? prefectureBounds(pref)
}
watch([areaCode, selectedArea], ([code, a]) => {
  const pref = prefHere.value
  if (!pref || framedArea === undefined || code === framedArea) return
  if (code && !a) return
  framedArea = code
  if (a) frameArea(a)
  else {
    fitMaxZoom.value = undefined
    bounds.value = prefFrame(pref, catalog.mapSpots[pref] ?? [])
  }
})

// 縣界載入後才畫得出目前地區的外框
const shapesReady = ref(false)
const outline = computed(() => (shapesReady.value && props.pref ? prefectureShape(props.pref) : null))
// 專心模式的範圍：整個縣（含離島）與這個縣的景點。之後的「日帰り」（鄰縣的目的地）由 focusArea 的 extra 加進來
const focus = computed(() => {
  const pref = focusPref.value
  if (!shapesReady.value || !pref) return null
  return focusArea(pref, catalog.mapSpots[pref] ?? catalog.featured[pref] ?? [])
})

function union(
  a: [number, number, number, number] | null,
  b: [number, number, number, number] | null,
): [number, number, number, number] | null {
  if (!a || !b) return a ?? b
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

// 鐵路圖層：地區頁一律顯示該縣的路線與車站（使用者決定，不需開關），轉成地圖用的 GeoJSON（railBundle 在上面宣告）
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
        properties: { n: l.n, ...(l.c ? { c: l.c } : {}), k: l.k, s: l.s ?? 0 },
        geometry: { type: 'MultiLineString' as const, coordinates: l.g },
      })),
    },
    // 合併過的車站（同一個 id）只畫一個點
    stations: {
      type: 'FeatureCollection' as const,
      features: r.stations
        .filter((st, i, all) => all.findIndex((x) => x.id === st.id) === i)
        .map((st) => ({
          type: 'Feature' as const,
          properties: { id: st.id, n: st.n, s: r.stations.some((x) => x.id === st.id && x.s === 1) ? 1 : 0 },
          geometry: { type: 'Point' as const, coordinates: [st.lng, st.lat] },
        })),
    },
  }
})

// 全國地圖的新幹線（UX-FLOW.md A1c）：首頁（全國）不必進縣就看得到路線與新幹線站；點了站進入那個縣、打開車站卡片
const shinkansen = shallowRef<ShinkansenBundle | null>(null)
watch(
  () => props.pref,
  async (pref) => {
    if (!pref && !shinkansen.value) shinkansen.value = await catalog.loadShinkansen()
  },
  { immediate: true },
)
const shinkansenMap = computed(() => {
  const sk = shinkansen.value
  if (!sk || props.pref) return null
  return {
    lines: {
      type: 'FeatureCollection' as const,
      features: sk.lines.map((l) => ({
        type: 'Feature' as const,
        properties: { n: l.n },
        geometry: { type: 'MultiLineString' as const, coordinates: l.g },
      })),
    },
    stations: {
      type: 'FeatureCollection' as const,
      features: sk.stations.map((st) => ({
        type: 'Feature' as const,
        properties: { id: st.id, n: st.n, p: st.p },
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
const listShown = computed(() => desktop.value || (!cardOpen.value && !pin.value))

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
    framedArea = undefined
    fitMaxZoom.value = undefined
    if (panSwitch) {
      panSwitch = false
      framedArea = null
      return
    }
    // 首頁：回到上次在全國地圖看的範圍（看新幹線看到一半點進縣，按「‹ 全國」回來不必重找）；
    // 還沒在全國地圖上動過就拉回整個日本版圖
    if (!pref) {
      japanFit = !lastNational
      bounds.value = lastNational ? [...lastNational] : [...JAPAN_BOUNDS]
      return
    }
    // 讀不到時清單顯示「讀不到」與重試（RegionLists）；這裡當作沒有景點，不留未處理的 rejection
    const spots = await trackSplash(catalog.loadMap(pref).catch(() => [] as MapSpot[]), 'map-bundle')
    const target = flyAfterLoad ? spots.find((s) => s.id === flyAfterLoad) : flyAfterLoadPoint ?? undefined
    flyAfterLoad = null
    flyAfterLoadPoint = null
    // 飛到景點、祭典、車站時不定位到區（網址的區只篩清單）
    if (target) {
      framedArea = areaCode.value
      await flyToVisible(target.lng, target.lat, 15)
      return
    }
    if (pin.value) {
      framedArea = areaCode.value
      await flyToVisible(pin.value.lng, pin.value.lat, 14)
      return
    }
    if (stationId.value) {
      const st = stationInfo(await catalog.loadRail(pref), stationId.value)
      if (st && props.pref === pref) {
        framedArea = areaCode.value
        await flyToVisible(st.lng, st.lat, 14)
        return
      }
    }
    await loadPrefectureShapes().catch(() => {})
    // 網址帶 ?area=：定位到那一區
    if (parseArea(route.query.area, pref)) {
      const a = areaList(await catalog.loadMunicipalities(pref)).find((x) => x.code === route.query.area)
      if (props.pref !== pref) return
      if (a) {
        await nextTick()
        measureInsets()
        framedArea = a.code
        frameArea(a)
        return
      }
    }
    if (props.pref !== pref) return
    // 清單換成這個縣的景點後再量一次高度，定位才扣得準
    await nextTick()
    measureInsets()
    framedArea = null
    bounds.value = prefFrame(pref, spots)
  },
  { immediate: true },
)

// 選取景點：讀詳細資料（別縣的點由下面的檢查換到它的縣，UX-FLOW.md §5.3）。
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

/** 地圖上的景點在哪個縣（已載入的縣 bundle 或全國總覽裡找） */
function prefOfMapSpot(id: string): string | undefined {
  return available.value.find((p) => (catalog.mapSpots[p] ?? catalog.featured[p])?.some((s) => s.id === id))
}

// 選到的點和網址的縣要一致：連結（/map/別縣?spot=、/?spot=）或任何沒換縣就打開別縣景點的路徑，
// 詳細資料到了發現不是這個縣時換到它的縣（replace，不多一筆歷史）。每個選取只檢查一次。
// 專心模式的地圖只畫這個縣的點，別縣的點只會從搜尋、連結、景點卡片的「附近」來
let prefCheckedFor: string | null = null
watch(
  () => {
    const id = selectedId.value
    if (!id) return null
    if (selectedPack.value) return [id, selectedPack.value.item.p] as const
    return selectedSpot.value?.id === id ? ([id, selectedSpot.value.prefecture] as const) : null
  },
  (hit) => {
    if (!hit) {
      if (!selectedId.value) prefCheckedFor = null
      return
    }
    const [id, pref] = hit
    if (prefCheckedFor === id) return
    prefCheckedFor = id
    if (pref === props.pref || !regionOf(pref)) return
    const pk = selectedPack.value?.item
    if (pk) flyAfterLoadPoint = { lng: pk.lng, lat: pk.lat }
    else flyAfterLoad = id
    void router.replace({ path: `/map/${pref}`, query: crossPref(route.query) })
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
  // 別縣（含首頁全國）的點：和搜尋一樣進入那個縣（地圖、地區色、清單都換到該縣；點出來的換縣有墨水暈開）
  const pref = item?.p ?? prefOfMapSpot(id)
  if (pref && pref !== props.pref && regionOf(pref)) {
    if (item) flyAfterLoadPoint = { lng: item.lng, lat: item.lat }
    else flyAfterLoad = id
    await router.push({ path: `/map/${pref}`, query: { ...crossPref(route.query), spot: target, ...(pack ? { pack } : {}) } })
    return
  }
  // 選了景點就收起地點標記、車站卡片
  const { at: _at, label: _label, station: _station, ...rest } = route.query
  const query = { ...rest, spot: target, ...(pack ? { pack } : {}) }
  // 手機從「沒有選取」打開卡片時新增一筆歷史，返回手勢先關卡片；之後換景點仍用 replace
  if (!cardOpen.value && !desktop.value) await router.push({ query })
  else await router.replace({ query })
  const s = item ?? allSpots.value.find((x) => x.id === id)
  // 縮放 15：群集全部散開（clusterMaxZoom 14），看得出選到的是哪一個點
  if (s) await flyToVisible(s.lng, s.lat, 15)
}

/**
 * 點了車站（UX-FLOW.md B5）：縣地圖上的站打開車站卡片（和景點卡片同一個位置，開著景點卡片時換掉）；
 * 全國地圖的新幹線站進入那個縣再打開（縣的 watcher 飛過去）
 */
async function selectStation(id: string, pref: string | null) {
  const target = pref && regionOf(pref) ? pref : props.pref
  if (!target || !regionOf(target)) return
  if (target !== props.pref) {
    await router.push({ path: `/map/${target}`, query: { station: id } })
    return
  }
  const { spot: _spot, at: _at, label: _label, ...rest } = route.query
  const query = { ...rest, station: id }
  if (!cardOpen.value && !desktop.value) await router.push({ query })
  else await router.replace({ query })
  // 和選景點一樣飛過去（從景點卡片的「最寄駅」來的時候地圖可能還拉得很遠）；已經比 14 近就不改縮放
  const st = stationInfo(railBundle.value, id)
  if (st) await flyToVisible(st.lng, st.lat, 14)
}
// 手機的車站卡片依內容高度：高度量到（或變了）之後，車站被卡片蓋住就平移到剩下的地圖中間
watch(
  () => (stationId.value && !desktop.value ? insets.value.bottom : null),
  (h) => {
    if (h) revealSelected()
  },
)
// 網址的車站在這個縣的鐵路 bundle 裡找不到（舊連結）：關閉
watch(
  () => [stationId.value, railBundle.value] as const,
  ([id, rail]) => {
    if (id && rail && !stationInfo(rail, id)) closeSpot()
  },
)

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

// 「‹ 祭典」：從深度探索的「在地圖上看」來的就用返回，回到原本那張祭典卡（月份、展開狀態都在那一筆歷史）；
// 直接打開這個網址時才連到祭典段落
function backToFestival(e: MouseEvent) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  const back = (window.history.state as { back?: unknown } | null)?.back
  if (typeof back === 'string' && props.pref && router.resolve(back).path === `/region/${props.pref}`) router.back()
  else void router.push(`/region/${props.pref}#festivals`)
}

/** 關閉卡片（景點、擴充包的點、車站） */
function closeSpot() {
  const q = { ...route.query }
  delete q.spot
  delete q.station
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
// 取樣格點（每邊）判斷畫面涵蓋哪些縣
const SAMPLE = 7

/**
 * 首頁（全國）的畫面對應的地區：中心所在的縣。畫面涵蓋太多縣、中心縣又只佔一小部分時不指定。
 * 回傳 undefined 表示判斷不出來（例如全是海），維持原狀。
 */
function regionForView(view: MapViewState): string | null | undefined {
  // 拉遠到看得到整個日本以上不指定地區（取樣點可能全落在海上，要先判斷）
  if (view.zoom < MIN_REGION_ZOOM) return null
  return regionForCenter(view)
}

/** 縣頁關掉「只看○○」時：跟著畫面中心的縣換；中心在海上維持原狀，拉遠到看得到整個日本才回全國 */
function regionWhileRoaming(view: MapViewState): string | null | undefined {
  if (view.zoom < MIN_REGION_ZOOM) return null
  const main = prefectureAt(view.center.lng, view.center.lat)
  return main && regionOf(main) ? main : undefined
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

// 使用者平移、縮放後：拉遠時關閉景點卡片。首頁（全國）放大到某個縣時，地區標籤、地區色、URL 跟著換到那個縣
// （replace，不新增歷史）；進入縣之後是專心模式，地圖鎖在這個縣（MapView 的 focus），拖曳、縮放不換縣。
function onMoveEnd(view: MapViewState) {
  if (!view.user) return
  japanFit = false
  if (focusPref.value) {
    if (cardOpen.value && view.zoom < CLOSE_SPOT_ZOOM) closeSpot()
    return
  }
  const target = props.pref ? regionWhileRoaming(view) : regionForView(view)
  const switching = target !== undefined && target !== (props.pref ?? null)
  if (!props.pref && !switching) lastNational = view.bounds
  // 換縣時下面的 replace 一併拿掉 spot；不換縣才另外關卡片（closeSpot 可能是返回，不能和 replace 同時發）
  if (selectedId.value && view.zoom < CLOSE_SPOT_ZOOM && !switching) closeSpot()
  if (!switching) return
  // 區、車站、祭典位置屬於原本的縣，換縣時不帶過去
  const query = { ...crossPref(route.query) }
  if (view.zoom < CLOSE_SPOT_ZOOM) delete query.spot
  panSwitch = true
  router.replace({ path: target ? `/map/${target}` : '/', query })
  if (target) catalog.loadMap(target).catch(() => {})
}
</script>

<template>
  <div ref="root" class="relative flex min-h-0 flex-1 max-lg:flex-col">
    <!-- 手機：頂部海報條。左「‹ 全國」、中間縣名（不能點）、右「深度探索 ›」，分隔線和桌機的地區標籤相同（DESIGN.md §7.5） -->
    <div
      v-if="pref && regionOf(pref)"
      ref="poster"
      class="-mr-[env(safe-area-inset-right)] -ml-[env(safe-area-inset-left)] flex h-[56px] shrink-0 items-center gap-2 bg-region land:h-12 pr-[calc(0.5rem+env(safe-area-inset-right))] pl-[calc(0.25rem+env(safe-area-inset-left))] text-on-region lg:hidden"
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
        class="flex min-h-tap shrink-0 items-center gap-0.5 rounded-control pr-1.5 pl-2.5 text-body-sm font-bold whitespace-nowrap text-on-region no-underline hover:bg-region-accent active:not-disabled:translate-y-px"
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
        :fit-pad="!desktop && (!pref || fitMaxZoom) ? 16 : undefined"
        :locator-edge="desktop || side ? null : insets.bottom ? { bottom: insets.bottom } : { top: insets.top }"
        :controls-lift="pinCard || (selectedId && spotSheet && snap === 'peek') ? insets.bottom : 0"
        :pack="packMap"
        :outline="outline"
        :focus="focus"
        :pin="pin"
        :rail="railMap"
        :station-id="stationId"
        :shinkansen="shinkansenMap"
        :areas="prefHere ? areas : null"
        :area="areaCode"
        :fit-max-zoom="fitMaxZoom"
        :marked="markedOnMap"
        @select="select"
        @station="selectStation"
        @area="pickArea"
        @close-pin="closePin"
        @moveend="onMoveEnd"
      />

      <!-- 地圖上方、左側面板旁：只看收藏（登入且有收藏時）＋擴充包列，靠左排（桌機；手機版面暫緩） -->
      <div
        class="pointer-events-none absolute top-4 right-4 z-10 flex flex-wrap items-start gap-2 *:pointer-events-auto max-lg:hidden"
        :style="{ left: `${insetLeft}px` }"
      >
        <button
          v-if="pref && regionOf(pref)"
          type="button"
          class="flex shrink-0 rounded-full active:not-disabled:translate-y-px"
          :aria-pressed="explore.focusLock"
          @click="explore.focusLock = !explore.focusLock"
        >
          <FocusChip :pref="pref" pill="flex h-9 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-bold shadow-float pointer-coarse:h-tap" />
        </button>
        <button
          v-if="userStore.user && marks.favorites.length"
          type="button"
          class="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-body-sm font-bold shadow-float active:not-disabled:translate-y-px pointer-coarse:h-tap"
          :class="explore.onlyFavorites ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-surface'"
          :aria-pressed="explore.onlyFavorites"
          @click="explore.onlyFavorites = !explore.onlyFavorites"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" :fill="explore.onlyFavorites ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
          </svg>
          收藏<RollingNumber :value="marks.favorites.length" class="font-num" />
        </button>
        <PackBar :pref="pref && regionOf(pref) ? pref : null" />
      </div>

      <!-- 左上浮動面板：地區標籤／地區清單、主題篩選、景點與地區特色。
           手機打橫（高 ≤500）：和桌機一樣是左側 300px 的欄，清單填滿欄高，地圖扣掉左側（決定事項 N2） -->
      <div
        ref="panel"
        class="pointer-events-none absolute top-4 bottom-4 left-4 z-10 flex w-float flex-col gap-2.5 *:pointer-events-auto max-lg:right-4 max-lg:bottom-auto max-lg:w-auto land:right-auto land:bottom-4 land:w-float"
      >
        <!-- 手機：chip 軌道（收藏、擴充包、設定；桌機在地圖上方的擴充包列）。軌道不吃點擊，空白處照樣拖得動地圖 -->
        <ChipRail v-if="!desktop" v-show="railShown" :pref="pref && regionOf(pref) ? pref : null" class="pointer-events-none! shrink-0" />
        <!-- 手機：這個縣有期間限定時，軌道下面一行連到深度探索的期間限定（清單收起時一起收） -->
        <RouterLink
          v-if="!desktop && pref && regionOf(pref) && timedHere.length && !explore.pack"
          v-show="listShown"
          :to="`/region/${pref}#timed`"
          class="flex min-h-tap shrink-0 items-center gap-2 rounded-card bg-region-tint pr-2.5 pl-3.5 text-ink no-underline shadow-float active:not-disabled:translate-y-px"
        >
          <span class="shrink-0 text-body-sm font-bold">期間限定</span>
          <span class="shrink-0 font-num text-body-sm text-sub">{{ timedHere.length }}</span>
          <span lang="ja" class="min-w-0 truncate text-body-sm">{{ timedHere[0]!.title.ja }}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto shrink-0 text-sub" aria-hidden="true">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </RouterLink>
        <RegionTag v-if="pref && regionOf(pref)" :pref="pref" class="max-lg:hidden" />
        <template v-if="pref && regionOf(pref)">
          <section v-if="timedHere.length && !explore.pack" class="shrink-0 rounded-card bg-paper px-3.5 pt-2.5 pb-2 shadow-float max-lg:hidden" aria-labelledby="timed-here">
            <h2 id="timed-here" class="flex items-baseline gap-1.5 text-body-sm font-bold">
              期間限定<span class="font-num font-normal text-sub">{{ timedHere.length }}</span>
              <RouterLink v-if="timedHere.length > 3" :to="`/region/${pref}#timed`" class="ml-auto text-caption font-normal text-sub active:text-ink">全部</RouterLink>
            </h2>
            <TimedList :items="timedHere.slice(0, 3)" />
          </section>
          <!-- 擴充包開著時清單換成擴充包清單；手機在上方 40dvh，打開景點卡片或地點標記時收起。
               收起用 v-show：關掉卡片時不重建幾百列，捲動位置也留著 -->
          <PackList
            v-if="explore.pack"
            v-show="listShown"
            :pref="pref"
            :selected-id="selectedId"
            class="max-lg:max-h-[40dvh] land:max-h-none"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          <RegionLists
            v-else
            v-show="listShown"
            :pref="pref"
            :spots="prefSpots"
            :state="catalog.mapState(pref)"
            :selected-id="selectedId"
            :areas="areaOptions"
            :area="areaCode"
            class="max-lg:max-h-[40dvh] land:max-h-none"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
            @area="pickArea"
          />
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
        <template v-else>
          <PackList
            v-if="explore.pack"
            v-show="listShown"
            :selected-id="selectedId"
            class="max-lg:max-h-[40dvh] land:max-h-none"
            @select="select"
            @highlight="(id) => mapRef?.highlight(id)"
          />
          <HomeSidebar v-else v-show="listShown" :available="available" class="max-lg:max-h-[42dvh] land:max-h-none" />
        </template>
      </div>

      <!-- 手機：深度探索「地圖」打開的祭典地點，下方一張小卡（清單收起）：回到祭典、關閉 -->
      <div
        v-if="pin && !cardOpen && pref && regionOf(pref)"
        ref="pinCard"
        class="absolute inset-x-4 bottom-4 z-10 flex items-center gap-1 rounded-card bg-paper p-1 text-ink shadow-float lg:hidden land:right-auto land:w-float"
      >
        <RouterLink v-slot="{ href }" :to="`/region/${pref}#festivals`" custom>
          <a
            :href="href"
            class="flex min-h-tap shrink-0 items-center gap-0.5 rounded-control pr-2.5 pl-1.5 text-body-sm font-bold text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px"
            @click="backToFestival"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            祭典
          </a>
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
    <!-- 手機打橫：卡片是左側欄，從左邊滑進來 -->
    <Transition :name="side ? 'side' : 'sheet'" @after-enter="sheetEntering = false" @enter-cancelled="sheetEntering = false" @after-leave="dragH = null">
      <!-- 擴充包的點內容短：手機的卡片依內容高度，最高 60dvh（PackPanel 自己捲動）。
           手機打橫時 60dvh 比地圖區還高：再限制在海報條以下、上面留 2.5rem 地圖 -->
      <aside
        v-if="cardOpen"
        ref="sheet"
        :data-reduce="desktop ? undefined : 'fade'"
        class="shrink-0 border-line"
        :class="[
          side
            ? 'absolute left-4 z-20 w-float overflow-hidden rounded-card shadow-float'
            : 'lg:w-panel lg:border-l max-lg:absolute max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:overflow-hidden max-lg:rounded-t-sheet max-lg:shadow-sheet',
          sheetHeight,
        ]"
        :style="side ? sideStyle : sheetStyle"
        @pointerdown="onSheetDown"
        @pointermove="onSheetMove"
        @pointerup="onSheetUp"
        @pointercancel="onSheetUp"
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
          <StationPanel
            v-else-if="shownStation && pref"
            :station="shownStation.info"
            :nearby="shownStation.nearby"
            :pref="pref"
            @close="closeSpot"
            @select="select"
          />
          <SpotPanel
            v-else
            :spot="shownSpot"
            :loading="loadingSpot"
            :nearby="nearby"
            :station-id="spotStation"
            :castle="castleOfSpot"
            :snap="spotSheet ? snap : side ? 'full' : undefined"
            :no-handle="side"
            @close="closeSpot"
            @select-pack="select"
            @station="(id: string) => selectStation(id, null)"
            @snap-step="onSnapStep"
            @head-height="headPx = $event"
          />
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
/* 手機的景點卡片（DESIGN.md §9）：升上來 0.32s、往下收 0.2s；開到一半又關會直接反轉。
   換段（收合、半開、全開）時高度 0.28s；拖曳中跟著手指，不加 transition */
@media (max-width: 1023.98px) {
  .side-enter-active {
    transition: transform 0.32s var(--ease-out-soft);
  }
  .side-leave-active {
    transition: transform 0.2s var(--ease-out-soft);
  }
  .side-enter-from,
  .side-leave-to {
    transform: translateX(calc(-100% - 1rem));
  }
  .sheet-snap {
    transition: height 0.28s var(--ease-out-soft);
  }
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
  .sheet-snap {
    transition: none;
  }
  .sheet-enter-active,
  .side-enter-active {
    transition: none;
  }
  .sheet-leave-active,
  .side-leave-active {
    transition: opacity 0.2s ease;
  }
  .sheet-enter-from,
  .sheet-leave-to,
  .side-enter-from,
  .side-leave-to {
    transform: none;
    opacity: 0;
  }
}
</style>
