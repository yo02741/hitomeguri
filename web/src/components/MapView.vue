<script setup lang="ts">
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import type * as GeoJSON from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { JAPAN_CENTER, JAPAN_ZOOM, MAP_STYLE_URL } from '../map/style'
import { THEMES } from '../data/themes'
import { mapThumbUrl, type MapSpot } from '../services/bundles'

const props = defineProps<{
  spots: MapSpot[]
  selectedId?: string | null
  /** 變更時地圖移到這個範圍 [west, south, east, north] */
  bounds?: [number, number, number, number] | null
  /** 地區色改變時換一個值，讓地圖重新讀取 CSS 變數 */
  colorKey?: string | null
  /** 目前開啟的主題：主題景點依主題色畫外框 */
  themes?: string[]
  /** 左側被浮動面板蓋住的寬度（px）：定位與「目前看的範圍」都扣掉這一塊 */
  insetLeft?: number
}>()

export interface MapView {
  /** 可見範圍（扣掉 insetLeft）的中心 */
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
}>()

const container = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let ready = false

const SOURCE = 'spots'
// hover 命中半徑（px）：游標靠近就放大，不必精準對到小圓點
const HOVER_HIT = 14
// 沒被群集起來的景點，有照片就直接畫成圓形照片；hover 時再放大
const PHOTO_PIN = 48
const PHOTO_SIZE = 88
// 同時顯示的照片上限（精選優先）
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
const edge = computed<Edge | null>(() => {
  const h = hover.value
  const el = container.value
  if (!h || !el) return null
  const w = el.clientWidth
  const ht = el.clientHeight
  const inset = Math.min(props.insetLeft ?? 0, w / 2)
  if (h.x >= inset && h.x <= w && h.y >= 0 && h.y <= ht) return null
  const left = inset + EDGE_PAD
  const right = w - EDGE_PAD
  const top = EDGE_PAD
  const bottom = ht - EDGE_PAD
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
  return getComputedStyle(el).getPropertyValue(name).trim() || '#1D222C'
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
        f: s.k === 'major' ? s.f : 0,
        // 顯示用主題：大點為空字串（墨色），主題景點取第一個開啟中的主題
        th: s.k === 'major' ? '' : ((s.t ?? []).find((t) => props.themes?.includes(t)) ?? s.t?.[0] ?? ''),
        i: s.i ?? '',
      },
    })),
  }
}

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
  const stroke = ['case', ['==', ['get', 'f'], 1], paper, themeColor] as unknown as maplibregl.ExpressionSpecification
  for (const layer of ['spots', 'hover']) {
    map.setPaintProperty(layer, 'circle-color', ['case', ['==', ['get', 'f'], 1], ink, paper])
    map.setPaintProperty(layer, 'circle-stroke-color', stroke)
  }
  map.setPaintProperty('spot-labels', 'text-color', ink)
  map.setPaintProperty('spot-labels', 'text-halo-color', paper)
  map.setPaintProperty('selected', 'circle-color', ink)
  map.setPaintProperty('selected', 'circle-stroke-color', strong)
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', land)
  }
}

function addLayers() {
  if (!map) return
  map.addSource(SOURCE, {
    type: 'geojson',
    data: toGeoJSON(props.spots),
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
  map.addLayer({
    id: 'spots',
    type: 'circle',
    source: SOURCE,
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'f'], 1], 7, 5],
      'circle-stroke-width': 2,
    },
  })
  map.addLayer({
    id: 'spot-labels',
    type: 'symbol',
    source: SOURCE,
    filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'f'], 1]],
    minzoom: 10,
    layout: {
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
  map.addLayer({
    id: 'hover',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'id'], ''],
    paint: { 'circle-radius': ['case', ['==', ['get', 'f'], 1], 12, 10], 'circle-stroke-width': 3 },
  })
  map.addLayer({
    id: 'selected',
    type: 'circle',
    source: SOURCE,
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
    const f = map?.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
    if (f) void expandCluster(f)
  })
  map.on('mousemove', (e) => updateHover(e.point))
  map.on('mouseout', () => setHover(null))
  map.on('move', positionHover)
  map.on('idle', syncPhotos)
  map.on('mouseenter', 'clusters', () => map && !hover.value && (map.getCanvas().style.cursor = 'pointer'))
  map.on('mouseleave', 'clusters', () => map && !hover.value && (map.getCanvas().style.cursor = ''))
}

async function expandCluster(f: maplibregl.MapGeoJSONFeature) {
  if (!map) return
  const src = map.getSource(SOURCE) as GeoJSONSource
  const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id as number)
  const center = (f.geometry as GeoJSON.Point).coordinates as [number, number]
  map.easeTo({ center, zoom, offset: [(props.insetLeft ?? 0) / 2, 0] }, { user: true })
}

function setHover(h: Hover | null) {
  if (!map) return
  const changed = hover.value?.id !== h?.id
  hover.value = h
  if (!changed) return
  map.setFilter('hover', ['==', ['get', 'id'], h?.id ?? ''])
  // hover 的名稱小標取代地圖上的同名標籤，避免重疊
  map.setFilter('spot-labels', [
    'all',
    ['!', ['has', 'point_count']],
    ['==', ['get', 'f'], 1],
    ['!=', ['get', 'id'], h?.id ?? ''],
  ])
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
    { layers: ['spots'] },
  )
  let best: Hover | null = null
  let bestD = Infinity
  for (const f of feats) {
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number]
    const p = map.project([lng, lat])
    const d = Math.hypot(p.x - pt.x, p.y - pt.y)
    const fp = f.properties as { id: string; n: string; i?: string }
    const reach = photoPins.has(fp.id) ? PHOTO_PIN / 2 : HOVER_HIT
    if (d > reach || d >= bestD) continue
    bestD = d
    best = { id: fp.id, name: fp.n, lng, lat, x: p.x, y: p.y, thumb: fp.i || undefined }
  }
  return best
}

// 照片模式：畫面內有照片的景點各放一個圓形照片 marker（不接收滑鼠事件，點擊仍走地圖）
const photoPins = new Map<string, maplibregl.Marker>()

function syncPhotos() {
  if (!map) return
  const want = new Map<string, { lng: number; lat: number; thumb: string; f: number }>()
  for (const f of map.queryRenderedFeatures({ layers: ['spots'] })) {
    const fp = f.properties as { id: string; i?: string; f: number }
    if (!fp.i || failedThumbs.has(fp.i) || want.has(fp.id)) continue
    const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates as [number, number]
    want.set(fp.id, { lng, lat, thumb: fp.i, f: fp.f })
  }
  const keep = new Set(
    [...want.entries()]
      .sort((a, b) => b[1].f - a[1].f)
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
    photoPins.set(id, new maplibregl.Marker({ element: photoEl(id, w.thumb, w.f) }).setLngLat([w.lng, w.lat]).addTo(map))
  }
}

function photoEl(id: string, thumb: string, featured: number): HTMLElement {
  const el = document.createElement('div')
  el.className = `pointer-events-none overflow-hidden rounded-full border-[3px] bg-placeholder shadow-float ${
    id === props.selectedId ? 'border-region-strong' : 'border-paper'
  }`
  el.style.width = `${PHOTO_PIN}px`
  el.style.height = `${PHOTO_PIN}px`
  el.style.zIndex = String(featured ? 2 : 1)
  el.dataset.id = id
  const img = document.createElement('img')
  img.src = mapThumbUrl(thumb)
  img.alt = ''
  img.referrerPolicy = 'no-referrer'
  img.decoding = 'async'
  img.className = 'size-full object-cover'
  img.onerror = () => {
    failedThumbs.add(thumb)
    photoPins.get(id)?.remove()
    photoPins.delete(id)
  }
  el.append(img)
  return el
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

/** 可見範圍：扣掉左側被浮動面板蓋住的部分 */
function visibleView(user: boolean): MapView | null {
  if (!map) return null
  const canvas = map.getCanvas()
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const left = Math.min(props.insetLeft ?? 0, w / 2)
  const nw = map.unproject([left, 0])
  const se = map.unproject([w, h])
  const c = map.unproject([(left + w) / 2, h / 2])
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
    attributionControl: {
      compact: true,
      customAttribution: '景點資料 © OpenStreetMap contributors・Wikidata・Wikimedia Commons',
    },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
  map.on('load', () => {
    addLayers()
    ready = true
    applyColors()
    if (props.bounds) fit(props.bounds, false)
  })
  map.on('moveend', (e: { originalEvent?: Event; user?: boolean }) => {
    const view = visibleView(Boolean(e.originalEvent || e.user))
    if (view) emit('moveend', view)
  })
})

onBeforeUnmount(() => {
  photoPins.clear()
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
  const pad = 48
  map.fitBounds(bounds, {
    padding: { top: pad, bottom: pad, right: pad, left: pad + (props.insetLeft ?? 0) },
    maxZoom: 12,
    animate,
    duration: animate ? 900 : 0,
  })
}

watch(
  () => [props.spots, props.themes] as const,
  ([spots]) => {
    if (!map || !ready) return
    ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(spots))
    setHover(null)
  },
)

watch(
  () => props.selectedId,
  (id) => {
    if (!map || !ready) return
    map.setFilter('selected', ['==', ['get', 'id'], id ?? ''])
    for (const [pid, m] of photoPins) {
      const el = m.getElement()
      el.classList.toggle('border-region-strong', pid === id)
      el.classList.toggle('border-paper', pid !== id)
    }
  },
)

watch(
  () => props.bounds,
  (b) => {
    if (b && ready) fit(b)
  },
)

watch(
  () => props.colorKey,
  async () => {
    await nextTick()
    applyColors()
  },
)

defineExpose({
  /** 由清單滑過時在地圖上標出景點（null 取消） */
  highlight(id: string | null) {
    if (!map || !ready) return
    const s = id ? props.spots.find((x) => x.id === id) : undefined
    if (!s) return setHover(null)
    const p = map.project([s.lng, s.lat])
    setHover({ id: s.id, name: s.n, lng: s.lng, lat: s.lat, x: p.x, y: p.y, thumb: s.i })
  },
  flyTo(lng: number, lat: number, zoom = 13) {
    // 右欄剛打開時地圖寬度已變：先同步尺寸再算目標位置
    map?.resize()
    map?.flyTo({
      center: [lng, lat],
      zoom: Math.max(map.getZoom(), zoom),
      offset: [(props.insetLeft ?? 0) / 2, 0],
      duration: 1200,
    })
  },
})
</script>

<template>
  <!-- overflow-hidden：hover 標籤落在畫面外時（例如從清單滑過畫面外的景點）不撐出整頁捲軸 -->
  <div class="absolute inset-0 overflow-hidden bg-map-land" role="region" aria-label="地圖">
    <div ref="container" class="isolate size-full"></div>
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
