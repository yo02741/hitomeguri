<script setup lang="ts">
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl'
import type * as GeoJSON from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { JAPAN_CENTER, JAPAN_ZOOM, MAP_STYLE_URL } from '../map/style'
import type { MapSpot } from '../services/bundles'

const props = defineProps<{
  spots: MapSpot[]
  selectedId?: string | null
  /** 變更時地圖移到這個範圍 [west, south, east, north] */
  bounds?: [number, number, number, number] | null
  /** 地區色改變時換一個值，讓地圖重新讀取 CSS 變數 */
  colorKey?: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  moveend: [center: { lng: number; lat: number }, zoom: number]
}>()

const container = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null
let ready = false

const SOURCE = 'spots'
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
      properties: { id: s.id, n: s.n, f: s.f, s: s.s },
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
  map.setPaintProperty('spots', 'circle-color', ['case', ['==', ['get', 'f'], 1], ink, paper])
  map.setPaintProperty('spots', 'circle-stroke-color', ['case', ['==', ['get', 'f'], 1], paper, ink])
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
    id: 'selected',
    type: 'circle',
    source: SOURCE,
    filter: ['==', ['get', 'id'], props.selectedId ?? ''],
    paint: { 'circle-radius': 10, 'circle-stroke-width': 3 },
  })

  map.on('click', 'spots', (e) => {
    const id = e.features?.[0]?.properties?.id as string | undefined
    if (id) emit('select', id)
  })
  map.on('click', 'clusters', async (e) => {
    const f = e.features?.[0]
    if (!f || !map) return
    const src = map.getSource(SOURCE) as GeoJSONSource
    const zoom = await src.getClusterExpansionZoom(f.properties?.cluster_id as number)
    map.easeTo({ center: (f.geometry as GeoJSON.Point).coordinates as [number, number], zoom })
  })
  for (const layer of ['spots', 'clusters']) {
    map.on('mouseenter', layer, () => map && (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', layer, () => map && (map.getCanvas().style.cursor = ''))
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
  map.on('moveend', () => {
    if (!map) return
    const c = map.getCenter()
    emit('moveend', { lng: c.lng, lat: c.lat }, map.getZoom())
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
  map.fitBounds(bounds, { padding: 48, maxZoom: 12, animate, duration: animate ? 900 : 0 })
}

watch(
  () => props.spots,
  (spots) => {
    if (!map || !ready) return
    ;(map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(toGeoJSON(spots))
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
    map?.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), zoom), duration: 1200 })
  },
})
</script>

<template>
  <div class="absolute inset-0 bg-map-land" role="region" aria-label="地圖">
    <div ref="container" class="size-full"></div>
  </div>
</template>
