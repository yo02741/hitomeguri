<script setup lang="ts">
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import type * as GeoJSON from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { JAPAN_CENTER, JAPAN_ZOOM, MAP_STYLE_URL } from '../map/style'
import { THEMES } from '../data/themes'
import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { splashCovering, trackSplash } from '../services/splash'
import { theme } from '../services/theme'
import { wide } from '../services/viewport'
import { DEM_SOURCE, GSI_ATTRIBUTION, GSI_DEM_URL, registerGsiDem, setTerrainPreferred, terrainPreferred } from '../map/terrain'
import JapanLocator from './JapanLocator.vue'

const props = defineProps<{
  spots: MapSpot[]
  selectedId?: string | null
  /** 變更時地圖移到這個範圍 [west, south, east, north] */
  bounds?: [number, number, number, number] | null
  /** 地區色改變時換一個值，讓地圖重新讀取 CSS 變數 */
  colorKey?: string | null
  /** 左側被浮動面板蓋住的寬度（px）：定位與「目前看的範圍」都扣掉這一塊 */
  insetLeft?: number
  /** 上方被清單卡、下方被景點卡片蓋住的高度（px，手機）：定位與「目前看的範圍」也扣掉 */
  insets?: { top: number; bottom: number } | null
  /** 下方的控制項（縮放、出處）往上移的高度（px）：手機的祭典小卡不蓋住縮放鈕 */
  controlsLift?: number
  /** 目前地區的縣界：虛線外框＋淡淡的地區色，看出縣的範圍 */
  outline?: GeoJSON.Feature | null
  /** 開啟中的擴充包：用主題色畫在最上層，景點變淡當底圖 */
  pack?: { color: string; points: PackPoint[] } | null
  /** 不是景點的地點（深度探索的祭典）：一個帶名稱的標記 */
  pin?: { lng: number; lat: number; label: string } | null
  /** 鐵路圖層：路線（官方路線色）與車站；null 為關閉 */
  rail?: { lines: GeoJSON.FeatureCollection; stations: GeoJSON.FeatureCollection } | null
  /** 使用者的收藏、去過（景點 id → 狀態）：收藏畫外圈，去過在右上疊印章色小圓點 */
  marked?: Record<string, { favorite?: boolean; visited?: boolean }> | null
  /** 行程某一天的順序連線（依停留點順序的座標） */
  route?: [number, number][] | null
  /** 不顯示「立體」切換（紀錄頁的小地圖） */
  noTerrain?: boolean
}>()

export interface PackPoint {
  id: string
  n: string
  lat: number
  lng: number
}

export interface MapView {
  /** 可見範圍（扣掉 insetLeft、insets）的中心 */
  center: { lng: number; lat: number }
  /** 可見範圍 [west, south, east, north] */
  bounds: [number, number, number, number]
  zoom: number
  /** 使用者操作（拖曳、縮放、點群集）造成的移動；程式定位為 false */
  user: boolean
}

const emit = defineEmits<{
  select: [id: string]
  moveend: [view: MapView]
  'close-pin': []
}>()

const container = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let ready = false

const SOURCE = 'spots'
const PACK_SOURCE = 'pack'
// 選取中的景點另外放一個不群集的來源：不會被併進群集數字裡而看不見
const SELECTED_SOURCE = 'selected-spot'
const OUTLINE_SOURCE = 'outline'
const RAIL_SOURCE = 'rail'
const STATION_SOURCE = 'rail-stations'
const ROUTE_SOURCE = 'route'
const ROUTE_HEAD_SOURCE = 'route-head'
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function routeData(coords: [number, number][] | null | undefined): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features:
      coords && coords.length > 1
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }]
        : [],
  }
}

// 行程路線像用筆畫出來（DESIGN.md §9）：路線改變時從起點畫到終點，筆尖是一個圓點。「減少動態」時直接畫好。
const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
let routeFrame = 0
let drawnRoute = ''
function drawRoute(coords: [number, number][] | null | undefined) {
  if (!map) return
  const line = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined
  const head = map.getSource(ROUTE_HEAD_SOURCE) as GeoJSONSource | undefined
  if (!line || !head) return
  // 同一條路線（行程其他欄位更新）不重畫
  const sig = JSON.stringify(coords ?? null)
  if (sig === drawnRoute) return
  drawnRoute = sig
  cancelAnimationFrame(routeFrame)
  if (!coords || coords.length < 2 || reducedMotion) {
    line.setData(routeData(coords))
    head.setData(EMPTY)
    return
  }
  // 各段長度（經度依緯度縮放，近似實際距離）
  const cum = [0]
  for (let i = 1; i < coords.length; i++) {
    const [x1, y1] = coords[i - 1]!
    const [x2, y2] = coords[i]!
    const k = Math.cos((((y1 + y2) / 2) * Math.PI) / 180)
    cum.push(cum[i - 1]! + Math.hypot((x2 - x1) * k, y2 - y1))
  }
  const total = cum[cum.length - 1]!
  const duration = Math.min(2400, 800 + coords.length * 140)
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration)
    // 前後慢、中間快
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    const at = e * total
    let i = 1
    while (i < coords.length - 1 && cum[i]! < at) i++
    const seg = cum[i]! - cum[i - 1]!
    const f = seg ? (at - cum[i - 1]!) / seg : 1
    const [x1, y1] = coords[i - 1]!
    const [x2, y2] = coords[i]!
    const tip: [number, number] = [x1 + (x2 - x1) * f, y1 + (y2 - y1) * f]
    line.setData(routeData([...coords.slice(0, i), tip]))
    head.setData(
      t < 1 ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: tip } }] } : EMPTY,
    )
    if (t < 1) routeFrame = requestAnimationFrame(step)
    else line.setData(routeData(coords))
  }
  routeFrame = requestAnimationFrame(step)
}

function outlineData(f: GeoJSON.Feature | null | undefined): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: f ? [f] : [] }
}
// 開啟擴充包時景點的不透明度
const DIM = 0.3
// hover 命中半徑（px）：游標靠近就放大，不必精準對到小圓點
const HOVER_HIT = 14
// 沒被群集起來的景點，有照片就直接畫成圓形照片；hover 時再放大
const PHOTO_PIN = 48
const PHOTO_SIZE = 88
// 同時顯示的照片上限（分數高的優先）
const PHOTO_MAX = 80

interface Hover {
  id: string
  name: string
  lng: number
  lat: number
  x: number
  y: number
  thumb?: string
}
const hover = shallowRef<Hover | null>(null)
const failedThumbs = new Set<string>()

// 景點在可見範圍外（或被左上浮動面板蓋住）時，改在可見範圍邊緣畫一個指向它的箭頭
// 箭頭與名稱一起置中在這個內縮線上，留足空間不被裁掉
const EDGE_PAD = 52
interface Edge {
  x: number
  y: number
  angle: number
  side: 'left' | 'right' | 'top' | 'bottom'
}
// 地圖容器的大小（MapLibre 的 resize 時更新）：蓋住的範圍不能大到看不到地圖
const size = ref({ w: 0, h: 0 })
// 蓋住之後至少留下這麼高的地圖（px）
const MIN_VISIBLE = 96
/** 被浮動面板、清單卡、景點卡片蓋住的部分；上下加起來太高時等比例縮小 */
const cover = computed(() => {
  const { w, h } = size.value
  const left = Math.min(props.insetLeft ?? 0, w / 2)
  let top = Math.max(0, props.insets?.top ?? 0)
  let bottom = Math.max(0, props.insets?.bottom ?? 0)
  const room = Math.max(0, h - MIN_VISIBLE)
  if (top + bottom > room) {
    const k = room / (top + bottom)
    top = Math.round(top * k)
    bottom = Math.round(bottom * k)
  }
  return { left, top, bottom }
})
/** 鏡頭中心往可見範圍的中心偏移 */
const centerOffset = (): [number, number] => [cover.value.left / 2, (cover.value.top - cover.value.bottom) / 2]
const edge = computed<Edge | null>(() => {
  const h = hover.value
  const el = container.value
  if (!h || !el) return null
  const w = el.clientWidth
  const ht = el.clientHeight
  const c = cover.value
  if (h.x >= c.left && h.x <= w && h.y >= c.top && h.y <= ht - c.bottom) return null
  const left = c.left + EDGE_PAD
  const right = w - EDGE_PAD
  const top = c.top + EDGE_PAD
  const bottom = ht - c.bottom - EDGE_PAD
  const cx = (left + right) / 2
  const cy = (top + bottom) / 2
  const dx = h.x - cx
  const dy = h.y - cy
  const tx = dx ? ((dx > 0 ? right : left) - cx) / dx : Infinity
  const ty = dy ? ((dy > 0 ? bottom : top) - cy) / dy : Infinity
  const t = Math.min(tx, ty)
  const side = tx <= ty ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'bottom' : 'top'
  return { x: cx + dx * t, y: cy + dy * t, angle: (Math.atan2(dy, dx) * 180) / Math.PI, side }
})
// 名稱放在箭頭朝內的一側，避免被裁掉
const EDGE_FLEX: Record<Edge['side'], string> = {
  left: 'flex-row',
  right: 'flex-row-reverse',
  top: 'flex-col',
  bottom: 'flex-col-reverse',
}
const FONT_BOLD = ['Noto Sans Bold']
const FONT_REGULAR = ['Noto Sans Regular']

// 顏色一律取自目前的地區色 token（DESIGN.md §3.3），不寫死色碼。
function token(name: string): string {
  const el = document.getElementById('app-root') ?? document.documentElement
  const v = getComputedStyle(el).getPropertyValue(name).trim() || '#1D222C'
  return v.startsWith('#') ? v : toRgb(v)
}

// MapLibre 讀不懂 color-mix() 等寫法（「增加對比」的 --region-line 會變成 color-mix），
// 讀不懂時整條線變黑；先畫進 1×1 canvas 讀回 rgb 再交給地圖
let probe: CanvasRenderingContext2D | null = null
function toRgb(v: string): string {
  probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  if (!probe) return v
  probe.clearRect(0, 0, 1, 1)
  probe.fillStyle = '#000'
  probe.fillStyle = v
  probe.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round(((a ?? 255) / 255) * 1000) / 1000})`
}

function unselected(): MapSpot[] {
  return props.selectedId ? props.spots.filter((s) => s.id !== props.selectedId) : props.spots
}

function selectedSpots(): MapSpot[] {
  const s = props.selectedId ? props.spots.find((x) => x.id === props.selectedId) : undefined
  return s ? [s] : []
}

function syncSources() {
  if (!map) return
  ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(unselected()))
  ;(map.getSource(SELECTED_SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(selectedSpots()))
}

function toGeoJSON(spots: MapSpot[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: spots.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        n: s.n,
        // 大點（major）與主題景點樣式不同；照片、名稱標籤由分數高的優先
        m: s.k === 'major' ? 1 : 0,
        s: s.s ?? 0,
        // 顯示用主題：大點為空字串（墨色），主題景點取第一個主題（主題層暫停，map bundle 目前只有大點）
        th: s.k === 'major' ? '' : (s.t?.[0] ?? ''),
        i: s.i ?? '',
        fv: props.marked?.[s.id]?.favorite ? 1 : 0,
        vs: props.marked?.[s.id]?.visited ? 1 : 0,
      },
    })),
  }
}

function packGeoJSON(points: PackPoint[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, n: p.n, i: '' },
    })),
  }
}

/** 開啟擴充包時景點變淡、名稱標籤與照片收起 */
function applyDim() {
  if (!map || !ready) return
  const o = props.pack ? DIM : 1
  for (const layer of ['clusters', 'spots', 'spot-visited']) {
    map.setPaintProperty(layer, 'circle-opacity', o)
    map.setPaintProperty(layer, 'circle-stroke-opacity', o)
  }
  map.setPaintProperty('spot-fav', 'circle-stroke-opacity', o)
  map.setPaintProperty('cluster-count', 'text-opacity', o)
  map.setLayoutProperty('spot-labels', 'visibility', props.pack ? 'none' : 'visible')
  syncPhotos()
}

const baseWater = new Map<string, unknown>()
function applyColors() {
  if (!map || !ready) return
  const ink = token('--region-ink')
  const paper = token('--region-paper')
  const strong = token('--region-strong')
  const land = token('--region-map')
  map.setPaintProperty('clusters', 'circle-color', ink)
  map.setPaintProperty('clusters', 'circle-stroke-color', paper)
  map.setPaintProperty('cluster-count', 'text-color', paper)
  const themeColor: unknown[] = ['match', ['get', 'th']]
  for (const t of THEMES) themeColor.push(t.key, token(`--color-t-${t.key}`))
  themeColor.push(ink)
  const stroke = ['case', ['==', ['get', 'm'], 1], paper, themeColor] as unknown as maplibregl.ExpressionSpecification
  for (const layer of ['spots', 'hover']) {
    map.setPaintProperty(layer, 'circle-color', ['case', ['==', ['get', 'm'], 1], ink, paper])
    map.setPaintProperty(layer, 'circle-stroke-color', stroke)
  }
  map.setPaintProperty('spot-fav', 'circle-stroke-color', strong)
  map.setPaintProperty('spot-visited', 'circle-color', token('--color-visited'))
  map.setPaintProperty('spot-visited', 'circle-stroke-color', paper)
  map.setPaintProperty('spot-labels', 'text-color', ink)
  map.setPaintProperty('spot-labels', 'text-halo-color', paper)
  map.setPaintProperty('selected', 'circle-color', ink)
  map.setPaintProperty('selected', 'circle-stroke-color', strong)
  map.setPaintProperty('outline-fill', 'fill-color', token('--region-base'))
  const rail = token('--color-map-rail')
  map.setPaintProperty('rail-casing', 'line-color', paper)
  map.setPaintProperty('rail-line', 'line-color', ['coalesce', ['get', 'c'], rail])
  map.setPaintProperty('rail-labels', 'text-color', ink)
  map.setPaintProperty('rail-labels', 'text-halo-color', paper)
  map.setPaintProperty('rail-stations', 'circle-color', paper)
  map.setPaintProperty('rail-stations', 'circle-stroke-color', ink)
  map.setPaintProperty('rail-station-labels', 'text-color', ink)
  map.setPaintProperty('rail-station-labels', 'text-halo-color', paper)
  map.setPaintProperty('outline-line', 'line-color', strong)
  map.setPaintProperty('route-line', 'line-color', strong)
  map.setPaintProperty('route-head', 'circle-color', strong)
  if (map.getLayer('hillshade')) {
    map.setPaintProperty('hillshade', 'hillshade-shadow-color', ink)
    map.setPaintProperty('hillshade', 'hillshade-highlight-color', paper)
    map.setPaintProperty('hillshade', 'hillshade-accent-color', token('--region-sub'))
  }
  map.setPaintProperty('route-head', 'circle-stroke-color', paper)
  const packColor = token(`--color-t-${props.pack?.color ?? 'major'}`)
  map.setPaintProperty('pack-clusters', 'circle-color', packColor)
  map.setPaintProperty('pack-clusters', 'circle-stroke-color', paper)
  map.setPaintProperty('pack-count', 'text-color', paper)
  for (const layer of ['pack-points', 'pack-hover']) {
    map.setPaintProperty(layer, 'circle-color', packColor)
    map.setPaintProperty(layer, 'circle-stroke-color', paper)
  }
  map.setPaintProperty('pack-labels', 'text-color', ink)
  map.setPaintProperty('pack-labels', 'text-halo-color', paper)
  map.setPaintProperty('pack-selected', 'circle-color', packColor)
  map.setPaintProperty('pack-selected', 'circle-stroke-color', strong)
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', land)
    // 年代主題（DESIGN.md §13）：水面換成年代的顏色；切回令和時還原底圖原本的顏色
    if (layer.type === 'fill' && layer.id.startsWith('water')) {
      if (!baseWater.has(layer.id)) baseWater.set(layer.id, map.getPaintProperty(layer.id, 'fill-color'))
      map.setPaintProperty(layer.id, 'fill-color', theme.value !== 'modern' ? token('--color-map-water') : baseWater.get(layer.id))
    }
  }
}

function addLayers() {
  if (!map) return
  // 縣界畫在景點下面
  map.addSource(OUTLINE_SOURCE, { type: 'geojson', data: outlineData(props.outline) })
  map.addLayer({
    id: 'outline-fill',
    type: 'fill',
    source: OUTLINE_SOURCE,
    paint: { 'fill-opacity': 0.14 },
  })
  map.addLayer({
    id: 'outline-line',
    type: 'line',
    source: OUTLINE_SOURCE,
    layout: { 'line-join': 'round' },
    paint: {
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 10, 2.5],
      'line-dasharray': [2.5, 1.5],
      // 縣界是簡化過的線（約 400 m 精度），拉很近時和海岸線對不齊：淡出
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0.9, 13, 0.35],
    },
  })
  // 鐵路：縣界之上、景點之下。路線用資料裡的官方路線色，沒有就用地圖的鐵路色
  map.addSource(RAIL_SOURCE, { type: 'geojson', data: props.rail?.lines ?? EMPTY })
  map.addSource(STATION_SOURCE, { type: 'geojson', data: props.rail?.stations ?? EMPTY })
  map.addLayer({
    id: 'rail-casing',
    type: 'line',
    source: RAIL_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2.5, 12, 5, 16, 9] },
  })
  map.addLayer({
    id: 'rail-line',
    type: 'line',
    source: RAIL_SOURCE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 12, 3, 16, 6] },
  })
  map.addLayer({
    id: 'rail-labels',
    type: 'symbol',
    source: RAIL_SOURCE,
    minzoom: 12,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'n'],
      'text-font': FONT_REGULAR,
      'text-size': 11,
      'symbol-spacing': 320,
      'text-optional': true,
    },
    paint: { 'text-halo-width': 1.5 },
  })
  map.addLayer({
    id: 'rail-stations',
    type: 'circle',
    source: STATION_SOURCE,
    minzoom: 12,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5],
      'circle-stroke-width': 1.5,
    },
  })
  map.addLayer({
    id: 'rail-station-labels',
    type: 'symbol',
    source: STATION_SOURCE,
    minzoom: 13,
    layout: {
      'text-field': ['get', 'n'],
      'text-font': FONT_REGULAR,
      'text-size': 11,
      'text-offset': [0, 0.8],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-halo-width': 1.5 },
  })
  map.addSource(ROUTE_SOURCE, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: ROUTE_SOURCE,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-width': 3, 'line-dasharray': [1.5, 1.5] },
  })
  map.addSource(ROUTE_HEAD_SOURCE, { type: 'geojson', data: EMPTY })
  map.addLayer({
    id: 'route-head',
    type: 'circle',
    source: ROUTE_HEAD_SOURCE,
    paint: { 'circle-radius': 6, 'circle-stroke-width': 2.5 },
  })
  map.addSource(SOURCE, {
    type: 'geojson',
    data: toGeoJSON(unselected()),
    cluster: true,
    // 半徑略大於照片，未群集的照片彼此不太會重疊；縮放 15 以上全部散開
    clusterRadius: 50,
    clusterMaxZoom: 14,
  })
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 13, 20, 17, 80, 22],
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': FONT_BOLD,
      'text-size': 12,
    },
  })
  // 收藏：圓點外面一圈（地區強調色）
  map.addLayer({
    id: 'spot-fav',
    type: 'circle',
    source: SOURCE,
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'fv'], 1]],
    paint: { 'circle-radius': 10.5, 'circle-opacity': 0, 'circle-stroke-width': 2.5 },
  })
  map.addLayer({
    id: 'spots',
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 6,
      'circle-stroke-width': 2,
    },
  })
  // 去過：右上疊一個印章色小圓點（DESIGN.md §7.12）
  map.addLayer({
    id: 'spot-visited',
    type: 'circle',
    source: SOURCE,
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'vs'], 1]],
    paint: { 'circle-radius': 4, 'circle-translate': [6, -6], 'circle-stroke-width': 1.5 },
  })
  map.addLayer({
    id: 'spot-labels',
    type: 'symbol',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    minzoom: 10,
    layout: {
      // 標籤互相擋到時，分數高的留下
      'symbol-sort-key': ['-', 0, ['get', 's']],
      'text-field': ['get', 'n'],
      'text-font': FONT_REGULAR,
      'text-size': 12,
      // 有照片的景點，名稱放在照片下緣
      'text-offset': ['case', ['!=', ['get', 'i'], ''], ['literal', [0, 2.3]], ['literal', [0, 1.1]]],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-halo-width': 1.5 },
  })
  // 擴充包：獨立的來源與群集，畫在景點上面
  map.addSource(PACK_SOURCE, {
    type: 'geojson',
    data: packGeoJSON(props.pack?.points ?? []),
    cluster: true,
    clusterRadius: 40,
    clusterMaxZoom: 12,
  })
  map.addLayer({
    id: 'pack-clusters',
    type: 'circle',
    source: PACK_SOURCE,
    filter: ['has', 'point_count'],
    paint: {
      'circle-radius': ['step', ['get', 'point_count'], 11, 10, 14, 50, 18],
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'pack-count',
    type: 'symbol',
    source: PACK_SOURCE,
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': FONT_BOLD,
      'text-size': 11,
    },
  })
  map.addLayer({
    id: 'pack-points',
    type: 'circle',
    source: PACK_SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: { 'circle-radius': 6, 'circle-stroke-width': 2 },
  })
  map.addLayer({
    id: 'pack-labels',
    type: 'symbol',
    source: PACK_SOURCE,
    filter: ['!', ['has', 'point_count']],
    minzoom: 12,
    layout: {
      'text-field': ['get', 'n'],
      'text-font': FONT_REGULAR,
      'text-size': 12,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-halo-width': 1.5 },
  })
  map.addLayer({
    id: 'hover',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'id'], ''],
    paint: { 'circle-radius': 11, 'circle-stroke-width': 3 },
  })
  map.addSource(SELECTED_SOURCE, { type: 'geojson', data: toGeoJSON(selectedSpots()) })
  map.addLayer({
    id: 'selected',
    type: 'circle',
    source: SELECTED_SOURCE,
    paint: { 'circle-radius': 10, 'circle-stroke-width': 3 },
  })
  map.addLayer({
    id: 'pack-hover',
    type: 'circle',
    source: PACK_SOURCE,
    filter: ['==', ['get', 'id'], ''],
    paint: { 'circle-radius': 10, 'circle-stroke-width': 3 },
  })
  map.addLayer({
    id: 'pack-selected',
    type: 'circle',
    source: PACK_SOURCE,
    filter: ['==', ['get', 'id'], props.selectedId ?? ''],
    paint: { 'circle-radius': 10, 'circle-stroke-width': 3 },
  })

  // 點選：以 hover 中的景點為準（命中範圍比圓點大）
  // 觸控沒有 hover：直接找點擊位置附近的景點
  map.on('click', (e) => {
    const hit = hover.value ?? nearestSpot(e.point)
    if (hit) {
      emit('select', hit.id)
      return
    }
    const f = map?.queryRenderedFeatures(e.point, { layers: ['pack-clusters', 'clusters'] })[0]
    if (f) void expandCluster(f)
  })
  map.on('mousemove', (e) => updateHover(e.point))
  map.on('mouseout', () => setHover(null))
  map.on('move', positionHover)
  map.on('idle', syncPhotos)
  for (const layer of ['clusters', 'pack-clusters']) {
    map.on('mouseenter', layer, () => map && !hover.value && (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => map && !hover.value && (map.getCanvas().style.cursor = ''))
  }
}

async function expandCluster(f: maplibregl.MapGeoJSONFeature) {
  if (!map) return
  const src = map.getSource(f.source) as GeoJSONSource
  const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id as number)
  const center = (f.geometry as GeoJSON.Point).coordinates as [number, number]
  map.easeTo({ center, zoom, offset: centerOffset() }, { user: true })
}

function setHover(h: Hover | null) {
  if (!map) return
  const changed = hover.value?.id !== h?.id
  hover.value = h
  if (!changed) return
  map.setFilter('hover', ['==', ['get', 'id'], h?.id ?? ''])
  map.setFilter('pack-hover', ['==', ['get', 'id'], h?.id ?? ''])
  // hover 的名稱小標取代地圖上的同名標籤，避免重疊
  map.setFilter('spot-labels', ['all', ['!', ['has', 'point_count']], ['!=', ['get', 'id'], h?.id ?? '']])
  map.getCanvas().style.cursor = h ? 'pointer' : ''
}

function updateHover(pt: { x: number; y: number }) {
  if (!map) return
  // 照片圓圈比較大：游標還在圓圈裡就維持，不因離開原本的點而閃掉
  const cur = hover.value
  const keep = cur?.thumb ? PHOTO_SIZE / 2 : HOVER_HIT
  if (cur && Math.hypot(cur.x - pt.x, cur.y - pt.y) <= keep) return
  setHover(nearestSpot(pt))
}

/** 游標／點擊位置附近最近的景點；照片模式下整張圓形照片都算命中 */
function nearestSpot(pt: { x: number; y: number }): Hover | null {
  if (!map) return null
  const r = Math.max(HOVER_HIT, PHOTO_PIN / 2)
  const feats = map.queryRenderedFeatures(
    [
      [pt.x - r, pt.y - r],
      [pt.x + r, pt.y + r],
    ],
    // 開啟擴充包時只有擴充包的點可以選，變淡的景點只當底圖
    { layers: props.pack ? ['pack-points'] : ['spots', 'selected'] },
  )
  let best: Hover | null = null
  let bestD = Infinity
  for (const f of feats) {
    const fp = f.properties as { id: string; n: string; i?: string }
    const [lng, lat] = coordsOf(fp.id) ?? ((f.geometry as GeoJSON.Point).coordinates as [number, number])
    const p = map.project([lng, lat])
    const d = Math.hypot(p.x - pt.x, p.y - pt.y)
    const reach = photoPins.has(fp.id) ? PHOTO_PIN / 2 : HOVER_HIT
    if (d > reach || d >= bestD) continue
    bestD = d
    best = { id: fp.id, name: fp.n, lng, lat, x: p.x, y: p.y, thumb: fp.i || undefined }
  }
  return best
}

// 選取中的景點：外圈一圈。大小跟著照片或圓點
let pulse: maplibregl.Marker | null = null

function selectedPoint(): { lng: number; lat: number } | undefined {
  const id = props.selectedId
  if (!id) return undefined
  return props.spots.find((s) => s.id === id) ?? props.pack?.points.find((p) => p.id === id)
}

function syncPulse() {
  if (!map) return
  const p = selectedPoint()
  if (!p) {
    pulse?.remove()
    pulse = null
    return
  }
  const size = props.selectedId && photoPins.has(props.selectedId) ? PHOTO_PIN : 22
  if (!pulse) {
    const el = document.createElement('div')
    el.className = 'pointer-events-none relative'
    el.setAttribute('aria-hidden', 'true')
    // 固定的外圈（原本往外擴散淡出的光圈依使用者回饋拿掉）
    const halo = document.createElement('span')
    halo.className = 'absolute -inset-[5px] rounded-full border-[2.5px] border-region-strong'
    el.append(halo)
    pulse = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
  }
  const el = pulse.getElement()
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  pulse.setLngLat([p.lng, p.lat])
}

// 地點標記（祭典等不是景點的位置）：地區色圓點＋呼吸燈＋名稱與關閉鈕
let pinMarker: maplibregl.Marker | null = null

function syncPin() {
  if (!map) return
  pinMarker?.remove()
  pinMarker = null
  const p = props.pin
  if (!p) return
  const el = document.createElement('div')
  el.className = 'flex flex-col items-center'
  const chip = document.createElement('div')
  chip.className =
    'mb-1.5 flex items-center gap-1 rounded-full bg-paper py-1 pr-1 pl-3 text-label font-bold text-ink shadow-float'
  const name = document.createElement('span')
  name.lang = 'ja'
  name.textContent = p.label
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'grid size-6 place-items-center rounded-full text-sub hover:bg-surface hover:text-ink'
  close.setAttribute('aria-label', '關閉標記')
  close.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  close.addEventListener('click', (e) => {
    e.stopPropagation()
    emit('close-pin')
  })
  chip.append(name, close)
  const dot = document.createElement('div')
  dot.className = 'relative size-4'
  const core = document.createElement('span')
  core.className = 'absolute inset-0 rounded-full border-2 border-paper bg-region-strong'
  const ring = document.createElement('span')
  ring.className =
    'absolute inset-0 rounded-full border-[3px] border-region-strong bg-region-strong/25 animate-pulse-ring motion-reduce:hidden'
  dot.append(ring, core)
  el.append(chip, dot)
  // 錨點在圓點中心：整個元素往上移（名稱在上方）
  pinMarker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, 8] })
    .setLngLat([p.lng, p.lat])
    .addTo(map)
}

// 照片模式：畫面內有照片的景點各放一個圓形照片 marker（不接收滑鼠事件，點擊仍走地圖）
const photoPins = new Map<string, maplibregl.Marker>()

/** 景點的座標：queryRenderedFeatures 回傳的幾何是圖磚座標換算的，可能偏掉；一律用資料的 */
function coordsOf(id: string): [number, number] | undefined {
  const s = props.spots.find((x) => x.id === id) ?? props.pack?.points.find((p) => p.id === id)
  return s ? [s.lng, s.lat] : undefined
}

function syncPhotos() {
  if (!map) return
  const want = new Map<string, { lng: number; lat: number; thumb: string; s: number }>()
  // 開啟擴充包時照片收起，只留選取中的景點（名城對到的景點要看得到照片）
  for (const f of map.queryRenderedFeatures({ layers: props.pack ? ['selected'] : ['spots', 'selected'] })) {
    const fp = f.properties as { id: string; i?: string; s: number }
    if (!fp.i || failedThumbs.has(fp.i) || want.has(fp.id)) continue
    const [lng, lat] = coordsOf(fp.id) ?? ((f.geometry as GeoJSON.Point).coordinates as [number, number])
    want.set(fp.id, { lng, lat, thumb: fp.i, s: fp.s })
  }
  const keep = new Set(
    [...want.entries()]
      .sort((a, b) => b[1].s - a[1].s)
      .slice(0, PHOTO_MAX)
      .map(([id]) => id),
  )
  for (const [id, m] of photoPins) {
    if (!keep.has(id)) {
      m.remove()
      photoPins.delete(id)
    }
  }
  for (const id of keep) {
    if (photoPins.has(id)) continue
    const w = want.get(id)!
    photoPins.set(id, new maplibregl.Marker({ element: photoEl(id, w.thumb, w.s) }).setLngLat([w.lng, w.lat]).addTo(map))
  }
  // 照片出現或消失時，選取外圈的大小跟著換
  syncPulse()
}

function photoEl(id: string, thumb: string, score: number): HTMLElement {
  const el = document.createElement('div')
  el.className = `map-photo pointer-events-none relative rounded-full border-[3px] bg-placeholder shadow-float ${
    id === props.selectedId ? 'border-region-strong' : 'border-paper'
  }`
  el.style.width = `${PHOTO_PIN}px`
  el.style.height = `${PHOTO_PIN}px`
  // 照片重疊時分數高的在上
  el.style.zIndex = String(Math.max(1, Math.round(score)))
  el.dataset.id = id
  const img = document.createElement('img')
  img.src = mapThumbUrl(thumb)
  img.alt = ''
  img.referrerPolicy = 'no-referrer'
  img.decoding = 'async'
  img.className = 'size-full rounded-full object-cover'
  img.onerror = () => {
    failedThumbs.add(thumb)
    photoPins.get(id)?.remove()
    photoPins.delete(id)
  }
  el.append(img)
  decoratePhoto(el, id)
  return el
}

// 照片 marker 上的收藏、去過記號：收藏左上星形、去過右上印章色小圓點
const STAR =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-1z"/></svg>'
function decoratePhoto(el: HTMLElement, id: string) {
  el.querySelectorAll('[data-badge]').forEach((b) => b.remove())
  const m = props.marked?.[id]
  if (m?.favorite) {
    const fav = document.createElement('span')
    fav.dataset.badge = 'fav'
    fav.className = 'absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full bg-paper text-region-strong shadow-marker'
    fav.innerHTML = STAR
    el.append(fav)
  }
  if (m?.visited) {
    const vis = document.createElement('span')
    vis.dataset.badge = 'visited'
    vis.className = 'absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-paper bg-visited'
    el.append(vis)
  }
}

function positionHover() {
  const h = hover.value
  if (!map || !h) return
  const p = map.project([h.lng, h.lat])
  hover.value = { ...h, x: p.x, y: p.y }
}

function thumbFailed(h: Hover) {
  if (h.thumb) failedThumbs.add(h.thumb)
  hover.value = { ...h, thumb: undefined }
}

// 立體地形（DESIGN.md §8，map/terrain.ts）：国土地理院の標高タイル＋陰影。鏡頭的傾斜照舊用右鍵拖曳（手機兩指上下拖），
// 這裡不改；正上方看時靠陰影看出起伏。偏好存在這台裝置。
// 手機不放「立體」：鈕太多、地形也吃效能
const terrainOn = ref(!props.noTerrain && wide.value && terrainPreferred())
function applyTerrain() {
  if (!map || !ready) return
  const on = terrainOn.value && !props.noTerrain
  if (on) {
    registerGsiDem()
    if (!map.getSource(DEM_SOURCE)) {
      map.addSource(DEM_SOURCE, {
        type: 'raster-dem',
        tiles: [GSI_DEM_URL.replace('https://', 'gsidem://')],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
        attribution: GSI_ATTRIBUTION,
      })
      // 陰影畫在縣界之上、鐵路與景點之下
      map.addLayer(
        {
          id: 'hillshade',
          type: 'hillshade',
          source: DEM_SOURCE,
          paint: {
            'hillshade-exaggeration': 0.7,
            'hillshade-shadow-color': token('--region-ink'),
            'hillshade-highlight-color': token('--region-paper'),
            'hillshade-accent-color': token('--region-sub'),
          },
        },
        'rail-casing',
      )
    }
    map.setLayoutProperty('hillshade', 'visibility', 'visible')
    map.setTerrain({ source: DEM_SOURCE, exaggeration: 1.5 })
  } else {
    if (map.getLayer('hillshade')) map.setLayoutProperty('hillshade', 'visibility', 'none')
    map.setTerrain(null)
  }
}
function toggleTerrain() {
  terrainOn.value = !terrainOn.value
  setTerrainPreferred(terrainOn.value)
  applyTerrain()
}
// 「立體」鈕放進 MapLibre 右下角的控制列（縮放鈕上面）：位置跟著 attribution 展開與縮放鈕走，不會疊在一起
const terrainHost = shallowRef<HTMLElement | null>(null)
class TerrainControl implements maplibregl.IControl {
  el = document.createElement('div')
  onAdd() {
    this.el.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    terrainHost.value = this.el
    return this.el
  }
  onRemove() {
    this.el.remove()
    terrainHost.value = null
  }
}

// 角落的日本全圖（JapanLocator）：放大到看不出在哪裡時才出現；移動中每一格畫面更新一次
const LOCATOR_ZOOM = 6.5
const locator = shallowRef<{ bounds: [number, number, number, number]; zoom: number } | null>(null)
let locatorFrame = 0
function updateLocator() {
  if (locatorFrame) return
  locatorFrame = requestAnimationFrame(() => {
    locatorFrame = 0
    const v = visibleView(false)
    locator.value = v ? { bounds: v.bounds, zoom: v.zoom } : null
  })
}

/** 可見範圍：扣掉左側被浮動面板、上下被清單卡與景點卡片蓋住的部分 */
function visibleView(user: boolean): MapView | null {
  if (!map) return null
  const canvas = map.getCanvas()
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const { left, top, bottom } = cover.value
  const nw = map.unproject([left, top])
  const se = map.unproject([w, h - bottom])
  const c = map.unproject([(left + w) / 2, (top + h - bottom) / 2])
  return {
    center: { lng: c.lng, lat: c.lat },
    bounds: [nw.lng, se.lat, se.lng, nw.lat],
    zoom: map.getZoom(),
    user,
  }
}

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    style: MAP_STYLE_URL,
    center: JAPAN_CENTER,
    zoom: JAPAN_ZOOM,
    // 底圖圖磚只到 14 級，再放大就只是放大；17 級已看得到建物。放太大時立體地形上的照片與圓點也會錯開
    maxZoom: 17,
    attributionControl: {
      compact: true,
      customAttribution: '景點資料 © OpenStreetMap contributors・Wikidata・Wikimedia Commons・維基百科（CC BY-SA 4.0）',
    },
  })
  // 手機：出處一開始只留 ⓘ，點了才展開（MapLibre 的 compact 一開始是展開的，會蓋住小地圖的下緣）
  if (!wide.value) collapseAttribution()
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
  // 下方角落後加的排在上面：立體、縮放、attribution
  if (!props.noTerrain && wide.value) map.addControl(new TerrainControl(), 'bottom-right')
  // 開場畫面等到底圖第一次畫完（樣式或圖磚失敗也放行）
  const m = map
  trackSplash(
    new Promise<void>((resolve) => {
      m.once('idle', () => resolve())
      m.once('error', () => resolve())
    }),
    'map',
  )
  map.on('load', () => {
    if (!wide.value) collapseAttribution()
    addLayers()
    ready = true
    applyColors()
    applyDim()
    syncPin()
    if (props.bounds) fit(props.bounds, false)
    drawRoute(props.route)
    applyTerrain()
  })
  const syncSize = () => {
    const el = container.value
    if (el) size.value = { w: el.clientWidth, h: el.clientHeight }
  }
  syncSize()
  map.on('resize', syncSize)
  map.on('move', updateLocator)
  map.on('moveend', (e: { originalEvent?: Event; user?: boolean }) => {
    const view = visibleView(Boolean(e.originalEvent || e.user))
    if (view) emit('moveend', view)
  })
})

/** 收起 compact 出處（和 MapLibre 拖曳地圖時收起的做法相同：拿掉 compact-show） */
function collapseAttribution() {
  container.value?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact')?.classList.remove('maplibregl-compact-show')
}

onBeforeUnmount(() => {
  cancelAnimationFrame(routeFrame)
  cancelAnimationFrame(locatorFrame)
  photoPins.clear()
  pulse = null
  pinMarker = null
  map?.remove()
  map = null
  ready = false
})

function fit(b: [number, number, number, number], animate = true) {
  if (!map) return
  const bounds: LngLatBoundsLike = [
    [b[0], b[1]],
    [b[2], b[3]],
  ]
  const { left, top, bottom } = cover.value
  // 蓋住之後剩下的高度不夠時，四周的留白跟著縮小
  const pad = Math.min(48, Math.max(8, (size.value.h - top - bottom) / 4))
  map.fitBounds(bounds, {
    padding: { top: pad + top, bottom: pad + bottom, right: pad, left: pad + left },
    maxZoom: 12,
    animate,
    duration: animate ? 900 : 0,
  })
}

watch(
  () => props.spots,
  () => {
    if (!map || !ready) return
    syncSources()
    setHover(null)
  },
)

watch(
  () => props.route,
  (r) => {
    if (map && ready) drawRoute(r)
  },
)

watch(
  () => props.marked,
  () => {
    if (!map || !ready) return
    syncSources()
    for (const [id, m] of photoPins) decoratePhoto(m.getElement(), id)
  },
)

watch(
  () => props.selectedId,
  (id) => {
    if (!map || !ready) return
    syncSources()
    map.setFilter('pack-selected', ['==', ['get', 'id'], id ?? ''])
    syncPulse()
    for (const [pid, m] of photoPins) {
      const el = m.getElement()
      el.classList.toggle('border-region-strong', pid === id)
      el.classList.toggle('border-paper', pid !== id)
    }
  },
)

watch(
  () => props.outline,
  (f) => {
    if (!map || !ready) return
    ;(map.getSource(OUTLINE_SOURCE) as GeoJSONSource | undefined)?.setData(outlineData(f))
  },
)

watch(
  () => props.pack,
  (pack) => {
    if (!map || !ready) return
    ;(map.getSource(PACK_SOURCE) as GeoJSONSource | undefined)?.setData(packGeoJSON(pack?.points ?? []))
    setHover(null)
    applyColors()
    applyDim()
  },
)

watch(
  () => props.rail,
  (rail) => {
    if (!map || !ready) return
    ;(map.getSource(RAIL_SOURCE) as GeoJSONSource | undefined)?.setData(rail?.lines ?? EMPTY)
    ;(map.getSource(STATION_SOURCE) as GeoJSONSource | undefined)?.setData(rail?.stations ?? EMPTY)
  },
)

watch(
  () => props.pin,
  () => {
    if (map && ready) syncPin()
  },
)

watch(
  () => props.bounds,
  (b) => {
    // 直接開某縣的網址時，資料在開場畫面後面載完：不播 0.9 秒的飛行，開場才不用等它
    if (b && ready) fit(b, !splashCovering())
  },
)

watch(
  () => [props.colorKey, theme.value],
  async () => {
    await nextTick()
    applyColors()
  },
)

defineExpose({
  /** 由清單滑過時在地圖上標出景點（null 取消） */
  highlight(id: string | null) {
    if (!map || !ready) return
    const spot = id ? props.spots.find((x) => x.id === id) : undefined
    const s = spot ?? (id ? props.pack?.points.find((x) => x.id === id) : undefined)
    if (!s) return setHover(null)
    const p = map.project([s.lng, s.lat])
    setHover({ id: s.id, name: s.n, lng: s.lng, lat: s.lat, x: p.x, y: p.y, thumb: spot?.i })
  },
  flyTo(lng: number, lat: number, zoom = 13) {
    // 右欄剛打開時地圖寬度已變：先同步尺寸再算目標位置
    map?.resize()
    map?.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), zoom),
      offset: centerOffset(),
      duration: 1200,
    })
  },
})
</script>

<template>
  <!-- overflow-hidden：hover 標籤落在畫面外時（例如從清單滑過畫面外的景點）不撐出整頁捲軸 -->
  <div
    class="map-root absolute inset-0 overflow-hidden bg-map-land"
    :style="controlsLift ? { '--map-lift-b': `${controlsLift}px` } : undefined"
    role="region"
    aria-label="地圖"
  >
    <div ref="container" class="isolate size-full"></div>
    <!-- maplibre-gl.css 不在 layer 裡，會蓋過 utilities：底色與排版用 ! 才壓得過它的 button 樣式 -->
    <Teleport v-if="terrainHost && !noTerrain" :to="terrainHost">
      <button
        type="button"
        class="!grid place-items-center text-caption leading-none font-bold print:hidden"
        :class="terrainOn ? '!bg-region-strong text-white' : '!bg-paper text-ink hover:!bg-surface active:!bg-surface'"
        :aria-pressed="terrainOn"
        aria-label="立體地形"
        title="立體地形"
        @click="toggleTerrain"
      >
        <span aria-hidden="true">立<br />體</span>
      </button>
    </Teleport>
    <Transition name="locator">
      <JapanLocator
        v-if="locator && locator.zoom >= LOCATOR_ZOOM"
        :bounds="locator.bounds"
        :zoom="locator.zoom"
        :pref="colorKey"
        class="absolute z-[2] print:hidden"
        :class="insetLeft ? 'bottom-[calc(1rem+var(--map-inset-b))] w-[132px]' : 'top-2.5 right-[calc(0.625rem+var(--map-inset-r))] w-[96px]'"
        :style="insetLeft ? { left: `${insetLeft}px` } : undefined"
      />
    </Transition>
    <div
      v-if="hover && edge"
      class="pointer-events-none absolute z-[1] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5"
      :class="EDGE_FLEX[edge.side]"
      :style="{ left: `${edge.x}px`, top: `${edge.y}px` }"
      aria-hidden="true"
    >
      <span
        class="grid size-9 shrink-0 place-items-center rounded-full bg-region-strong text-white shadow-float"
        :style="{ transform: `rotate(${edge.angle}deg)` }"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
      <span lang="ja" class="rounded-tag bg-paper px-1.5 text-label font-bold whitespace-nowrap text-ink shadow-marker">{{ hover.name }}</span>
    </div>
    <div
      v-else-if="hover"
      class="pointer-events-none absolute z-[1] flex -translate-x-1/2 flex-col items-center"
      :style="{ left: `${hover.x}px`, top: `${hover.y}px` }"
      aria-hidden="true"
    >
      <span
        v-if="hover.thumb && !failedThumbs.has(hover.thumb)"
        class="-mt-[44px] block overflow-hidden rounded-full border-[3px] border-paper bg-placeholder shadow-float"
        :style="{ width: `${PHOTO_SIZE}px`, height: `${PHOTO_SIZE}px` }"
      >
        <img
          data-photo
          :src="mapThumbUrl(hover.thumb)"
          alt=""
          class="size-full object-cover"
          referrerpolicy="no-referrer"
          @error="thumbFailed(hover)"
        />
      </span>
      <span
        lang="ja"
        class="mt-1 rounded-tag bg-paper px-1.5 text-label font-bold whitespace-nowrap text-ink shadow-marker"
        :class="hover.thumb && !failedThumbs.has(hover.thumb) ? '' : 'mt-[16px]'"
      >{{ hover.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.locator-enter-active,
.locator-leave-active {
  transition:
    opacity 0.25s var(--ease-out-soft),
    transform 0.25s var(--ease-out-soft);
}
.locator-enter-from,
.locator-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>

