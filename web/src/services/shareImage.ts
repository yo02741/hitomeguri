import { national, regionOf } from '../data/regions'
import themeColors from '../styles/theme-colors.json'
import type { useCatalogStore } from '../stores/catalog'
import type { KeikenLevel } from '../stores/keiken'
import { KEIKEN_LEVELS, KEIKEN_MAX } from '../stores/keiken'
import { japanOutline, loadPrefectureShapes } from './geo'
import { theme } from './theme'
import { wrapStops } from './stopWrap'
import { dayDate, type Trip } from './trip'

/**
 * 分享圖（DESIGN.md §7.22）：1080×1350（IG 直式）。只用自己畫的地圖（縣界）與文字，不放照片
 * （Commons 照片要逐張標作者與授權，分享出去容易漏）。顏色取 regions.json 與 theme.css 的 token。
 */
const W = 1080
const H = 1350
// 字型跟著年代主題（DESIGN.md §13）：畫之前從 token 讀
let SANS = '"Noto Sans TC", "Noto Sans JP", system-ui, sans-serif'
let JA = '"Noto Sans JP", "Noto Sans TC", system-ui, sans-serif'
let LATIN = '"Barlow Semi Condensed", "Noto Sans TC", system-ui, sans-serif'

// 地區色跟著主題：canvas 讀不到 CSS 變數的 [data-pref]，用 build-region-css 一起產生的 theme-colors.json（令和是 modern，已套中性色層次）
type Colors = Record<string, string>
const ERA_COLORS = themeColors as Record<string, { national: Colors; regions: Record<string, Colors> }>
function nationalColor(): Colors {
  const t = ERA_COLORS[theme.value]
  return t ? { ...national.color, ...t.national } : national.color
}
function prefColor(pref: string): Colors | undefined {
  const base = regionOf(pref)?.color
  const t = ERA_COLORS[theme.value]?.regions[pref]
  return base && t ? { ...base, ...t } : base
}

type Catalog = ReturnType<typeof useCatalogStore>

async function fonts() {
  SANS = cssToken('--font-sans') || SANS
  JA = cssToken('--font-ja') || JA
  LATIN = cssToken('--font-latin') || LATIN
  const specs = [`900 64px ${JA}`, `700 32px ${SANS}`, `400 28px ${SANS}`, `700 64px ${LATIN}`, `600 28px ${LATIN}`]
  await Promise.race([Promise.all(specs.map((s) => document.fonts.load(s, '一巡りひとめぐり經縣值DAY0123'))), new Promise((r) => setTimeout(r, 3000))])
}

function setup(canvas: HTMLCanvasElement, h = H): CanvasRenderingContext2D {
  canvas.width = W
  canvas.height = h
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
  const c = nationalColor()
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
  footer(ctx, c.ink)
}

// 縣界的出處（地球地図日本）列在 /credits，圖上不放（使用者決定 2026-10-11）
function footer(ctx: CanvasRenderingContext2D, ink: string, h = H) {
  ctx.textAlign = 'right'
  ctx.font = `700 26px ${LATIN}`
  ctx.fillStyle = ink
  ctx.fillText('HITOMEGURI', W - 64, h - 40)
  ctx.textAlign = 'left'
}

// ---------- 旅行回顧 ----------

/**
 * 縣名放哪裡：卡片裡（扣掉邊緣與右上的日本全圖）每 24px 一個格點，落在這個縣裡的格點太少（不到 6 個）就不標；
 * 其餘取離停留點遠（最多算到 90px）、離這個縣在畫面裡的重心近的一點。
 */
function prefLabelSpot(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  card: { x: number; y: number; w: number; h: number },
  mini: { x: number; y: number; w: number; h: number },
  dots: ReadonlyArray<readonly [number, number]>,
): [number, number] | null {
  const step = 24
  const inside: Array<[number, number]> = []
  for (let y = card.y + 36; y <= card.y + card.h - 24; y += step) {
    for (let x = card.x + 60; x <= card.x + card.w - 60; x += step) {
      if (x > mini.x - 50 && x < mini.x + mini.w + 50 && y > mini.y - 30 && y < mini.y + mini.h + 30) continue
      if (ctx.isPointInPath(path, x, y, 'evenodd')) inside.push([x, y])
    }
  }
  if (inside.length < 6) return null
  const cx = inside.reduce((a, p) => a + p[0], 0) / inside.length
  const cy = inside.reduce((a, p) => a + p[1], 0) / inside.length
  let best: [number, number] | null = null
  let bestScore = -Infinity
  for (const [x, y] of inside) {
    const near = dots.reduce((m, [dx, dy]) => Math.min(m, Math.hypot(dx - x, dy - y)), Infinity)
    const score = Math.min(near, 90) - 0.35 * Math.hypot(x - cx, y - cy)
    if (score > bestScore) {
      bestScore = score
      best = [x, y]
    }
  }
  return best
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function fmtDate(d: string): string {
  return d.replaceAll('-', '.')
}

// 每天的停留點一列：DAY 標記、日期、地點（太長時在「→」處換行，一個地點也放不下時照字切）
const LIST_TOP = 1036
const LINE = 42
const ROW_GAP = 16
const DATE_X = 196

interface DayRow {
  idx: number
  y: number
  md: string
  mdW: number
  wd: string
  x: number
  lines: string[]
}

function measurer(): CanvasRenderingContext2D {
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) throw new Error('canvas')
  return ctx
}

function layoutDays(trip: Trip): DayRow[] {
  const m = measurer()
  const rows: DayRow[] = []
  let y = LIST_TOP
  trip.days.forEach((d, idx) => {
    const date = dayDate(trip, idx)
    let md = ''
    let wd = ''
    let mdW = 0
    let x = DATE_X
    if (date) {
      md = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
      wd = `（${WEEK[new Date(`${date}T00:00:00`).getDay()]}）`
      m.font = `600 28px ${LATIN}`
      mdW = m.measureText(md).width
      m.font = `400 24px ${SANS}`
      x = DATE_X + mdW + 6 + m.measureText(wd).width + 10
    }
    m.font = `700 30px ${JA}`
    const lines = d.stops.length ? wrapStops(d.stops.map((s) => s.name), W - 64 - x, (t) => m.measureText(t).width) : []
    rows.push({ idx, y, md, mdW, wd, x, lines })
    y += Math.max(1, lines.length) * LINE + ROW_GAP
  })
  return rows
}

export async function drawTripRecap(canvas: HTMLCanvasElement, trip: Trip, catalog: Catalog) {
  await fonts()
  const days = trip.days.filter((d) => d.stops.length)
  const stops = trip.days.flatMap((d) => d.stops)
  const prefs = [...new Set(stops.map((s) => s.pref))]
  await Promise.all(prefs.map((p) => catalog.loadMap(p)))
  // 主縣：停留點最多的縣，決定整張圖的顏色
  const countBy = new Map<string, number>()
  for (const s of stops) countBy.set(s.pref, (countBy.get(s.pref) ?? 0) + 1)
  const main = [...countBy.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const c = prefColor(main) ?? nationalColor()
  const colorOf = (pref: string) => prefColor(pref) ?? nationalColor()

  // 每天一列，地點多時換行（使用者回饋 2026-10-11：每一天都要列出來）；列不下時圖往下加高（最少 1350）
  const rows = layoutDays(trip)
  const last = rows[rows.length - 1]
  const listBottom = last ? last.y + (Math.max(1, last.lines.length) - 1) * LINE : LIST_TOP
  const height = Math.max(H, listBottom + 110)
  const ctx = setup(canvas, height)
  ctx.fillStyle = c.paper
  ctx.fillRect(0, 0, W, height)

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
  const card = { x: 60, y: 410, w: W - 120, h: 560 }
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
    const paths = new Map<string, Path2D>()
    for (const f of shapes) {
      const pref = f.properties.pref
      const col = colorOf(pref)
      const path = new Path2D()
      for (const poly of f.geometry.coordinates) {
        for (const ring of poly) {
          ring.forEach(([lng, lat], i) => (i ? path.lineTo(X(lng), Y(lat)) : path.moveTo(X(lng), Y(lat))))
          path.closePath()
        }
      }
      paths.set(pref, path)
      ctx.fillStyle = prefs.includes(pref) ? col.accent : c.surface
      ctx.fill(path, 'evenodd')
      ctx.strokeStyle = c.paper
      ctx.lineWidth = 3
      ctx.stroke(path)
    }
    const dots = pts.map((p) => [X(p.lng), Y(p.lat)] as const)
    // 日本全圖放在停留點最少的角落（右上優先），不蓋住停留點與 DAY 標籤
    const mw = 154
    const mh = 170
    const corners = [
      { x: card.x + card.w - mw - 16, y: card.y + 16 },
      { x: card.x + 16, y: card.y + 16 },
      { x: card.x + card.w - mw - 16, y: card.y + card.h - mh - 16 },
      { x: card.x + 16, y: card.y + card.h - mh - 16 },
    ]
    const covered = (r: { x: number; y: number }) =>
      dots.filter(([dx, dy]) => dx > r.x - 60 && dx < r.x + mw + 30 && dy > r.y - 50 && dy < r.y + mh + 30).length
    const corner = corners.reduce((best, r) => (covered(r) < covered(best) ? r : best), corners[0]!)
    const mini = { ...corner, w: mw, h: mh }
    // 縣名佔的位置（DAY 標籤讓開）
    const labelBoxes: Array<{ x: number; y: number; w: number; h: number }> = []
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
    // 縣名：看得出是哪裡（使用者回饋 2026-10-11）。畫面裡看得到的縣都標，這趟去的縣大字、其他的小字；
    // 位置取那個縣在畫面裡的格點中離停留點遠、離中心近的一點（日本全圖讓開）
    for (const [pref, path] of paths) {
      const spot = prefLabelSpot(ctx, path, card, mini, dots)
      if (!spot) continue
      const ours = prefs.includes(pref)
      const name = regionOf(pref)?.name.ja ?? pref
      ctx.font = ours ? `900 34px ${JA}` : `700 24px ${JA}`
      ctx.textAlign = 'center'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = c.paper
      ctx.strokeText(name, spot[0], spot[1])
      ctx.fillStyle = ours ? colorOf(pref).strong : c.sub
      ctx.fillText(name, spot[0], spot[1])
      const lw = ctx.measureText(name).width
      labelBoxes.push({ x: spot[0] - lw / 2 - 4, y: spot[1] - (ours ? 32 : 24), w: lw + 8, h: ours ? 40 : 30 })
      ctx.textAlign = 'left'
    }
    // 每天第一站旁標 DAY n（和下面的清單對得起來）：依序試點的右上、左上、右下、左下，
    // 不壓到日本全圖、已經放的標籤與停留點；都壓到時用右上
    type Box = { x: number; y: number; w: number; h: number }
    const hit = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
    const placed: Box[] = [mini, ...labelBoxes]
    const dotBoxes: Box[] = dots.map(([dx, dy]) => ({ x: dx - 18, y: dy - 18, w: 36, h: 36 }))
    for (const d of days) {
      const p = d.stops.map((st) => catalog.mapSpots[st.pref]?.find((x) => x.id === st.spot_id)).find(Boolean)
      if (!p) continue
      const col = colorOf(d.stops[0]!.pref)
      const label = `DAY ${trip.days.indexOf(d) + 1}`
      ctx.font = `700 22px ${LATIN}`
      const tw = ctx.measureText(label).width + 20
      const px = X(p.lng)
      const py = Y(p.lat)
      const clampBox = (x: number, y: number): Box => ({
        x: Math.max(card.x + 8, Math.min(x, card.x + card.w - tw - 8)),
        y: Math.max(card.y + 8, Math.min(y, card.y + card.h - 40)),
        w: tw,
        h: 32,
      })
      const tries = [clampBox(px + 20, py - 48), clampBox(px - 20 - tw, py - 48), clampBox(px + 20, py + 16), clampBox(px - 20 - tw, py + 16)]
      const box = tries.find((t) => !placed.some((b) => hit(t, b)) && !dotBoxes.some((b) => hit(t, b))) ?? tries.find((t) => !placed.some((b) => hit(t, b))) ?? tries[0]!
      placed.push(box)
      const tx = box.x
      const ty = box.y
      roundRect(ctx, tx, ty, tw, 32, 6)
      ctx.fillStyle = col.base
      ctx.fill()
      ctx.lineWidth = 3
      ctx.strokeStyle = c.paper
      ctx.stroke()
      ctx.fillStyle = col.on_base
      ctx.fillText(label, tx + 10, ty + 24)
    }
    ctx.restore()
    // 日本全圖：看得出在日本的哪裡
    roundRect(ctx, mini.x, mini.y, mini.w, mini.h, 14)
    ctx.fillStyle = c.paper
    ctx.fill()
    await drawJapan(ctx, { x: mini.x + 8, y: mini.y + 8, w: mini.w - 16, h: mini.h - 16 }, (p) => (prefs.includes(p) ? colorOf(p).strong : c.line), c.paper, c.line)
  }

  // 每天的停留點
  // 每一天都列（沒排地點的天也留 DAY 標記與日期）；地點多時換行，第二行起對齊第一個地點
  for (const r of rows) {
    const d = trip.days[r.idx]!
    const col = d.stops[0] ? colorOf(d.stops[0].pref) : c
    roundRect(ctx, 64, r.y - 34, 112, 46, 8)
    ctx.fillStyle = col.base
    ctx.fill()
    ctx.fillStyle = col.on_base
    ctx.font = `700 28px ${LATIN}`
    ctx.fillText(`DAY ${r.idx + 1}`, 78, r.y - 1)
    if (r.md) {
      ctx.fillStyle = c.sub
      ctx.font = `600 28px ${LATIN}`
      ctx.fillText(r.md, DATE_X, r.y)
      ctx.font = `400 24px ${SANS}`
      ctx.fillText(r.wd, DATE_X + r.mdW + 6, r.y)
    }
    ctx.fillStyle = c.ink
    ctx.font = `700 30px ${JA}`
    r.lines.forEach((line, i) => ctx.fillText(line, r.x, r.y + i * LINE))
  }
  footer(ctx, c.ink, height)
}
