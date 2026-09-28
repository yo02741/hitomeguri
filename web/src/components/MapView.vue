<script setup lang="ts">
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import type * as GeoJSON from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

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
// 這個縮放以上，hover 的圓圈裡顯示景點照片
const PHOTO_ZOOM = 12
const PHOTO_SIZE = 88

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
const photoMode = ref(false)
const failedThumbs = new Set<string>()
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
    clusterRadius: 44,
    clusterMaxZoom: 11,
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
  map.on('click', (e) => {
    if (hover.value) {
      emit('select', hover.value.id)
      return
    }
    const f = map?.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]
    if (f) void expandCluster(f)
  })
  map.on('mousemove', (e) => updateHover(e.point))
  map.on('mouseout', () => setHover(null))
  map.on('move', positionHover)
  map.on('zoom', () => map && (photoMode.value = map.getZoom() >= PHOTO_ZOOM))
  photoMode.value = map.getZoom() >= PHOTO_ZOOM
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
  map.getCanvas().style.cursor = h ? 'pointer' : ''
}

function updateHover(pt: { x: number; y: number }) {
  if (!map) return
  // 照片圓圈比較大：游標還在圓圈裡就維持，不因離開原本的點而閃掉
  const cur = hover.value
  const keep = cur?.thumb && photoMode.value ? PHOTO_SIZE / 2 : HOVER_HIT
  if (cur && Math.hypot(cur.x - pt.x, cur.y - pt.y) <= keep) return
  const r = HOVER_HIT
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
    if (d > r || d >= bestD) continue
    const fp = f.properties as { id: string; n: string; i?: string }
    bestD = d
    best = { id: fp.id, name: fp.n, lng, lat, x: p.x, y: p.y, thumb: fp.i || undefined }
  }
  setHover(best)
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
  <div class="absolute inset-0 bg-map-land" role="region" aria-label="地圖">
    <div ref="container" class="size-full"></div>
    <div
      v-if="hover"
      class="pointer-events-none absolute z-[1] flex -translate-x-1/2 flex-col items-center"
      :style="{ left: `${hover.x}px`, top: `${hover.y}px` }"
      aria-hidden="true"
    >
      <span
        v-if="photoMode && hover.thumb && !failedThumbs.has(hover.thumb)"
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
        :class="photoMode && hover.thumb && !failedThumbs.has(hover.thumb) ? '' : 'mt-[16px]'"
      >{{ hover.name }}</span>
    </div>
  </div>
</template>
