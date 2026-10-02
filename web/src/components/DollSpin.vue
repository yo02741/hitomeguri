<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

import type { Slot } from '../data/outfits'
import type { AvatarParts } from '../stores/avatar'
import PaperDoll from './PaperDoll.vue'

// 旅人的 3D 展示窗（DESIGN.md §7.24）：紙做的立牌，滑鼠或手指左右拖拉就轉，上下拖拉（滑鼠）稍微俯仰；
// 放開會帶著慣性轉一下再停。轉過去看得到紙的背面（紙色、透一點正面）與切邊的厚度，地上的影子跟著變窄。
// 雙擊轉回正面；鍵盤 ←→ 一次轉 30 度、Home 回正面。系統減少動態時沒有慣性。
// 停下來就完全不動：3D 的層只要角度一直在變，瀏覽器就用低解析度畫（放大看配件會糊），所以沒有待機擺動，
// 動畫迴圈也只在轉動、慣性、回正時跑。
const props = defineProps<{ parts: AvatarParts; equipped: Partial<Record<Slot, string>> }>()

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const ry = ref(0)
const rx = ref(0)
const smooth = ref(false)
let dragging = false
let start = { x: 0, y: 0, ry: 0, rx: 0 }
let last = { x: 0, t: 0 }
let vel = 0
let raf = 0

/** 紙的厚度：前後之間疊幾層切邊 */
const EDGES = [-1.5, -0.5, 0.5, 1.5]

/** 慣性與俯仰回正；兩個都停了就不再排下一格 */
function frame() {
  raf = 0
  if (dragging) return
  let moving = false
  if (Math.abs(vel) > 0.005) {
    ry.value += vel * 16
    vel *= 0.94
    moving = true
  } else vel = 0
  if (Math.abs(rx.value) > 0.05) {
    rx.value *= 0.9
    moving = true
  } else if (rx.value !== 0) rx.value = 0
  if (moving) raf = requestAnimationFrame(frame)
}
function settle() {
  if (!raf) raf = requestAnimationFrame(frame)
}
function onDown(e: PointerEvent) {
  if (e.button !== 0) return
  dragging = true
  smooth.value = false
  vel = 0
  start = { x: e.clientX, y: e.clientY, ry: ry.value, rx: rx.value }
  last = { x: e.clientX, t: performance.now() }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  ry.value = start.ry + (e.clientX - start.x) * 0.6
  if (e.pointerType === 'mouse') rx.value = Math.min(14, Math.max(-20, start.rx - (e.clientY - start.y) * 0.25))
  const now = performance.now()
  const dt = Math.max(1, now - last.t)
  vel = reduced ? 0 : (((e.clientX - last.x) * 0.6) / dt) * 0.9
  last = { x: e.clientX, t: now }
}
function onUp() {
  if (!dragging) return
  dragging = false
  // 停很久才放開就不帶慣性
  if (performance.now() - last.t > 80) vel = 0
  settle()
}
/** 轉回正面（最近的 0、360、720…） */
function home() {
  smooth.value = true
  vel = 0
  ry.value = Math.round(ry.value / 360) * 360
  rx.value = 0
  window.setTimeout(() => (smooth.value = false), 650)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    smooth.value = true
    ry.value += e.key === 'ArrowLeft' ? -30 : 30
    window.setTimeout(() => (smooth.value = false), 450)
  } else if (e.key === 'Home') home()
  else return
  e.preventDefault()
}

const angle = computed(() => ry.value)
const transform = computed(() => `rotateX(${rx.value}deg) rotateY(${angle.value}deg)`)
// 地上的影子：正面、背面最寬，轉到側面最窄
const shadowScale = computed(() => 0.45 + 0.55 * Math.abs(Math.cos((angle.value * Math.PI) / 180)))
const look = computed(() => ({ ...props.equipped }))

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div
    class="spin-stage relative size-full cursor-grab select-none active:cursor-grabbing"
    tabindex="0"
    role="img"
    aria-label="旅人（可以左右拖拉旋轉）"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @lostpointercapture="onUp"
    @dblclick="home"
    @keydown="onKey"
  >
    <span class="ground pointer-events-none absolute left-1/2 rounded-[50%]" :style="{ transform: `translateX(-50%) scaleX(${shadowScale})` }" aria-hidden="true"></span>
    <div class="scene absolute inset-x-0 bottom-[6%] mx-auto aspect-[3/4] h-[88%]">
      <div class="spinner relative size-full" :class="{ smooth }" :style="{ transform }">
        <div class="layer back"><PaperDoll :parts="parts" :equipped="look" :shadow="false" class="paper-back size-full" /></div>
        <div v-for="z in EDGES" :key="z" class="layer" :style="{ transform: `translateZ(${z}px)` }">
          <PaperDoll :parts="parts" :equipped="look" :shadow="false" class="paper-edge size-full" />
        </div>
        <div class="layer front"><PaperDoll :parts="parts" :equipped="look" :shadow="false" class="size-full" /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.spin-stage {
  touch-action: pan-y;
  outline-offset: -4px;
}
.scene {
  perspective: 900px;
}
.spinner {
  transform-style: preserve-3d;
  transform-origin: 50% 88%;
}
.spinner.smooth {
  transition: transform 0.6s cubic-bezier(0.3, 1.2, 0.5, 1);
}
.layer {
  position: absolute;
  inset: 0;
}
.front {
  transform: translateZ(2px);
  backface-visibility: hidden;
}
.back {
  transform: rotateY(180deg) translateZ(2px);
  backface-visibility: hidden;
}
/* 背面這層轉了 180 度，圖案先左右翻一次，從後面看才會跟紙的剪影對齊（透過來的印刷也是反的） */
.paper-back {
  filter: url(#doll-back);
  transform: scaleX(-1);
}
.paper-edge {
  filter: url(#doll-edge);
}
.ground {
  bottom: 5%;
  width: 46%;
  height: 5%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--color-shade) 22%, transparent), transparent);
}
@media (prefers-reduced-motion: reduce) {
  .spinner.smooth {
    transition: none;
  }
}
</style>
