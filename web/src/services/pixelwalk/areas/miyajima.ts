import { drawSprite } from '../build'
import type { Gfx } from '../gfx'
import { cloud, isNight, pine, roundTree } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import { type AreaDef, type Env, type EventDef, FLOOR, H, type Stage } from '../types'

/**
 * 宮島（廣島）：瀨戶內海上的朱色大鳥居（這一次是漲潮或退潮由 rng 決定）、海上的嚴島神社朱色迴廊與燈籠、
 * 山上的五重塔與彌山、對岸的山；地面是海邊的參道：石燈籠、松、楓、躺著的鹿、賣紅葉饅頭的老店。
 * 層：天空與海（不動）、對岸 0.12、彌山與五重塔 0.28、海上的鳥居與迴廊 0.45、地面 1、前景的楓枝 1.3。
 */
const PATH = FLOOR - 8
/** 水平線 */
const HZ = 96
/** 退潮時，水邊的線（比這裡近的是沙灘） */
const EBB = 109
const FAR = 0.12
const HILL = 0.28
const SEA = 0.45
/** 海上的東西（鳥居、迴廊）站在哪 */
const SB = 115
/** 島的山伸到海邊的地方（比退潮的水邊遠） */
const HB = 106

/** 這一次是漲潮還是退潮（天空先畫、決定；同一次造訪的各層與腳本都看這個） */
let tide: 'high' | 'low' = 'high'
/** 大鳥居在海上那一層的 x（腳本用） */
let toriiX = -1
/** 地面上擋住海的店家（地面的 x0–x1，腳本用） */
let shops: Array<[number, number]> = []
/** 地面上高的松（地面的 x0–x1）：跟店家一樣擋住海上的鳥居、渡輪 */
let pines: Array<[number, number]> = []
/** 島的山（HILL 層的 x0–x1）、海上的鳥居與神社（SEA 層的 x0–x1）：渡輪開到這些後面就看不到 */
let hillSpans: Array<[number, number]> = []
let seaSpans: Array<[number, number]> = []

const overlaps = (list: Array<[number, number]>, x0: number, x1: number) => list.some(([a, b]) => b > x0 && a < x1)
/** 畫面 x0–x1 這一段，地面上沒有店家、松擋住（看得到海上） */
function groundOpen(cam: number, x0: number, x1: number) {
  return !overlaps(shops, x0 + cam, x1 + cam) && !overlaps(pines, x0 + cam, x1 + cam)
}
/** 畫面 x0–x1 這一段，水平線一帶的海沒有被島的山、神社、鳥居、地面的店與松擋住 */
function seaOpen(cam: number, x0: number, x1: number) {
  return groundOpen(cam, x0, x1) && !overlaps(hillSpans, x0 + cam * HILL, x1 + cam * HILL) && !overlaps(seaSpans, x0 + cam * SEA, x1 + cam * SEA)
}

const sunX = (W: number) => Math.round(W * 0.7)
const moonX = (W: number) => Math.round(W * 0.66)

function disc(g: Gfx, cx: number, cy: number, r: number, k: Px, maxY = H, level = 16) {
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy
    if (y >= maxY) break
    const dx = Math.floor((r + 0.5) * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((r + 0.5) * (r + 0.5)))))
    if (level >= 16) g.hline(cx - dx, cx + dx, y, k)
    else g.dither(cx - dx, y, dx * 2 + 1, 1, k, level)
  }
}

function glitter(g: Gfx, x: number, r: Rng, a: Px, b: Px, y1: number, spread: number, skip: number) {
  for (let y = HZ + 1; y < y1; y++) {
    if (r.chance(skip)) continue
    const d = (y - HZ) / (y1 - HZ)
    const half = Math.max(0, Math.round((1 + d * spread) * r.range(0.3, 1)))
    const off = Math.round(r.range(-1, 1) * (1 + d * 2))
    g.hline(x + off - half, x + off + half, y, d < 0.3 || r.chance(0.4) ? a : b)
  }
}

// ---------- 天空與海 ----------
function miyaSky(g: Gfx, env: Env, r: Rng) {
  tide = r.chance(0.5) ? 'high' : 'low'
  const W = g.w
  const grey = env.weather !== 'clear'
  const t = env.time
  if (t === 'day') g.bands(0, HZ, grey ? ['stone-2', 'stone-1', 'cloud-2'] : ['sky-day-1', 'sky-day-2', 'sky-day-3'])
  else if (t === 'dusk') g.bands(0, HZ, grey ? ['stone-3', 'stone-2', 'sky-dusk-2'] : ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3'])
  else g.bands(0, HZ, ['sky-night-1', 'sky-night-2', 'sky-night-3'])
  // 瀨戶內海：平靜、水平線附近有霧氣
  g.bands(HZ, 22, ['sea-2', 'sea-3'])
  g.rect(0, HZ + 22, W, H - HZ - 22, 'sea-3')
  g.dither(0, HZ, W, 3, t === 'day' ? 'cloud-2' : 'sea-1', 5)
  for (let i = 0; i < W / 3; i++) {
    const y = r.int(HZ + 3, H - 1)
    const x = r.int(0, W)
    g.hline(x, x + r.int(1, 4), y, y < HZ + 12 ? 'sea-1' : 'sea-2')
  }
  if (tide === 'low') {
    // 退潮：近處露出濕濕的沙灘，水窪映著天空
    g.rect(0, EBB, W, H - EBB, 'dirt-2')
    g.dither(0, EBB, W, 2, 'sea-2', 8)
    g.dither(0, EBB + 3, W, H - EBB - 3, 'sand-2', 4)
    for (let i = 0; i < W / 18; i++) {
      const x = r.int(0, W)
      const y = r.int(EBB + 3, 126)
      const w = r.int(5, 16)
      g.rect(x, y, w, 1, t === 'night' ? 'sea-3' : 'sea-2')
      g.hline(x + 1, x + w - 2, y + 1, 'sea-1')
    }
    g.hline(0, W, EBB, 'foam')
  }
  if (grey) {
    for (let i = 0; i < Math.ceil(W / 40); i++) cloud(g, r.int(-10, W), r.int(4, 44), r.int(18, 34), t === 'night' ? 'sky-night-2' : 'stone-1', t === 'night' ? 'sky-night-1' : 'stone-2')
    return
  }
  const y1 = tide === 'low' ? EBB : 128
  if (t === 'day') {
    g.circle(sunX(W), 18, 7, 'lamp-1')
    for (let i = 0; i < Math.ceil(W / 70); i++) cloud(g, r.int(-10, W), r.int(8, 56), r.int(16, 30))
  } else if (t === 'dusk') {
    const sx = sunX(W)
    disc(g, sx, HZ - 10, 15, 'lamp-2', HZ, 4)
    disc(g, sx, HZ - 10, 9, 'lamp-2', HZ)
    disc(g, sx, HZ - 10, 6, 'lamp-1', HZ)
    for (let i = 0; i < Math.ceil(W / 80); i++) {
      const cx = r.int(-10, W)
      const cw = r.int(16, 30)
      if (cx + cw > sx - 18 && cx < sx + 18) continue
      cloud(g, cx, r.int(10, 56), cw, 'sky-dusk-3', 'sky-dusk-2')
    }
    glitter(g, sx, r, 'lamp-1', 'lamp-2', y1, 6, 0.4)
  } else {
    for (let i = 0; i < Math.round(W / 5); i++) g.px(r.int(0, W), r.int(0, HZ - 10), r.chance(0.3) ? 'star' : 'sky-night-3')
    const mx = moonX(W)
    g.circle(mx, 20, 6, 'moon')
    g.circle(mx + 3, 18, 5, 'sky-night-1')
    glitter(g, mx - 2, r, 'moon', 'sky-night-3', y1, 3, 0.6)
  }
}

// ---------- 遠景：對岸的山 ----------
function shoreHills(g: Gfx, w: number, r: Rng, env: Env) {
  const pts: number[] = [0, HZ + 1]
  let y = HZ - r.int(4, 10)
  for (let x = 0; x <= w + 8; x += 4) {
    y = Math.max(HZ - 16, Math.min(HZ - 3, y + r.int(-2, 2)))
    pts.push(x, y)
  }
  pts.push(w + 8, HZ + 1)
  g.poly(pts, 'roof-1')
  g.dither(0, HZ - 6, w, 7, 'sea-2', 4)
  g.hline(0, w, HZ, 'roof-2')
  // 對岸的鎮：白色的小房子，夜裡點點燈火
  for (let x = r.int(0, 20); x < w; x += r.int(6, 30)) {
    if (env.time === 'day') g.px(x, HZ - 1, r.chance(0.5) ? 'stone-1' : 'paper')
    else {
      g.px(x, HZ - 1 - r.int(0, 2), r.chance(0.6) ? 'lamp-1' : 'lamp-2')
      if (isNight(env)) g.px(x + 1, HZ + 2, 'lamp-2')
    }
  }
}

// ---------- 彌山、五重塔 ----------
function pagoda(g: Gfx, x: number, y: number, env: Env) {
  const lit = isNight(env)
  for (let i = 0; i < 5; i++) {
    const w = 16 - i * 2
    const yy = y - 6 - i * 6
    g.rect(x - Math.round(w * 0.32), yy, Math.round(w * 0.64), 5, lit ? 'lamp-2' : 'shu-1')
    g.vline(x + Math.round(w * 0.32) - 1, yy, yy + 4, 'shu-2')
    g.poly([x - w / 2 - 2, yy + 1, x - w * 0.3, yy - 2, x + w * 0.3, yy - 2, x + w / 2 + 2, yy + 1], 'roof-3')
    g.px(x - w / 2 - 2, yy, 'roof-3')
    g.px(x + w / 2 + 1, yy, 'roof-3')
  }
  g.rect(x, y - 42, 1, 10, 'gold-2')
  for (let i = 0; i < 3; i++) g.hline(x - 1, x + 1, y - 40 + i * 2, 'gold-2')
}

/** 一團楓（季節色）：春綠夾一點櫻、夏綠、秋紅、冬枯 */
function maple(g: Gfx, x: number, y: number, s: number, env: Env) {
  if (env.season === 'autumn') roundTree(g, x, y, s, 'momiji-1', 'momiji-2')
  else if (env.season === 'winter') {
    g.rect(x - 1, y - s * 1.6, 2, s * 1.6, 'wood-3')
    for (let i = 0; i < 3; i++) {
      const yy = y - s * 1.6 + i * s * 0.45
      g.line(x, yy + 3, x - s * 0.8 + i, yy - 1, 'wood-3')
      g.line(x, yy + 4, x + s * 0.8 - i, yy, 'wood-3')
    }
  } else if (env.season === 'spring') roundTree(g, x, y, s, 'leaf-1', 'leaf-2')
  else roundTree(g, x, y, s, 'leaf-2', 'leaf-3')
}

function forestBumps(g: Gfx, x0: number, x1: number, top: (x: number) => number, r: Rng, env: Env) {
  for (let x = x0; x < x1; x += r.int(4, 8)) {
    const y = top(x) + r.int(2, 10)
    const k: Px =
      env.season === 'autumn' && r.chance(0.45)
        ? r.pick(['momiji-1', 'momiji-2', 'gold-2'] as const)
        : env.season === 'spring' && r.chance(0.12)
          ? 'sakura-1'
          : env.season === 'winter'
            ? r.pick(['leaf-4', 'wood-3'] as const)
            : r.pick(['leaf-3', 'leaf-4', 'leaf-3'] as const)
    g.ellipse(x, y, r.int(2, 4), r.int(1, 3), k)
  }
}

function hills(g: Gfx, w: number, r: Rng, env: Env) {
  // 島的山從左右伸出來、到海邊，中間是開闊的海
  hillSpans = []
  let x = r.int(-60, 40)
  let misen = false
  while (x < w) {
    const hw = r.int(150, 230)
    hillSpans.push([x, x + hw])
    const peak = misen ? r.int(68, 80) : r.int(56, 66)
    const cx = x + hw / 2
    const top = (xx: number) => {
      const d = Math.abs(xx - cx) / (hw / 2)
      return Math.round(HB - (HB - peak) * Math.max(0, 1 - d * d) ** 0.8)
    }
    const pts: number[] = [x, HB + 1]
    for (let xx = x; xx <= x + hw; xx += 2) pts.push(xx, top(xx) + (r.chance(0.3) ? 1 : 0))
    pts.push(x + hw, HB + 1)
    g.poly(pts, env.season === 'winter' ? 'leaf-4' : 'leaf-3')
    // 山的陰影：右半邊深一點（只畫在山的裡面）
    for (let xx = Math.round(cx); xx < x + hw; xx++) g.dither(xx, top(xx) + 2, 1, HB - top(xx) - 2, 'leaf-4', 7)
    // 山腳的岸邊
    for (let xx = x; xx < x + hw; xx += 3) if (top(xx) < HB - 1) g.hline(xx, xx + 1, HB, tide === 'high' ? 'foam' : 'stone-2')
    forestBumps(g, x + 4, x + hw - 4, top, r, env)
    if (!misen) {
      // 彌山：山頂的大岩石
      for (let i = 0; i < 4; i++) {
        const rx = Math.round(cx) + r.int(-14, 14)
        const ry = top(rx) + r.int(1, 3)
        g.ellipse(rx, ry, r.int(2, 4), 2, 'stone-1')
        g.hline(rx - 1, rx + 2, ry + 2, 'stone-2')
      }
      misen = true
    } else {
      // 山腰上的五重塔，旁邊一片楓
      const px = Math.round(x + hw * r.range(0.3, 0.42))
      const py = top(px) + 18
      g.rect(px - 10, py - 3, 20, 4, 'stone-2')
      for (let i = -14; i <= 14; i += 7) maple(g, px + i + (i > 0 ? 6 : -6), py + 2, 4, env)
      pagoda(g, px, py - 2, env)
    }
    x += hw + r.int(120, 220)
  }
}

// ---------- 海上：大鳥居、嚴島神社的迴廊 ----------
function greatTorii(g: Gfx, cx: number, base: number, env: Env) {
  const night = isNight(env)
  const k: Px = night ? 'lamp-2' : 'shu-1'
  const d: Px = 'shu-2'
  const h = 46
  const top = base - h
  // 倒影（漲潮）
  if (tide === 'high') {
    for (let y = base + 1; y < base + 7; y++) {
      const lv = night ? 10 : 7
      const wob = (y >> 1) % 2
      for (const px of [-13, 9]) g.dither(cx + px + wob, y, 4, 1, k, y % 2 ? lv - 4 : lv)
      if (y === base + 4) g.dither(cx - 20 - wob, y, 40, 1, k, night ? 8 : 5)
    }
  }
  // 稚兒柱（前後的小柱子，往外斜）
  for (const side of [-1, 1]) {
    const px = cx + side * 11
    g.line(px - 4, base, px - 2, top + 22, d)
    g.line(px - 3, base, px - 1, top + 22, d)
    g.line(px + 4, base, px + 2, top + 22, d)
    g.line(px + 5, base, px + 3, top + 22, d)
    g.hline(px - 4, px + 4, top + 24, k)
  }
  // 主柱
  g.rect(cx - 13, top + 6, 4, h - 6, k)
  g.rect(cx + 9, top + 6, 4, h - 6, k)
  g.vline(cx - 10, top + 6, base - 1, d)
  g.vline(cx + 12, top + 6, base - 1, d)
  // 貫、額束（匾額）
  g.rect(cx - 17, top + 11, 34, 3, k)
  g.hline(cx - 17, cx + 16, top + 13, d)
  g.rect(cx - 3, top + 5, 6, 7, 'ink-2')
  g.frame(cx - 3, top + 5, 6, 7, 'gold-2')
  // 島木與笠木：兩端翹起來，上面黑色
  g.rect(cx - 18, top + 4, 36, 2, k)
  g.poly([cx - 22, top - 1, cx - 18, top + 1, cx + 18, top + 1, cx + 22, top - 1, cx + 21, top + 3, cx - 21, top + 3], k)
  g.hline(cx - 22, cx + 21, top - 1, 'ink-2')
  g.hline(cx - 20, cx + 19, top, 'ink-2')
  g.px(cx - 23, top - 2, 'ink-2')
  g.px(cx + 22, top - 2, 'ink-2')
  // 柱腳（退潮時看得到泥沙）
  if (tide === 'low') {
    g.hline(cx - 16, cx + 16, base, 'dirt-2')
    g.dither(cx - 18, base - 1, 36, 2, 'wood-3', 4)
  } else {
    g.hline(cx - 18, cx + 18, base, 'foam')
    g.hline(cx - 15, cx - 7, base + 1, 'sea-1')
    g.hline(cx + 7, cx + 15, base + 1, 'sea-1')
  }
}

function corridor(g: Gfx, x0: number, x1: number, env: Env, r: Rng) {
  const night = isNight(env)
  const floor = SB - 5
  // 高床的柱子在水裡
  for (let x = x0 + 2; x < x1 - 1; x += 6) g.vline(x, floor + 1, SB + 1, 'shu-2')
  if (tide === 'high') for (let x = x0; x < x1; x += 3) g.px(x, SB + 2, 'foam')
  g.rect(x0, floor - 1, x1 - x0, 2, 'wood-3')
  // 朱色的柱子、白牆、燈籠
  for (let x = x0 + 1; x < x1 - 1; x += 6) {
    g.rect(x, floor - 11, 2, 10, night ? 'lamp-2' : 'shu-1')
    g.rect(x + 2, floor - 11, 4, 10, night ? 'shu-2' : 'white')
    if (r.chance(0.5)) {
      g.vline(x + 4, floor - 11, floor - 9, 'ink-2')
      g.rect(x + 3, floor - 8, 3, 3, env.time === 'day' ? 'gold-2' : 'lamp-1')
    }
  }
  // 檜皮葺的屋頂
  g.poly([x0 - 3, floor - 11, x0 + 2, floor - 16, x1 - 2, floor - 16, x1 + 3, floor - 11], 'wood-3')
  g.hline(x0 - 3, x1 + 2, floor - 11, 'roof-3')
  g.hline(x0 + 2, x1 - 3, floor - 16, 'roof-2')
  if (night) {
    // 燈的倒影
    for (let x = x0 + 4; x < x1 - 2; x += 6) if (tide === 'high') g.dither(x, SB + 1, 2, 6, 'lamp-2', 6)
  }
}

function shrine(g: Gfx, x: number, env: Env, r: Rng) {
  // 迴廊、中間的本殿（大屋頂）
  corridor(g, x, x + 70, env, r)
  const cx = x + 96
  const night = isNight(env)
  g.rect(cx - 22, SB - 20, 44, 16, night ? 'shu-2' : 'shu-1')
  for (let i = cx - 20; i < cx + 20; i += 5) g.rect(i + 1, SB - 18, 3, 10, night ? 'lamp-1' : 'white')
  g.rect(cx - 24, SB - 6, 48, 2, 'wood-3')
  for (let i = cx - 22; i < cx + 22; i += 6) g.vline(i, SB - 4, SB + 1, 'shu-2')
  g.poly([cx - 30, SB - 19, cx - 18, SB - 30, cx + 18, SB - 30, cx + 30, SB - 19], 'wood-3')
  g.poly([cx - 32, SB - 18, cx - 30, SB - 21, cx + 30, SB - 21, cx + 32, SB - 18], 'roof-3')
  g.hline(cx - 18, cx + 18, SB - 30, 'roof-2')
  g.rect(cx - 3, SB - 33, 6, 3, 'wood-3')
  g.px(cx - 19, SB - 31, 'gold-2')
  g.px(cx + 18, SB - 31, 'gold-2')
  if (tide === 'high') g.dither(cx - 24, SB + 1, 48, 3, night ? 'lamp-2' : 'shu-2', 3)
  corridor(g, x + 122, x + 200, env, r)
}

function seaLayer(g: Gfx, w: number, r: Rng, env: Env) {
  // 大鳥居：走到一半左右的時候在畫面中間
  toriiX = Math.round(w * r.range(0.3, 0.38))
  greatTorii(g, toriiX, SB, env)
  // 嚴島神社：鳥居的一側
  const sx = Math.max(0, r.chance(0.5) ? toriiX - 260 - r.int(0, 60) : toriiX + 70 + r.int(0, 40))
  shrine(g, sx, env, r)
  // 笠木兩端、兩邊迴廊的屋簷
  seaSpans = [
    [toriiX - 23, toriiX + 23],
    [sx - 3, sx + 203],
  ]
  // 遠一點的木樁、浮標
  for (let x = r.int(0, 30); x < w; x += r.int(40, 90)) {
    if (Math.abs(x - toriiX) < 40) continue
    if (tide === 'high') {
      g.vline(x, SB - 6, SB, 'wood-3')
      g.hline(x - 1, x + 1, SB + 1, 'foam')
    } else g.rect(x, SB - 1, r.int(2, 4), 1, 'stone-3')
  }
}

// ---------- 地面：海邊的參道 ----------
function stoneLantern(g: Gfx, x: number, base: number, env: Env) {
  // 宮島的石燈籠：寬的笠、方的火袋
  g.rect(x - 4, base - 3, 9, 3, 'stone-2')
  g.hline(x - 4, x + 4, base - 3, 'stone-1')
  g.rect(x - 1, base - 13, 3, 10, 'stone-1')
  g.vline(x + 1, base - 13, base - 4, 'stone-2')
  g.rect(x - 4, base - 15, 9, 2, 'stone-2')
  const lit = env.time !== 'day'
  g.rect(x - 3, base - 21, 7, 6, 'stone-1')
  g.rect(x - 2, base - 20, 5, 4, lit ? 'lamp-1' : 'stone-3')
  if (lit) g.vline(x, base - 20, base - 17, 'lamp-2')
  g.poly([x - 7, base - 21, x - 3, base - 25, x + 3, base - 25, x + 7, base - 21], 'stone-2')
  g.hline(x - 7, x + 6, base - 21, 'stone-3')
  g.px(x - 8, base - 22, 'stone-2')
  g.px(x + 7, base - 22, 'stone-2')
  g.rect(x - 1, base - 28, 3, 3, 'stone-2')
  if (isNight(env)) disc(g, x, base - 18, 6, 'lamp-2', base - 13, 3)
}

/** 躺著休息的鹿（地面的裝飾，不會動） */
const RESTING = drawSprite(16, 9, (g) => {
  g.ellipse(8, 6, 6, 2, 'wood-1')
  g.rect(3, 6, 10, 2, 'wood-1')
  g.hline(4, 12, 8, 'wood-2')
  g.px(6, 5, 'paper')
  g.px(9, 5, 'paper')
  g.rect(12, 2, 3, 4, 'wood-1')
  g.px(14, 3, 'ink')
  g.px(15, 4, 'wood-2')
  g.px(12, 1, 'wood-2')
  g.px(11, 2, 'wood-2')
  g.rect(1, 5, 2, 1, 'paper')
})

function shop(g: Gfx, x: number, w: number, env: Env, r: Rng, manju: boolean) {
  const top = PATH - 40
  const lit = env.time !== 'day'
  g.rect(x, top + 8, w, 32, 'wood-2')
  g.rect(x + 2, top + 10, w - 4, 8, 'paper')
  for (let i = x + 4; i < x + w - 4; i += 3) g.vline(i, top + 11, top + 17, 'wood-3')
  g.rect(x - 2, top + 20, w + 4, 3, 'roof-2')
  g.hline(x - 2, x + w + 1, top + 20, 'roof-1')
  g.rect(x + 2, top + 24, w - 4, 16, lit ? 'lamp-2' : 'wood-3')
  // 店頭的台子
  g.rect(x + 3, PATH - 7, w - 6, 7, 'wood-1')
  g.hline(x + 3, x + w - 4, PATH - 7, 'paper-2')
  for (let i = x + 5; i < x + w - 6; i += 5) {
    g.rect(i, PATH - 9, 4, 2, manju ? 'gold-2' : r.pick(['shu-1', 'cloth-2', 'leaf-2'] as const))
    if (manju) g.px(i + 1, PATH - 10, 'gold-1')
  }
  // 暖簾
  const nk: Px = manju ? 'shu-2' : r.pick(['cloth-2', 'roof-3', 'leaf-3'] as const)
  g.rect(x + 3, top + 24, w - 6, 6, nk)
  for (let i = x + 8; i < x + w - 6; i += 6) g.vline(i, top + 25, top + 29, 'paper')
  if (manju) {
    // 楓葉形的招牌
    const cx = x + Math.round(w / 2)
    g.rect(cx - 6, top - 3, 12, 11, 'wood-3')
    g.rect(cx - 5, top - 2, 10, 9, 'paper')
    mapleLeaf(g, cx, top + 2, 'momiji-2')
  }
  g.poly([x - 3, top + 8, x + 3, top + 1, x + w - 3, top + 1, x + w + 3, top + 8], 'roof-2')
  g.hline(x - 3, x + w + 2, top + 8, 'roof-3')
  for (let i = x; i < x + w; i += 3) g.vline(i, top + 2, top + 7, 'roof-1')
}

/** 楓葉：五個尖 */
function mapleLeaf(g: Gfx, cx: number, cy: number, k: Px) {
  g.rect(cx - 1, cy - 1, 3, 3, k)
  g.px(cx, cy - 3, k)
  g.px(cx, cy - 2, k)
  g.px(cx - 3, cy - 1, k)
  g.px(cx - 2, cy - 1, k)
  g.px(cx + 2, cy - 1, k)
  g.px(cx + 3, cy - 1, k)
  g.px(cx - 2, cy + 2, k)
  g.px(cx + 2, cy + 2, k)
  g.px(cx, cy + 3, 'wood-3')
}

function promenade(g: Gfx, w: number, r: Rng) {
  // 參道：淺色的砂土路，靠海那一側是花崗岩的邊石
  g.rect(0, PATH, w, H - PATH, 'dirt-1')
  g.dither(0, PATH + 2, w, H - PATH - 2, 'sand-2', 6)
  g.dither(0, PATH + 18, w, H - PATH - 18, 'dirt-2', 2)
  for (let i = 0; i < w / 6; i++) g.px(r.int(0, w), r.int(PATH + 2, H - 1), r.pick(['stone-1', 'dirt-2', 'sand-1'] as const))
  g.rect(0, PATH - 2, w, 3, 'stone-1')
  for (let x = r.int(0, 8); x < w; x += r.int(10, 16)) g.vline(x, PATH - 2, PATH, 'stone-2')
  g.hline(0, w, PATH + 1, 'stone-2')
}

function seawall(g: Gfx, x0: number, x1: number) {
  // 靠海的低石堤（後面看得到海）
  g.rect(x0, PATH - 8, x1 - x0, 6, 'stone-2')
  g.hline(x0, x1 - 1, PATH - 8, 'stone-1')
  for (let x = x0 + 3; x < x1; x += 9) g.vline(x, PATH - 7, PATH - 3, 'stone-3')
  if (tide === 'high') for (let x = x0; x < x1; x += 2) g.px(x, PATH - 9, (x >> 1) % 3 ? 'sea-3' : 'foam')
}

function miyaGround(g: Gfx, w: number, r: Rng, env: Env) {
  shops = []
  pines = []
  promenade(g, w, r)
  let x = r.int(0, 20)
  let sinceShop = r.int(100, 260)
  while (x < w) {
    const k = r.next()
    if (sinceShop > 380 && k < 0.5) {
      // 表參道的老店（兩三間），其中一間賣紅葉饅頭
      const n = r.int(2, 3)
      const m = r.int(0, n - 1)
      shops.push([x - 4, x + n * 47 + 4])
      for (let i = 0; i < n; i++) {
        const sw = r.int(36, 46)
        shop(g, x, sw, env, r, i === m)
        x += sw + 1
      }
      sinceShop = 0
      x += r.int(4, 10)
      continue
    }
    const start = x
    if (k < 0.55) {
      // 海邊：石燈籠一排、低石堤，看得到海上的鳥居
      const len = r.int(90, 160)
      seawall(g, x, x + len)
      for (let i = x + r.int(8, 16); i < x + len - 6; i += r.int(34, 46)) stoneLantern(g, i, PATH - 1, env)
      if (r.chance(0.5)) g.sprite(RESTING, x + r.int(10, len - 26), PATH - 8, { flip: r.chance(0.5) })
      x += len
    } else if (k < 0.8) {
      // 松與楓
      const len = r.int(44, 70)
      seawall(g, x, x + len)
      const ps = r.int(18, 24)
      pine(g, x + 14, PATH - 2, ps)
      pines.push([x + 14 - Math.ceil(ps * 1.15), x + 14 + ps])
      maple(g, x + len - 16, PATH - 2, r.int(8, 10), env)
      x += len
    } else {
      // 鹿在草地上休息、楓樹
      const len = r.int(40, 60)
      g.rect(x, PATH - 6, len, 5, env.season === 'winter' ? 'dirt-2' : 'leaf-3')
      g.dither(x, PATH - 6, len, 2, 'leaf-2', 6)
      maple(g, x + 12, PATH - 4, r.int(9, 11), env)
      g.sprite(RESTING, x + len - 22, PATH - 9)
      x += len
    }
    sinceShop += x - start
  }
}

// ---------- 前景：垂下來的楓枝 ----------
function miyaFront(g: Gfx, w: number, r: Rng, env: Env) {
  for (let x = r.int(80, 200); x < w; x += r.int(300, 520)) {
    const len = r.int(36, 60)
    g.line(x, -1, x + len, 10, 'wood-3')
    g.line(x, 0, x + len, 11, 'wood-3')
    for (let i = 0; i < len; i += 5) {
      const lx = x + i + r.int(-2, 2)
      const ly = Math.round((i / len) * 10) + r.int(1, 6)
      if (env.season === 'winter') {
        g.line(lx, ly - 2, lx + 3, ly + 2, 'wood-3')
        continue
      }
      const k: Px = env.season === 'autumn' ? r.pick(['momiji-1', 'momiji-2', 'shu-1'] as const) : env.season === 'spring' ? r.pick(['leaf-1', 'leaf-2'] as const) : r.pick(['leaf-2', 'leaf-3'] as const)
      mapleLeaf(g, lx, ly, k)
    }
  }
}

// ---------- 宮島的腳本 ----------
// 鹿：走路 4 格、站著、低頭（吃、鞠躬）
function deerBody(g: Gfx, f: number, pose: 'walk' | 'stand' | 'bow' | 'munch') {
  const leg = pose === 'walk' ? [1, 0, -1, 0][f % 4]! : 0
  g.ellipse(9, 10, 6, 3, 'wood-1')
  g.px(7, 9, 'paper')
  g.px(10, 9, 'paper')
  g.px(8, 11, 'paper')
  g.rect(3, 9, 2, 2, 'paper')
  g.rect(4 + leg, 13, 2, 5, 'wood-2')
  g.rect(13 - leg, 13, 2, 5, 'wood-2')
  g.rect(6 - leg, 13, 2, 5, 'wood-1')
  g.rect(11 + leg, 13, 2, 5, 'wood-1')
  const low = pose === 'bow' || pose === 'munch'
  const hy = low ? 9 + (pose === 'munch' ? f % 2 : 0) : 3
  g.rect(13, low ? 8 : 5, 3, low ? 3 : 6, 'wood-1')
  g.rect(14, hy, 4, 4, 'wood-1')
  g.px(18, hy + 2, 'ink-2')
  g.px(16, hy + 1, 'ink')
  g.px(13, hy - 1, 'wood-2')
  g.px(14, hy - 1, 'wood-1')
}
const DEER = {
  walk: [0, 1, 2, 3].map((f) => drawSprite(20, 18, (g) => deerBody(g, f, 'walk'))),
  stand: drawSprite(20, 18, (g) => deerBody(g, 0, 'stand')),
  bow: drawSprite(20, 18, (g) => deerBody(g, 0, 'bow')),
  munch: [0, 1].map((f) => drawSprite(20, 18, (g) => deerBody(g, f, 'munch'))),
}
const MAP = drawSprite(8, 7, (g) => {
  g.rect(1, 1, 6, 5, 'paper')
  g.vline(3, 1, 5, 'paper-2')
  g.vline(5, 1, 5, 'paper-2')
  g.px(2, 3, 'shu-1')
  g.line(1, 4, 6, 2, 'sea-2')
})

const DEER_EVENT: EventDef = {
  id: 'miyajima-deer-map',
  *run(s) {
    // 旅人停下來看地圖，鹿從後面走過來一口叼走，旅人冒汗追過去；鹿把地圖吃掉，鞠個躬
    s.hero.stop()
    const map = s.spawn({ frames: MAP, x: s.cam + s.hero.x + 6, y: s.FLOOR - 8, z: 'front' })
    s.hero.emote('dots', 1.2)
    yield 1.2
    const deer = s.spawn({ frames: DEER.walk, fps: 6, x: s.cam - 14, y: s.FLOOR + 1, z: 'front' })
    yield* s.move(deer, s.cam + s.hero.x - 4, 24)
    deer.frames = [DEER.bow]
    deer.fps = 0
    deer.frame = 0
    yield 0.3
    // 叼走
    map.update = (a) => {
      a.x = deer.x + (deer.flip ? -9 : 9)
      a.y = deer.y - 6
    }
    deer.frames = DEER.walk
    deer.fps = 10
    s.hero.emote('surprise', 0.8)
    yield 0.3
    s.hero.jump(6)
    deer.x += 2
    yield* s.move(deer, s.cam + s.hero.x + 70, 46)
    s.hero.emote('sweat', 2.6)
    s.hero.speed = 2.2
    s.hero.walk()
    // 鹿在前面一點跑、旅人追
    const runAway = s.cam + s.W * 0.75
    yield* s.move(deer, runAway, 46)
    deer.frames = DEER.munch
    deer.fps = 5
    yield () => s.hero.x + s.cam > deer.x - 26
    s.hero.stop()
    s.hero.speed = 1
    // 吃掉了
    map.update = (a) => {
      a.x = deer.x + 10
      a.y = deer.y - 1
      a.level = Math.max(0, 16 - Math.round(a.age * 3))
    }
    yield 1.4
    map.remove()
    s.hero.emote('dots', 1.4)
    yield 1.2
    deer.frames = [DEER.bow]
    deer.fps = 0
    deer.frame = 0
    deer.flip = true
    yield 0.7
    deer.frames = [DEER.stand]
    s.hero.emote('sweat', 1)
    yield 1
    s.hero.walk()
    deer.frames = DEER.walk
    deer.fps = 6
    // 鹿往回走、跟旅人錯身（真的在走，不是原地踏步）
    // 走出畫面就結束（不要走到很遠的目標，畫面外還一直在跑）
    deer.flip = true
    deer.vx = -16
    yield () => deer.sx() < -20
  },
}

// 紅葉饅頭的攤子：烤盤冒煙、店員把剛烤好的遞出來
const MANJU = drawSprite(7, 7, (g) => {
  mapleLeaf(g, 3, 3, 'gold-2')
  g.px(3, 2, 'gold-1')
  g.px(2, 2, 'gold-1')
})
const CLERK = [0, 1].map((f) =>
  drawSprite(12, 16, (g) => {
    g.rect(3, 6, 6, 10, 'cloth-1')
    g.rect(3, 9, 6, 7, 'paper')
    g.ellipse(6, 4, 3, 3, 'skin-1')
    g.rect(3, 0, 6, 3, 'white')
    g.px(4, 4, 'ink')
    g.rect(f ? 0 : 1, 8 - f, 3, 2, 'skin-1')
  }),
)

const MANJU_EVENT: EventDef = {
  id: 'miyajima-manju',
  *run(s) {
    // 路邊烤紅葉饅頭的攤子：旅人聞到香味停下來，買一個，吃得很開心
    // 攤子（寬 44）擺在表參道的老店之間的空地，不蓋在店面上
    let sx = s.cam + s.W + 30
    for (let moved = true; moved; ) {
      moved = false
      for (const [a, b] of shops)
        if (b > sx - 26 && a < sx + 26) {
          sx = b + 27
          moved = true
        }
    }
    const stall = s.spawn({
      x: sx,
      y: s.FLOOR - 6,
      draw(g, x, y, a) {
        const X = Math.round(x)
        // 小攤子：屋簷、楓葉的布條、烤盤
        g.rect(X - 22, y - 30, 44, 3, 'roof-2')
        g.hline(X - 22, X + 21, y - 30, 'roof-1')
        g.rect(X - 20, y - 27, 2, 27, 'wood-3')
        g.rect(X + 18, y - 27, 2, 27, 'wood-3')
        g.rect(X - 18, y - 27, 36, 5, 'shu-2')
        for (let i = -12; i <= 12; i += 8) mapleLeaf(g, X + i, y - 25, 'paper')
        g.rect(X - 18, y - 10, 36, 10, 'wood-1')
        g.hline(X - 18, X + 17, y - 10, 'paper-2')
        g.rect(X - 14, y - 13, 20, 3, 'stone-4')
        for (let i = -12; i < 6; i += 5) g.rect(X + i, y - 14, 3, 1, 'gold-2')
        // 煙
        for (let i = 0; i < 3; i++) {
          const t = (a.age * 0.8 + i / 3) % 1
          g.dither(X - 8 + i * 5 + Math.round(Math.sin(t * 6 + i) * 2), y - 16 - Math.round(t * 14), 3, 2, 'white', Math.round(10 * (1 - t)))
        }
      },
    })
    const clerk = s.spawn({ frames: CLERK, fps: 0, x: sx + 10, y: s.FLOOR - 15, flip: true })
    yield () => stall.sx() < s.hero.x + 40
    s.hero.stop()
    s.hero.emote('surprise', 0.8)
    yield 0.9
    s.hero.emote('heart', 1.2)
    clerk.frame = 1
    yield 0.4
    // 遞過來
    const m = s.spawn({ frames: MANJU, x: clerk.x - 8, y: clerk.y - 7, z: 'front' })
    yield* s.move(m, s.cam + s.hero.x + 6, 30)
    clerk.frame = 0
    m.y = s.FLOOR - 9
    yield 0.4
    // 吃：一口、兩口
    for (let i = 0; i < 3; i++) {
      s.hero.jump(2)
      m.level = 16 - (i + 1) * 5
      yield 0.5
    }
    m.remove()
    s.hero.emote('heart', 1.6)
    yield 1.6
    s.hero.walk()
    yield () => stall.sx() < -30
  },
}

// 渡輪：白色的船身、藍色的線、煙囪；鳴笛的時候冒白煙
const FERRY = drawSprite(
  30,
  10,
  (g) => {
    g.poly([0, 5, 29, 5, 27, 9, 2, 9], 'white')
    g.hline(1, 28, 7, 'cloth-1')
    g.rect(6, 2, 16, 3, 'white')
    for (let i = 8; i < 21; i += 3) g.px(i, 3, 'sea-3')
    g.rect(10, 0, 8, 2, 'stone-1')
    g.rect(15, 0, 2, 2, 'shu-1')
  },
  null,
)

/** 渡輪一秒開幾 px（畫面座標）；鳴笛幾秒（這段時間船要一直看得到；之後開到島後面，旅人揮手送它） */
const FERRY_V = 15
const FERRY_WATCH = 1.5
const ferryFrom = (W: number, dir: number) => (dir > 0 ? -20 : W + 20)
/** 旅人停下來看渡輪的範圍（畫面 x）：在旅人前面、還沒開出畫面 */
function ferryWindow(s: Stage, x: number, dir: number) {
  return dir > 0 ? x > s.W * 0.4 && x < s.W - 40 : x < s.W * 0.7 && x > s.hero.x + 20
}
/** 渡輪在 x：船身與鳴笛的這幾秒要開過的海面，都沒有被山、神社、店擋住 */
function ferryClear(cam: number, x: number, dir: number) {
  const run = dir * FERRY_V * FERRY_WATCH
  return seaOpen(cam, x - 16 + Math.min(0, run), x + 16 + Math.max(0, run))
}
/** 往 dir 開的渡輪：旅人照常走的話，會不會開到看得到的地方（30 秒內、這一區走完之前） */
function ferrySeen(s: Stage, dir: number) {
  const v = s.hero.walking ? 22 * s.hero.speed : 0
  for (let t = 0; t < 30; t += 0.1) {
    const cam = s.cam + v * t
    if (cam > s.area.length - 40) break
    const x = ferryFrom(s.W, dir) + dir * FERRY_V * t
    if (ferryWindow(s, x, dir) && ferryClear(cam, x, dir)) return true
  }
  return false
}

const FERRY_EVENT: EventDef = {
  id: 'miyajima-ferry',
  ready: (s) => ferrySeen(s, 1) || ferrySeen(s, -1),
  *run(s) {
    // 渡輪從海上開過去，嘟——的一聲；旅人嚇一跳、揮手（跳）。開到山、神社、店後面看不到的時候不停下來
    const dirs = [1, -1].filter((d) => ferrySeen(s, d))
    const dir = dirs.length ? s.rng.pick(dirs) : s.rng.chance(0.5) ? 1 : -1
    const y = HZ + 11
    const ferry = s.spawn({
      frames: FERRY,
      x: dir > 0 ? -20 : s.W + 20,
      y,
      space: 'screen',
      z: 'sky',
      flip: dir < 0,
      vx: dir * FERRY_V,
      draw(g, x, yy, a) {
        const X = Math.round(x)
        // 船後的白浪
        for (let i = 1; i < 6; i++) g.hline(X - dir * (14 + i * 4), X - dir * (14 + i * 4) + 2, yy - 1 + (i % 2), 'foam')
        g.sprite(FERRY, X - 15, yy - 10, { flip: a.flip })
        if (isNight(s.env)) {
          for (let i = -8; i < 6; i += 3) g.px(X + i, yy - 7, 'lamp-1')
        }
      },
    })
    const seen = () => ferryWindow(s, ferry.x, dir) && ferryClear(s.cam, ferry.x, dir)
    const passed = () => (dir > 0 ? ferry.x >= s.W - 40 : ferry.x <= s.hero.x + 20)
    yield () => seen() || passed() || ferry.age > 30
    if (!seen()) {
      // 一直在山、神社、店的後面：船自己開走
      yield () => ferry.x < -40 || ferry.x > s.W + 40
      return
    }
    s.hero.stop()
    // 鳴笛：白煙與聲音的弧線（畫在對岸的山前面；船開到東西後面時不畫）
    const hx = () => Math.round(ferry.x) + (dir > 0 ? 1 : -1) * 1
    const horn = s.paint('mid', (g, t) => {
      if (!seaOpen(s.cam, ferry.x - 16, ferry.x + 16)) return
      const X = hx()
      const up = Math.round(t * 6)
      g.dither(X - 1, y - 13 - up, 3, 3, 'white', Math.max(0, 14 - Math.round(t * 10)))
      for (let i = 0; i < 3; i++) {
        const rr = 4 + i * 3 + Math.round((t * 8) % 3)
        g.px(X + rr, y - 12 - (i % 2), 'white')
        g.px(X - rr, y - 12 - (i % 2), 'white')
        g.px(X + rr - 1, y - 14, 'white')
        g.px(X - rr + 1, y - 14, 'white')
      }
    })
    s.hero.emote('surprise', 1)
    yield 1.4
    horn.stop()
    s.hero.emote('note', 1.4)
    s.hero.jump(5)
    yield 0.5
    s.hero.jump(5)
    yield 1.2
    s.hero.walk()
    yield () => ferry.x < -40 || ferry.x > s.W + 40
  },
}

// 走到大鳥居的人（退潮）、穿過鳥居的小船（漲潮）
const WALKER = [0, 1].map((f) =>
  drawSprite(5, 8, (g) => {
    g.rect(1, 2, 3, 4, f ? 'cloth-1' : 'shu-1')
    g.rect(1, 0, 3, 2, 'skin-1')
    g.px(1, 6, 'roof-3')
    g.px(3, 7 - f, 'roof-3')
    g.px(1 + f, 7, 'roof-3')
  }, null),
)
const BOAT = drawSprite(
  16,
  8,
  (g) => {
    g.poly([0, 4, 15, 4, 13, 7, 2, 7], 'wood-2')
    g.hline(0, 15, 4, 'wood-1')
    g.rect(5, 1, 6, 3, 'shu-2')
    g.hline(4, 11, 0, 'roof-3')
    g.px(3, 3, 'skin-1')
  },
  null,
)

function toriiOnScreen(s: Stage, cam = s.cam) {
  return toriiX - cam * SEA
}
/** 地面捲到 cam 的時候：大鳥居在旅人前面、畫面裡，沒有被店與松擋住 */
function toriiSeen(s: Stage, cam = s.cam) {
  const x = toriiOnScreen(s, cam)
  return x > s.hero.x + 20 && x < s.W - 30 && groundOpen(cam, x - 24, x + 24)
}
/** 照常走的話，16 秒內走得到看得見大鳥居的地方 */
function toriiAhead(s: Stage) {
  const end = Math.min(s.cam + 16 * 22 * s.hero.speed, s.area.length - 40)
  for (let c = s.cam; c <= end; c += 2) if (toriiSeen(s, c)) return true
  return false
}

const TORII_EVENT: EventDef = {
  id: 'miyajima-torii',
  ready: toriiAhead,
  *run(s) {
    // 退潮的時候大家走到大鳥居下面；漲潮的時候遊覽的小船從鳥居中間穿過去
    const t0 = s.t
    yield () => toriiSeen(s) || toriiOnScreen(s) < s.hero.x || s.t - t0 > 16
    if (!toriiSeen(s)) return
    s.hero.stop()
    const wx = toriiX
    if (tide === 'low') {
      const people = [0, 1, 2].map((i) =>
        s.spawn({ frames: WALKER, fps: 3, x: wx - 46 - i * 9, y: SB + (i % 2), space: SEA, z: 'mid', vx: 0 }),
      )
      people[1]!.frames = WALKER.map((w) => ({ ...w, keys: w.keys.map((k) => (k === 'shu-1' ? 'leaf-2' : k === 'cloth-1' ? 'gold-2' : k)) }))
      s.hero.emote('question', 1.2)
      yield 1
      for (const p of people) p.vx = 5
      yield () => people[0]!.x > wx - 4
      for (const p of people) {
        p.vx = 0
        p.fps = 0
      }
      s.hero.emote('surprise', 1)
      yield 0.6
      // 在鳥居下面跳起來拍照
      for (let i = 0; i < 2; i++) {
        for (const p of people) p.y -= 2
        yield 0.2
        for (const p of people) p.y += 2
        yield 0.3
      }
      s.hero.emote('heart', 1.6)
      yield 1.4
    } else {
      const night = isNight(s.env)
      const boat = s.spawn({
        frames: BOAT,
        x: wx - 70,
        y: SB + 1,
        space: SEA,
        z: 'mid',
        draw(g, x, y, a) {
          g.sprite(BOAT, Math.round(x) - 8, y - 8)
          g.hline(Math.round(x) - 12, Math.round(x) - 10, y - 1, 'foam')
          if (night) {
            g.vline(Math.round(x) + 6, y - 11, y - 8, 'ink-2')
            g.ellipse(Math.round(x) + 6, y - 12, 1, 2, 'lamp-2')
            g.dither(Math.round(x) + 5, y, 3, 4, 'lamp-2', 6)
          }
          void a
        },
      })
      s.hero.emote('dots', 1)
      boat.vx = 9
      yield () => boat.x > wx - 2
      s.hero.emote('surprise', 1)
      yield 1
      s.hero.emote('heart', 1.4)
      yield () => boat.x > wx + 40
    }
    s.hero.walk()
  },
}

export const MIYAJIMA: AreaDef = {
  id: 'miyajima',
  name: '宮島',
  romaji: 'MIYAJIMA',
  tags: ['coast', 'shrine', 'deer', 'town'],
  length: 1400,
  horizon: HZ,
  sky: miyaSky,
  layers: [
    { speed: FAR, draw: shoreHills },
    { speed: HILL, draw: hills },
    { speed: SEA, draw: seaLayer },
  ],
  ground: { speed: 1, draw: miyaGround },
  front: { speed: 1.3, draw: miyaFront },
  events: [DEER_EVENT, MANJU_EVENT, FERRY_EVENT, TORII_EVENT],
}
