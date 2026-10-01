import { national, regionOf } from '../data/regions'
import type { useCatalogStore } from '../stores/catalog'
import type { KeikenLevel } from '../stores/keiken'
import { KEIKEN_LEVELS, KEIKEN_MAX } from '../stores/keiken'
import { japanOutline, loadPrefectureShapes } from './geo'
import { dayDate, type Trip } from './trip'

/**
 * 分享圖（DESIGN.md §7.22）：1080×1350（IG 直式）。只用自己畫的地圖（縣界）與文字，不放照片
 * （Commons 照片要逐張標作者與授權，分享出去容易漏）。顏色取 regions.json 與 theme.css 的 token。
 */
const W = 1080
const H = 1350
const SANS = '"Noto Sans TC", "Noto Sans JP", system-ui, sans-serif'
const JA = '"Noto Sans JP", "Noto Sans TC", system-ui, sans-serif'
const LATIN = '"Barlow Semi Condensed", "Noto Sans TC", system-ui, sans-serif'
const GSI_CREDIT = '縣界：地球地図日本（国土地理院）'

type Catalog = ReturnType<typeof useCatalogStore>

async function fonts() {
  const specs = [`900 64px ${JA}`, `700 32px ${SANS}`, `400 28px ${SANS}`, `700 64px ${LATIN}`, `600 28px ${LATIN}`]
  await Promise.race([Promise.all(specs.map((s) => document.fonts.load(s, '一巡りひとめぐり經縣值DAY0123'))), new Promise((r) => setTimeout(r, 3000))])
}

function setup(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.textBaseline = 'alphabetic'
  return ctx
}

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** 超過寬度時截斷加「…」 */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

function wordmark(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, align: CanvasTextAlign = 'left') {
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.font = `900 34px ${JA}`
  ctx.fillText('一巡り', x, y)
  ctx.textAlign = 'left'
}

/** 日本全圖（縣界 SVG path）畫進 (x, y, w, h)，fill 決定各縣顏色；回傳換算用的比例與位移 */
async function drawJapan(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  fill: (pref: string) => string,
  stroke: string,
  insetStroke: string,
) {
  const o = await japanOutline()
  const [, , vw, vh] = o.viewBox.split(' ').map(Number) as [number, number, number, number]
  const s = Math.min(box.w / vw, box.h / vh)
  const ox = box.x + (box.w - vw * s) / 2
  const oy = box.y + (box.h - vh * s) / 2
  ctx.save()
  ctx.translate(ox, oy)
  ctx.scale(s, s)
  ctx.lineJoin = 'round'
  for (const p of o.paths) {
    const path = new Path2D(p.d)
    ctx.fillStyle = fill(p.pref)
    ctx.fill(path)
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1.2 / s
    ctx.stroke(path)
  }
  const [ix, iy, iw, ih] = o.inset
  ctx.setLineDash([6 / s, 4 / s])
  ctx.strokeStyle = insetStroke
  ctx.lineWidth = 1.5 / s
  ctx.strokeRect(ix, iy, iw, ih)
  ctx.restore()
  return { s, ox, oy }
}

// ---------- 經縣值 ----------

export async function drawKeiken(canvas: HTMLCanvasElement, opts: { levelOf: (pref: string) => KeikenLevel; total: number }) {
  await fonts()
  const ctx = setup(canvas)
  const c = national.color
  const level = (l: number) => (l === 0 ? c.line : cssToken(`--color-keiken-${l}`))

  ctx.fillStyle = c.paper
  ctx.fillRect(0, 0, W, H)
  // 上方色帶：標題與分數
  ctx.fillStyle = c.base
  ctx.fillRect(0, 0, W, 300)
  wordmark(ctx, 64, 88, c.on_base)
  ctx.fillStyle = c.on_base
  ctx.font = `900 76px ${SANS}`
  ctx.fillText('經縣值', 64, 220)
  ctx.textAlign = 'right'
  ctx.font = `600 56px ${LATIN}`
  const max = `/ ${KEIKEN_MAX}`
  const maxW = ctx.measureText(max).width
  ctx.fillText(max, W - 64, 236)
  ctx.font = `700 190px ${LATIN}`
  ctx.fillText(String(opts.total), W - 64 - maxW - 18, 236)
  ctx.textAlign = 'left'

  await drawJapan(ctx, { x: 70, y: 340, w: 940, h: 820 }, (p) => level(opts.levelOf(p)), c.paper, c.line)

  // 圖例
  const counts = new Map<number, number>()
  for (const l of KEIKEN_LEVELS) counts.set(l.level, 0)
  const all = (await japanOutline()).paths.map((p) => opts.levelOf(p.pref))
  for (const l of all) counts.set(l, (counts.get(l) ?? 0) + 1)
  const cell = (W - 128) / KEIKEN_LEVELS.length
  KEIKEN_LEVELS.forEach((l, i) => {
    const x = 64 + i * cell
    roundRect(ctx, x, 1200, 34, 34, 6)
    ctx.fillStyle = level(l.level)
    ctx.fill()
    ctx.fillStyle = c.ink
    ctx.font = `700 28px ${SANS}`
    ctx.fillText(l.label, x + 46, 1228)
    const lw = ctx.measureText(l.label).width
    ctx.font = `600 30px ${LATIN}`
    ctx.fillStyle = c.sub
    ctx.fillText(String(counts.get(l.level) ?? 0), x + 46 + lw + 10, 1228)
  })
  footer(ctx, c.sub, c.ink)
}

function footer(ctx: CanvasRenderingContext2D, sub: string, ink: string) {
  ctx.font = `400 22px ${SANS}`
  ctx.fillStyle = sub
  ctx.fillText(GSI_CREDIT, 64, H - 40)
  ctx.textAlign = 'right'
  ctx.font = `700 26px ${LATIN}`
  ctx.fillStyle = ink
  ctx.fillText('HITOMEGURI', W - 64, H - 40)
  ctx.textAlign = 'left'
}

// ---------- 旅行回顧 ----------

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function fmtDate(d: string): string {
  return d.replaceAll('-', '.')
}

export async function drawTripRecap(canvas: HTMLCanvasElement, trip: Trip, catalog: Catalog) {
  await fonts()
  const ctx = setup(canvas)
  const days = trip.days.filter((d) => d.stops.length)
  const stops = trip.days.flatMap((d) => d.stops)
  const prefs = [...new Set(stops.map((s) => s.pref))]
  await Promise.all(prefs.map((p) => catalog.loadMap(p)))
  // 主縣：停留點最多的縣，決定整張圖的顏色
  const countBy = new Map<string, number>()
  for (const s of stops) countBy.set(s.pref, (countBy.get(s.pref) ?? 0) + 1)
  const main = [...countBy.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const c = regionOf(main)?.color ?? national.color
  const colorOf = (pref: string) => regionOf(pref)?.color ?? national.color

  ctx.fillStyle = c.paper
  ctx.fillRect(0, 0, W, H)

  // 上方色帶：行程名稱、日期、統計
  ctx.fillStyle = c.base
  ctx.fillRect(0, 0, W, 380)
  wordmark(ctx, 64, 86, c.on_base)
  ctx.fillStyle = c.on_base
  ctx.font = `900 66px ${SANS}`
  ctx.fillText(fit(ctx, trip.name || '未命名行程', W - 128), 64, 196)
  ctx.font = `600 38px ${LATIN}`
  const dates = trip.start_date ? `${fmtDate(trip.start_date)}${trip.end_date && trip.end_date !== trip.start_date ? ` – ${fmtDate(trip.end_date).slice(5)}` : ''}` : ''
  ctx.fillText(dates, 64, 262)
  ctx.font = `700 32px ${SANS}`
  const prefNames = prefs.map((p) => regionOf(p)?.name.ja ?? p).join('・')
  ctx.fillText(fit(ctx, `${trip.days.length} 天　${stops.length} 個地方　${prefNames}`, W - 128), 64, 326)

  // 地圖：停留點範圍內的縣界＋每天的路線與順序
  const card = { x: 60, y: 410, w: W - 120, h: 600 }
  roundRect(ctx, card.x, card.y, card.w, card.h, 24)
  ctx.fillStyle = cssToken('--color-map-water') || c.map
  ctx.fill()
  const pts = stops
    .map((s) => catalog.mapSpots[s.pref]?.find((x) => x.id === s.spot_id))
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
  if (pts.length) {
    let w = Math.min(...pts.map((p) => p.lng))
    let e = Math.max(...pts.map((p) => p.lng))
    let s = Math.min(...pts.map((p) => p.lat))
    let n = Math.max(...pts.map((p) => p.lat))
    const k = Math.cos((((s + n) / 2) * Math.PI) / 180)
    // 最少 0.06 度（約 6 km）、四周留一點，並配合卡片的長寬比
    const minSpan = 0.06
    let spanX = Math.max((e - w) * k, minSpan) * 1.3
    let spanY = Math.max(n - s, minSpan) * 1.3
    const pad = 40
    const aspect = (card.w - pad * 2) / (card.h - pad * 2)
    if (spanX / spanY > aspect) spanY = spanX / aspect
    else spanX = spanY * aspect
    const cx = (w + e) / 2
    const cy = (s + n) / 2
    w = cx - spanX / k / 2
    e = cx + spanX / k / 2
    s = cy - spanY / 2
    n = cy + spanY / 2
    const sx = (card.w - pad * 2) / ((e - w) * k)
    const X = (lng: number) => card.x + pad + (lng - w) * k * sx
    const Y = (lat: number) => card.y + pad + (n - lat) * sx

    ctx.save()
    roundRect(ctx, card.x, card.y, card.w, card.h, 24)
    ctx.clip()
    const shapes = await loadPrefectureShapes()
    for (const f of shapes) {
      const pref = f.properties.pref
      const col = colorOf(pref)
      ctx.beginPath()
      for (const poly of f.geometry.coordinates) {
        for (const ring of poly) {
          ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(X(lng), Y(lat)) : ctx.moveTo(X(lng), Y(lat))))
          ctx.closePath()
        }
      }
      ctx.fillStyle = prefs.includes(pref) ? col.accent : c.surface
      ctx.fill('evenodd')
      ctx.strokeStyle = c.paper
      ctx.lineWidth = 3
      ctx.stroke()
    }
    // 路線：每天一條，用那天主縣的 strong 色
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const d of days) {
      const dp = d.stops.map((st) => catalog.mapSpots[st.pref]?.find((x) => x.id === st.spot_id)).filter(Boolean) as typeof pts
      if (dp.length < 2) continue
      ctx.beginPath()
      dp.forEach((p, i) => (i ? ctx.lineTo(X(p.lng), Y(p.lat)) : ctx.moveTo(X(p.lng), Y(p.lat))))
      ctx.strokeStyle = colorOf(d.stops[0]!.pref).strong
      ctx.lineWidth = 7
      ctx.setLineDash([16, 12])
      ctx.stroke()
      ctx.setLineDash([])
    }
    // 停留點：每天從 1 開始編號
    for (const d of days) {
      d.stops.forEach((st, i) => {
        const p = catalog.mapSpots[st.pref]?.find((x) => x.id === st.spot_id)
        if (!p) return
        ctx.beginPath()
        ctx.arc(X(p.lng), Y(p.lat), 17, 0, Math.PI * 2)
        ctx.fillStyle = colorOf(st.pref).strong
        ctx.fill()
        ctx.lineWidth = 4
        ctx.strokeStyle = c.paper
        ctx.stroke()
        ctx.fillStyle = c.paper
        ctx.font = `700 20px ${LATIN}`
        ctx.textAlign = 'center'
        ctx.fillText(String(i + 1), X(p.lng), Y(p.lat) + 7)
        ctx.textAlign = 'left'
      })
    }
    ctx.restore()
    // 右上的日本全圖：看得出在日本的哪裡
    const mini = { x: card.x + card.w - 170, y: card.y + 16, w: 154, h: 170 }
    roundRect(ctx, mini.x, mini.y, mini.w, mini.h, 14)
    ctx.fillStyle = c.paper
    ctx.fill()
    await drawJapan(ctx, { x: mini.x + 8, y: mini.y + 8, w: mini.w - 16, h: mini.h - 16 }, (p) => (prefs.includes(p) ? colorOf(p).strong : c.line), c.paper, c.line)
  }

  // 每天的停留點
  let y = 1080
  const shown = days.slice(0, 4)
  for (const d of shown) {
    const idx = trip.days.indexOf(d)
    const col = colorOf(d.stops[0]!.pref)
    roundRect(ctx, 64, y - 34, 112, 46, 8)
    ctx.fillStyle = col.base
    ctx.fill()
    ctx.fillStyle = col.on_base
    ctx.font = `700 28px ${LATIN}`
    ctx.fillText(`DAY ${idx + 1}`, 78, y - 1)
    const date = dayDate(trip, idx)
    let x = 196
    if (date) {
      ctx.fillStyle = c.sub
      ctx.font = `600 28px ${LATIN}`
      const md = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
      ctx.fillText(md, x, y)
      x += ctx.measureText(md).width + 6
      ctx.font = `400 24px ${SANS}`
      const wd = `（${WEEK[new Date(`${date}T00:00:00`).getDay()]}）`
      ctx.fillText(wd, x, y)
      x += ctx.measureText(wd).width + 10
    }
    ctx.fillStyle = c.ink
    ctx.font = `700 30px ${JA}`
    ctx.fillText(fit(ctx, d.stops.map((s) => s.name).join(' → '), W - 64 - x), x, y)
    y += 62
  }
  if (days.length > shown.length) {
    ctx.fillStyle = c.sub
    ctx.font = `400 26px ${SANS}`
    ctx.fillText(`還有 ${days.length - shown.length} 天`, 64, y)
  }
  footer(ctx, c.sub, c.ink)
}
