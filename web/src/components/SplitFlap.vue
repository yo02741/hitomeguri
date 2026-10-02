<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// 車站發車標的翻牌（パタパタ，DESIGN.md §9）：每一格從目前的字一張一張翻到目標字，
// 數字依 0→9 的順序翻，其他字直接翻一張。出現時從空白翻到目標。「減少動態」時直接顯示。
const props = defineProps<{ value: string }>()

const DIGITS = ' 0123456789'
const STEP_MS = 70
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface Cell {
  cur: string
  prev: string
  flip: number
}
const cells = ref<Cell[]>([])
let timer = 0

function sizeTo(n: number) {
  while (cells.value.length < n) cells.value.unshift({ cur: ' ', prev: ' ', flip: 0 })
  while (cells.value.length > n) cells.value.shift()
}

function nextChar(cur: string, target: string): string {
  const a = DIGITS.indexOf(cur)
  const b = DIGITS.indexOf(target)
  if (a >= 0 && b >= 0) return DIGITS[(a + 1) % DIGITS.length]!
  return target
}

function tick() {
  timer = 0
  const target = props.value.padStart(cells.value.length)
  let moving = false
  cells.value.forEach((c, i) => {
    const t = target[i] ?? ' '
    if (c.cur === t) return
    c.prev = c.cur
    c.cur = nextChar(c.cur, t)
    c.flip++
    moving = true
  })
  if (moving) timer = window.setTimeout(tick, STEP_MS)
}

function run() {
  sizeTo(props.value.length)
  if (reduced) {
    cells.value.forEach((c, i) => (c.cur = c.prev = props.value[i] ?? ' '))
    return
  }
  if (!timer) timer = window.setTimeout(tick, STEP_MS)
}

watch(() => props.value, run)
onMounted(run)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <span class="inline-flex gap-[2px]" :aria-label="value" role="text">
    <span v-for="(c, i) in cells" :key="i" class="cell" aria-hidden="true">
      <span class="half top"><span>{{ c.cur }}</span></span>
      <span class="half bottom"><span>{{ c.flip ? c.prev : c.cur }}</span></span>
      <template v-if="c.flip">
        <span :key="`f${c.flip}`" class="half top flap-out"><span>{{ c.prev }}</span></span>
        <span :key="`b${c.flip}`" class="half bottom flap-in"><span>{{ c.cur }}</span></span>
      </template>
    </span>
  </span>
</template>

<style scoped>
/* 一格：深色底、淺色字，中間一道分割線；上半張往下翻蓋住下半張 */
.cell {
  position: relative;
  display: inline-block;
  width: 0.78em;
  height: 1.2em;
  perspective: 6em;
  font-family: var(--font-latin);
  font-weight: 700;
  line-height: 1.2em;
  text-align: center;
  color: var(--region-paper);
}
.half {
  position: absolute;
  left: 0;
  right: 0;
  height: 50%;
  overflow: hidden;
  background: var(--region-ink);
  backface-visibility: hidden;
}
.half > span {
  position: absolute;
  left: 0;
  right: 0;
  height: 200%;
}
.top {
  top: 0;
  border-radius: 0.12em 0.12em 0 0;
  transform-origin: bottom;
}
.top > span {
  top: 0;
}
.bottom {
  bottom: 0;
  border-radius: 0 0 0.12em 0.12em;
  transform-origin: top;
  border-top: 1px solid color-mix(in oklab, var(--region-paper) 18%, transparent);
}
.bottom > span {
  bottom: 0;
}
.flap-out {
  animation: flap-out 0.07s ease-in both;
}
.flap-in {
  animation: flap-in 0.07s 0.035s ease-out both;
}
@keyframes flap-out {
  to {
    transform: rotateX(-90deg);
  }
}
@keyframes flap-in {
  from {
    transform: rotateX(90deg);
  }
}
</style>
