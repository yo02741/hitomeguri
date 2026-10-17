import type { Weather } from '../engine/render'
import type { Season, TimeOfDay } from '../engine/types'

import type { PhotoSlot } from './state'

/**
 * 拍照（規格 §8.4）的純邏輯：構圖分數、相簿的格子、取景框的大小與移動、裁切畫面。
 * 分數（0–100，數字，遊戲的規則）：
 *   地標整個在框裡 30（切到一部分照比例少很多）；佔畫面 25–60% 20（太小、太大照比例少）；
 *   地標中心靠近三分線的交點 15；路人擋到地標每個 −8（最多 −24）；自己或夥伴入鏡＝合照 +10；
 *   黃昏 +8、夜 +10；櫻、楓、雪 +10；祭典 +10；隨便拍也有 10。
 */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface ShotInput {
  frame: Rect
  /** 地標佔的範圍（畫面座標）；不在拍攝點拍的是 null */
  target: Rect | null
  /** 路人（NPC）的身體 */
  people: readonly Rect[]
  /** 自己、夥伴 */
  selves: readonly Rect[]
  time: TimeOfDay
  season: Season
  weather: Weather
  festival: boolean
  /** 花季（平年值）：櫻、楓 */
  bloom: 'sakura' | 'momiji' | null
  /** 冬天會積雪的地方（沖繩不會） */
  snowy: boolean
}

export interface ScorePart {
  label: string
  points: number
}

export interface ShotScore {
  score: number
  parts: ScorePart[]
  together: boolean
  slot: PhotoSlot
}

export const area = (r: Rect) => Math.max(0, r.w) * Math.max(0, r.h)

export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const w = Math.min(a.x + a.w, b.x + b.w) - x
  const h = Math.min(a.y + a.h, b.y + b.h) - y
  return { x, y, w: Math.max(0, w), h: Math.max(0, h) }
}

/**
 * kit 冬天畫不畫積雪：近畿（屋頂積雪）、北海道（厚雪）會；關東不積雪（偶爾下雪是天氣畫的）、沖繩沒有雪。
 * 不積雪的地方只有下雪天才算雪景。
 */
export const SNOWY_KITS: ReadonlySet<string> = new Set(['kinki', 'hokkaido'])

/** 是不是下雪的景（下雪天，或會積雪的地方的冬天） */
export const isSnowScene = (i: Pick<ShotInput, 'weather' | 'season' | 'snowy'>) => i.weather === 'snow' || (i.snowy && i.season === 'winter')

/** 相簿的哪一格：祭典 > 夜 > 雪 > 春櫻 > 秋楓 > 平常 */
export function slotOf(i: Pick<ShotInput, 'festival' | 'time' | 'weather' | 'season' | 'snowy' | 'bloom'>): PhotoSlot {
  if (i.festival) return 'festival'
  if (i.time === 'night') return 'night'
  if (isSnowScene(i)) return 'snow'
  if (i.bloom === 'sakura') return 'sakura'
  if (i.bloom === 'momiji') return 'momiji'
  return 'normal'
}

export function scoreShot(i: ShotInput): ShotScore {
  const parts: ScorePart[] = [{ label: '拍照', points: 10 }]
  const f = i.frame
  const fa = Math.max(1, area(f))
  if (i.target && area(i.target) > 0) {
    const t = i.target
    const vis = intersect(t, f)
    const inside = area(vis) / area(t)
    // 整個在框裡
    const whole = inside >= 0.999 ? 30 : Math.round(30 * inside * 0.5)
    if (whole > 0) parts.push({ label: '構圖', points: whole })
    // 大小：佔畫面 25–60%
    const r = area(vis) / fa
    const size = r >= 0.25 && r <= 0.6 ? 20 : r < 0.25 ? Math.round(20 * (r / 0.25)) : Math.round(20 * Math.max(0, (1 - r) / 0.4))
    if (size > 0) parts.push({ label: '大小', points: size })
    // 三分線：看得到的那一塊的中心，離最近的交點多遠（以框的寬高為 1）
    if (area(vis) > 0) {
      const cx = (vis.x + vis.w / 2 - f.x) / f.w
      const cy = (vis.y + vis.h / 2 - f.y) / f.h
      let d = Infinity
      for (const px of [1 / 3, 2 / 3]) for (const py of [1 / 3, 2 / 3]) d = Math.min(d, Math.hypot(cx - px, cy - py))
      const thirds = Math.round(15 * Math.max(0, 1 - d / 0.25))
      if (thirds > 0) parts.push({ label: '三分線', points: thirds })
    }
    // 路人擋到地標
    let blocked = 0
    for (const p of i.people) {
      const o = intersect(intersect(p, vis), f)
      if (area(p) > 0 && area(o) / area(p) > 0.2) blocked++
    }
    if (blocked) parts.push({ label: '路人', points: -8 * Math.min(3, blocked) })
  }
  // 合照：自己或夥伴大半在框裡
  const together = i.selves.some((s) => area(s) > 0 && area(intersect(s, f)) / area(s) >= 0.6)
  if (together) parts.push({ label: '合照', points: 10 })
  if (i.time === 'dusk') parts.push({ label: '黃昏', points: 8 })
  if (i.time === 'night') parts.push({ label: '夜', points: 10 })
  if (isSnowScene(i)) parts.push({ label: '雪', points: 10 })
  else if (i.bloom === 'sakura') parts.push({ label: '櫻', points: 10 })
  else if (i.bloom === 'momiji') parts.push({ label: '楓', points: 10 })
  if (i.festival) parts.push({ label: '祭典', points: 10 })
  const score = Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.points, 0)))
  return { score, parts, together, slot: slotOf(i) }
}

// ---------- 取景框 ----------
/** 兩段變焦：全畫面、中間放大一半（框是畫面的三分之二） */
export type Zoom = 1 | 2
/** 角上的變焦（點陣字的 ×，比 X 小：不會看成按鍵 X） */
export const ZOOM_LABEL: Record<Zoom, string> = { 1: '×1', 2: '×1.5' }

export function frameSize(W: number, H: number, zoom: Zoom): { w: number; h: number } {
  return zoom === 1 ? { w: W, h: H } : { w: Math.round((W * 2) / 3), h: Math.round((H * 2) / 3) }
}

/** 框放在畫面裡（不出界） */
export function clampFrame(f: Rect, W: number, H: number): Rect {
  return { ...f, x: Math.max(0, Math.min(W - f.w, Math.round(f.x))), y: Math.max(0, Math.min(H - f.h, Math.round(f.y))) }
}

/** 換變焦：框的中心不動 */
export function zoomFrame(f: Rect, W: number, H: number, zoom: Zoom): Rect {
  const s = frameSize(W, H, zoom)
  return clampFrame({ x: f.x + f.w / 2 - s.w / 2, y: f.y + f.h / 2 - s.h / 2, w: s.w, h: s.h }, W, H)
}

/** 從畫面（Uint32 的像素）裁下框裡的那一塊 */
export function crop(src: { w: number; h: number; buf: Uint32Array }, r: Rect): Uint32Array {
  const out = new Uint32Array(r.w * r.h)
  for (let y = 0; y < r.h; y++) {
    const sy = r.y + y
    if (sy < 0 || sy >= src.h) continue
    const x0 = Math.max(0, r.x)
    const x1 = Math.min(src.w, r.x + r.w)
    if (x0 >= x1) continue
    out.set(src.buf.subarray(sy * src.w + x0, sy * src.w + x1), y * r.w + (x0 - r.x))
  }
  return out
}

/** 角色的身體（畫面座標）：腳底在格子下緣，身體約 16×24 */
export function bodyRect(px: number, py: number, camX: number, camY: number): Rect {
  return { x: px - camX, y: py + 16 - 24 - camY, w: 16, h: 24 }
}

/** 照片 id：時間＋亂數（同一毫秒拍兩張也不撞） */
export function photoId(now = Date.now(), r = Math.random()): string {
  return `p${now.toString(36)}${Math.floor(r * 1296)
    .toString(36)
    .padStart(2, '0')}`
}
