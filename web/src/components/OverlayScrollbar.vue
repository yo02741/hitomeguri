<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 浮在畫面右緣的細捲軸（形象網站，DESIGN.md §14）：原生捲軸藏起來，照片才能滿版到右緣。
 * 捲動、滑到右緣時出現，停 1.2 秒淡出；可以拖曳。只動 transform 與 opacity。
 * 鍵盤、滾輪、觸控照常捲原本的容器；這條只是看得到位置、也能拖，報讀軟體略過（aria-hidden）。
 */
const props = defineProps<{ target: string }>()

const thumb = ref<HTMLElement | null>(null)
const shown = ref(false)
const dragging = ref(false)
let el: HTMLElement | null = null
let raf = 0
let hideTimer = 0
let thumbH = 0
let track = 0

function measure() {
  if (!el || !thumb.value) return
  const view = el.clientHeight
  const total = el.scrollHeight
  track = view - 8
  thumbH = total > view ? Math.max(40, (view / total) * track) : 0
  thumb.value.style.height = `${thumbH}px`
  place()
}
function place() {
  if (!el || !thumb.value) return
  const max = el.scrollHeight - el.clientHeight
  const y = max > 0 ? (el.scrollTop / max) * (track - thumbH) : 0
  thumb.value.style.transform = `translateY(${y}px)`
}
function wake() {
  if (!thumbH) return
  shown.value = true
  window.clearTimeout(hideTimer)
  if (!dragging.value) hideTimer = window.setTimeout(() => (shown.value = false), 1200)
}
function onScroll() {
  if (raf) return
  raf = requestAnimationFrame(() => {
    raf = 0
    place()
    wake()
  })
}

let startY = 0
let startTop = 0
function onPointerDown(e: PointerEvent) {
  if (!el) return
  dragging.value = true
  startY = e.clientY
  startTop = el.scrollTop
  thumb.value?.setPointerCapture(e.pointerId)
  wake()
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !el) return
  const max = el.scrollHeight - el.clientHeight
  el.scrollTop = startTop + ((e.clientY - startY) / Math.max(1, track - thumbH)) * max
}
function onPointerUp(e: PointerEvent) {
  dragging.value = false
  thumb.value?.releasePointerCapture(e.pointerId)
  wake()
}

let resize: ResizeObserver | null = null
onMounted(() => {
  el = document.getElementById(props.target)
  if (!el) return
  el.addEventListener('scroll', onScroll, { passive: true })
  measure()
  if ('ResizeObserver' in window) {
    resize = new ResizeObserver(measure)
    resize.observe(el)
    if (el.firstElementChild) resize.observe(el.firstElementChild)
  }
})
onBeforeUnmount(() => {
  el?.removeEventListener('scroll', onScroll)
  resize?.disconnect()
  cancelAnimationFrame(raf)
  window.clearTimeout(hideTimer)
})
</script>

<template>
  <div class="overlay-scrollbar" :class="{ 'is-shown': shown || dragging }" aria-hidden="true" @pointerenter="wake">
    <div
      ref="thumb"
      class="thumb"
      :class="{ 'is-dragging': dragging }"
      @pointerdown.prevent="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    ></div>
  </div>
</template>

<style scoped>
/* 右緣 12px 的感應區；捲軸本體 6px，拖的時候變粗一點。深色照片、淺色紙面上都看得到：半透明的字色加一圈淺色描邊 */
.overlay-scrollbar {
  position: fixed;
  top: 4px;
  right: 2px;
  bottom: 4px;
  z-index: 40;
  width: 12px;
  opacity: 0;
  transition: opacity 0.4s var(--ease-out-soft);
}
.overlay-scrollbar.is-shown,
.overlay-scrollbar:hover {
  opacity: 1;
}
.thumb {
  position: absolute;
  top: 0;
  right: 2px;
  width: 6px;
  border-radius: 9999px;
  background: color-mix(in oklab, var(--color-sub) 70%, transparent);
  box-shadow: 0 0 0 1px color-mix(in oklab, var(--color-paper) 45%, transparent);
  cursor: grab;
  touch-action: none;
  transition: width 0.15s var(--ease-out-soft);
}
.overlay-scrollbar:hover .thumb,
.thumb.is-dragging {
  width: 8px;
}
.thumb.is-dragging {
  cursor: grabbing;
}
/* 觸控裝置用手指捲，不需要拖的捲軸 */
@media (pointer: coarse) {
  .overlay-scrollbar {
    pointer-events: none;
  }
}
</style>
