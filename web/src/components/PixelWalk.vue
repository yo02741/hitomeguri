<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { PixelWalkEngine } from '../services/pixelwalk/engine'

// 形象網站的像素散步（DESIGN.md §14a）：GBA 風的旅人一區一區走過日本各地，路上隨機遇到東西。
// 這個元件只管 canvas、大小、暫停與地名牌；引擎與各地區（services/pixelwalk）捲到附近才下載。
// 放大用整數倍（2–4 倍）＋ image-rendering: pixelated，點一下旅人會跳。
const H = 160
const box = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const scale = ref(3)
const width = ref(0)
const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
/** 自己按的暫停（減少動態的人一開始就是暫停的，畫面停在第一格） */
const paused = ref(reduced)
const banner = ref<{ name: string; romaji: string; n: number } | null>(null)
const ready = ref(false)

let engine: PixelWalkEngine | null = null
let ctx: CanvasRenderingContext2D | null = null
let image: ImageData | null = null
let imageOf: unknown = null
let raf = 0
let last = 0
let acc = 0
let visible = false
let near = false
let bannerTimer = 0
let io: IntersectionObserver | null = null
let seen: IntersectionObserver | null = null
let ro: ResizeObserver | null = null

const running = computed(() => ready.value && !paused.value)

function measure() {
  const el = box.value
  if (!el) return
  const cw = el.clientWidth
  const vh = window.innerHeight || 800
  const s = Math.max(2, Math.min(4, Math.floor(cw / 180), Math.floor(Math.min(vh * 0.55, 480) / H)))
  scale.value = s
  width.value = Math.ceil(cw / s)
  const c = canvas.value
  if (c && (c.width !== width.value || c.height !== H)) {
    c.width = width.value
    c.height = H
  }
  engine?.resize(width.value)
  paint()
}

/** 把引擎畫好的一格貼到 canvas */
function paint() {
  if (!engine || !ctx) return
  const f = engine.render()
  if (imageOf !== f) {
    image = new ImageData(new Uint8ClampedArray(f.buf.buffer as ArrayBuffer, f.buf.byteOffset, f.buf.byteLength), f.w, f.h)
    imageOf = f
  }
  ctx.putImageData(image!, 0, 0)
}

function frame(now: number) {
  raf = 0
  if (!engine || !running.value || !visible || document.hidden) return
  const dt = Math.min(0.1, (now - (last || now)) / 1000)
  last = now
  acc += dt
  let n = 0
  while (acc >= 1 / 60 && n < 6) {
    engine.update(1 / 60)
    acc -= 1 / 60
    n++
  }
  if (n === 6) acc = 0
  // 120Hz 的螢幕兩格才走一步：沒走就不用重畫
  if (n > 0) paint()
  raf = requestAnimationFrame(frame)
}

function loop() {
  if (raf || !engine || !running.value || !visible || document.hidden) return
  last = 0
  raf = requestAnimationFrame(frame)
}

let pending: { name: string; romaji: string } | null = null
function showBanner(name: string, romaji: string) {
  // 還沒捲到（先下載好的時候）：等看到了再出來
  if (!visible || paused.value) {
    pending = { name, romaji }
    return
  }
  pending = null
  banner.value = { name, romaji, n: (banner.value?.n ?? 0) + 1 }
  clearTimeout(bannerTimer)
  bannerTimer = window.setTimeout(() => (banner.value = null), 3200)
}

async function boot() {
  if (engine || !canvas.value) return
  let mods
  try {
    mods = await Promise.all([import('../services/pixelwalk/engine'), import('../services/pixelwalk/catalog'), import('../services/pixelwalk/palette')])
  } catch {
    // 離線、還沒下載過：這一段先空著，下次捲到再試
    near = false
    return
  }
  const [{ PixelWalkEngine }, catalog, { readTokens }] = mods
  if (!canvas.value || engine) return
  ctx = canvas.value.getContext('2d')
  try {
    engine = new PixelWalkEngine(
      { tokens: readTokens(), areas: catalog.AREAS, events: catalog.EVENTS, transitions: catalog.TRANSITIONS, onArea: (a) => showBanner(a.name, a.romaji) },
      width.value || 320,
    )
  } catch (e) {
    // 起不來（例：讀不到顏色）：這一段留著天空色，不影響頁面其他地方
    if (import.meta.env.DEV) console.warn('pixelwalk：引擎起不來', e)
    return
  }
  ready.value = true
  // dev：預覽、檢查用（快轉：__pixelwalk.update(1 / 60) 跑很多次）
  if (import.meta.env.DEV) (window as unknown as { __pixelwalk?: PixelWalkEngine }).__pixelwalk = engine
  measure()
  loop()
}

function toggle() {
  paused.value = !paused.value
  if (!paused.value) {
    if (pending) showBanner(pending.name, pending.romaji)
    loop()
  }
}

function poke() {
  // 暫停時點了不跳（不然按播放時才突然跳一下）
  if (!engine || !running.value) return
  engine.poke()
}

const onVisibility = () => loop()
/** 只有視窗高度變（容器寬沒變）時 ResizeObserver 不會叫：倍率可能要換 */
function onWinResize() {
  const el = box.value
  if (!el) return
  const vh = window.innerHeight || 800
  const s = Math.max(2, Math.min(4, Math.floor(el.clientWidth / 180), Math.floor(Math.min(vh * 0.55, 480) / H)))
  if (s !== scale.value) measure()
}

onMounted(() => {
  measure()
  io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        // 快捲到的時候先下載、畫好第一格；進到畫面才開始走
        if (e.isIntersecting && !near) {
          near = true
          void boot()
        }
      }
    },
    { rootMargin: '600px 0px' },
  )
  seen = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting)
    if (visible) {
      if (pending) showBanner(pending.name, pending.romaji)
      loop()
    }
  })
  if (box.value) {
    io.observe(box.value)
    seen.observe(box.value)
  }
  ro = new ResizeObserver(() => measure())
  if (box.value) ro.observe(box.value)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', onWinResize)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  io?.disconnect()
  seen?.disconnect()
  ro?.disconnect()
  clearTimeout(bannerTimer)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('resize', onWinResize)
  engine = null
})
</script>

<template>
  <section ref="box" class="pixel-walk relative overflow-hidden bg-px-sky-day-2" :style="{ height: `${H * scale}px` }" aria-label="像素散步">
    <canvas
      ref="canvas"
      class="pixel-canvas absolute top-0 left-1/2 -translate-x-1/2"
      :style="{ width: `${width * scale}px`, height: `${H * scale}px` }"
      role="img"
      aria-label="像素風的旅人走過京都、東京、沖繩等地"
      @pointerdown="poke"
    ></canvas>
    <!-- 地名牌：進到新的一區時從左上滑下來 -->
    <p v-if="banner" :key="banner.n" class="area-sign absolute top-3 left-3 m-0 flex flex-col px-3 py-1.5" :style="{ '--s': `${scale}px` }" aria-hidden="true">
      <span class="text-title font-bold tracking-[0.12em]">{{ banner.name }}</span>
      <span class="font-latin text-micro font-bold tracking-[0.3em]">{{ banner.romaji }}</span>
    </p>
    <button
      type="button"
      class="px-btn absolute right-3 bottom-3 grid size-9 place-items-center"
      :aria-label="paused ? '播放像素散步' : '暫停像素散步'"
      @click="toggle"
    >
      <svg v-if="paused" viewBox="0 0 8 8" class="size-3.5" aria-hidden="true" shape-rendering="crispEdges"><path d="M2 1h1v6H2zM3 2h1v4H3zM4 3h1v2H4z" fill="currentColor" /></svg>
      <svg v-else viewBox="0 0 8 8" class="size-3.5" aria-hidden="true" shape-rendering="crispEdges"><path d="M2 1h1v6H2zM5 1h1v6H5z" fill="currentColor" /></svg>
    </button>
  </section>
</template>

<style scoped>
.pixel-canvas {
  image-rendering: pixelated;
  cursor: pointer;
  touch-action: pan-y;
}
/* GBA 的地名牌：白底、雙線的深色框 */
.area-sign {
  color: var(--color-px-ink);
  background: var(--color-px-white);
  border: 3px solid var(--color-px-ink);
  box-shadow:
    inset 0 0 0 2px var(--color-px-white),
    inset 0 0 0 3px var(--color-px-ink-2),
    3px 3px 0 color-mix(in oklab, var(--color-px-ink) 35%, transparent);
  animation: sign-in 3.2s steps(1, end) both;
  line-height: 1.2;
}
@keyframes sign-in {
  0% {
    transform: translateY(-140%);
  }
  4% {
    transform: translateY(-90%);
  }
  8% {
    transform: translateY(-40%);
  }
  12%,
  88% {
    transform: none;
  }
  92% {
    transform: translateY(-40%);
  }
  96% {
    transform: translateY(-90%);
  }
  100% {
    transform: translateY(-140%);
  }
}
.px-btn {
  color: var(--color-px-ink);
  background: var(--color-px-white);
  border: 2px solid var(--color-px-ink);
  box-shadow: 2px 2px 0 color-mix(in oklab, var(--color-px-ink) 35%, transparent);
}
.px-btn:active {
  transform: translate(1px, 1px);
  box-shadow: 1px 1px 0 color-mix(in oklab, var(--color-px-ink) 35%, transparent);
}
.px-btn:focus-visible {
  /* 白一圈＋墨一圈：雪地、沙灘、夜裡都看得到 */
  outline: 2px solid var(--color-px-ink);
  outline-offset: 2px;
  box-shadow:
    0 0 0 2px var(--color-px-white),
    2px 2px 0 color-mix(in oklab, var(--color-px-ink) 35%, transparent);
}
@media (prefers-reduced-motion: reduce) {
  .area-sign {
    animation: none;
  }
}
</style>
