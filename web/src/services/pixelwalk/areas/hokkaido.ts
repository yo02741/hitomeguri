import { drawSprite } from '../build'
import type { Gfx } from '../gfx'
import { isNight, skyBase } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import type { Sprite } from '../sprite'
import { type Actor, type AreaDef, type Env, type EventDef, FLOOR, H, type Script, type Stage } from '../types'

/**
 * 北海道：冬是雪原、白樺、紅屋頂的牛舍與穀倉（サイロ）、遠方的羊蹄山與大雪山，路是壓實的雪路，路肩有矢羽根；
 * 夏是富良野的薰衣草田、美瑛的丘陵拼布田與一棵樹、白樺、牧草捲。
 * 層：遠山 0.12、丘陵 0.3、農場與鐵道 0.55、路 1、前景 1.3。
 */
const PATH = FLOOR - 8
/** 農場那一層的鐵軌（蒸汽火車走這裡） */
const RAIL = 119
const isWinter = (env: Env) => env.season === 'winter'

// ---------- 小工具 ----------
/** 平滑的起伏：每 step 一個控制點、餘弦內插，回傳每一欄的 y（base − 0…amp） */
function profile(w: number, step: number, base: number, amp: number, r: Rng): Int16Array {
  const n = Math.ceil((w + 2) / step) + 2
  const ctl = Array.from({ length: n }, () => base - r.next() * amp)
  const out = new Int16Array(w + 2)
  for (let x = 0; x < out.length; x++) {
    const i = Math.floor(x / step)
    const t = (x - i * step) / step
    const k = 0.5 - Math.cos(t * Math.PI) / 2
    out[x] = Math.round(ctl[i]! + (ctl[i + 1]! - ctl[i]!) * k)
  }
  return out
}

/** 白樺：白的樹幹、黑的皮目；冬天光禿的細枝，夏天一團團的淺綠 */
function birch(g: Gfx, x: number, y: number, h: number, env: Env, r: Rng) {
  const top = y - h
  if (isWinter(env)) {
    for (let i = 0; i < 5; i++) {
      const yy = top + 3 + i * Math.round(h / 9)
      const side = i % 2 ? 1 : -1
      const len = r.int(4, 8) - Math.floor(i / 2)
      g.line(x + (side > 0 ? 1 : 0), yy + 3, x + side * len, yy - 2, 'stone-3')
      g.px(x + side * (len + 1), yy - 3, 'stone-2')
    }
    g.line(x, top + 2, x - 2, top - 3, 'stone-3')
    g.line(x + 1, top + 2, x + 3, top - 2, 'stone-3')
  } else {
    const leaf: Px = env.season === 'autumn' ? 'gold-1' : 'leaf-1'
    const dark: Px = env.season === 'autumn' ? 'gold-2' : 'leaf-2'
    for (let i = 0; i < 5; i++) {
      const cx = x + r.int(-5, 6)
      const cy = top + r.int(1, Math.round(h * 0.45))
      g.ellipse(cx, cy, r.int(3, 4), r.int(2, 3), leaf)
      g.dither(cx - 3, cy, 7, 3, dark, 8)
    }
  }
  g.rect(x, top, 2, h, 'white')
  g.vline(x + 1, top, y - 1, 'stone-1')
  for (let yy = top + 2; yy < y - 2; yy += r.int(3, 5)) {
    g.px(x + r.int(0, 1), yy, 'ink-2')
    if (r.chance(0.4)) g.hline(x, x + 1, yy + 1, 'stone-3')
  }
}

/** トドマツ（樅）：一層層的三角；冬天每層上面積雪 */
function fir(g: Gfx, x: number, y: number, h: number, env: Env) {
  const tiers = Math.max(3, Math.round(h / 7))
  g.rect(x - 1, y - 3, 2, 3, 'wood-3')
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers
    const yy = Math.round(y - 3 - t * (h - 4))
    const half = Math.max(2, Math.round((h * 0.32) * (1 - t * 0.75)))
    const th = Math.round(h / tiers) + 3
    g.tri(x - half, yy, x, yy - th, x + half, yy, 'leaf-4')
    g.tri(x - half + 1, yy - 1, x, yy - th + 1, x, yy - 1, 'leaf-3')
    if (isWinter(env)) {
      g.line(x - half + 1, yy - 1, x, yy - th + 1, 'snow-1')
      g.line(x, yy - th + 1, x + half - 1, yy - 1, 'snow-2')
      g.hline(x - half + 1, x + half - 2, yy - 1, 'snow-1')
    }
  }
}

/** 白楊（ポプラ）：細長的一柱；冬天是一束往上的細枝 */
function poplar(g: Gfx, x: number, y: number, h: number, env: Env) {
  if (isWinter(env)) {
    g.vline(x, y - h, y, 'wood-3')
    for (let i = 1; i < 4; i++) {
      g.line(x, y - 4 - i * 3, x - 2, y - h + i * 2, 'wood-3')
      g.line(x, y - 4 - i * 3, x + 2, y - h + i * 2, 'wood-3')
    }
    return
  }
  g.vline(x, y - 4, y, 'wood-3')
  g.ellipse(x, y - h / 2 - 2, 3, h / 2 - 2, env.season === 'autumn' ? 'gold-1' : 'leaf-3')
  g.dither(x, y - h, 4, h - 3, env.season === 'autumn' ? 'gold-2' : 'leaf-4', 9)
  g.vline(x - 2, y - h / 2 - 4, y - h / 2 + 2, env.season === 'autumn' ? 'sand-1' : 'leaf-2')
}

/** 紅屋頂的牛舍（腰折屋根，山牆朝前）：x 左緣、y 地面 */
function barn(g: Gfx, x: number, y: number, env: Env, w = 30) {
  const wall = Math.round(w * 0.46)
  const knee = Math.round(w * 0.33)
  const ridge = Math.round(w * 0.5)
  const yE = y - wall
  const yK = yE - knee + 2
  const yR = yE - ridge + 1
  g.rect(x, yE, w, wall, 'paper')
  for (let i = x + 3; i < x + w - 1; i += 3) g.vline(i, yE + 1, y - 1, 'paper-2')
  g.dither(x + w - 6, yE, 6, wall, 'paper-2', 8)
  // 大門與 X 撐
  const dw = Math.round(w * 0.36)
  const dx = x + Math.round((w - dw) / 2)
  g.rect(dx, y - wall + 4, dw, wall - 4, 'shu-2')
  g.frame(dx, y - wall + 4, dw, wall - 4, 'paper')
  g.line(dx, y - wall + 4, dx + dw - 1, y - 1, 'paper')
  g.line(dx + dw - 1, y - wall + 4, dx, y - 1, 'paper')
  // 屋頂
  g.poly([x - 2, yE + 1, x + 2, yK, x + w / 2, yR, x + w - 2, yK, x + w + 2, yE + 1], 'shu-1')
  g.poly([x + w / 2, yR + 1, x + w - 2, yK, x + w + 2, yE + 1, x + w / 2, yE + 1], 'shu-2')
  g.rect(x + 2, yE + 1, w - 4, 1, 'shu-2')
  // 山牆的乾草門
  g.rect(x + w / 2 - 2, yK + 2, 4, 5, 'wood-3')
  g.hline(x + w / 2 - 2, x + w / 2 + 1, yK + 1, 'paper')
  if (isWinter(env)) {
    g.poly([x + 2, yK, x + w / 2, yR - 1, x + w - 2, yK, x + w - 4, yK + 2, x + w / 2, yR + 2, x + 4, yK + 2], 'snow-1')
    g.line(x - 2, yE, x + 2, yK, 'snow-1')
    g.line(x + w - 2, yK, x + w + 2, yE, 'snow-2')
    g.rect(x - 2, y - 3, w + 4, 3, 'snow-1')
  }
  if (env.time !== 'day') g.rect(dx + dw / 2 - 1, yE + 1, 2, 2, 'lamp-1')
}

/** 穀倉（サイロ）：圓筒、圓頂；x 中心、y 地面 */
function silo(g: Gfx, x: number, y: number, h: number, env: Env, brick: boolean) {
  const body: Px = brick ? 'momiji-2' : 'stone-1'
  const ring: Px = brick ? 'shu-2' : 'stone-2'
  g.ellipse(x, y - h, 5, 4, brick ? 'leaf-3' : 'shu-2')
  g.rect(x - 5, y - h, 11, h, body)
  for (let yy = y - h + 3; yy < y; yy += 4) g.hline(x - 5, x + 5, yy, ring)
  g.dither(x + 2, y - h, 4, h, ring, 9)
  g.vline(x - 4, y - h + 1, y - 1, brick ? 'momiji-1' : 'white')
  if (isWinter(env)) {
    g.ellipse(x, y - h - 1, 4, 2, 'snow-1')
    g.rect(x - 6, y - 2, 13, 2, 'snow-1')
  }
}

/** 鐵皮屋頂的顏色（亮、暗） */
const ROOFS: Array<[Px, Px]> = [
  ['shu-1', 'shu-2'],
  ['sea-2', 'sea-3'],
  ['leaf-2', 'leaf-3'],
  ['roof-1', 'roof-2'],
]

/** 農家（側面：鐵皮屋頂的直條接縫、煙囪，冬天屋頂積厚雪、掛冰柱）：x 左緣、y 地面 */
function farmhouse(g: Gfx, x: number, y: number, w: number, env: Env, r: Rng) {
  const [lit, k] = r.pick(ROOFS)
  const wall = Math.round(w * 0.42)
  const rh = Math.round(w * 0.28)
  const yE = y - wall
  g.rect(x, yE, w, wall, r.chance(0.5) ? 'paper' : 'stone-1')
  g.dither(x + w - 5, yE, 5, wall, 'stone-2', 7)
  // 窗：夜裡亮
  const on = env.time === 'night' ? 0.8 : env.time === 'dusk' ? 0.5 : 0
  for (let i = x + 3; i + 4 < x + w - 9; i += 7) {
    const l = r.chance(on)
    g.frame(i - 1, yE + 2, 6, 6, 'wood-2')
    g.rect(i, yE + 3, 4, 4, l ? 'lamp-1' : 'roof-2')
    if (l) g.dither(i - 1, yE + 8, 6, 2, 'lamp-2', 4)
  }
  g.rect(x + w - 8, y - 10, 5, 10, 'wood-2')
  g.px(x + w - 5, y - 5, 'gold-2')
  // 屋頂
  g.poly([x - 3, yE + 1, x + 3, yE - rh, x + w - 3, yE - rh, x + w + 3, yE + 1], k)
  for (let i = x + 1; i < x + w; i += 3) g.vline(i, yE - rh + 1, yE, lit)
  g.hline(x + 3, x + w - 4, yE - rh, lit)
  g.hline(x - 3, x + w + 2, yE + 1, 'roof-3')
  // 煙囪（薪爐的鐵管）
  const cx = x + w - 11
  g.rect(cx, yE - rh - 5, 3, rh + 3, 'stone-4')
  g.hline(cx - 1, cx + 3, yE - rh - 5, 'stone-3')
  if (isWinter(env)) {
    g.poly([x - 2, yE - 1, x + 2, yE - rh - 2, x + w - 2, yE - rh - 2, x + w + 2, yE - 1, x + w + 2, yE + 1, x - 2, yE + 1], 'snow-1')
    g.hline(x + 2, x + w - 3, yE - rh - 2, 'white')
    g.dither(x - 2, yE - 1, w + 5, 2, 'snow-2', 8)
    g.rect(cx, yE - rh - 5, 3, 3, 'stone-4')
    // 冰柱
    for (let i = x - 1; i < x + w + 2; i += 2) g.vline(i, yE + 2, yE + 2 + ((i * 7) % 4), 'snow-2')
    g.rect(x - 3, y - 3, w + 6, 3, 'snow-1')
    // 煙
    g.circle(cx + 1, yE - rh - 8, 2, 'stone-1')
    g.circle(cx + 4, yE - rh - 12, 3, 'stone-1')
    g.circle(cx + 8, yE - rh - 17, 2, 'stone-1')
  }
}

// ---------- 遠景：大雪山連峰與羊蹄山 ----------
function mountains(g: Gfx, w: number, r: Rng, env: Env) {
  const win = isWinter(env)
  const range = profile(w, 46, 100, 24, r)
  const jag = profile(w, 9, 2, 2, r)
  const snow = profile(w, 11, 97, 8, r)
  const cx = Math.round(w * r.range(0.42, 0.6))
  const half = 74
  const summit = 52
  const foot = 114
  const coneY = (x: number) => {
    const d = Math.abs(x - cx)
    if (d >= half) return 999
    if (d <= 3) return summit + (d <= 1 ? 1 : 0)
    return Math.round(foot - (foot - summit) * Math.pow(1 - (d - 3) / (half - 3), 1.6))
  }
  for (let x = 0; x < w; x++) {
    const a = range[x]! + jag[x]! - 2
    const c = coneY(x)
    const cone = c <= a
    const y = Math.min(a, c)
    // 光從左上來：往右下降的坡是暗面（看平滑的稜線，不看小鋸齒）
    const shade = cone ? x > cx + 1 : range[Math.min(w, x + 3)]! > range[Math.max(0, x - 3)]!
    if (win) {
      const line = cone ? snow[x]! + 5 : snow[x]!
      g.vline(x, y, line, shade ? 'snow-2' : 'snow-1')
      g.vline(x, line + 1, H, 'roof-1')
      g.dither(x, line + 1, 1, H - line, 'roof-2', 6)
      if (cone && x % 7 === 3 && y < 96) g.vline(x, y + 5, Math.min(line - 2, y + 9 + ((x * 3) % 9)), shade ? 'roof-1' : 'stone-1')
    } else {
      g.vline(x, y, H, shade ? 'roof-2' : 'roof-1')
      // 夏天殘雪：山頂附近的雪溪
      if (y < 84 && (shade ? x % 4 === 0 : x % 3 !== 1)) g.vline(x, y + 1, y + 2 + ((x * 7) % 6), shade ? 'stone-2' : 'snow-2')
      else if (y < 78) g.px(x, y, 'snow-2')
    }
  }
}

// ---------- 丘陵：美瑛的拼布田（冬是雪丘與防風林） ----------
const CROPS: Array<{ base: Px; line?: Px; dot?: Px }> = [
  { base: 'leaf-1', line: 'leaf-2' },
  { base: 'gold-1', line: 'gold-2' },
  { base: 'leaf-2', dot: 'white' },
  { base: 'dirt-1', line: 'dirt-2' },
  { base: 'leaf-3', line: 'leaf-2' },
  { base: 'sand-1', line: 'sand-2' },
  { base: 'leaf-1', dot: 'leaf-3' },
]
const STRIPES: Px[] = ['shu-1', 'white', 'gold-1', 'lavender', 'momiji-1', 'sakura-2', 'white', 'leaf-1']
/** 一列田的深度（離丘頂多遠）：越往下越寬 */
const ROWS = [0, 4, 9, 15, 22, 30, 40, 70]

function hills(g: Gfx, w: number, r: Rng, env: Env) {
  const win = isWinter(env)
  const top = profile(w, 62, 109, 19, r)
  // 每一列的田：一段段不同的作物
  const fields: Uint8Array[] = ROWS.map(() => {
    const row = new Uint8Array(w + 2)
    let x = 0
    let last = -1
    while (x < w + 2) {
      const len = r.int(14, 46)
      let c = r.int(0, CROPS.length - 1)
      if (c === last) c = (c + 1) % CROPS.length
      last = c
      row.fill(c, x, Math.min(w + 2, x + len))
      x += len
    }
    return row
  })
  const stripeAt = win ? -999 : r.int(Math.round(w * 0.2), Math.round(w * 0.55))
  for (let x = 0; x < w; x++) {
    const t = top[x]!
    const slope = top[x + 1]! - top[Math.max(0, x - 1)]!
    for (let j = 0; j + 1 < ROWS.length; j++) {
      const y0 = t + ROWS[j]!
      const y1 = Math.min(H, t + ROWS[j + 1]!)
      if (y0 >= H) break
      if (win) {
        g.vline(x, y0, y1 - 1, 'snow-1')
        if (j > 0 && x % 4 !== 0) g.px(x, y0, 'snow-2')
        continue
      }
      // 斜的分界：每一列錯開一點
      const fx = Math.max(0, Math.min(w + 1, x + j * 9 - Math.round((ROWS[j]! - 0) * 0.6)))
      const inStripe = x >= stripeAt && x < stripeAt + 70 && j >= 1 && j <= 5
      for (let y = y0; y < y1; y++) {
        if (inStripe) {
          g.px(x, y, STRIPES[Math.floor((x - stripeAt + (y - t) * 2) / 3) % STRIPES.length]!)
          continue
        }
        const c = CROPS[fields[j]![fx]!]!
        let k = c.base
        if (c.line && (y - y0) % 2 === 1) k = c.line
        if (c.dot && (x + y * 3) % 7 === 0) k = c.dot
        g.px(x, y, k)
      }
      if (j > 0) g.px(x, y0, 'leaf-3')
    }
    // 背光的坡
    if (slope > 0) g.dither(x, t, 1, win ? 14 : 10, win ? 'snow-2' : 'leaf-3', win ? 10 : 5)
    g.px(x, t, win ? 'white' : 'leaf-1')
  }
  // 防風林：沿著田的邊界一排樹
  for (let n = 0; n < w / (win ? 50 : 90); n++) {
    const x0 = r.int(0, w)
    const j = r.int(1, 4)
    const len = r.int(30, 90)
    for (let x = x0; x < Math.min(w, x0 + len); x += 2) {
      const y = top[x]! + ROWS[j]!
      if (win) {
        g.vline(x, y - r.int(3, 5), y, r.chance(0.5) ? 'wood-3' : 'roof-2')
        g.px(x, y, 'snow-2')
      } else {
        g.ellipse(x, y - 2, 1, 2, 'leaf-4')
      }
    }
  }
  // 丘頂的一棵樹、遠處的農家
  let x = r.int(30, 90)
  while (x < w) {
    let best = x
    for (let i = x - 24; i <= x + 24; i++) if (i >= 0 && i < w && top[i]! < top[best]!) best = i
    const y = top[best]! + 1
    const kind = r.next()
    if (kind < 0.35) {
      // 兩棵白楊
      poplar(g, best - 3, y, 14, env)
      poplar(g, best + 3, y + 1, 12, env)
    } else if (kind < 0.6) {
      if (win) fir(g, best, y, 16, env)
      else {
        g.vline(best, y - 4, y, 'wood-3')
        g.ellipse(best, y - 7, 5, 4, 'leaf-3')
        g.dither(best - 1, y - 8, 7, 5, 'leaf-4', 7)
        g.px(best - 2, y - 9, 'leaf-2')
      }
    } else {
      // 小農家（紅屋頂）
      const hx = best + r.int(-6, 6)
      const hy = top[Math.max(0, Math.min(w, hx))]! + 6
      g.rect(hx - 3, hy - 3, 7, 4, win ? 'stone-1' : 'paper')
      g.tri(hx - 4, hy - 3, hx, hy - 7, hx + 4, hy - 3, 'shu-2')
      if (win) g.line(hx - 3, hy - 4, hx, hy - 7, 'snow-1')
      if (isNight(env)) g.px(hx, hy - 1, 'lamp-1')
    }
    x = best + r.int(110, 190)
  }
}

// ---------- 中景：牛舍、穀倉、農家、白楊、白樺林，前面一條鐵道 ----------
function farms(g: Gfx, w: number, r: Rng, env: Env) {
  const win = isWinter(env)
  const ground = 116
  g.rect(0, ground, w, H - ground, win ? 'snow-1' : 'leaf-2')
  if (win) {
    g.dither(0, ground, w, 3, 'snow-2', 7)
    for (let i = 0; i < w / 10; i++) g.hline(r.int(0, w), r.int(0, w) % 12 + r.int(0, w), r.int(ground + 2, RAIL - 1), 'snow-2')
  } else {
    g.dither(0, ground, w, H - ground, 'leaf-3', 3)
    g.hline(0, w, ground, 'leaf-3')
  }
  let x = r.int(0, 50)
  let sinceBarn = 999
  while (x < w) {
    const roll = r.next()
    const y = ground + r.int(1, 2)
    if (sinceBarn > 170 && roll < 0.45) {
      // 招牌：紅屋頂的牛舍＋穀倉
      const bw = r.int(28, 34)
      silo(g, x + 6, y - 1, r.int(26, 32), env, r.chance(0.4))
      barn(g, x + 13, y, env, bw)
      if (r.chance(0.5)) silo(g, x + bw + 19, y, r.int(22, 26), env, false)
      const step = bw + 30
      x += step
      sinceBarn = 0
      continue
    }
    let step: number
    if (roll < 0.2) {
      const hw = r.int(20, 26)
      farmhouse(g, x, y, hw, env, r)
      step = hw + r.int(6, 14)
    } else if (roll < 0.42) {
      const n = r.int(3, 6)
      for (let i = 0; i < n; i++) poplar(g, x + i * 7, y, r.int(18, 24), env)
      step = n * 7 + r.int(8, 20)
    } else if (roll < 0.62) {
      const n = r.int(4, 8)
      for (let i = 0; i < n; i++) birch(g, x + i * r.int(3, 5), y + r.int(-1, 1), r.int(16, 24), env, r)
      step = n * 4 + r.int(10, 24)
    } else if (roll < 0.78) {
      const n = r.int(2, 4)
      for (let i = 0; i < n; i++) fir(g, x + i * 6, y, r.int(14, 22), env)
      step = n * 6 + r.int(8, 20)
    } else {
      step = r.int(20, 50)
      if (!win) {
        // 牧草捲（白的、黃的）或是吃草的牛
        if (r.chance(0.55))
          for (let i = 0; i < r.int(2, 5); i++) {
            const bx = x + i * r.int(7, 11)
            const by = y + r.int(-1, 2)
            const k: Px = r.chance(0.6) ? 'white' : 'sand-2'
            g.ellipse(bx, by - 3, 3, 3, k)
            g.dither(bx, by - 6, 4, 6, k === 'white' ? 'stone-1' : 'dirt-2', 6)
            g.hline(bx - 2, bx + 2, by, 'leaf-3')
          }
        else
          for (let i = 0; i < r.int(2, 4); i++) {
            const cx = x + i * r.int(9, 13)
            const cy = y + r.int(0, 2)
            g.rect(cx - 3, cy - 4, 7, 3, 'white')
            g.rect(cx - 2, cy - 4, 2, 2, 'ink')
            g.rect(cx + 2, cy - 3, 1, 1, 'ink')
            g.rect(cx + 4, cy - 3, 2, 2, r.chance(0.5) ? 'ink' : 'white')
            g.vline(cx - 3, cy - 1, cy, 'stone-3')
            g.vline(cx + 3, cy - 1, cy, 'stone-3')
          }
      }
    }
    x += step
    sinceBarn += step
  }
  // 鐵道與電線桿
  g.hline(0, w, RAIL - 1, 'stone-4')
  g.hline(0, w, RAIL, 'stone-3')
  g.dither(0, RAIL + 1, w, 2, 'stone-2', 8)
  let px = r.int(0, 30)
  while (px < w) {
    const nx = px + r.int(34, 42)
    g.vline(px, RAIL - 18, RAIL - 1, 'wood-3')
    g.hline(px - 2, px + 2, RAIL - 16, 'wood-3')
    const mid = (px + nx) / 2
    g.line(px, RAIL - 16, mid, RAIL - 14, 'ink-2')
    g.line(mid, RAIL - 14, nx, RAIL - 16, 'ink-2')
    px = nx
  }
}

// ---------- 地面：雪路（夏是農道）、路肩、矢羽根 ----------
/** 矢羽根：路肩的高桿，頂上一支紅白相間、往下指的箭頭（下雪時標出路的邊） */
function arrowPole(g: Gfx, x: number, y: number, env: Env) {
  const top = y - 52
  g.rect(x, top, 2, y - top, 'stone-2')
  g.vline(x + 1, top, y, 'stone-3')
  g.rect(x, top - 1, 8, 2, 'stone-3')
  for (let i = 0; i < 12; i++) g.hline(x + 4, x + 8, top + 1 + i, Math.floor(i / 2) % 2 ? 'white' : 'shu-1')
  g.tri(x + 4, top + 13, x + 9, top + 13, x + 6.5, top + 17, 'shu-1')
  if (env.time !== 'day') g.px(x + 6, top + 15, 'lamp-2')
  if (isWinter(env)) {
    g.hline(x, x + 7, top - 2, 'snow-1')
    g.ellipse(x + 1, y - 1, 4, 2, 'snow-1')
  }
}

/** 一段薰衣草田（或彩色的花田）：由後往前幾排圓圓的花壟 */
function flowerRows(g: Gfx, x0: number, x1: number, r: Rng, colors: Px[]) {
  g.rect(x0, 110, x1 - x0, PATH - 110, 'leaf-3')
  g.dither(x0, 110, x1 - x0, PATH - 110, 'leaf-4', 4)
  const rows = [
    [112, 2, 4, 1],
    [115, 3, 6, 1],
    [119, 4, 8, 2],
    [124, 5, 11, 2],
  ] as const
  rows.forEach(([top, mh, mw, gap], i) => {
    const k = colors[i % colors.length]!
    const off = r.int(0, mw)
    for (let x = x0 - off; x < x1; x += mw + gap) {
      const cx = x + mw / 2
      if (cx < x0 + 2 || cx > x1 - 2) continue
      g.ellipse(cx, top + mh / 2, mw / 2, mh / 2 + 0.5, k)
      g.dither(cx - mw / 2, top + mh / 2 + 1, mw + 1, mh, k === 'lavender' ? 'ink-2' : 'leaf-3', 5)
      for (let s = 0; s < mw / 3; s++) g.px(cx + r.int(-mw / 2 + 1, mw / 2 - 1), top - 1, k)
      if (k === 'lavender') g.px(cx - 1, top, 'sakura-1')
    }
  })
}

function road(g: Gfx, w: number, r: Rng, env: Env) {
  const win = isWinter(env)
  let x = r.int(0, 20)
  let lastHouse = -400
  while (x < w) {
    const roll = r.next()
    if (!win && roll < 0.42) {
      // 花田：多半是薰衣草，偶爾是彩色的花壟
      const len = r.int(110, 210)
      const colors: Px[] = r.chance(0.7) ? ['lavender'] : r.pick([['shu-1', 'white', 'gold-1', 'lavender'], ['gold-1', 'lavender', 'sakura-2', 'white']] as Px[][])
      flowerRows(g, x, x + len, r, colors)
      // 田邊的木柵
      g.vline(x, PATH - 9, PATH - 1, 'wood-2')
      g.vline(x + len - 1, PATH - 9, PATH - 1, 'wood-2')
      x += len + r.int(6, 20)
      continue
    }
    if (x - lastHouse > 480 && roll < 0.58) {
      const hw = r.int(42, 52)
      farmhouse(g, x, PATH - 2, hw, env, r)
      if (win) {
        // 鏟雪的鏟子插在雪堆
        g.vline(x + hw + 6, PATH - 14, PATH - 4, 'wood-2')
        g.rect(x + hw + 4, PATH - 6, 5, 4, 'shu-1')
      }
      lastHouse = x
      x += hw + r.int(16, 30)
      continue
    }
    if (roll < 0.72) {
      const n = r.int(2, 5)
      for (let i = 0; i < n; i++) birch(g, x + i * r.int(6, 10), PATH - 3 - r.int(0, 3), r.int(48, 74), env, r)
      x += n * 8 + r.int(18, 46)
    } else if (roll < 0.84) {
      const n = r.int(1, 3)
      for (let i = 0; i < n; i++) fir(g, x + i * 12, PATH - 3, r.int(36, 52), env)
      x += n * 12 + r.int(16, 36)
    } else if (roll < 0.94) {
      // 木柵
      const len = r.int(40, 90)
      for (let i = x; i < x + len; i += 9) {
        g.rect(i, PATH - 12, 2, 12, 'wood-2')
        if (win) g.hline(i, i + 1, PATH - 13, 'snow-1')
      }
      g.hline(x, x + len - 8, PATH - 10, 'wood-3')
      g.hline(x, x + len - 8, PATH - 6, 'wood-3')
      x += len + r.int(10, 24)
    } else x += r.int(30, 70)
  }
  if (win) {
    // 路肩的雪堆（除雪車推出來的雪牆）
    const bank = profile(w, 13, 127, 5, r)
    for (let i = 0; i < w; i++) {
      g.vline(i, bank[i]!, PATH, 'snow-1')
      g.px(i, bank[i]!, 'white')
      if (bank[i + 1]! > bank[Math.max(0, i - 1)]!) g.dither(i, bank[i]! + 1, 1, 3, 'snow-2', 8)
    }
    g.dither(0, PATH - 3, w, 3, 'snow-2', 7)
  } else {
    for (let i = 0; i < w; i++) if (r.chance(0.5)) g.vline(i, PATH - r.int(1, 3), PATH, r.chance(0.5) ? 'leaf-2' : 'leaf-3')
  }
  for (let i = r.int(20, 80); i < w; i += r.int(win ? 100 : 150, win ? 150 : 220)) arrowPole(g, i, PATH, env)
  // 路面
  if (win) {
    g.rect(0, PATH, w, H - PATH, 'snow-2')
    g.dither(0, PATH, w, 2, 'snow-1', 10)
    for (const [y, h] of [
      [137, 4],
      [150, 5],
    ] as const) {
      g.dither(0, y, w, h, 'stone-1', 6)
      g.hline(0, w, y + 1, 'stone-1')
    }
    for (let i = 0; i < w / 3; i++) g.px(r.int(0, w), r.int(PATH + 2, H - 1), r.pick(['snow-1', 'snow-1', 'paper-2', 'stone-1'] as const))
  } else {
    g.rect(0, PATH, w, H - PATH, 'dirt-1')
    g.dither(0, PATH + 10, w, H - PATH - 10, 'dirt-2', 3)
    g.hline(0, w, 137, 'dirt-2')
    g.hline(0, w, 151, 'dirt-2')
    for (let i = 0; i < w / 2; i++) g.px(r.int(0, w), r.int(PATH + 1, H - 1), r.pick(['sand-1', 'dirt-2', 'stone-2', 'sand-2'] as const))
    g.rect(0, H - 3, w, 3, 'leaf-2')
    for (let i = 0; i < w / 3; i++) g.vline(r.int(0, w), H - r.int(4, 6), H - 3, 'leaf-2')
  }
}

// ---------- 前景：雪堆、樹幹；夏天路邊的魯冰花 ----------
function front(g: Gfx, w: number, r: Rng, env: Env) {
  const win = isWinter(env)
  for (let x = r.int(40, 160); x < w; x += r.int(90, 200)) {
    if (win) {
      const ww = r.int(14, 30)
      g.ellipse(x, H, ww, r.int(6, 10), 'snow-1')
      g.dither(x - ww, H - 4, ww * 2, 4, 'snow-2', 6)
      g.px(x - ww / 2, H - 7, 'white')
    } else {
      for (let i = 0; i < r.int(3, 6); i++) {
        const lx = x + i * r.int(4, 7)
        const h = r.int(8, 15)
        const k = r.pick(['lavender', 'sakura-2', 'white', 'lavender'] as const)
        g.rect(lx - 1, H - h, 3, h - 3, k)
        for (let j = H - h; j < H - 3; j += 2) g.px(lx + ((j >> 1) % 2 ? -1 : 1), j, k === 'white' ? 'stone-1' : 'ink-2')
        g.px(lx, H - h - 1, k)
        g.ellipse(lx, H - 1, 3, 2, 'leaf-3')
        g.px(lx - 2, H - 3, 'leaf-2')
      }
    }
  }
  // 偶爾一棵很近的白樺
  for (let x = r.int(520, 760); x < w; x += r.int(560, 820)) {
    g.rect(x, 0, 6, H, 'white')
    g.rect(x + 4, 0, 2, H, 'stone-1')
    for (let y = 4; y < H; y += r.int(5, 11)) {
      g.rect(x + r.int(0, 2), y, r.int(2, 4), 1, 'ink')
      if (r.chance(0.5)) g.px(x + 1, y + 1, 'stone-3')
    }
    if (win) g.ellipse(x + 3, H - 1, 9, 4, 'snow-1')
    else
      for (let i = 0; i < 7; i++) {
        const lx = x + r.int(-16, 20)
        const ly = r.int(-2, 12)
        g.ellipse(lx, ly, r.int(4, 6), r.int(3, 4), 'leaf-1')
        g.dither(lx - 6, ly + 1, 13, 4, 'leaf-2', 8)
      }
  }
}

// ---------- 北海道的角色 ----------
/** 狐狸（キタキツネ）：橘色、黑襪子、白尾巴尖 */
function foxStand(o: { leg: number; tail: number; look?: 'down'; snowy?: boolean }) {
  return drawSprite(24, 14, (g) => {
    g.ellipse(4, 6 + o.tail, 3, 2, 'momiji-1')
    g.rect(1, 5 + o.tail, 2, 2, 'white')
    g.vline(5, 6, 9, 'momiji-2')
    g.ellipse(11, 8, 5, 2, 'momiji-1')
    g.hline(8, 14, 10, 'paper')
    const L = (x: number, d: number) => g.rect(x + d, 10, 1, 3, 'ink-2')
    L(8, o.leg)
    L(10, -o.leg)
    L(14, -o.leg)
    L(16, o.leg)
    g.rect(14, 5, 3, 4, 'momiji-1')
    g.rect(16, 7, 1, 3, 'white')
    const hy = o.look === 'down' ? 3 : 0
    g.ellipse(18, 4 + hy, 2, 2, 'momiji-1')
    g.rect(20, 4 + hy, 2, 2, 'momiji-1')
    g.hline(18, 21, 6 + hy, 'white')
    g.px(22, 4 + hy, 'ink')
    g.px(19, 3 + hy, 'ink')
    g.rect(16, 0 + hy, 1, 3, 'ink-2')
    g.rect(18, 0 + hy, 1, 2, 'momiji-2')
    if (o.snowy) {
      g.hline(17, 20, 2 + hy, 'snow-1')
      g.px(12, 6, 'snow-1')
      g.px(9, 6, 'snow-1')
    }
  })
}
const FOX_TROT = [0, 1, 0, -1].map((leg, i) => foxStand({ leg, tail: i % 2 ? -1 : 0 }))
const FOX_STAND = foxStand({ leg: 0, tail: 0 })
const FOX_LISTEN = [foxStand({ leg: 0, tail: 0, look: 'down' }), foxStand({ leg: 0, tail: -1, look: 'down' })]
const FOX_SNOWY = foxStand({ leg: 0, tail: 0, snowy: true })
/** 探頭：只有頭與耳朵 */
const FOX_HEAD = [0, 1].map((f) =>
  drawSprite(10, 8, (g) => {
    g.ellipse(4, 5, 3, 2, 'momiji-1')
    g.rect(6, 5, 2, 2, 'momiji-1')
    g.hline(3, 7, 7, 'white')
    g.px(8, 5, 'ink')
    g.px(5, 4, 'ink')
    g.rect(2, 1 + f, 1, 3 - f, 'ink-2')
    g.rect(5, 1, 1, 3, 'ink-2')
  }),
)
/** 往上跳（伸直） */
const FOX_LEAP = drawSprite(26, 12, (g) => {
  g.ellipse(4, 7, 4, 2, 'momiji-1')
  g.rect(0, 6, 2, 2, 'white')
  g.ellipse(12, 6, 6, 2, 'momiji-1')
  g.line(7, 8, 4, 11, 'ink-2')
  g.line(9, 8, 6, 11, 'ink-2')
  g.line(16, 7, 20, 9, 'ink-2')
  g.rect(17, 3, 3, 3, 'momiji-1')
  g.ellipse(21, 3, 2, 2, 'momiji-1')
  g.rect(23, 3, 2, 2, 'momiji-1')
  g.px(25, 3, 'ink')
  g.px(21, 2, 'ink')
  g.rect(19, 0, 1, 2, 'ink-2')
})
/** 頭朝下撲進雪裡：尾巴在上面搖 */
const FOX_DIVE = [-1, 1].map((sw) =>
  drawSprite(14, 22, (g) => {
    g.ellipse(7 + sw, 4, 2, 3, 'momiji-1')
    g.rect(6 + sw * 2, 0, 2, 2, 'white')
    g.ellipse(7, 10, 3, 5, 'momiji-1')
    g.vline(7, 6, 14, 'momiji-2')
    g.line(4, 8, 2, 5, 'ink-2')
    g.line(10, 8, 12, 5, 'ink-2')
    g.line(5, 14, 4, 19, 'ink-2')
    g.line(9, 14, 10, 19, 'ink-2')
    g.ellipse(7, 17, 2, 2, 'momiji-1')
    g.rect(6, 19, 2, 2, 'momiji-1')
    g.px(7, 21, 'ink')
  }),
)

/** 雪堆（夏天是一叢草）：描一圈淺色的邊，才看得出來是一堆 */
const MOUND = {
  winter: drawSprite(22, 10, (g) => {
    g.ellipse(11, 6, 9, 4, 'snow-1')
    g.dither(2, 7, 19, 3, 'snow-2', 8)
    g.hline(6, 12, 3, 'white')
    g.px(5, 4, 'white')
  }, 'snow-2'),
  summer: drawSprite(22, 11, (g) => {
    for (let i = -8; i <= 8; i += 2) g.vline(11 + i, 2 + Math.round(Math.abs(i) / 2) + (i & 2 ? 1 : 0), 9, i % 4 ? 'leaf-2' : 'leaf-3')
    g.ellipse(11, 8, 9, 2, 'leaf-3')
    g.dither(2, 7, 19, 3, 'leaf-4', 6)
    g.px(7, 4, 'lavender')
    g.px(14, 3, 'lavender')
    g.px(17, 6, 'white')
  }, 'leaf-4'),
}

/** 一把飛散的雪（或草屑） */
function burst(s: Stage, x: number, y: number, n: number, k: Px) {
  for (let i = 0; i < n; i++)
    s.spawn({
      x: x + s.rng.range(-4, 4),
      y,
      vx: s.rng.range(-36, 36),
      vy: s.rng.range(-80, -30),
      gravity: 260,
      draw: (g, sx, sy) => g.px(Math.round(sx), Math.round(sy), k),
      update: (a) => {
        if (a.age > 0.6) a.remove()
      },
    })
}

/** 等條件成立，最多 max 秒（不會卡住） */
function* until(s: Stage, cond: () => boolean, max = 15): Script {
  const t0 = s.t
  yield () => cond() || s.t - t0 > max
}

const FOX_EVENT: EventDef = {
  id: 'hokkaido-fox',
  *run(s) {
    const win = isWinter(s.env)
    const bit: Px = win ? 'snow-1' : 'leaf-2'
    const gy = PATH + 1
    const mx = s.cam + s.W + 16
    const head = s.spawn({ frames: FOX_HEAD, fps: 0, x: mx + 1, y: gy - 2, flip: true })
    head.hidden = true
    s.spawn({ frames: win ? MOUND.winter : MOUND.summer, x: mx, y: gy + 1 })
    yield* until(s, () => head.sx() < s.hero.x + 62)
    // 探出頭
    head.hidden = false
    head.y = gy - 7
    burst(s, mx, gy - 6, 6, bit)
    s.hero.stop()
    s.hero.emote('surprise', 1)
    yield 0.9
    head.frame = 1
    yield 0.25
    head.frame = 0
    yield 0.5
    head.flip = false
    head.frame = 1
    yield 0.3
    head.frame = 0
    s.hero.emote('question', 1.6)
    yield 0.4
    // 跳出來，站在雪堆旁邊聽雪下的聲音
    head.remove()
    const fox = s.spawn({ frames: FOX_STAND, fps: 0, x: mx + 2, y: gy - 6, vx: 16, vy: -70, gravity: 300 })
    burst(s, mx, gy - 6, 5, bit)
    yield () => fox.vy > 0 && fox.y >= gy
    fox.vx = fox.vy = fox.gravity = 0
    fox.y = gy
    fox.frames = FOX_LISTEN
    fox.fps = 5
    yield 1.6
    // 縱身一撲：往上、頭朝下插進雪裡
    fox.frames = [FOX_LEAP]
    fox.fps = 0
    fox.frame = 0
    fox.vx = 20
    fox.vy = -150
    fox.gravity = 320
    yield () => fox.vy > 10
    fox.frames = FOX_DIVE
    fox.frame = 0
    yield () => fox.y >= gy + 3
    fox.vx = fox.vy = fox.gravity = 0
    fox.y = gy
    fox.fps = 6
    const landX = fox.x
    s.spawn({ frames: win ? MOUND.winter : MOUND.summer, x: landX, y: gy + 1 })
    burst(s, landX, gy - 6, 12, bit)
    s.hero.emote('sweat', 1.6)
    yield 1.8
    // 鑽出來，抖掉身上的雪，看旅人一眼就跑走
    fox.frames = [FOX_SNOWY]
    fox.fps = 0
    fox.frame = 0
    fox.x = landX + 6
    fox.y = gy - 8
    fox.flip = true
    fox.vx = 24
    fox.vy = -60
    fox.gravity = 320
    burst(s, landX, gy - 8, 8, bit)
    yield () => fox.vy > 0 && fox.y >= gy
    fox.vx = fox.vy = fox.gravity = 0
    fox.y = gy
    yield 0.4
    burst(s, fox.x, gy - 8, 6, bit)
    yield 0.4
    s.hero.emote('heart', 1.4)
    yield 0.8
    fox.frames = FOX_TROT
    fox.fps = 10
    s.hero.walk()
    yield* s.move(fox, s.cam - 30, 46)
  },
}

/** 丹頂鶴：白身、黑頸、頭頂紅 */
type CranePose = 'stand' | 'bow' | 'wings'
function crane(p: CranePose, legs: 'down' | 'tuck' = 'down') {
  return drawSprite(26, 28, (g) => {
    const ox = 4
    if (legs === 'down') {
      g.vline(ox + 7, 19, 27, 'stone-3')
      g.vline(ox + 10, 19, 27, 'stone-3')
    } else {
      g.line(ox + 7, 19, ox + 4, 24, 'stone-3')
      g.line(ox + 10, 19, ox + 7, 25, 'stone-3')
    }
    if (p === 'wings') {
      // 翅膀張開往上：白的覆羽、黑的飛羽在後緣
      g.poly([ox + 5, 15, ox - 3, 3, ox - 4, 8, ox + 2, 17], 'white')
      g.line(ox - 4, 8, ox + 2, 17, 'ink')
      g.line(ox - 3, 9, ox + 2, 16, 'ink')
      g.poly([ox + 9, 14, ox + 15, 1, ox + 18, 5, ox + 12, 16], 'white')
      g.line(ox + 18, 5, ox + 12, 16, 'ink')
      g.line(ox + 17, 6, ox + 12, 15, 'ink')
    }
    g.ellipse(ox + 8, 16, 6, 3, 'white')
    g.ellipse(ox + 3, 17, 3, 2, 'ink')
    if (p === 'bow') {
      g.line(ox + 13, 15, ox + 17, 18, 'ink')
      g.line(ox + 13, 14, ox + 17, 17, 'ink')
      g.line(ox + 12, 14, ox + 15, 16, 'white')
      g.ellipse(ox + 18, 19, 1, 1, 'ink')
      g.px(ox + 18, 18, 'shu-1')
      g.line(ox + 19, 20, ox + 20, 22, 'stone-2')
    } else {
      g.line(ox + 12, 14, ox + 14, 5, 'ink')
      g.line(ox + 13, 14, ox + 15, 5, 'ink')
      g.line(ox + 11, 12, ox + 13, 6, 'white')
      g.ellipse(ox + 15, 4, 1, 1, 'ink')
      g.hline(ox + 14, ox + 15, 2, 'shu-1')
      g.line(ox + 16, 4, ox + 19, 5, 'stone-2')
    }
  })
}
const CRANE = { stand: crane('stand'), bow: crane('bow'), wings: crane('wings'), jump: crane('wings', 'tuck') }

/** 一隻鶴的舞：照時間換姿勢（鞠躬、張翅、跳） */
function craneDance(baseY: number, phase: number) {
  const SEQ: Array<[number, Sprite, number]> = [
    [0.7, CRANE.stand, 0],
    [0.6, CRANE.bow, 0],
    [0.4, CRANE.stand, 0],
    [0.5, CRANE.wings, 0],
    [0.7, CRANE.jump, 1],
    [0.4, CRANE.wings, 0],
    [0.5, CRANE.bow, 0],
    [0.5, CRANE.stand, 0],
  ]
  const total = SEQ.reduce((a, [d]) => a + d, 0)
  return (a: Actor) => {
    let t = (a.age + phase) % total
    for (const [d, spr, jump] of SEQ) {
      if (t < d) {
        a.frames = [spr]
        a.frame = 0
        a.y = baseY - (jump ? Math.round(Math.sin((t / d) * Math.PI) * 12) : 0)
        return
      }
      t -= d
    }
  }
}

const CRANES_EVENT: EventDef = {
  id: 'hokkaido-cranes',
  when: { season: ['winter'], time: ['day', 'dusk'] },
  *run(s) {
    const y = PATH - 1
    const x0 = s.cam + s.W + 24
    const a = s.spawn({ frames: CRANE.stand, fps: 0, x: x0, y, update: craneDance(y, 0) })
    const b = s.spawn({ frames: CRANE.stand, fps: 0, x: x0 + 22, y, flip: true, update: craneDance(y, 1.9) })
    yield* until(s, () => a.sx() < s.hero.x + 64)
    s.hero.stop()
    s.hero.emote('surprise', 1)
    yield 1.4
    s.hero.hold = 'camera'
    s.hero.emote('heart', 1.6)
    yield 2.4
    // 喀嚓：閃一下
    let flash = 0
    const hx = () => s.hero.x + 4
    s.paint('over', (g) => {
      if (flash <= 0) return
      g.cover('white', flash)
      g.circle(hx(), s.hero.y - 15, 3, 'white')
      g.hline(hx() - 6, hx() + 6, s.hero.y - 15, 'white')
      g.vline(hx(), s.hero.y - 21, s.hero.y - 9, 'white')
    })
    for (const lv of [9, 5, 2, 0]) {
      flash = lv
      yield 0.06
    }
    yield 0.8
    s.hero.emote('note', 1.6)
    yield 1.4
    s.hero.hold = null
    s.hero.walk()
    yield* until(s, () => b.sx() < -20, 20)
    void b
  },
}

/** 雪人（兩顆球、紅水桶、圍巾）：眼睛會偷看 */
function snowman(look: number) {
  return drawSprite(22, 25, (g) => {
    g.line(4, 15, 0, 11, 'wood-3')
    g.px(1, 10, 'wood-3')
    g.line(17, 15, 21, 11, 'wood-3')
    g.px(20, 10, 'wood-3')
    g.circle(11, 18, 6, 'snow-1')
    g.dither(11, 16, 7, 9, 'snow-2', 8)
    g.dither(5, 22, 13, 3, 'snow-2', 8)
    g.circle(11, 8, 4, 'snow-1')
    g.dither(12, 7, 4, 6, 'snow-2', 8)
    g.rect(6, 12, 10, 2, 'shu-1')
    g.rect(13, 13, 2, 4, 'shu-1')
    g.poly([7, 5, 15, 4, 14, 0, 8, 1], 'cloth-1')
    g.hline(7, 15, 5, 'cloth-2')
    g.px(9 + look, 8, 'ink')
    g.px(13 + look, 8, 'ink')
    g.px(11 + look, 9, 'momiji-1')
    g.hline(10 + look, 12 + look, 11, 'stone-3')
  })
}
const SNOWMAN = [snowman(0), snowman(1), snowman(-1)]

const SNOWMAN_EVENT: EventDef = {
  id: 'hokkaido-snowman',
  when: { season: ['winter'] },
  *run(s) {
    const y = PATH + 1
    const sm = s.spawn({ frames: SNOWMAN, fps: 0, x: s.cam + s.W + 14, y })
    try {
      // 走過去之後，雪人的眼睛跟著旅人
      yield* until(s, () => sm.sx() < s.hero.x - 26, 25)
      sm.frame = 1
      yield 0.7
      s.hero.stop()
      s.hero.face('left')
      s.hero.emote('question', 1.2)
      sm.frame = 0
      yield 1.4
      s.hero.emote('dots', 1)
      yield 1
      s.hero.face('right')
      s.hero.walk()
      yield 0.6
      // 偷偷跳過來一格
      sm.frame = 1
      for (let i = 0; i < 2; i++) {
        sm.vy = -60
        sm.gravity = 400
        sm.vx = 34
        yield () => sm.vy > 0 && sm.y >= y
        sm.vx = sm.vy = sm.gravity = 0
        sm.y = y
        yield 0.15
      }
      sm.frame = 0
      s.hero.stop()
      s.hero.face('left')
      s.hero.emote('surprise', 1.2)
      yield 1.4
      s.hero.emote('sweat', 1.6)
      yield 0.6
      s.hero.face('right')
      s.hero.speed = 1.8
      s.hero.walk()
      yield 0.6
      sm.frame = 1
      yield* until(s, () => sm.sx() < -16, 15)
    } finally {
      s.hero.face('right')
      s.hero.speed = 1
    }
  },
}

/** 霜淇淋（薰衣草口味，紫白相間）：一口一口變少 */
const CONE = [3, 2, 1, 0, -1].map((left) =>
  drawSprite(7, 13, (g) => {
    g.poly([1, 7, 6, 7, 3.5, 12], 'wood-1')
    g.px(3, 9, 'dirt-2')
    g.px(4, 8, 'dirt-2')
    if (left >= 1) g.ellipse(3, 6, 2, 1, 'white')
    if (left >= 2) g.ellipse(3, 4, 1.5, 1, 'lavender')
    if (left >= 3) g.px(3, 2, 'white')
    if (left === 0) g.hline(1, 5, 6, 'white')
    if (left < 0) g.cut(0, 0, 7, 9)
  }),
)

/** 路邊的霜淇淋小屋（屋頂旁一支大大的甜筒招牌） */
function kiosk(g: Gfx, x: number, y: number) {
  const X = Math.round(x)
  const Y = Math.round(y)
  g.rect(X - 15, Y - 20, 22, 20, 'wood-1')
  for (let i = X - 13; i < X + 6; i += 3) g.vline(i, Y - 19, Y - 1, 'wood-2')
  g.rect(X - 12, Y - 15, 15, 7, 'roof-3')
  g.rect(X - 13, Y - 8, 17, 2, 'wood-2')
  for (let i = 0; i < 17; i++) g.rect(X - 13 + i, Y - 18, 1, 3, i % 4 < 2 ? 'white' : 'lavender')
  g.poly([X - 18, Y - 19, X + 10, Y - 19, X + 7, Y - 25, X - 15, Y - 25], 'shu-2')
  g.hline(X - 18, X + 9, Y - 19, 'shu-1')
  // 店員
  g.circle(X - 5, Y - 12, 2, 'skin-1')
  g.hline(X - 7, X - 3, Y - 14, 'hair')
  // 大甜筒
  g.rect(X + 12, Y - 16, 2, 16, 'stone-3')
  g.poly([X + 8, Y - 25, X + 18, Y - 25, X + 13, Y - 14], 'wood-1')
  g.line(X + 10, Y - 24, X + 13, Y - 17, 'dirt-2')
  g.line(X + 16, Y - 24, X + 13, Y - 17, 'dirt-2')
  g.ellipse(X + 13, Y - 27, 5, 2, 'white')
  g.ellipse(X + 13, Y - 30, 4, 2, 'lavender')
  g.ellipse(X + 13, Y - 33, 3, 1.5, 'white')
  g.px(X + 13, Y - 35, 'lavender')
  g.px(X + 11, Y - 30, 'sakura-1')
}

const SOFTSERVE_EVENT: EventDef = {
  id: 'hokkaido-softserve',
  when: { season: ['summer'] },
  *run(s) {
    const k = s.spawn({ x: s.cam + s.W + 22, y: PATH + 1, draw: kiosk })
    yield* until(s, () => k.sx() < s.hero.x + 10, 25)
    s.hero.stop()
    s.hero.emote('surprise', 0.8)
    yield 1
    s.hero.emote('dots', 1.2)
    yield 1.4
    // 甜筒從窗口遞出來
    const cone = s.spawn({ frames: CONE, fps: 0, x: k.sx() - 4, y: PATH - 6, space: 'screen', z: 'front' })
    const handX = () => s.hero.x + 3
    const handY = () => s.hero.y - 5
    yield* s.move(cone, handX(), 30)
    cone.y = handY()
    s.hero.jump(5)
    s.hero.emote('heart', 1.6)
    yield 1.2
    s.hero.walk()
    let lick = 0
    cone.update = (a) => {
      a.x = handX()
      a.y = handY() - lick
    }
    // 邊走邊吃：舔一口少一點，最後連甜筒一起吃掉
    for (let i = 1; i < CONE.length; i++) {
      yield 1.3
      lick = 3
      yield 0.25
      lick = 0
      cone.frame = i
      if (i === 2) s.hero.emote('note', 1.2)
    }
    yield 0.6
    cone.remove()
    s.hero.emote('heart', 1.2)
    yield 1.2
  },
}

/** 蒸汽火車（中景，跟農場那一層一起捲）：煙一團團往後飄 */
function locoSprite(lit: boolean) {
  return drawSprite(44, 17, (g) => {
    // 煤水車
    g.rect(1, 6, 10, 8, 'ink-2')
    g.rect(2, 5, 8, 2, 'ink')
    g.circle(3, 14, 1, 'roof-3')
    g.circle(8, 14, 1, 'roof-3')
    // 駕駛室
    g.rect(12, 3, 8, 11, 'ink-2')
    g.rect(11, 2, 10, 2, 'ink')
    g.rect(14, 5, 3, 3, lit ? 'lamp-1' : 'roof-1')
    // 鍋爐
    g.rect(20, 6, 18, 6, 'ink')
    g.hline(20, 37, 7, 'roof-3')
    g.rect(37, 5, 3, 8, 'roof-3')
    g.rect(32, 2, 3, 4, 'ink')
    g.rect(26, 4, 3, 2, 'ink')
    g.px(41, 6, 'lamp-1')
    g.hline(20, 38, 12, 'white')
    g.rect(39, 12, 3, 2, 'shu-2')
    for (const cx of [23, 28, 33]) {
      g.circle(cx, 14, 2, 'roof-3')
      g.px(cx, 14, 'shu-2')
    }
    g.circle(38, 15, 1, 'roof-3')
    g.hline(23, 33, 14, 'stone-2')
  }, null)
}
function carSprite(lit: boolean) {
  return drawSprite(24, 15, (g) => {
    g.rect(1, 3, 22, 9, 'wood-2')
    g.rect(2, 1, 20, 2, 'roof-3')
    for (let i = 3; i < 21; i += 4) g.rect(i, 5, 3, 3, lit ? 'lamp-1' : 'paper-2')
    g.hline(1, 22, 10, 'wood-3')
    g.rect(2, 12, 20, 1, 'ink')
    for (const cx of [4, 7, 16, 19]) g.circle(cx, 13, 1, 'ink')
  }, null)
}
const TRAIN = { day: { loco: locoSprite(false), car: carSprite(false) }, night: { loco: locoSprite(true), car: carSprite(true) } }

const SL_EVENT: EventDef = {
  id: 'hokkaido-sl',
  kind: 'ambient',
  *run(s) {
    const depth = 0.55
    const set = s.env.time === 'day' ? TRAIN.day : TRAIN.night
    const cars = 3
    const len = set.loco.w + cars * (set.car.w + 1)
    // x：火車頭的前端（農場那一層的座標）
    const tr = s.spawn({
      x: s.cam * depth - 10,
      y: RAIL,
      space: depth,
      z: 'mid',
      vx: 52,
      draw: (g, sx, sy) => {
        const X = Math.round(sx)
        const Y = Math.round(sy)
        g.sprite(set.loco, X - set.loco.w, Y - set.loco.h + 1)
        for (let i = 0; i < cars; i++) g.sprite(set.car, X - set.loco.w - (i + 1) * (set.car.w + 1), Y - set.car.h + 1)
        if (s.env.time !== 'day') g.dither(X, Y - 12, 14, 5, 'lamp-1', 3)
      },
    })
    let puff = 0
    tr.update = (a, dt) => {
      puff -= dt
      if (puff > 0) return
      puff = 0.22
      s.spawn({
        x: a.x - 10,
        y: RAIL - 16,
        space: depth,
        z: 'mid',
        vx: 20,
        vy: -14,
        draw: (g, sx, sy, p) => {
          const r = 2 + p.age * 2.4
          const lv = Math.max(0, Math.round(14 - p.age * 5))
          g.dither(sx - r, sy - r, r * 2 + 1, r * 2 + 1, 'white', lv)
          g.circle(sx, sy, Math.max(1, r - 2), p.age < 1 ? 'white' : 'stone-1')
        },
        update: (p) => {
          if (p.age > 2.4) p.remove()
        },
      })
    }
    yield* until(s, () => tr.sx() - len > s.W + 10, 30)
  },
}

export const HOKKAIDO: AreaDef = {
  id: 'hokkaido',
  name: '北海道',
  romaji: 'HOKKAIDO',
  tags: ['nature', 'farm'],
  length: 1500,
  seasons: ['winter', 'summer'],
  snowy: true,
  sky: (g, env, r) => skyBase(g, env, r, 104),
  layers: [
    { speed: 0.12, draw: mountains },
    { speed: 0.3, draw: hills },
    { speed: 0.55, draw: farms },
  ],
  ground: { speed: 1, draw: road },
  front: { speed: 1.3, draw: front },
  events: [FOX_EVENT, CRANES_EVENT, SNOWMAN_EVENT, SOFTSERVE_EVENT, SL_EVENT],
}
