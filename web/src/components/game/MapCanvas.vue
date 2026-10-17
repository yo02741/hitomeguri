<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { drawMinimap, type Minimap, type MiniWindow } from '../../game/engine/minimap'
import type { Dir } from '../../game/engine/types'
import { Gfx } from '../../services/pixelwalk/gfx'
import { makePalette, type Palette, readTokens } from '../../services/pixelwalk/palette'

// 小地圖的點陣（P4）：一格 tile 一個點，畫在自己的 canvas 上，CSS 放大（pixelated）。顏色是 --color-px-*（readTokens）。
// 畫面上的小框（MiniMap）給一塊 win 與 px＝放大倍數（跟遊戲畫面一樣）；手帳的地圖頁給整張與放得下的倍數。
const props = defineProps<{
  mini: Minimap
  /** 畫哪一塊（不給就整張） */
  win?: MiniWindow | null
  /** 一個點是幾 CSS px */
  px: number
  player?: { x: number; y: number; dir: Dir } | null
  focus?: { x: number; y: number } | null
}>()

const el = ref<HTMLCanvasElement | null>(null)
const win = computed<MiniWindow>(() => props.win ?? { x: 0, y: 0, w: props.mini.w, h: props.mini.h })

// px token 不跟著年代主題換：整頁讀一次
let palette: Palette | null = null
function pal(): Palette {
  palette ??= makePalette(readTokens(), 'day')
  return palette
}

let g: Gfx | null = null
let image: ImageData | null = null
function draw() {
  const c = el.value
  if (!c) return
  const w = win.value
  if (c.width !== w.w || c.height !== w.h) {
    c.width = w.w
    c.height = w.h
  }
  if (!g || g.w !== w.w || g.h !== w.h) {
    g = new Gfx(w.w, w.h, pal())
    image = new ImageData(new Uint8ClampedArray(g.buf.buffer as ArrayBuffer, g.buf.byteOffset, g.buf.byteLength), g.w, g.h)
  }
  drawMinimap(g, props.mini, w, { player: props.player ?? null, focus: props.focus ?? null })
  c.getContext('2d')?.putImageData(image!, 0, 0)
}

watch(
  () => {
    const w = win.value
    const p = props.player
    const f = props.focus
    return `${props.mini.id}|${props.mini.w}x${props.mini.h}|${w.x},${w.y},${w.w},${w.h}|${p ? `${p.x},${p.y},${p.dir}` : ''}|${f ? `${f.x},${f.y}` : ''}`
  },
  draw,
  { flush: 'post' },
)
// 同一張地圖換了一份小地圖（祭典的攤子、花季換 tile 之後重算）：照物件換
watch(() => props.mini, draw, { flush: 'post' })
onMounted(draw)
</script>

<template>
  <canvas ref="el" class="map-canvas" :style="{ width: `${win.w * px}px`, height: `${win.h * px}px` }" aria-hidden="true"></canvas>
</template>

<style scoped>
.map-canvas {
  display: block;
  image-rendering: pixelated;
}
</style>
