<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'

import { regionOf } from '../data/regions'
import { JAPAN_ZOOM } from '../map/style'
import { inOkinawaInset, japanOutline, type JapanOutline, japanProject, OKINAWA_SCALE } from '../services/geo'

// 地圖放大時的日本全圖（像手機相機放大時的全景小窗，DESIGN.md §7.5a）：
// 目前看的範圍畫成框，範圍太小時改成一個點；目前的縣塗地區色；下方寫縣名與放大倍率。只顯示，不能點。
const props = defineProps<{
  /** 可見範圍 [west, south, east, north] */
  bounds: [number, number, number, number]
  /** 目前的縮放（倍率以日本全圖的縮放為 1×） */
  zoom: number
  pref?: string | null
}>()

const shape = shallowRef<JapanOutline | null>(null)
onMounted(async () => {
  shape.value = await japanOutline()
})

const view = computed(() => {
  const [w, s, e, n] = props.bounds
  // 沖繩一帶看中心點決定整個框要不要移到左上
  const [x1, y1] = japanProject(w, n, false)
  const [x2, y2] = japanProject(e, s, false)
  const [cx, cy] = japanProject((w + e) / 2, (s + n) / 2)
  // 沖繩的框放大了 OKINAWA_SCALE 倍，看的範圍也跟著放大
  const k = inOkinawaInset((w + e) / 2, (s + n) / 2) ? OKINAWA_SCALE : 1
  const width = Math.abs(x2 - x1) * k
  const height = Math.abs(y2 - y1) * k
  return { cx, cy, x: cx - width / 2, y: cy - height / 2, width, height, tiny: width < 7 && height < 7 }
})

// 倍率：縮放每加 1 放大 2 倍；10 倍以下留一位小數
const factor = computed(() => {
  const f = 2 ** (props.zoom - JAPAN_ZOOM)
  return f < 10 ? f.toFixed(1) : String(Math.round(f))
})
const name = computed(() => regionOf(props.pref)?.name.ja ?? '')
</script>

<template>
  <div class="locator pointer-events-none flex flex-col gap-1 rounded-card bg-paper/90 p-1.5 shadow-float" role="img" :aria-label="`目前在日本的位置：${name}，${factor} 倍`">
    <svg v-if="shape" :viewBox="shape.viewBox" class="block h-auto w-full" aria-hidden="true">
      <rect :x="shape.inset[0]" :y="shape.inset[1]" :width="shape.inset[2]" :height="shape.inset[3]" rx="2" class="inset" />
      <path v-for="p in shape.paths" :key="p.pref" :d="p.d" :data-pref="p.pref === pref ? p.pref : undefined" class="pref" :class="{ 'is-here': p.pref === pref }" />
      <g class="here">
        <template v-if="view.tiny">
          <circle :cx="view.cx" :cy="view.cy" r="3" class="dot" />
        </template>
        <rect v-else :x="view.x" :y="view.y" :width="view.width" :height="view.height" rx="1.2" class="frame" />
      </g>
    </svg>
    <p class="flex items-baseline justify-between gap-1 px-0.5 leading-none" aria-hidden="true">
      <span lang="ja" class="truncate text-caption font-bold text-ink">{{ name }}</span>
      <span class="font-latin text-caption font-semibold text-sub">×{{ factor }}</span>
    </p>
  </div>
</template>

<style scoped>
.locator {
  --frame: var(--region-strong);
}
.inset {
  fill: none;
  stroke: var(--region-line);
  stroke-width: 0.8;
  stroke-dasharray: 2 1.5;
}
.pref {
  fill: var(--region-line);
  stroke: var(--region-paper);
  stroke-width: 0.4;
}
.pref.is-here {
  fill: var(--region-accent);
}
.frame {
  fill: color-mix(in oklab, var(--frame) 18%, transparent);
  stroke: var(--frame);
  stroke-width: 1.6;
  vector-effect: non-scaling-stroke;
}
.dot {
  fill: var(--frame);
  stroke: var(--region-paper);
  stroke-width: 1.2;
}
</style>
