import type { Gfx } from './gfx'
import type { Px } from './palette'
import type { Rng } from './rng'
import { type Env, FLOOR, H } from './types'

/**
 * 地區共用的零件（各地區的檔案可以再寫自己的）：天空、雲、日月星、山、樹、房子、燈、路面。
 * 全部畫在整數像素上、平塗加一層抖色陰影，深色描邊用 ink-2 或 ink（遠景不描）。
 */

export const isNight = (env: Env) => env.time === 'night'
export const isDusk = (env: Env) => env.time === 'dusk'
export const wet = (env: Env) => env.weather === 'rain'

// ---------- 天空 ----------
/** 依時段、天氣鋪滿天空；白天有太陽與雲、黃昏有夕陽、夜晚有月亮與星星。horizon 以下不用管（會被遠景蓋住） */
export function skyBase(g: Gfx, env: Env, r: Rng, horizon = 110) {
  const W = g.w
  const grey = env.weather !== 'clear'
  if (env.time === 'day') g.bands(0, horizon, grey ? ['stone-2', 'stone-1', 'cloud-2'] : ['sky-day-1', 'sky-day-2', 'sky-day-3'])
  else if (env.time === 'dusk') g.bands(0, horizon, grey ? ['stone-3', 'stone-2', 'sky-dusk-2'] : ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3'])
  else g.bands(0, horizon, ['sky-night-1', 'sky-night-2', 'sky-night-3'])
  g.rect(0, horizon, W, H - horizon, env.time === 'night' ? 'sky-night-3' : env.time === 'dusk' ? 'sky-dusk-3' : grey ? 'cloud-2' : 'sky-day-3')
  if (grey) {
    for (let i = 0; i < Math.ceil(W / 40); i++) cloud(g, r.int(-10, W), r.int(4, 40), r.int(18, 34), env.time === 'night' ? 'sky-night-2' : 'stone-1')
    return
  }
  if (env.time === 'day') {
    const sx = r.int(Math.round(W * 0.55), W - 24)
    g.circle(sx, r.int(16, 26), 7, 'lamp-1')
    for (let i = 0; i < Math.ceil(W / 70); i++) cloud(g, r.int(-10, W), r.int(8, 56), r.int(16, 30))
  } else if (env.time === 'dusk') {
    const sx = r.int(Math.round(W * 0.5), W - 30)
    g.circle(sx, horizon - 14, 11, 'lamp-2')
    g.circle(sx, horizon - 14, 8, 'lamp-1')
    for (let i = 0; i < Math.ceil(W / 80); i++) cloud(g, r.int(-10, W), r.int(10, 50), r.int(16, 28), 'sky-dusk-2')
  } else {
    for (let i = 0; i < Math.round(W / 5); i++) g.px(r.int(0, W), r.int(0, horizon - 10), r.chance(0.25) ? 'star' : 'sky-night-3')
    const mx = r.int(Math.round(W * 0.55), W - 20)
    g.circle(mx, 20, 6, 'moon')
    g.circle(mx + 3, 18, 5, 'sky-night-1') // 弦月
  }
}

/** 一朵雲（平底、上面幾個圓） */
export function cloud(g: Gfx, x: number, y: number, w: number, k: Px = 'cloud-1', shade: Px = 'cloud-2') {
  const h = Math.max(4, Math.round(w / 4))
  g.rect(x, y + h - 2, w, 3, shade)
  g.ellipse(x + w * 0.3, y + h / 2, w * 0.22, h * 0.55, k)
  g.ellipse(x + w * 0.6, y + h * 0.35, w * 0.25, h * 0.7, k)
  g.ellipse(x + w * 0.82, y + h * 0.6, w * 0.16, h * 0.45, k)
  g.rect(x + 1, y + h - 2, w - 2, 2, k)
  g.hline(x + 2, x + w - 3, y + h + 1, shade)
}

// ---------- 地形 ----------
/** 連綿的丘陵或山：base 是山腳的 y，amp 高低，step 起伏的寬；下面一直填到畫布底 */
export function ridge(g: Gfx, w: number, base: number, amp: number, step: number, r: Rng, k: Px, shade?: Px) {
  let y = base - r.range(0.3, 1) * amp
  let next = base - r.range(0.3, 1) * amp
  const pts: number[] = [0, H]
  for (let x = 0; x <= w + step; x += 2) {
    const t = (x % step) / step
    if (x % step === 0 && x > 0) {
      y = next
      next = base - r.range(0.2, 1) * amp
    }
    const yy = y + (next - y) * (0.5 - Math.cos(t * Math.PI) / 2)
    pts.push(x, Math.round(yy))
  }
  pts.push(w + step, H)
  g.poly(pts, k)
  if (shade) g.dither(0, base - 2, w, H - base + 2, shade, 5)
}

/** 尖的山（富士山那種用 fuji） */
export function peak(g: Gfx, cx: number, top: number, base: number, half: number, k: Px, snow?: Px) {
  g.tri(cx - half, base, cx, top, cx + half, base, k)
  if (snow) {
    const sh = Math.round((base - top) * 0.28)
    const sw = Math.round(half * 0.28)
    g.poly([cx - sw, top + sh, cx, top, cx + sw, top + sh, cx + sw * 0.5, top + sh - 2, cx, top + sh + 1, cx - sw * 0.5, top + sh - 2], snow)
  }
}

// ---------- 樹 ----------
/** 圓的樹（闊葉、櫻、楓）：x 中心、y 地面 */
export function roundTree(g: Gfx, x: number, y: number, s: number, leaf: Px, dark: Px, trunk: Px = 'wood-2') {
  g.rect(x - 1, y - Math.round(s * 0.9), 3, Math.round(s * 0.9), trunk)
  g.circle(x, y - s * 1.3, s * 0.75, leaf)
  g.circle(x - s * 0.55, y - s * 0.95, s * 0.55, leaf)
  g.circle(x + s * 0.55, y - s, s * 0.55, leaf)
  g.dither(x - s * 1.1, y - s * 1.1, s * 2.2, s * 0.6, dark, 7)
  g.px(x - Math.round(s * 0.3), y - Math.round(s * 1.7), 'white')
}

/** 季節的樹：春櫻、夏綠、秋楓、冬枯 */
export function seasonTree(g: Gfx, x: number, y: number, s: number, env: Env) {
  if (env.season === 'spring') roundTree(g, x, y, s, 'sakura-1', 'sakura-2')
  else if (env.season === 'autumn') roundTree(g, x, y, s, 'momiji-1', 'momiji-2')
  else if (env.season === 'winter') {
    g.rect(x - 1, y - s * 2, 2, s * 2, 'wood-3')
    for (let i = 0; i < 4; i++) {
      const yy = y - s * 2 + i * s * 0.4
      g.line(x, yy + 4, x - s * 0.8 + i, yy, 'wood-3')
      g.line(x, yy + 5, x + s * 0.8 - i, yy + 1, 'wood-3')
    }
    if (env.weather === 'snow' || env.time !== 'night') g.dither(x - s, y - s * 2.1, s * 2, 3, 'snow-1', 8)
  } else roundTree(g, x, y, s, 'leaf-2', 'leaf-3')
}

/** 松（日本庭園、海邊）：一層層橫向的葉團 */
export function pine(g: Gfx, x: number, y: number, s: number) {
  g.line(x, y, x - 2, y - s * 1.6, 'wood-3')
  g.line(x + 1, y, x - 1, y - s * 1.6, 'wood-2')
  for (let i = 0; i < 3; i++) {
    const yy = y - s * 0.7 - i * s * 0.45
    const off = (i % 2 ? 1 : -1) * s * 0.35
    g.ellipse(x + off, yy, s * (0.8 - i * 0.15), s * 0.18 + 1, 'leaf-3')
    g.hline(x + off - s * 0.5, x + off + s * 0.4, yy - 1, 'leaf-2')
  }
}

/** 杉（神社、山）：細長的三角 */
export function cedar(g: Gfx, x: number, y: number, h: number, k: Px = 'leaf-4', light: Px = 'leaf-3') {
  const w = Math.max(3, Math.round(h * 0.28))
  g.rect(x - 1, y - 4, 2, 4, 'wood-3')
  g.tri(x - w, y - 3, x, y - h, x + w, y - 3, k)
  g.tri(x - w + 2, y - 5, x, y - h + 3, x, y - 5, light)
}

// ---------- 建築 ----------
/** 一排窗：夜裡隨機亮燈 */
export function windows(g: Gfx, x: number, y: number, cols: number, rows: number, cw: number, ch: number, env: Env, r: Rng, off: Px = 'roof-2') {
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      // 亂數不管時段都抽一樣多次：腳本換時段重畫時，房子不會跑掉（黃昏亮的窗，夜裡也亮）
      const roll = r.next()
      const lamp = r.pick(['lamp-1', 'lamp-1', 'lamp-2'] as const)
      const lit = env.time === 'night' ? roll < 0.55 : env.time === 'dusk' ? roll < 0.2 : false
      g.rect(x + i * (cw + 2), y + j * (ch + 3), cw, ch, lit ? lamp : off)
    }
}

/** 京町家：格子、瓦簷、一樓暖簾 */
export function machiya(g: Gfx, x: number, w: number, env: Env, r: Rng, floor = FLOOR - 6) {
  const top = floor - 40
  g.rect(x, top + 6, w, 34, 'wood-2')
  g.rect(x, top + 6, w, 2, 'wood-3')
  // 二樓：蟲籠窓（白壁＋直條）
  g.rect(x + 2, top + 9, w - 4, 9, 'paper')
  for (let i = x + 4; i < x + w - 4; i += 3) g.vline(i, top + 10, top + 16, 'wood-3')
  // 一樓的簷
  g.rect(x - 2, top + 20, w + 4, 3, 'roof-2')
  g.hline(x - 2, x + w + 1, top + 20, 'roof-1')
  // 一樓：格子（千本格子），夜裡透光
  const lit = env.time !== 'day'
  g.rect(x + 2, top + 24, w - 4, 16, lit ? 'lamp-2' : 'wood-1')
  for (let i = x + 3; i < x + w - 2; i += 2) g.vline(i, top + 24, top + 39, 'wood-3')
  // 暖簾
  if (r.chance(0.6)) {
    const nx = x + r.int(4, Math.max(5, w - 16))
    const nk = r.pick(['cloth-2', 'shu-2', 'roof-3'] as const)
    g.rect(nx, top + 24, 12, 7, nk)
    g.vline(nx + 4, top + 26, top + 30, 'paper')
    g.vline(nx + 8, top + 26, top + 30, 'paper')
  }
  // 屋頂
  g.poly([x - 3, top + 7, x + 3, top, x + w - 3, top, x + w + 3, top + 7], 'roof-2')
  g.hline(x - 3, x + w + 2, top + 7, 'roof-3')
  for (let i = x; i < x + w; i += 3) g.vline(i, top + 1, top + 6, 'roof-1')
}

/** 鳥居：x 中心、y 地面、w 寬、h 高 */
export function torii(g: Gfx, x: number, y: number, w: number, h: number, k: Px = 'shu-1', dark: Px = 'shu-2') {
  const half = w / 2
  g.rect(x - half + 3, y - h + 6, 3, h - 6, k)
  g.rect(x + half - 6, y - h + 6, 3, h - 6, k)
  g.rect(x - half + 4, y - h + 6, 1, h - 6, dark)
  g.rect(x + half - 5, y - h + 6, 1, h - 6, dark)
  g.rect(x - half + 1, y - h + 9, w - 2, 2, k) // 貫
  g.poly([x - half - 2, y - h + 1, x + half + 2, y - h + 1, x + half, y - h + 5, x - half, y - h + 5], k) // 笠木
  g.hline(x - half - 2, x + half + 1, y - h, 'ink')
  g.hline(x - half - 1, x + half, y - h + 1, 'ink')
  g.rect(x - 1, y - h + 5, 2, 4, dark)
  g.rect(x - half + 2, y - 2, 5, 2, 'ink')
  g.rect(x + half - 7, y - 2, 5, 2, 'ink')
}

/** 石燈籠：x 中心、y 地面 */
export function lantern(g: Gfx, x: number, y: number, env: Env) {
  g.rect(x - 3, y - 2, 7, 2, 'stone-3')
  g.rect(x - 1, y - 9, 3, 7, 'stone-2')
  g.rect(x - 3, y - 13, 7, 4, env.time === 'day' ? 'stone-2' : 'lamp-1')
  g.vline(x, y - 13, y - 10, 'stone-3')
  g.tri(x - 5, y - 13, x, y - 18, x + 5, y - 13, 'stone-3')
  g.px(x, y - 19, 'stone-3')
}

/** 紙燈籠（提燈）：x 中心、y 上緣 */
export function chochin(g: Gfx, x: number, y: number, env: Env, k: Px = 'shu-1') {
  g.vline(x, y - 3, y, 'ink-2')
  g.ellipse(x, y + 4, 3, 4, env.time === 'day' ? k : 'lamp-2')
  g.hline(x - 2, x + 2, y + 1, 'ink-2')
  g.hline(x - 2, x + 2, y + 7, 'ink-2')
}

// ---------- 地面 ----------
/** 石板路：上緣 top 到畫布底；每隔一段有接縫 */
export function stonePath(g: Gfx, w: number, top: number, r: Rng) {
  g.rect(0, top, w, H - top, 'stone-2')
  g.hline(0, w, top, 'stone-1')
  for (let row = top + 4, n = 0; row < H; row += 6, n++) {
    g.hline(0, w, row, 'stone-3')
    for (let x = (n % 2) * 7; x < w; x += r.int(10, 16)) g.vline(x, row - 5, row - 1, 'stone-3')
  }
  g.dither(0, top + 1, w, 3, 'stone-1', 4)
}

/** 柏油路（城市）：中線虛線 */
export function asphalt(g: Gfx, w: number, top: number) {
  g.rect(0, top, w, H - top, 'stone-4')
  g.rect(0, top, w, 3, 'stone-2') // 人行道緣石
  for (let x = 0; x < w; x += 16) g.rect(x, top + Math.round((H - top) / 2) + 2, 8, 1, 'paper')
}

/** 沙灘 */
export function sand(g: Gfx, w: number, top: number, r: Rng) {
  g.rect(0, top, w, H - top, 'sand-1')
  g.dither(0, top + 6, w, H - top - 6, 'sand-2', 4)
  for (let i = 0; i < w / 8; i++) g.px(r.int(0, w), r.int(top + 2, H - 1), r.pick(['sand-2', 'paper', 'stone-1'] as const))
}

/** 草地 */
export function grass(g: Gfx, w: number, top: number, r: Rng, env: Env) {
  const [a, b] = env.season === 'winter' ? (['snow-1', 'snow-2'] as const) : env.season === 'autumn' ? (['dirt-1', 'leaf-2'] as const) : (['leaf-2', 'leaf-3'] as const)
  g.rect(0, top, w, H - top, a)
  g.dither(0, top + 4, w, H - top - 4, b, 5)
  for (let i = 0; i < w / 4; i++) {
    const x = r.int(0, w)
    g.vline(x, top - 1, top + r.int(0, 2), b)
  }
}
