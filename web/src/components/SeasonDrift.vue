<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { type Season, seasonFor, SEASONS } from '../services/season'
import { todayIso } from '../services/userdb'
import { useCatalogStore } from '../stores/catalog'

// 海報區的季節飄落（DESIGN.md §9）：櫻花瓣、紅葉、銀杏、雪、螢火蟲。
// 放在海報區裡（父元素要 relative），游標滑過時花瓣被風吹開。
// 「減少動態」時不畫；離開畫面、分頁切到背景時暫停。網址加 ?season=sakura 等可以預覽其他季節。
const props = defineProps<{ pref: string | null }>()

const route = useRoute()
const catalog = useCatalogStore()
void catalog.loadTimed()
const season = computed<Season | null>(() => {
  const q = route.query.season
  if (typeof q === 'string' && (SEASONS as string[]).includes(q)) return q as Season
  return seasonFor(props.pref, todayIso(), catalog.timed)
})

const canvas = ref<HTMLCanvasElement | null>(null)
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

interface Particle {
  x: number
  y: number
  size: number
  vy: number
  vx: number
  sway: number
  swayFreq: number
  phase: number
  rot: number
  vrot: number
  flip: number
  vflip: number
  color: string
  alpha: number
}

const COLORS: Record<Season, string[]> = {
  sakura: ['--color-sakura-1', '--color-sakura-2'],
  momiji: ['--color-momiji-1', '--color-momiji-2', '--color-momiji-3'],
  ichou: ['--color-ichou-1', '--color-ichou-2'],
  snow: ['--color-snow'],
  hotaru: ['--color-hotaru'],
}

let ctx: CanvasRenderingContext2D | null = null
let particles: Particle[] = []
let w = 0
let h = 0
let raf = 0
let last = 0
let visible = true
let wind = 0
let pointer: { x: number; y: number } | null = null
let palette: string[] = []
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function spawn(s: Season, anywhere: boolean): Particle {
  const hotaru = s === 'hotaru'
  const snow = s === 'snow'
  return {
    x: rand(-20, w + 20),
    y: anywhere || hotaru ? rand(0, h) : rand(-60, -10),
    size: snow ? rand(1.4, 3.6) : hotaru ? rand(1.6, 2.8) : s === 'sakura' ? rand(5, 9) : s === 'momiji' ? rand(8, 13) : rand(7, 12),
    vy: snow ? rand(14, 34) : hotaru ? rand(-6, 6) : rand(22, 46),
    vx: hotaru ? rand(-8, 8) : rand(-6, 10),
    sway: snow ? rand(6, 16) : rand(10, 28),
    swayFreq: rand(0.4, 1.1),
    phase: rand(0, Math.PI * 2),
    rot: rand(0, Math.PI * 2),
    vrot: rand(-1.6, 1.6),
    flip: rand(0, Math.PI * 2),
    vflip: rand(1.2, 3.2),
    color: palette[Math.floor(Math.random() * palette.length)] ?? '#fff',
    alpha: snow ? rand(0.55, 0.95) : rand(0.75, 1),
  }
}

function countFor(s: Season): number {
  const area = (w * h) / 10000
  if (s === 'snow') return Math.round(Math.min(110, Math.max(30, area * 2.6)))
  if (s === 'hotaru') return Math.round(Math.min(30, Math.max(12, area * 0.7)))
  return Math.round(Math.min(48, Math.max(16, area * 1.3)))
}

function reset() {
  const s = season.value
  if (!s || !ctx) {
    particles = []
    return
  }
  const css = getComputedStyle(document.documentElement)
  palette = COLORS[s].map((v) => css.getPropertyValue(v).trim()).filter(Boolean)
  particles = Array.from({ length: countFor(s) }, () => spawn(s, true))
}

function resize() {
  const el = canvas.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const changed = Math.abs(r.width - w) > 1 || Math.abs(r.height - h) > 1
  w = r.width
  h = r.height
  el.width = Math.round(w * dpr)
  el.height = Math.round(h * dpr)
  ctx = el.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (changed || !particles.length) reset()
}

// 櫻花瓣：前端有缺口的花瓣
function petal(c: CanvasRenderingContext2D, s: number) {
  c.beginPath()
  c.moveTo(0, -0.62 * s)
  c.lineTo(0.24 * s, -s)
  c.bezierCurveTo(0.85 * s, -0.75 * s, 0.75 * s, 0.45 * s, 0, s)
  c.bezierCurveTo(-0.75 * s, 0.45 * s, -0.85 * s, -0.75 * s, -0.24 * s, -s)
  c.closePath()
  c.fill()
}

// 楓葉：五個尖角＋葉柄
function maple(c: CanvasRenderingContext2D, s: number) {
  const angles = [-90, -38, 18, 162, 218].map((d) => (d * Math.PI) / 180)
  const len = [1, 0.9, 0.66, 0.66, 0.9]
  c.beginPath()
  angles.forEach((a, i) => {
    const r = len[i]! * s
    // 每個尖角兩側往外鼓，葉片才不會像星星
    c.lineTo(Math.cos(a - 0.62) * s * 0.36, Math.sin(a - 0.62) * s * 0.36)
    c.lineTo(Math.cos(a - 0.2) * r * 0.78, Math.sin(a - 0.2) * r * 0.78)
    c.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    c.lineTo(Math.cos(a + 0.2) * r * 0.78, Math.sin(a + 0.2) * r * 0.78)
  })
  c.closePath()
  c.fill()
  c.lineWidth = Math.max(0.8, s * 0.12)
  c.strokeStyle = c.fillStyle
  c.beginPath()
  c.moveTo(0, 0)
  c.lineTo(0, s * 0.95)
  c.stroke()
}

// 銀杏：扇形，上緣中間一道缺口
function ginkgo(c: CanvasRenderingContext2D, s: number) {
  c.beginPath()
  c.moveTo(0, 0.55 * s)
  c.lineTo(-0.95 * s, -0.35 * s)
  c.quadraticCurveTo(-0.5 * s, -0.95 * s, -0.08 * s, -0.8 * s)
  c.lineTo(0, -0.5 * s)
  c.lineTo(0.08 * s, -0.8 * s)
  c.quadraticCurveTo(0.5 * s, -0.95 * s, 0.95 * s, -0.35 * s)
  c.closePath()
  c.fill()
  c.lineWidth = Math.max(0.8, s * 0.1)
  c.strokeStyle = c.fillStyle
  c.beginPath()
  c.moveTo(0, 0.5 * s)
  c.lineTo(0, 1.05 * s)
  c.stroke()
}

function draw(c: CanvasRenderingContext2D, s: Season, p: Particle, t: number) {
  if (s === 'snow') {
    c.globalAlpha = p.alpha
    c.fillStyle = p.color
    c.beginPath()
    c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    c.fill()
    return
  }
  if (s === 'hotaru') {
    // 明滅：慢慢亮起、慢慢暗下
    const glow = 0.5 + 0.5 * Math.sin(t * p.swayFreq * 2.2 + p.phase)
    c.globalAlpha = 0.15 + glow * 0.85
    const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5)
    g.addColorStop(0, p.color)
    g.addColorStop(0.25, p.color)
    g.addColorStop(1, 'transparent')
    c.fillStyle = g
    c.beginPath()
    c.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2)
    c.fill()
    return
  }
  c.save()
  c.translate(p.x, p.y)
  c.rotate(p.rot)
  // 翻轉：左右寬度隨角度變化，看起來像在空中翻面
  c.scale(Math.max(0.12, Math.abs(Math.cos(p.flip))), 1)
  c.globalAlpha = p.alpha * (0.75 + 0.25 * Math.abs(Math.cos(p.flip)))
  c.fillStyle = p.color
  if (s === 'sakura') petal(c, p.size)
  else if (s === 'momiji') maple(c, p.size)
  else ginkgo(c, p.size)
  c.restore()
}

function frame(now: number) {
  raf = 0
  const c = ctx
  const s = season.value
  if (!c || !s || !visible) return
  const dt = Math.min(0.05, (now - (last || now)) / 1000)
  last = now
  const t = now / 1000
  wind *= Math.pow(0.15, dt)
  c.clearRect(0, 0, w, h)
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i]!
    // 游標附近被推開
    if (pointer) {
      const dx = p.x - pointer.x
      const dy = p.y - pointer.y
      const d2 = dx * dx + dy * dy
      if (d2 < 90 * 90 && d2 > 1) {
        const f = (1 - Math.sqrt(d2) / 90) * 420 * dt
        const d = Math.sqrt(d2)
        p.vx += (dx / d) * f
        p.vy += (dy / d) * f * 0.5
      }
    }
    if (s === 'hotaru') {
      p.vx += rand(-14, 14) * dt
      p.vy += rand(-14, 14) * dt
      p.vx *= Math.pow(0.6, dt)
      p.vy *= Math.pow(0.6, dt)
      p.x += (p.vx + wind) * dt
      p.y += p.vy * dt
      if (p.x < -20) p.x = w + 20
      if (p.x > w + 20) p.x = -20
      if (p.y < -20) p.y = h + 20
      if (p.y > h + 20) p.y = -20
    } else {
      // 推開後慢慢回到原本的落速
      const base = s === 'snow' ? 24 : 34
      p.vy += (base - p.vy) * Math.min(1, dt * 0.6)
      p.vx += (4 - p.vx) * Math.min(1, dt * 0.4)
      p.x += (p.vx + wind + Math.sin(t * p.swayFreq + p.phase) * p.sway) * dt
      p.y += p.vy * dt
      p.rot += p.vrot * dt
      p.flip += p.vflip * dt
      if (p.y > h + 24 || p.x > w + 40 || p.x < -40) particles[i] = spawn(s, false)
    }
    draw(c, s, p, t)
  }
  c.globalAlpha = 1
  raf = requestAnimationFrame(frame)
}

function start() {
  if (reduced || raf || !season.value) return
  last = 0
  raf = requestAnimationFrame(frame)
}
function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

// 游標經過：記位置、依移動速度吹起一陣風
function onMove(e: PointerEvent) {
  const el = canvas.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  if (pointer) wind = Math.max(-160, Math.min(160, wind + (x - pointer.x) * 2.2))
  pointer = { x, y }
}
function onLeave() {
  pointer = null
}
function onVisibility() {
  if (document.hidden) stop()
  else if (visible) start()
}

watch(season, () => {
  reset()
  stop()
  if (ctx) ctx.clearRect(0, 0, w, h)
  start()
})

onMounted(() => {
  if (reduced) return
  const el = canvas.value
  const host = el?.parentElement
  if (!el || !host) return
  resize()
  ro = new ResizeObserver(() => resize())
  ro.observe(el)
  io = new IntersectionObserver(([e]) => {
    visible = Boolean(e?.isIntersecting)
    if (visible) start()
    else stop()
  })
  io.observe(el)
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerleave', onLeave)
  document.addEventListener('visibilitychange', onVisibility)
  start()
})
onBeforeUnmount(() => {
  stop()
  ro?.disconnect()
  io?.disconnect()
  const host = canvas.value?.parentElement
  host?.removeEventListener('pointermove', onMove)
  host?.removeEventListener('pointerleave', onLeave)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <canvas v-if="!reduced" ref="canvas" class="pointer-events-none absolute inset-0 size-full" aria-hidden="true"></canvas>
</template>
