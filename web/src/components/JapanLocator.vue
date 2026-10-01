<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'

import { japanOutline, type JapanOutline, japanProject, japanUnproject } from '../services/geo'

// 地圖放大時角落的日本全圖（像相機放大時的全景小框，DESIGN.md §7.5a）：
// 目前看的範圍畫成框，範圍太小時改成一個點；目前的縣塗地區色。點小地圖飛到那個位置（縮放不變）。
const props = defineProps<{
  /** 可見範圍 [west, south, east, north] */
  bounds: [number, number, number, number]
  pref?: string | null
}>()
const emit = defineEmits<{ go: [lng: number, lat: number] }>()

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
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  return { cx, cy, x: cx - width / 2, y: cy - height / 2, width, height, tiny: width < 7 && height < 7 }
})

const svg = shallowRef<SVGSVGElement | null>(null)
function onClick(e: MouseEvent) {
  const el = svg.value
  if (!el) return
  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(el.getScreenCTM()?.inverse())
  const [lng, lat] = japanUnproject(pt.x, pt.y)
  emit('go', lng, lat)
}
</script>

<template>
  <div class="locator rounded-card bg-paper p-1.5 shadow-float">
    <svg v-if="shape" ref="svg" :viewBox="shape.viewBox" class="block h-auto w-full cursor-pointer" role="img" aria-label="目前在日本的位置" @click="onClick">
      <rect :x="shape.inset[0]" :y="shape.inset[1]" :width="shape.inset[2]" :height="shape.inset[3]" rx="2" class="inset" />
      <path v-for="p in shape.paths" :key="p.pref" :d="p.d" :data-pref="p.pref === pref ? p.pref : undefined" class="pref" :class="{ 'is-here': p.pref === pref }" />
      <g class="here">
        <template v-if="view.tiny">
          <circle :cx="view.cx" :cy="view.cy" r="7" class="ring" />
          <circle :cx="view.cx" :cy="view.cy" r="3" class="dot" />
        </template>
        <rect v-else :x="view.x" :y="view.y" :width="view.width" :height="view.height" rx="1.2" class="frame" />
      </g>
    </svg>
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
  transition:
    x 0.15s,
    y 0.15s,
    width 0.15s,
    height 0.15s;
}
.dot {
  fill: var(--frame);
  stroke: var(--region-paper);
  stroke-width: 1.2;
}
.ring {
  fill: none;
  stroke: var(--frame);
  stroke-width: 1.4;
  transform-box: fill-box;
  transform-origin: center;
  animation: locator-ring 2s var(--ease-out-soft) infinite;
}
@keyframes locator-ring {
  from {
    transform: scale(0.5);
    opacity: 1;
  }
  to {
    transform: scale(1.6);
    opacity: 0;
  }
}
</style>
