import { drawSprite } from '../build'
import { dotOn, type Gfx } from '../gfx'
import { cedar, roundTree, skyBase } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import { type AreaDef, type Env, type EventDef, FLOOR, H } from '../types'

/**
 * 白川鄉：白山的群山、庄川與であい橋，杉林與田間一棟棟的合掌造（陡的茅草人字屋根、三角山牆的障子窗）。
 * 遠山 0.1、近山與庄川 0.25、中景的聚落 0.5、地面 1（大合掌、田、板倉、放水銃小屋）、前景 1.3。
 * 春天水田映著天空、夏天綠油油、秋天金黃稻穗與稻架、冬天厚雪與夜裡點燈。
 */
const PATH = FLOOR - 8
/** 地面層的田：遠端田埂的 y（再往下是水面或稻子，到 PATH - 1） */
const LEVEE = 115
/** 中景聚落的地面 */
const MID = 111

const isWinter = (env: Env) => env.season === 'winter'
const waterOf = (env: Env): Px => (env.time === 'night' ? 'sky-night-2' : env.time === 'dusk' ? 'sky-dusk-3' : 'sky-day-2')
const rippleOf = (env: Env): Px => (env.time === 'night' ? 'sky-night-3' : env.time === 'dusk' ? 'sky-dusk-2' : 'sky-day-3')
const hazeOf = (env: Env): Px => (env.time === 'night' ? 'sky-night-3' : env.time === 'dusk' ? 'sky-dusk-3' : 'sky-day-3')

// ---------- 地面層畫的時候記下房子、田的位置（腳本用：屋根的雪、稻草人、白鷺） ----------
interface HouseSpot {
  gx: number
  hw: number
  L: number
  flip: boolean
  top: number
  eave: number
  ov: number
}
type FieldKind = 'water' | 'rice' | 'gold' | 'stubble' | 'snow'
interface FieldSpot {
  x0: number
  x1: number
  kind: FieldKind
}
const SPOTS: { houses: HouseSpot[]; fields: FieldSpot[] } = { houses: [], fields: [] }

/** 只在三角形裡抖色（頂點 cx, top；底邊 base、半寬 half） */
function ditherTri(g: Gfx, cx: number, top: number, base: number, half: number, k: Px, level: number) {
  for (let y = top; y <= base; y++) {
    const a = Math.floor((half * (y - top)) / Math.max(1, base - top))
    g.dither(cx - a, y, 2 * a + 1, 1, k, level)
  }
}

// ---------- 合掌造 ----------
interface Gassho {
  /** 山牆（三角）的中心 */
  gx: number
  /** 牆腳（最下面一列的下一列） */
  base: number
  /** 茅草屋根在簷口的半寬 */
  hw: number
  /** 一樓牆高 */
  wall: number
  /** 側面屋根的長（0：只看得到山牆） */
  L: number
  /** 側面在左邊 */
  flip: boolean
}

function gassho(g: Gfx, h: Gassho, env: Env, r: Rng): HouseSpot {
  const { gx, base, hw, wall, L, flip } = h
  const s = flip ? -1 : 1
  const X = (dx: number) => gx + s * dx
  const span = (a: number, b: number): [number, number] => {
    const p = X(a)
    const q = X(b)
    return [Math.min(p, q), Math.abs(q - p) + 1]
  }
  const k = hw / 28
  const big = k > 0.7
  const eave = base - wall
  const top = eave - Math.round(hw * 1.5)
  const ov = Math.max(1, Math.round(3 * k))
  const snow = isWinter(env)
  const night = env.time === 'night'
  const on = () => {
    const roll = r.next()
    return night ? roll < 0.9 : env.time === 'dusk' ? roll < 0.4 : false
  }
  const pane = (x: number, y: number, w: number, hh: number, lit: boolean) => {
    if (w <= 0 || hh <= 0) return
    g.rect(x, y, w, hh, lit ? 'lamp-2' : 'paper')
    if (lit && w > 2 && hh > 2) g.rect(x + 1, y + 1, w - 2, hh - 2, 'lamp-1')
    else if (!lit && hh > 2) g.hline(x, x + w - 1, y + hh - 1, 'paper-2')
    const step = big ? 3 : 2
    for (let i = x + step - 1; i < x + w - 1; i += step) g.vline(i, y, y + hh - 1, big ? 'wood-3' : lit ? 'lamp-2' : 'paper-2')
    if (big && hh >= 6) g.hline(x, x + w - 1, y + Math.floor(hh / 2), 'wood-3')
  }

  // 1. 側面的牆（側面屋根下面）：障子一排、入口、腰板
  if (L > 0) {
    const [sx, sw] = span(hw - 2, hw + L + ov)
    g.rect(sx, eave + 1, sw, base - eave - 1, 'wood-2')
    const wy = eave + Math.max(2, Math.round(4 * k))
    const wh = Math.max(1, Math.round(6 * k))
    const post = Math.max(4, Math.round(9 * k))
    for (let dx = hw; dx < hw + L - 1; dx += post) {
      const [px, pw] = span(dx + 1, Math.min(dx + post - 1, hw + L - 1))
      pane(px, wy, pw, wh, on())
      g.vline(X(dx), eave + 1, base - 1, 'wood-3')
    }
    if (big) {
      // 入口（土間）：夜裡透光
      const [dx0] = span(hw + Math.round(L * 0.55), hw + Math.round(L * 0.55) + 6)
      const doorLit = env.time !== 'day'
      g.rect(dx0, wy + wh + 2, 7, base - wy - wh - 4, doorLit ? 'lamp-2' : 'ink-2')
      g.rect(dx0 + 1, wy + wh + 3, 2, 4, doorLit ? 'lamp-1' : 'wood-3')
      for (let x = sx; x < sx + sw; x += 3) if (x < dx0 - 1 || x > dx0 + 7) g.vline(x, wy + wh + 3, base - 3, 'wood-3')
      if (snow) {
        // 雪囲い：一樓圍上木板
        for (let x = sx + 1; x < sx + sw - 1; x += 2) if (x < dx0 - 1 || x > dx0 + 7) g.vline(x, wy + wh + 4, base - 2, x % 4 === 1 ? 'wood-1' : 'wood-3')
      }
    }
    g.hline(sx, sx + sw - 1, eave + 1, 'ink-2')
    g.dither(sx, eave + 2, sw, 2, 'ink-2', 6)
    g.rect(sx, base - 2, sw, 2, 'stone-3')
  }

  // 2. 山牆那一面的一樓
  {
    const fx = gx - hw + ov + 1
    const fw = 2 * (hw - ov - 1) + 1
    g.rect(fx, eave + 1, fw, base - eave - 1, 'wood-2')
    g.hline(fx, fx + fw - 1, eave + 1, 'wood-3')
    const wy = eave + Math.max(2, Math.round(4 * k))
    const wh = Math.max(1, Math.round(7 * k))
    const half = Math.floor(fw / 2)
    pane(fx + 2, wy, half - 3, wh, on())
    pane(fx + half + 2, wy, fw - half - 4, wh, on())
    g.vline(fx, eave + 1, base - 1, 'wood-3')
    g.vline(fx + fw - 1, eave + 1, base - 1, 'wood-3')
    g.vline(gx, eave + 1, base - 1, 'wood-3')
    if (big) for (let x = fx + 2; x < fx + fw - 1; x += 3) g.vline(x, wy + wh + 2, base - 3, 'wood-3')
    g.rect(fx - 1, base - 2, fw + 2, 2, 'stone-3')
    g.hline(fx - 1, fx + fw, base - 2, 'stone-2')
  }

  // 3. 側面的茅草屋根（平行四邊形）
  const rowOf = (y: number): [number, number] => {
    const t = (y - top) / (eave + ov - top)
    const a = hw * t
    return span(a, a + L)
  }
  if (L > 0) {
    g.poly([X(0), top, X(L), top, X(L + hw), eave + ov + 1, X(hw), eave + ov + 1], snow ? 'snow-1' : 'dirt-2')
    if (snow) g.line(X(L), top, X(L + hw), eave + ov, 'snow-2')
    for (let y = top + 1; y <= eave + ov; y++) {
      const [x0, ww] = rowOf(y)
      const t = (y - top) / (eave + ov - top)
      if (snow) {
        // 雪：下半部有一點陰影，底下露出茅草的切口
        if (t > 0.45) for (let x = x0; x < x0 + ww; x++) if (dotOn(x, y, Math.round((t - 0.45) * 12))) g.px(x, y, 'snow-2')
        continue
      }
      // 茅草一層一層：每隔幾列一條深色的線
      if ((y - top) % Math.max(2, Math.round(4 * k)) === 0) for (let x = x0 + 1; x < x0 + ww - 1; x++) if (((x * 7 + y * 3) & 7) !== 0) g.px(x, y, 'wood-2')
      if (t > 0.55) for (let x = x0; x < x0 + ww; x++) if (dotOn(x, y, 4)) g.px(x, y, 'wood-2')
      if (t < 0.12) for (let x = x0; x < x0 + ww; x++) if (dotOn(x, y, 6)) g.px(x, y, 'dirt-1')
    }
    // 簷口茅草的切口
    const [cx0, cw] = rowOf(eave + ov)
    g.hline(cx0, cx0 + cw - 1, eave + ov, 'dirt-1')
    if (big) for (let x = cx0; x < cx0 + cw; x += 2) g.px(x, eave + ov - 1, snow ? 'dirt-1' : 'wood-2')
    // 屋脊
    const [rx, rw] = span(0, L)
    g.hline(rx, rx + rw - 1, top, snow ? 'snow-1' : 'wood-3')
    if (snow) {
      g.hline(rx, rx + rw - 1, top - 1, 'snow-1')
      g.hline(rx, rx + rw - 1, top - 2, 'stone-2')
      for (let x = rx; x < rx + rw; x += 4) g.px(x, top - 2, 'snow-1')
      // 簷口垂下來的雪與冰柱
      for (let x = cx0; x < cx0 + cw; x += 3) g.rect(x, eave + ov + 1, 2, 1 + ((x >> 2) & 1), 'snow-1')
      g.hline(cx0, cx0 + cw - 1, eave + ov + 2, 'snow-2')
      if (big) for (let x = cx0 + 1; x < cx0 + cw - 1; x += r.int(3, 5)) g.vline(x, eave + ov + 3, eave + ov + 3 + r.int(1, 5), 'snow-2')
    } else if (big) for (let x = rx + 2; x < rx + rw - 1; x += 5) g.line(x, top - 2, x + 2, top, 'wood-3')
  }

  // 4. 山牆的茅草（人字形的厚邊）
  if (snow) {
    const st = Math.max(1, Math.round(3 * k))
    g.tri(gx - hw - st, eave + ov, gx, top - st - 1, gx + hw + st, eave + ov, 'snow-1')
    g.ellipse(gx - hw - 1, eave + ov, st + 1, st, 'snow-1')
    g.ellipse(gx + hw + 1, eave + ov, st + 1, st, 'snow-1')
    g.hline(gx - hw - st - 1, gx + hw + st + 1, eave + ov + st, 'snow-2')
  }
  g.tri(gx - hw, eave + ov + 1, gx, top, gx + hw, eave + ov + 1, 'dirt-1')
  if (big) {
    ditherTri(g, gx, top + 2, eave + ov, hw - 1, 'dirt-2', 3)
    // 切口的茅草：細細的直紋
    for (let y = top + 3; y <= eave + ov; y += 2) {
      const a = Math.round((hw * (y - top)) / (eave + ov + 1 - top))
      g.px(gx - a + 1, y, 'wood-2')
      g.px(gx + a - 1, y, 'wood-2')
    }
  }
  g.hline(gx - hw, gx + hw, eave + ov, 'wood-2')

  // 5. 山牆（三角的木板牆）與二、三、四樓的障子窗
  const gTop = top + Math.max(3, Math.round(8 * k))
  const inner = hw - ov - 1
  g.tri(gx - inner, eave + 1, gx, gTop, gx + inner, eave + 1, 'wood-3')
  g.line(gx - inner, eave, gx, gTop, 'ink-2')
  g.line(gx + inner, eave, gx, gTop, 'ink-2')
  const gh = eave + 1 - gTop
  const halfAt = (y: number) => Math.floor((inner * (y - gTop)) / gh)
  let bottom = eave - Math.max(1, Math.round(2 * k))
  const plan = [0.24, 0.17, 0.1]
  for (let i = 0; i < plan.length; i++) {
    const hh = Math.max(1, Math.round(gh * plan[i]!))
    const y = bottom - hh + 1
    const half = halfAt(y) - (big ? 3 : 2)
    if (half < 1 || y <= gTop + 1) break
    pane(gx - half, y, 2 * half + 1, hh, on())
    // 窗上的小簷
    if (big) g.hline(gx - half - 1, gx + half + 1, y - 2, 'wood-1')
    bottom = y - Math.max(2, Math.round(gh * 0.12))
  }
  if (big) {
    g.vline(gx, gTop + 2, gTop + 4, 'wood-2')
    // 夜裡的冬天：點燈，雪地映著暖光
    if (night && snow) ditherTri(g, gx, gTop + 2, eave, inner - 1, 'lamp-2', 2)
  }
  return { gx, hw, L, flip, top, eave, ov }
}

/** 放水銃小屋：田邊的小小合掌形木箱（消防的放水銃收在裡面） */
function hydrant(g: Gfx, x: number, base: number, env: Env, k = 1) {
  const hw = Math.max(3, Math.round(5 * k))
  const bh = Math.max(2, Math.round(4 * k))
  const rh = Math.max(5, Math.round(10 * k))
  g.rect(x - hw + 1, base - bh, 2 * hw - 1, bh, 'wood-3')
  if (isWinter(env)) g.tri(x - hw - 2, base - bh + 1, x, base - bh - rh - 2, x + hw + 2, base - bh + 1, 'snow-1')
  g.tri(x - hw - 1, base - bh + 1, x, base - bh - rh, x + hw + 1, base - bh + 1, 'wood-2')
  g.tri(x - hw + 2, base - bh, x, base - bh - rh + 4, x + hw - 2, base - bh, 'wood-3')
  if (k >= 1) g.rect(x - 1, base - bh - 3, 3, 3, 'wood-1')
}

/** 板倉：石頭墊高的木造小倉庫，也是人字的茅草屋根 */
function storehouse(g: Gfx, x: number, base: number, env: Env, k = 1) {
  const w = Math.round(18 * k)
  const bh = Math.round(13 * k)
  const leg = Math.max(2, Math.round(3 * k))
  const b = base - leg
  for (const px of [x + 1, x + w - 3]) g.rect(px, b, 2, leg, 'stone-2')
  g.rect(x, b - bh, w, bh, 'wood-2')
  for (let i = x + 2; i < x + w; i += 3) g.vline(i, b - bh + 1, b - 1, 'wood-3')
  g.hline(x, x + w - 1, b - bh + Math.round(bh * 0.4), 'wood-1')
  g.rect(x + Math.round(w / 2) - 2, b - bh + 3, 4, Math.round(bh * 0.6), 'wood-3')
  const hw = Math.round(w / 2) + 3
  const cx = x + Math.round(w / 2)
  const rt = b - bh - Math.round(hw * 1.2)
  if (isWinter(env)) g.tri(cx - hw - 2, b - bh + 2, cx, rt - 3, cx + hw + 2, b - bh + 2, 'snow-1')
  g.tri(cx - hw, b - bh + 2, cx, rt, cx + hw, b - bh + 2, 'dirt-1')
  g.tri(cx - hw + 4, b - bh + 1, cx, rt + 5, cx + hw - 4, b - bh + 1, 'wood-3')
  if (k >= 1) ditherTri(g, cx, rt + 1, b - bh + 1, hw - 1, 'dirt-2', 3)
  if (isWinter(env)) g.hline(cx - hw - 1, cx + hw + 1, b - bh + 2, 'snow-2')
}

/** 杉：細長、一層層的；冬天左邊積雪 */
function sugi(g: Gfx, x: number, y: number, h: number, env: Env, light: Px = 'leaf-3') {
  cedar(g, x, y, h, 'leaf-4', light)
  const w = Math.max(3, Math.round(h * 0.28))
  for (let i = 1; i < 4; i++) {
    const yy = y - h + Math.round((h * i) / 4)
    const ww = Math.round((w * i) / 4)
    g.hline(x - ww, x - ww + 1, yy, 'leaf-4')
    g.hline(x + ww - 1, x + ww, yy, 'leaf-4')
  }
  if (isWinter(env)) {
    for (let i = 0; i < 4; i++) {
      const yy = y - h + 2 + Math.round((h * i) / 4)
      const ww = Math.round((w * (i + 0.6)) / 4)
      g.hline(x - ww, x, yy, 'snow-1')
      g.px(x - ww + 1, yy + 1, 'snow-2')
    }
    g.px(x, y - h, 'snow-1')
  }
}

/** 季節的樹：春櫻、夏綠、秋柿（橘色的果子）、冬天枯枝積雪 */
function tree(g: Gfx, x: number, y: number, s: number, env: Env, r: Rng) {
  if (env.season === 'spring') roundTree(g, x, y, s, 'sakura-1', 'sakura-2')
  else if (env.season === 'summer') roundTree(g, x, y, s, 'leaf-2', 'leaf-3')
  else {
    g.rect(x - 1, y - s * 2, 3, s * 2, 'wood-3')
    for (let i = 0; i < 5; i++) {
      const yy = y - s * 2 + i * Math.round(s * 0.35)
      g.line(x, yy + 4, x - s + i, yy - 1, 'wood-3')
      g.line(x + 1, yy + 5, x + s - i, yy, 'wood-3')
    }
    if (env.season === 'autumn') {
      for (let i = 0; i < 9; i++) g.px(x + r.int(-s, s), y - s * 2 + r.int(-1, s), 'momiji-2')
      for (let i = 0; i < 12; i++) {
        const fx = x + r.int(-s + 1, s - 1)
        const fy = y - s * 2 + r.int(0, s + 2)
        g.rect(fx, fy, 2, 2, 'momiji-1')
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const yy = y - s * 2 + i * Math.round(s * 0.35)
        g.hline(x - s + i + 1, x - 1, yy - 1, 'snow-1')
        g.hline(x + 2, x + s - i - 1, yy, 'snow-1')
      }
    }
  }
}

/** 稻架（はさ掛け）：木樁上掛滿稻束 */
function hazakake(g: Gfx, x: number, w: number, base: number, k = 1) {
  const hh = Math.round(16 * k)
  for (let px = x; px <= x + w; px += Math.round(10 * k)) g.rect(px, base - hh - 2, 1 + (k >= 1 ? 1 : 0), hh + 2, 'wood-3')
  for (let row = 0; row < 2; row++) {
    const y = base - hh + row * Math.round(7 * k)
    g.hline(x, x + w, y, 'wood-3')
    for (let px = x + 1; px < x + w; px += 2) {
      const l = Math.round((5 + ((px * 3) % 3)) * k)
      g.vline(px, y + 1, y + l, (px >> 1) % 3 === 0 ? 'gold-2' : 'gold-1')
    }
  }
}

// ---------- 遠山（0.1） ----------
interface RangeOpts {
  base: number
  lo: number
  hi: number
  gap: [number, number]
  lit: Px
  shade: Px
  /** 雪線（y，比它高的是雪）；null 沒有雪 */
  snow: number | null
  haze: Px
  /** 雪下面露出來的林子 */
  rock?: Px
}

function mountains(g: Gfx, w: number, r: Rng, o: RangeOpts) {
  const peaks: Array<{ x: number; h: number; sl: number; sr: number }> = []
  for (let x = r.int(-40, -10); x < w + 80; x += r.int(o.gap[0], o.gap[1])) peaks.push({ x, h: r.int(o.lo, o.hi), sl: r.range(0.7, 1.25), sr: r.range(0.7, 1.25) })
  let jag = 0
  let sn = 0
  for (let x = 0; x < w; x++) {
    let best = peaks[0]!
    let hb = -Infinity
    for (const p of peaks) {
      const hh = p.h - (x < p.x ? (p.x - x) * p.sl : (x - p.x) * p.sr)
      if (hh > hb) {
        hb = hh
        best = p
      }
    }
    if (x % 3 === 0) jag = Math.max(-1, Math.min(1, jag + r.int(-1, 1)))
    if (x % 2 === 0) sn = Math.max(-4, Math.min(4, sn + r.int(-1, 1)))
    const top = Math.round(o.base - Math.max(0, hb)) + (hb > 6 ? jag : 0)
    const peakTop = o.base - best.h
    // 背光面：山峰右邊、從山頂往右下的一條線以上
    const shadeTo = x > best.x ? Math.round(peakTop + (x - best.x) * 2.2) : -1
    for (let y = top; y < H; y++) {
      const dark = y <= shadeTo
      const snowy = o.snow !== null && y < o.snow + sn + (dark ? 3 : 0)
      let k: Px = snowy ? (dark ? 'snow-2' : 'snow-1') : dark ? o.shade : o.lit
      if (snowy && o.rock && y > top + 6 && dotOn(x, y, 3 + Math.max(0, Math.round((y - (o.base - 30)) / 5)))) k = o.rock
      if (y >= o.base - 8 && dotOn(x, y, Math.min(9, 2 + (y - o.base + 8)))) k = o.haze
      g.px(x, y, k)
    }
  }
}

function farRange(g: Gfx, w: number, r: Rng, env: Env) {
  const sea = env.season
  mountains(g, w, r, {
    base: 102,
    lo: 20,
    hi: 48,
    gap: [34, 66],
    lit: sea === 'winter' ? 'snow-2' : 'roof-1',
    shade: sea === 'winter' ? 'roof-1' : 'roof-2',
    snow: sea === 'winter' ? null : sea === 'spring' ? 70 : sea === 'autumn' ? 54 : null,
    haze: hazeOf(env),
    rock: undefined,
  })
}

// ---------- 近山、庄川、であい橋（0.25） ----------
function valley(g: Gfx, w: number, r: Rng, env: Env) {
  const sea = env.season
  const BASE = 101
  const ph = [r.range(0, 6), r.range(0, 6), r.range(0, 6)]
  const ht = (x: number) => 15 + 8 * Math.sin(x / 41 + ph[0]!) + 5 * Math.sin(x / 19 + ph[1]!) + 2 * Math.sin(x / 7 + ph[2]!)
  const [lit, shade, hi]: [Px, Px, Px] =
    sea === 'winter' ? ['snow-1', 'snow-2', 'snow-1'] : sea === 'spring' ? ['leaf-2', 'leaf-3', 'leaf-1'] : sea === 'autumn' ? ['momiji-2', 'wood-2', 'momiji-1'] : ['leaf-3', 'leaf-4', 'leaf-2']
  // 秋天的山：一塊塊紅、橘、黃、綠
  const AUT: Px[] = ['momiji-1', 'momiji-2', 'gold-1', 'momiji-2', 'leaf-3', 'gold-2', 'momiji-1']
  const cell = new Map<number, Px>()
  const autumnAt = (x: number, y: number) => {
    const cx = Math.floor((x + ((y * 5) % 3)) / 6)
    const cy = Math.floor(y / 4)
    const key = cx * 64 + cy
    let c = cell.get(key)
    if (!c) {
      c = AUT[(Math.imul(cx * 73856093 ^ (cy * 19349663), 2654435761) >>> 0) % AUT.length]!
      cell.set(key, c)
    }
    return c
  }
  for (let x = 0; x < w; x++) {
    const h0 = ht(x)
    const h1 = ht(x + 1)
    const bump = x % 4 === 0 || x % 4 === 1 ? 1 : 0
    const top = Math.round(BASE - h0) - bump
    const dark = h1 < h0 - 0.05
    for (let y = top; y < BASE; y++) {
      let k: Px = sea === 'autumn' ? autumnAt(x, y) : lit
      if (dark && dotOn(x, y, sea === 'winter' ? 6 : 8)) k = shade
      if (y === top && !dark) k = hi
      g.px(x, y, k)
    }
  }
  // 林子的紋路：一點一點的樹冠（冬天是雪裡的杉）
  for (let i = 0; i < w / 3; i++) {
    const x = r.int(0, w)
    const y = r.int(Math.round(BASE - ht(x)) + 3, BASE - 1)
    if (y >= BASE) continue
    if (sea === 'winter') g.vline(x, y, y + 1, r.chance(0.6) ? 'leaf-4' : 'stone-3')
    else if (sea === 'autumn') g.px(x, y, r.pick(['gold-1', 'momiji-1', 'wood-2'] as const))
    else {
      g.hline(x - 1, x + 1, y, shade)
      g.px(x, y - 1, hi)
    }
  }
  if (sea === 'spring') for (let i = 0; i < w / 7; i++) g.px(r.int(0, w), r.int(84, BASE - 2), 'sakura-1')
  // 庄川：河灘的石子、水面的反光
  const winter = sea === 'winter'
  g.rect(0, BASE, w, 2, winter ? 'snow-1' : 'stone-1')
  g.rect(0, BASE + 2, w, 4, winter ? 'sea-3' : 'sea-2')
  for (let i = 0; i < w / 9; i++) {
    const x = r.int(0, w)
    g.hline(x, x + r.int(1, 4), BASE + r.int(2, 5), r.chance(0.5) ? 'foam' : winter ? 'sea-2' : 'sea-1')
  }
  g.rect(0, BASE + 6, w, H - BASE - 6, winter ? 'snow-1' : sea === 'autumn' ? 'gold-2' : 'leaf-3')
  g.dither(0, BASE + 6, w, 2, 'stone-1', 6)
  // であい橋（吊橋）
  for (let x = r.int(60, 200); x < w - 50; x += r.int(420, 640)) {
    const len = 40
    for (const tx of [x, x + len]) {
      g.rect(tx, BASE - 9, 2, 11, 'wood-3')
      g.px(tx, BASE - 10, 'wood-2')
    }
    g.hline(x, x + len, BASE + 1, 'wood-3')
    for (let i = 0; i <= len; i++) {
      const sag = Math.round(8 * (1 - ((i / len) * 2 - 1) ** 2))
      g.px(x + i, BASE - 9 + sag, 'stone-3')
      if (i % 4 === 2) g.vline(x + i, BASE - 8 + sag, BASE, 'stone-3')
    }
  }
}

// ---------- 中景的聚落（0.5） ----------
function farFields(g: Gfx, w: number, r: Rng, env: Env, top: number) {
  const sea = env.season
  const fill: Px = sea === 'winter' ? 'snow-1' : sea === 'spring' ? waterOf(env) : sea === 'autumn' ? 'gold-1' : 'leaf-2'
  const line: Px = sea === 'winter' ? 'snow-2' : sea === 'autumn' ? 'gold-2' : 'leaf-3'
  g.rect(0, top, w, H - top, fill)
  // 田埂：越近越疏
  for (let y = top, gap = 2; y < H; y += gap, gap += 1) {
    g.hline(0, w, y, line)
    for (let x = r.int(0, 30); x < w; x += r.int(24, 60)) {
      g.vline(x, y, Math.min(H - 1, y + gap), line)
      if (sea === 'autumn' && r.chance(0.35)) g.rect(x + 1, y + 1, r.int(8, 22), gap - 1, 'dirt-2')
      if (sea === 'summer' && r.chance(0.25)) g.rect(x + 1, y + 1, r.int(8, 22), gap - 1, 'leaf-1')
      if (sea === 'spring' && r.chance(0.3)) g.hline(x + 2, x + r.int(4, 10), y + 1, rippleOf(env))
    }
  }
}

function hamlet(g: Gfx, w: number, r: Rng, env: Env) {
  farFields(g, w, r, env, 106)
  let x = r.int(-10, 16)
  while (x < w) {
    const roll = r.next()
    if (roll < 0.45) {
      for (let n = r.int(1, 3); n > 0 && x < w; n--) {
        const hw = r.int(9, 12)
        const L = r.chance(0.75) ? r.int(8, 16) : 0
        const flip = r.chance(0.5)
        const gx = flip ? x + L + hw + 1 : x + hw + 1
        gassho(g, { gx, base: MID + r.int(-1, 0), hw, wall: 5, L, flip }, env, r)
        x += 2 * hw + L + r.int(3, 12)
      }
    } else if (roll < 0.72) {
      const n = r.int(3, 7)
      for (let i = 0; i < n; i++) sugi(g, x + i * 5, MID + 1 - r.int(0, 2), r.int(14, 26), env)
      x += n * 5 + r.int(4, 14)
    } else if (roll < 0.84) {
      if (env.season === 'autumn') hazakake(g, x, r.int(16, 26), MID, 0.5)
      else hydrant(g, x + 4, MID, env, 0.6)
      x += r.int(24, 34)
    } else {
      tree(g, x + 6, MID, 5, env, r)
      x += r.int(16, 30)
    }
  }
}

// ---------- 地面（1） ----------
function road(g: Gfx, w: number, r: Rng, env: Env) {
  const winter = isWinter(env)
  // 路：冬天是壓實的雪、其他是土路
  g.rect(0, PATH, w, H - PATH, winter ? 'snow-1' : 'dirt-1')
  if (winter) {
    for (const y of [139, 147]) {
      g.hline(0, w, y, 'snow-2')
      g.dither(0, y + 1, w, 2, 'snow-2', 5)
    }
    g.dither(0, PATH, w, 3, 'snow-2', 3)
  } else {
    g.dither(0, PATH + 9, w, 12, 'dirt-2', 3)
    for (let i = 0; i < w / 6; i++) g.px(r.int(0, w), r.int(PATH + 2, 151), r.pick(['dirt-2', 'stone-2', 'paper-2'] as const))
    if (env.season === 'autumn') for (let i = 0; i < w / 14; i++) g.px(r.int(0, w), r.int(PATH + 1, 151), r.pick(['momiji-1', 'gold-1', 'momiji-2'] as const))
  }
  // 路的後緣：草或雪堆
  if (winter) {
    for (let x = 0; x < w; x += r.int(5, 9)) g.ellipse(x, PATH - 1, r.int(3, 6), 2, 'snow-1')
    g.hline(0, w, PATH + 1, 'snow-2')
  } else {
    g.rect(0, PATH - 2, w, 2, env.season === 'autumn' ? 'leaf-3' : 'leaf-2')
    for (let x = 0; x < w; x += r.int(2, 4)) g.vline(x, PATH - 3 - r.int(0, 1), PATH - 1, 'leaf-3')
  }
  // 路前面的水路（石砌，水往前流）
  const cy = 153
  g.rect(0, cy, w, 2, 'stone-2')
  g.hline(0, w, cy, winter ? 'snow-1' : 'stone-1')
  g.rect(0, cy + 2, w, H - cy - 2, winter ? 'sea-3' : 'sea-2')
  for (let i = 0; i < w / 7; i++) {
    const x = r.int(0, w)
    g.hline(x, x + r.int(1, 3), r.int(cy + 3, H - 2), r.chance(0.5) ? 'foam' : 'sea-1')
  }
  for (let x = r.int(0, 10); x < w; x += r.int(9, 14)) g.vline(x, cy, cy + 1, 'stone-3')
  // 水裡的鯉魚
  if (!winter) for (let x = r.int(40, 160); x < w; x += r.int(140, 260)) {
    g.rect(x, 157, 3, 1, r.pick(['shu-1', 'paper', 'gold-1'] as const))
    g.px(x + 3, 157, 'shu-2')
  }
}

function field(g: Gfx, x: number, fw: number, env: Env, r: Rng): FieldKind {
  const sea = env.season
  const kind: FieldKind = sea === 'winter' ? 'snow' : sea === 'spring' ? 'water' : sea === 'summer' ? (r.chance(0.45) ? 'water' : 'rice') : r.chance(0.5) ? 'gold' : 'stubble'
  const y0 = LEVEE + 1
  const y1 = PATH - 2
  // 遠端的田埂
  g.hline(x, x + fw - 1, LEVEE, sea === 'winter' ? 'snow-2' : sea === 'autumn' ? 'leaf-3' : 'leaf-3')
  if (kind === 'water') g.rect(x, y0, fw, y1 - y0 + 1, waterOf(env))
  else if (kind === 'rice') g.rect(x, y0, fw, y1 - y0 + 1, 'leaf-2')
  else if (kind === 'gold') g.rect(x, y0, fw, y1 - y0 + 1, 'gold-1')
  else if (kind === 'stubble') g.rect(x, y0, fw, y1 - y0 + 1, 'dirt-2')
  else {
    g.rect(x, y0 - 1, fw, y1 - y0 + 2, 'snow-1')
    g.dither(x, y0 + 4, fw, 4, 'snow-2', 3)
  }
  // 遠端田埂上的東西：中型的合掌、板倉、放水銃小屋、杉、稻架
  const roll = r.next()
  if (kind === 'stubble') hazakake(g, x + 6, fw - 14, LEVEE + 2)
  else if (roll < 0.4 && fw >= 70) {
    const hw = r.int(14, 16)
    const L = r.int(10, 18)
    const flip = r.chance(0.5)
    const left = x + r.int(6, Math.max(7, fw - (2 * hw + L) - 6))
    gassho(g, { gx: flip ? left + L + hw : left + hw, base: LEVEE + 1, hw, wall: 7, L, flip }, env, r)
  } else if (roll < 0.6) storehouse(g, x + r.int(6, Math.max(7, fw - 26)), LEVEE + 1, env, 0.8)
  else if (roll < 0.8) hydrant(g, x + r.int(8, fw - 8), LEVEE + 1, env)
  else for (let i = 0, n = r.int(2, 4), cx = x + r.int(6, Math.max(7, fw - 24)); i < n; i++) sugi(g, cx + i * 6, LEVEE + 1, r.int(24, 34), env)
  // 水田的倒影（壓扁一半、一列列晃動）與秧苗
  if (kind === 'water') {
    for (let y = y0; y <= y1; y++) {
      const sy = LEVEE - (y - LEVEE) * 2 + 1
      if (sy < 0) break
      const wob = y % 3 === 0 ? 1 : y % 3 === 1 ? 0 : -1
      for (let xx = x; xx < x + fw; xx++) {
        const sx = xx - wob
        if (sx < 0 || sx >= g.w) continue
        const v = g.buf[sy * g.w + sx]!
        if (v && dotOn(xx, y, y % 4 === 1 ? 6 : 12)) g.buf[y * g.w + xx] = v
      }
    }
    for (let i = 0; i < fw / 8; i++) {
      const xx = x + r.int(2, fw - 4)
      g.hline(xx, xx + r.int(2, 5), r.int(y0 + 1, y1), rippleOf(env))
    }
    const tall = sea === 'summer' ? 2 : 1
    for (let yy = y0 + 2; yy <= y1; yy += 3) for (let xx = x + 2 + (yy % 2) * 2; xx < x + fw - 2; xx += 4) g.vline(xx, yy - tall + 1, yy, 'leaf-2')
  } else if (kind === 'rice') {
    for (let yy = y0; yy <= y1; yy += 2) for (let xx = x + (yy % 4 === 0 ? 0 : 1); xx < x + fw; xx += 2) g.px(xx, yy, yy % 4 === 0 ? 'leaf-1' : 'leaf-3')
    g.hline(x, x + fw - 1, y0, 'leaf-1')
  } else if (kind === 'gold') {
    for (let yy = y0; yy <= y1; yy += 2) for (let xx = x + ((yy >> 1) % 2); xx < x + fw; xx += 2) g.px(xx, yy, 'gold-2')
    for (let xx = x; xx < x + fw; xx += 2) g.px(xx, y0 - 1, 'gold-1')
  } else if (kind === 'stubble') {
    for (let yy = y0 + 1; yy <= y1; yy += 2) for (let xx = x + 1 + (yy % 3); xx < x + fw - 1; xx += 3) g.px(xx, yy, 'gold-2')
  }
  // 近的田埂
  g.hline(x, x + fw - 1, PATH - 1, sea === 'winter' ? 'snow-2' : 'dirt-2')
  return kind
}

function village(g: Gfx, w: number, r: Rng, env: Env) {
  SPOTS.houses = []
  SPOTS.fields = []
  road(g, w, r, env)
  const winter = isWinter(env)
  const lights: Array<[number, number]> = []
  let x = r.int(8, 30)
  let since = 220
  let last = ''
  while (x < w) {
    const roll = r.next()
    const start = x
    if (since > 230 || (roll < 0.3 && last !== 'house')) {
      // 大合掌（招牌）
      const hw = r.int(24, 29)
      const L = r.int(26, 44)
      const flip = r.chance(0.45)
      const ov = Math.max(1, Math.round((3 * hw) / 28))
      const gx = flip ? x + L + hw + ov + 2 : x + hw + 2
      const spot = gassho(g, { gx, base: PATH, hw, wall: r.int(21, 23), L, flip }, env, r)
      SPOTS.houses.push(spot)
      if (env.time === 'night') lights.push([Math.min(gx - hw, flip ? gx - hw - L : gx - hw), 2 * hw + L])
      x += 2 * hw + L + ov + 4
      if (winter) for (let sx = start; sx < x; sx += r.int(4, 7)) g.ellipse(sx, PATH - 1, r.int(2, 4), 2, 'snow-1')
      if (r.chance(0.45)) {
        hydrant(g, x + 6, PATH - 1, env)
        x += 14
      } else if (!winter && env.season === 'summer' && r.chance(0.6)) {
        // 屋前的紫陽花
        for (let i = 0; i < 3; i++) {
          g.ellipse(x + 3 + i * 6, PATH - 4, 3, 3, 'leaf-3')
          g.ellipse(x + 3 + i * 6, PATH - 5, 2, 2, i % 2 ? 'lavender' : 'sea-1')
        }
        x += 18
      }
      x += r.int(4, 16)
      since = 0
      last = 'house'
      continue
    }
    if (roll < 0.62 && last !== 'field') {
      const fw = r.int(60, 118)
      const kind = field(g, x, fw, env, r)
      SPOTS.fields.push({ x0: x, x1: x + fw - 1, kind })
      x += fw
      last = 'field'
    } else if (roll < 0.74) {
      storehouse(g, x + 4, PATH - 1, env)
      x += 30
      last = 'store'
    } else if (roll < 0.87) {
      const n = r.int(2, 4)
      for (let i = 0; i < n; i++) sugi(g, x + 6 + i * r.int(7, 10), PATH - 1, r.int(36, 52), env)
      x += n * 9 + 10
      last = 'cedar'
    } else {
      tree(g, x + 12, PATH - 1, r.int(8, 10), env, r)
      x += 26
      last = 'tree'
    }
    since += x - start
  }
  // 夜裡：窗的光映在路上（冬天的雪地特別亮）
  for (const [lx, lw] of lights) {
    g.dither(lx + 2, PATH, lw - 4, 2, 'lamp-2', winter ? 5 : 3)
    g.dither(lx + 6, PATH + 2, lw - 12, 3, 'lamp-2', winter ? 2 : 1)
  }
}

// ---------- 前景（1.3）：偶爾出現的枝、草 ----------
function front(g: Gfx, w: number, r: Rng, env: Env) {
  const sea = env.season
  let top = r.chance(0.5)
  for (let x = r.int(120, 260); x < w; x += r.int(300, 520), top = !top) {
    if (top) {
      // 上面垂下來的枝
      const [leaf, dark, hi]: [Px, Px, Px] =
        sea === 'spring' ? ['sakura-1', 'sakura-2', 'white'] : sea === 'summer' ? ['leaf-2', 'leaf-3', 'leaf-1'] : sea === 'autumn' ? ['momiji-1', 'momiji-2', 'gold-1'] : ['leaf-3', 'leaf-4', 'snow-1']
      g.line(x - 40, 0, x + 18, 9, 'wood-3')
      g.line(x - 40, 1, x + 18, 10, 'wood-3')
      g.line(x - 12, 5, x - 2, 15, 'wood-3')
      g.line(x + 6, 7, x + 14, 2, 'wood-3')
      const cl: Array<[number, number, number]> = [[-34, 3, 4], [-22, 6, 5], [-9, 8, 4], [-3, 16, 4], [7, 11, 5], [15, 4, 4], [19, 11, 3]]
      for (const [dx, dy, rr] of cl) {
        const cx = x + dx + r.int(-1, 1)
        const cy = dy + r.int(-1, 1)
        g.ellipse(cx, cy + 1, rr, rr - 1, dark)
        g.ellipse(cx - 1, cy, rr - 1, rr - 2, leaf)
        if (sea === 'winter') {
          g.hline(cx - rr + 1, cx + rr - 1, cy - rr + 2, 'snow-1')
          g.hline(cx - rr + 2, cx + rr - 2, cy - rr + 1, 'snow-1')
        } else g.px(cx - 2, cy - 1, hi)
      }
    } else if (sea === 'winter') {
      // 雪堆與竹竿
      g.ellipse(x, H, 22, 9, 'snow-2')
      g.ellipse(x - 2, H + 1, 20, 8, 'snow-1')
      g.rect(x + 8, H - 26, 2, 20, 'wood-2')
      g.rect(x + 7, H - 28, 4, 3, 'snow-1')
    } else if (sea === 'autumn') {
      // 芒草
      for (let i = 0; i < 9; i++) {
        const bx = x + i * 3 - 12
        const tip = H - 22 - (i % 3) * 4
        g.line(bx, H, bx + 3, tip, 'gold-2')
        g.line(bx + 3, tip, bx + 6, tip + 4, 'paper')
        g.px(bx + 4, tip + 1, 'paper-2')
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const bx = x + i * 2 - 12
        g.line(bx, H, bx + (i % 3) - 1, H - 10 - (i % 4) * 3, i % 2 ? 'leaf-3' : 'leaf-4')
      }
      if (sea === 'spring') for (let i = 0; i < 4; i++) g.px(x - 8 + i * 5, H - 12 + (i % 2) * 3, 'gold-1')
      else for (let i = 0; i < 3; i++) g.px(x - 6 + i * 6, H - 14 + (i % 2) * 2, 'white')
    }
  }
}

// ---------- 白川鄉的腳本 ----------
/** 屋根滑下來的一塊雪 */
const SLAB = drawSprite(18, 9, (g) => {
  g.ellipse(9, 5, 7, 3, 'snow-1')
  g.ellipse(7, 3, 4, 2, 'snow-1')
  g.hline(3, 14, 7, 'snow-2')
  g.hline(4, 13, 6, 'snow-2')
  g.px(5, 2, 'white')
}, 'stone-3')
/** 頭上的雪堆（臉從下面露出來） */
const PILE = drawSprite(20, 12, (g) => {
  g.ellipse(10, 8, 8, 3, 'snow-1')
  g.ellipse(9, 5, 5, 3, 'snow-1')
  g.ellipse(12, 3, 3, 2, 'snow-1')
  g.hline(3, 17, 10, 'snow-2')
  g.dither(3, 8, 15, 2, 'snow-2', 5)
  g.px(8, 3, 'white')
  g.px(11, 1, 'white')
}, 'stone-3')

/** 雪粒：落地後留一下、再化掉 */
function puff(s: Parameters<EventDef['run']>[0], x: number, y: number, n: number, k: Px = 'snow-1') {
  for (let i = 0; i < n; i++) {
    let rest = 0
    s.spawn({
      x,
      y,
      vx: s.rng.range(-36, 36),
      vy: s.rng.range(-70, -20),
      gravity: 300,
      z: 'front',
      draw: (g, sx, sy) => g.rect(Math.round(sx), Math.round(sy) - 1, 2, 2, k),
      update: (a, dt) => {
        if (a.y >= FLOOR + 2) {
          a.y = FLOOR + 2
          a.vx = 0
          a.vy = 0
          a.gravity = 0
          rest += dt
          if (rest > 0.9) a.level = 8
          if (rest > 1.5) a.hidden = true
        }
      },
    })
  }
}

const ROOF_SNOW: EventDef = {
  id: 'shirakawago-roof-snow',
  when: { season: ['winter'] },
  *run(s) {
    // 前面最近的一棟（側面屋根的簷口就在路上方）
    const hx = s.hero.worldX
    const drop = (h: HouseSpot): [number, number] => (h.flip ? [h.gx - h.hw - h.ov - h.L + 4, h.gx - h.hw - h.ov - 4] : [h.gx + h.hw + h.ov + 4, h.gx + h.hw + h.ov + h.L - 4])
    const h = SPOTS.houses.find((h) => h.L > 20 && drop(h)[1] > hx + 20 && drop(h)[0] < hx + s.W * 1.2)
    if (!h) return
    const [d0, d1] = drop(h)
    const target = Math.max(d0, Math.min(d1, hx + 20), Math.round((d0 + d1) / 2))
    yield () => s.hero.worldX >= target
    s.hero.stop()
    s.hero.emote('note', 1.2)
    yield 1
    // 屋根上的雪鬆開：先抖一下、再滑下來
    const dx = s.hero.worldX
    const run = h.hw + h.ov
    const startX = h.flip ? dx + run : dx - run
    const y0 = h.top + 4
    const y1 = h.eave + h.ov + 1
    const slab = s.spawn({ frames: SLAB, x: startX, y: y0, z: 'back' })
    for (let i = 0; i < 6; i++) {
      slab.x = startX + (i % 2 ? 1 : -1)
      yield 0.07
    }
    slab.x = startX
    let t = 0
    const dur = 0.9
    yield () => {
      t += 1 / 60
      const u = Math.min(1, (t / dur) ** 2)
      slab.x = startX + (dx - startX) * u
      slab.y = y0 + (y1 - y0) * u
      return u >= 1
    }
    // 掉下來砸在頭上
    slab.z = 'front'
    slab.vy = 30
    slab.gravity = 500
    const head = s.FLOOR - 21
    yield () => slab.y >= head
    slab.remove()
    const pile = s.spawn({ frames: PILE, x: s.hero.x + 1, y: head + 6, space: 'screen', z: 'front' })
    puff(s, dx, head, 6)
    s.hero.emote('sweat', 2)
    yield 1.6
    // 甩掉
    s.hero.jump(6)
    pile.remove()
    puff(s, dx, head, 10)
    yield 0.6
    s.hero.jump(4)
    yield 0.6
    s.hero.emote('dots', 1)
    yield 0.9
    s.hero.walk()
    yield 1.6
  },
}

/** 冬夜點燈：黃昏一到，整個村子的窗亮起來、開始下細雪 */
const LIGHT_UP: EventDef = {
  id: 'shirakawago-lightup',
  kind: 'ambient',
  when: { season: ['winter'], time: ['dusk', 'night'] },
  *run(s) {
    if (s.env.time === 'dusk') {
      yield 1.5
      s.setEnv({ time: 'night' })
      yield 1.2
    }
    const n = Math.round(s.W / 4)
    const fl = Array.from({ length: n }, () => ({ x: s.rng.range(0, s.W), y: s.rng.range(-s.H, 0), v: s.rng.range(9, 22), p: s.rng.range(0, 6), d: s.rng.range(0.2, 1.1) }))
    let fade = 0
    s.paint('over', (g, t) => {
      fade = Math.min(1, t / 2)
      const night = s.env.time === 'night'
      for (const f of fl) {
        if (fade < 1 && f.p / 6 > fade) continue
        const y = ((f.y + t * f.v) % (s.H + 8)) + (f.y + t * f.v < 0 ? s.H + 8 : 0)
        const x = (((f.x + Math.sin(t * 0.9 + f.p) * 5 - s.cam * f.d) % s.W) + s.W) % s.W
        if (f.d > 0.8) g.rect(Math.round(x), Math.round(y), 2, 2, night ? 'star' : 'snow-1')
        else g.px(x, y, night ? (f.d > 0.5 ? 'moon' : 'snow-2') : 'snow-1')
      }
    })
    yield 18
  },
}

// 稻草人：斗笠、圓臉、橫竿上的舊衣服；第 1 格頭轉過來
const SCARECROW = [0, 1].map((f) =>
  drawSprite(22, 32, (g) => {
    g.rect(10, 13, 2, 19, 'wood-2')
    g.rect(1, 14, 20, 2, 'wood-2')
    g.rect(5, 13, 12, 9, 'cloth-1')
    g.rect(5, 13, 12, 2, 'cloth-2')
    g.rect(8, 16, 3, 3, 'shu-2')
    g.rect(13, 18, 3, 2, 'gold-2')
    g.rect(9, 21, 4, 2, 'gold-2')
    // 第 1 格：頭轉向右邊（看著走過去的旅人）
    const fx = f ? 2 : 0
    g.ellipse(11 + fx, 9, 4, 4, 'paper')
    g.rect(9 + fx * 1.5, 8, 1, 2, 'ink')
    g.rect(12 + fx * 1.5, 8, 1, 2, 'ink')
    g.hline(10 + fx * 1.5, 12 + fx * 1.5, 11, 'shu-2')
    g.px(8 + fx * 1.5, 10, 'sakura-2')
    g.tri(2 + fx, 6 - f, 11 + fx, 0, 20 + fx, 6 + f, 'dirt-1')
    g.line(3 + fx, 6 - f, 19 + fx, 6 + f, 'dirt-2')
    g.px(11 + fx, 1, 'dirt-2')
    for (const x of [1, 20]) g.vline(x, 16, 18, 'gold-1')
  }),
)
// 烏鴉：停著、翅膀上、翅膀下
const CROW = [
  drawSprite(10, 8, (g) => {
    g.ellipse(4, 5, 3, 2, 'ink-2')
    g.rect(6, 2, 3, 3, 'ink-2')
    g.px(9, 3, 'stone-3')
    g.px(7, 3, 'white')
    g.line(1, 5, 0, 4, 'ink-2')
    g.vline(4, 7, 7, 'stone-3')
  }),
  drawSprite(12, 9, (g) => {
    g.ellipse(6, 6, 3, 1, 'ink-2')
    g.rect(9, 4, 2, 2, 'ink-2')
    g.line(5, 5, 2, 1, 'ink-2')
    g.line(6, 5, 4, 1, 'ink-2')
  }),
  drawSprite(12, 9, (g) => {
    g.ellipse(6, 4, 3, 1, 'ink-2')
    g.rect(9, 3, 2, 2, 'ink-2')
    g.line(5, 5, 2, 7, 'ink-2')
    g.line(6, 5, 4, 8, 'ink-2')
  }),
]

/** 找前面的田（腳本用）：kinds 依喜好排 */
function fieldAhead(s: Parameters<EventDef['run']>[0], kinds: FieldKind[], min: number, max: number): FieldSpot | null {
  const hx = s.hero.worldX
  for (const k of kinds) {
    const f = SPOTS.fields.find((f) => f.kind === k && f.x1 - f.x0 >= 50 && (f.x0 + f.x1) / 2 > hx + min && (f.x0 + f.x1) / 2 < hx + max)
    if (f) return f
  }
  return null
}

const SCARECROW_EVENT: EventDef = {
  id: 'shirakawago-scarecrow',
  when: { season: ['summer', 'autumn'] },
  *run(s) {
    const f = fieldAhead(s, ['gold', 'rice', 'stubble', 'water'], 40, Math.min(s.W * 1.4, 400))
    if (!f) return
    const cx = Math.round((f.x0 + f.x1) / 2)
    const sc = s.spawn({ frames: SCARECROW, fps: 0, x: cx, y: PATH - 3, z: 'back' })
    const crow = s.spawn({ frames: CROW, fps: 0, x: cx + 1, y: PATH - 33, z: 'back', flip: true })
    yield () => sc.sx() < s.hero.x + 26
    s.hero.stop()
    s.hero.emote('question', 1.4)
    yield 1.6
    // 烏鴉跳到旅人頭上
    const fx = crow.x
    const fy = crow.y
    const tx = s.hero.worldX + 1
    const ty = s.FLOOR - 22
    crow.fps = 10
    crow.frames = [CROW[1]!, CROW[2]!]
    for (let i = 1; i <= 30; i++) {
      const u = i / 30
      crow.x = fx + (tx - fx) * u
      crow.y = fy + (ty - fy) * u - Math.sin(u * Math.PI) * 14
      yield null
    }
    crow.fps = 0
    crow.frames = [CROW[0]!]
    crow.frame = 0
    crow.z = 'front'
    s.hero.emote('sweat', 1.6)
    yield 1.8
    s.hero.jump(7)
    crow.frames = [CROW[1]!, CROW[2]!]
    crow.fps = 12
    crow.flip = false
    crow.vx = 50
    crow.vy = -38
    yield 0.8
    s.hero.walk()
    // 走過去之後，稻草人的頭轉過來看
    yield () => sc.sx() < s.hero.x - 26
    sc.frame = 1
    yield 0.9
    s.hero.stop()
    s.hero.face('left')
    s.hero.emote('surprise', 1)
    sc.frame = 0
    yield 1.2
    s.hero.emote('question', 1)
    yield 1
    s.hero.face('right')
    s.hero.walk()
    yield 0.8
    sc.frame = 1
    yield () => sc.sx() < -16
  },
}

// 白鷺：站著（低頭、抬頭）、飛（翅膀上、下）、遠遠的
const HERON_STAND = [0, 1].map((f) =>
  drawSprite(16, 22, (g) => {
    g.ellipse(6, 11, 4, 3, 'white')
    g.line(2, 11, 0, 13, 'white')
    g.vline(5, 14, 21, 'ink-2')
    g.vline(7, 14, 21, 'ink-2')
    if (f === 0) {
      g.line(9, 10, 11, 5, 'white')
      g.line(10, 10, 12, 5, 'white')
      g.rect(10, 3, 3, 3, 'white')
      g.hline(13, 15, 4, 'gold-1')
      g.px(12, 4, 'ink')
    } else {
      g.line(9, 10, 12, 2, 'white')
      g.line(10, 10, 13, 2, 'white')
      g.rect(11, 0, 3, 3, 'white')
      g.hline(14, 15, 1, 'gold-1')
      g.px(13, 1, 'ink')
    }
  }, 'stone-3'),
)
const HERON_FLY = [0, 1].map((f) =>
  drawSprite(26, 14, (g) => {
    g.ellipse(12, 7, 5, 2, 'white')
    g.rect(17, 5, 4, 2, 'white')
    g.hline(21, 23, 5, 'gold-1')
    g.line(4, 8, 7, 8, 'ink-2')
    if (f === 0) {
      g.poly([9, 6, 15, 6, 10, 0, 6, 1], 'white')
    } else {
      g.poly([9, 8, 15, 8, 11, 13, 6, 12], 'white')
    }
  }, 'stone-3'),
)
const HERON_FAR = [
  drawSprite(9, 5, (g) => {
    g.hline(1, 7, 2, 'white')
    g.line(3, 2, 2, 0, 'white')
    g.line(5, 2, 6, 0, 'white')
  }, null),
  drawSprite(9, 5, (g) => {
    g.hline(1, 7, 2, 'white')
    g.line(3, 2, 2, 4, 'white')
    g.line(5, 2, 6, 4, 'white')
  }, null),
]

const HERON_EVENT: EventDef = {
  id: 'shirakawago-heron',
  when: { season: ['spring', 'summer'] },
  *run(s) {
    const f = fieldAhead(s, ['water', 'rice'], 70, Math.min(s.W * 1.4, 400))
    if (!f) return
    const cx = Math.round(f.x0 + (f.x1 - f.x0) * 0.6)
    const her = s.spawn({ frames: HERON_STAND, fps: 0, x: cx, y: PATH - 4, z: 'back', flip: true })
    // 水面的漣漪
    let ring = 0
    s.paint('back', (g) => {
      const x = Math.round(her.sx())
      if (her.hidden || her.y < PATH - 6) return
      const rr = 3 + Math.floor(ring) % 4
      g.hline(x - rr - 2, x - rr, PATH - 3, 'foam')
      g.hline(x + rr, x + rr + 2, PATH - 3, 'foam')
    })
    let peck = 0
    yield () => {
      peck += 1 / 60
      ring += 1 / 30
      her.frame = Math.floor(peck * 1.2) % 3 === 0 ? 0 : 1
      return her.sx() < s.hero.x + 56
    }
    s.hero.stop()
    s.hero.emote('heart', 1.4)
    her.frame = 1
    yield 1.4
    // 躡手躡腳靠近
    s.hero.speed = 0.35
    s.hero.walk()
    yield 1.6
    s.hero.stop()
    s.hero.speed = 1
    her.frame = 1
    s.hero.emote('surprise', 0.8)
    yield 0.4
    // 飛走：往遠山去，越飛越小
    her.frames = HERON_FLY
    her.fps = 5
    her.flip = false
    her.y -= 4
    her.vx = 46
    her.vy = -34
    yield 1.6
    her.frames = HERON_FAR
    her.fps = 4
    her.vx = 26
    her.vy = -10
    s.hero.emote('note', 1.4)
    yield 1.2
    s.hero.walk()
    yield () => her.sx() > s.W + 12 || her.y < -10 || her.age > 12
  },
}

export const SHIRAKAWAGO: AreaDef = {
  id: 'shirakawago',
  name: '白川鄉',
  romaji: 'SHIRAKAWA-GO',
  tags: ['town', 'nature', 'farm', 'mountain'],
  length: 1400,
  snowy: true,
  sky: (g, env, r) => skyBase(g, env, r, 100),
  layers: [
    { speed: 0.1, draw: farRange },
    { speed: 0.25, draw: valley },
    { speed: 0.5, draw: hamlet },
  ],
  ground: { speed: 1, draw: village },
  front: { speed: 1.3, draw: front },
  events: [ROOF_SNOW, LIGHT_UP, SCARECROW_EVENT, HERON_EVENT],
}

