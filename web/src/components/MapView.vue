<script setup lang="ts">
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { JAPAN_CENTER, JAPAN_ZOOM, MAP_STYLE_URL } from '../map/style'

const container = ref<HTMLDivElement | null>(null)
let map: maplibregl.Map | null = null

onMounted(() => {
  if (!container.value) return
  map = new maplibregl.Map({
    container: container.value,
    style: MAP_STYLE_URL,
    center: JAPAN_CENTER,
    zoom: JAPAN_ZOOM,
    attributionControl: { compact: true },
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div class="absolute inset-0 bg-map-land" role="region" aria-label="地圖">
    <div ref="container" class="size-full"></div>
  </div>
</template>
