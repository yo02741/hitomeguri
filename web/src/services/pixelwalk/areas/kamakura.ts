import { drawSprite } from '../build'
import { dotOn, type Gfx } from '../gfx'
import { isNight, lantern, pine, peak, seasonTree, skyBase, torii, windows } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import { type AreaDef, type Env, type EventDef, FLOOR, H } from '../types'

/**
 * 鎌倉：湘南的海（遠方的江之島與富士山）、海邊的沙灘與衝浪的人、鶴岡八幡宮的大石段與樓門，
 * 地面沿著江之電的軌道：住家與小店、小小的車站、鎌倉大佛、朱色的大鳥居、紫陽花（夏）。
 * 層：海平線上的島 0.08、岬 0.3、沙灘與八幡宮 0.55、地面 1（軌道在旅人後面）、前景 1.3。海畫在天空裡（不捲），夕陽與月光的倒影才對得上。
 */
const LEN = 1450
const PATH = FLOOR - 8
/** 海平線 */
const HZ = 94
/** 江之電的鐵軌（車輪踩的那一列） */
const RAIL = 119
const SP_FAR = 0.08
const SP_BEACH = 0.55


function shadeOn(g: Gfx, x: number, y: number, w: number, h: number, k: Px, level: number) {
  const u = g.pal.u32[k]
  for (let yy = Math.max(0, y); yy < Math.min(g.h, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(g.w, x + w); xx++) if (g.buf[yy * g.w + xx] && dotOn(xx, yy, level)) g.buf[yy * g.w + xx] = u
}

// ---------- 天空與海 ----------
function sky(g: Gfx, env: Env, r: Rng) {
  skyBase(g, env, r, HZ)
  const W = g.w
  // 找太陽、月亮在哪（倒影要畫在它下面）
  const find = (k: Px, y0: number, y1: number) => {
    const v = g.pal.u32[k]
    for (let y = y0; y <= y1; y++) for (let x = 0; x < W; x++) if (g.buf[y * W + x] === v) return x + 4
    return -1
  }
  const glowX = env.time === 'dusk' ? find('lamp-1', HZ - 15, HZ - 13) : env.time === 'night' ? find('moon', 18, 24) : -1
  const bands: Px[] = env.time === 'night' ? ['sky-night-2', 'sky-night-1'] : env.time === 'dusk' ? ['sky-dusk-2', 'sky-dusk-1', 'sea-3'] : ['sea-2', 'sea-2', 'sea-3']
  g.bands(HZ, H - HZ, bands)
  g.hline(0, W, HZ, env.time === 'day' ? 'sea-3' : env.time === 'dusk' ? 'sky-dusk-1' : 'sky-night-1')
  const line: Px = env.time === 'night' ? 'sky-night-3' : env.time === 'dusk' ? 'sky-dusk-3' : 'sea-1'
  for (let i = 0; i < W / 4; i++) {
    const y = r.int(HZ + 2, H - 1)
    const x = r.int(0, W)
    g.hline(x, x + r.int(1, 2 + Math.round((y - HZ) / 8)), y, line)
  }
  if (env.time === 'day') for (let i = 0; i < W / 10; i++) g.px(r.int(0, W), r.int(HZ + 2, H - 1), 'white')
  // 夕陽、月光在海上的一條光
  if (glowX >= 0) {
    const k: Px = env.time === 'dusk' ? 'lamp-1' : 'moon'
    for (let y = HZ + 1; y < H; y += 2) {
      const half = 2 + Math.round((y - HZ) / 6)
      for (let i = 0; i < 2; i++) {
        const x = glowX + r.int(-half, half)
        g.hline(x, x + r.int(1, 3), y, r.chance(0.5) ? k : env.time === 'dusk' ? 'lamp-2' : 'star')
      }
    }
  }
}

/** 海平線：江之島（燈塔）、後面的富士山、箱根與伊豆的山、帆船 */
function farLayer(g: Gfx, w: number, r: Rng, env: Env, view: number) {
  const W = view
  const ex = Math.round(W * 0.5 + LEN * SP_FAR * 0.45)
  const night = isNight(env)
  const far: Px = env.time === 'dusk' ? 'sky-dusk-1' : night ? 'sky-night-3' : 'roof-1'
  const near: Px = env.time === 'dusk' ? 'ink-2' : night ? 'roof-3' : 'leaf-4'
  // 箱根、伊豆：低低的山
  for (let x = ex - 140; x < ex + 260; x += r.int(30, 50)) g.ellipse(x, HZ, r.int(20, 34), r.int(3, 7), far)
  // 富士山（小小的，冬春有雪）
  const fx = ex + 52
  peak(g, fx, HZ - 26, HZ, 34, far)
  g.rect(fx - 2, HZ - 26, 5, 1, far)
  if (env.season !== 'summer') {
    const snow: Px = env.time === 'dusk' ? 'sakura-1' : night ? 'stone-2' : 'snow-1'
    const d = env.season === 'autumn' ? 4 : 9
    g.tri(fx - Math.round(d * 1.3), HZ - 26 + d, fx, HZ - 26, fx + Math.round(d * 1.3), HZ - 26 + d, snow)
    for (let i = -d; i <= d; i += 2) g.vline(fx + i, HZ - 26 + d, HZ - 26 + d + r.int(0, 3), snow)
  }
  // 江之島
  g.ellipse(ex, HZ, 24, 9, near)
  g.ellipse(ex - 8, HZ - 4, 12, 7, near)
  g.ellipse(ex + 10, HZ - 2, 12, 6, near)
  if (!night && env.time === 'day') {
    g.dither(ex - 18, HZ - 10, 30, 4, 'leaf-3', 5)
    shadeOn(g, ex - 26, HZ - 12, 52, 12, 'leaf-3', 3)
  }
  g.rect(ex - 9, HZ - 24, 2, 13, night ? 'roof-2' : 'stone-1')
  g.rect(ex - 11, HZ - 25, 6, 2, night ? 'roof-2' : 'stone-1')
  g.px(ex - 9, HZ - 26, 'stone-3')
  if (env.time !== 'day') g.rect(ex - 10, HZ - 27, 3, 2, 'lamp-1')
  // 橋（往左邊的岸）
  for (let x = ex - 60; x < ex - 20; x++) g.px(x, HZ, night ? 'roof-2' : 'stone-2')
  if (night) for (let x = ex - 58; x < ex - 22; x += 6) g.px(x, HZ - 1, 'lamp-2')
  // 帆船
  for (let x = r.int(10, 60); x < w; x += r.int(50, 110)) {
    if (Math.abs(x - ex) < 34) continue
    const y = HZ + r.int(2, 6)
    g.tri(x, y, x + 2, y - 5, x + 3, y, night ? 'roof-2' : 'white')
    g.hline(x - 1, x + 3, y, night ? 'roof-3' : 'stone-3')
  }
}

/** 岬與山：圓圓的樹林（鎌倉的山一路連到海邊） */
function hills(g: Gfx, w: number, r: Rng, env: Env) {
  for (let x = r.int(-40, 60); x < w; x += r.int(160, 300)) {
    const hw = r.int(40, 80)
    const top = r.int(70, 84)
    for (let i = -hw; i <= hw; i += 4) {
      const t = 1 - (i / hw) * (i / hw)
      const y = Math.round(HZ + 10 - (HZ + 10 - top) * Math.sqrt(Math.max(0, t)))
      g.circle(x + i, y + 4, 5, 'leaf-4')
      g.vline(x + i, y + 4, H, 'leaf-4')
      g.vline(x + i + 1, y + 4, H, 'leaf-4')
      g.vline(x + i + 2, y + 4, H, 'leaf-4')
      g.vline(x + i + 3, y + 4, H, 'leaf-4')
    }
    const hi: Px = env.season === 'autumn' ? 'momiji-2' : env.season === 'spring' ? 'sakura-1' : 'leaf-3'
    for (let i = 0; i < hw / 3; i++) {
      const xx = x + r.int(-hw + 8, hw - 8)
      const t = 1 - ((xx - x) / hw) ** 2
      const y = Math.round(HZ + 10 - (HZ + 10 - top) * Math.sqrt(Math.max(0, t)))
      g.circle(xx, r.int(y + 6, y + 18), r.int(1, 2), r.chance(0.5) ? 'leaf-3' : hi)
    }
  }
}

// ---------- 沙灘、鶴岡八幡宮 ----------
function beachStrip(g: Gfx, x0: number, x1: number, r: Rng, env: Env) {
  const w = x1 - x0
  const night = isNight(env)
  const sea: Px = env.time === 'night' ? 'sky-night-2' : env.time === 'dusk' ? 'sea-3' : 'sea-2'
  g.rect(x0, 102, w, 8, sea)
  for (let i = 0; i < w / 6; i++) {
    const x = x0 + r.int(0, w)
    g.hline(x, x + r.int(2, 5), r.int(103, 108), env.time === 'night' ? 'sky-night-3' : 'sea-1')
  }
  // 白浪
  for (let x = x0; x < x1; x++) {
    const y = 110 + Math.round(Math.sin(x * 0.11) * 0.8)
    g.px(x, y, 'foam')
    g.px(x, y - 1, (x * 7) % 5 < 3 ? 'white' : 'foam')
    if ((x * 13) % 7 < 2) g.px(x, y - 3, 'foam')
  }
  g.rect(x0, 111, w, 2, 'sand-2')
  g.rect(x0, 113, w, 13, 'sand-1')
  g.dither(x0, 118, w, 8, 'sand-2', 4)
  for (let i = 0; i < w / 10; i++) g.px(x0 + r.int(0, w), r.int(114, 125), r.pick(['sand-2', 'paper', 'stone-1'] as const))
  // 夏天的海之家、陽傘；其他季節拉上岸的漁船與晒海帶的架子
  for (let x = x0 + r.int(10, 40); x < x1 - 30; x += r.int(50, 90)) {
    if (env.season === 'summer') {
      if (r.chance(0.5)) {
        g.rect(x, 104, 26, 12, 'wood-1')
        g.rect(x + 2, 108, 22, 8, night ? 'lamp-2' : 'wood-2')
        for (let i = 0; i < 26; i += 4) g.rect(x + i, 102, 2, 3, i % 8 ? 'white' : 'shu-1')
        g.hline(x - 1, x + 26, 101, 'roof-2')
      } else
        for (let i = 0; i < 3; i++) {
          const ux = x + i * 9
          const k = r.pick(['shu-1', 'sea-1', 'gold-1', 'white'] as const)
          g.vline(ux, 110, 117, 'stone-3')
          g.poly([ux - 4, 111, ux, 108, ux + 4, 111], k)
        }
    } else if (r.chance(0.5)) {
      g.poly([x, 115, x + 2, 118, x + 16, 118, x + 18, 114], night ? 'roof-1' : 'white')
      g.hline(x + 1, x + 17, 116, 'sea-2')
    } else {
      for (let i = 0; i < 3; i++) g.vline(x + i * 7, 109, 118, 'wood-3')
      g.hline(x, x + 14, 110, 'wood-3')
      if (env.season === 'spring' || env.season === 'winter') for (let i = x + 1; i < x + 14; i += 2) g.vline(i, 111, 111 + r.int(2, 5), 'leaf-4')
    }
  }
}

function hachimangu(g: Gfx, x: number, env: Env, r: Rng) {
  const night = isNight(env)
  // 後面的山（樹林）
  for (let i = -80; i <= 80; i += 6) {
    const y = 56 + Math.round(Math.abs(i) * 0.36)
    g.circle(x + i, y + 4, 8, 'leaf-4')
    g.rect(x + i - 3, y + 4, 7, H - y, 'leaf-4')
  }
  for (let i = 0; i < 26; i++) g.circle(x + r.int(-66, 66), r.int(72, 98), r.int(1, 2), env.season === 'autumn' ? r.pick(['momiji-1', 'gold-1'] as const) : 'leaf-3')
  // 大石段：正面看，一階一階往上變窄
  for (let i = 0; i < 15; i++) {
    const y = 126 - i * 3
    const half = 18 - Math.round(i * 0.5)
    g.rect(x - half, y - 2, half * 2, 2, 'stone-1')
    g.hline(x - half, x + half - 1, y, 'stone-3')
  }
  g.line(x - 19, 126, x - 12, 82, 'shu-2')
  g.line(x + 18, 126, x + 11, 82, 'shu-2')
  // 樓門（本宮）：朱色、黑瓦、金色的飾
  const top = 62
  g.rect(x - 22, top + 8, 44, 16, night ? 'wood-3' : 'shu-1')
  for (let i = x - 20; i < x + 21; i += 7) g.vline(i, top + 8, top + 23, night ? 'ink-2' : 'shu-2')
  g.rect(x - 7, top + 12, 14, 12, night ? 'lamp-2' : 'roof-3')
  g.hline(x - 22, x + 21, top + 16, night ? 'ink-2' : 'paper')
  g.poly([x - 30, top + 9, x - 20, top + 2, x + 20, top + 2, x + 30, top + 9], 'roof-3')
  g.hline(x - 30, x + 29, top + 9, 'ink-2')
  g.rect(x - 15, top - 3, 30, 5, night ? 'wood-3' : 'shu-1')
  g.poly([x - 21, top - 2, x - 15, top - 9, x + 15, top - 9, x + 21, top - 2], 'roof-3')
  g.px(x - 21, top - 3, 'gold-1')
  g.px(x + 20, top - 3, 'gold-1')
  g.hline(x - 13, x + 12, top - 9, 'gold-2')
  g.rect(x - 4, top - 2, 8, 3, 'gold-1')
  if (env.season === 'winter') g.hline(x - 14, x + 13, top - 10, 'snow-1')
  // 石段旁的大銀杏（秋天金黃）
  const gx = x - 40
  g.rect(gx - 2, 94, 4, 32, 'wood-3')
  const leaf: Px = env.season === 'autumn' ? 'gold-1' : env.season === 'winter' ? 'wood-2' : 'leaf-3'
  const dark: Px = env.season === 'autumn' ? 'gold-2' : env.season === 'winter' ? 'wood-3' : 'leaf-4'
  g.ellipse(gx, 84, 12, 14, leaf)
  g.ellipse(gx, 70, 8, 8, leaf)
  g.dither(gx - 12, 84, 24, 14, dark, 6)
  if (night) for (let i = 0; i < 4; i++) g.px(x - 20 + i * 13, top + 21, 'lamp-1')
}

function midLayer(g: Gfx, w: number, r: Rng, env: Env, view: number) {
  const W = view
  const shrineAt = Math.round(W * 0.9) + r.int(40, 120)
  let x = 0
  let shrineDone = false
  while (x < w) {
    if (!shrineDone && x + 180 > shrineAt) {
      hachimangu(g, x + 86, env, r)
      shrineDone = true
      x += 172
      continue
    }
    const len = r.int(200, 340)
    beachStrip(g, x, Math.min(w, x + len), r, env)
    // 沙灘邊的松
    pine(g, x + len - r.int(6, 20), 124, r.int(8, 11))
    x += len
    if (r.chance(0.5) && x < w) {
      // 海邊的一叢樹與屋頂
      for (let i = 0; i < 4; i++) g.circle(x + 6 + i * 10, r.int(98, 104), r.int(6, 9), 'leaf-4')
      g.rect(x - 2, 104, 48, H - 104, 'leaf-4')
      g.poly([x + 8, 104, x + 14, 98, x + 32, 98, x + 38, 104], 'roof-3')
      g.rect(x + 12, 104, 22, 12, 'wood-2')
      x += 46
    }
  }
}

// ---------- 地面：江之電沿線 ----------
/** 這一次看得到海的路段（世界座標；衝浪的腳本用） */
let COAST: Array<[number, number]> = []

function track(g: Gfx, w: number) {
  g.rect(0, RAIL + 2, w, PATH - RAIL - 2, 'stone-3')
  g.dither(0, RAIL + 4, w, PATH - RAIL - 4, 'stone-2', 6)
  g.dither(0, RAIL + 6, w, PATH - RAIL - 6, 'stone-4', 3)
  for (let x = 0; x < w; x += 7) g.rect(x, RAIL + 2, 4, 1, 'wood-3')
  g.hline(0, w, RAIL, 'stone-1')
  g.hline(0, w, RAIL + 1, 'stone-3')
  g.hline(0, w, PATH - 1, 'stone-4')
}

function house(g: Gfx, x: number, w: number, r: Rng, env: Env) {
  const h = r.int(24, 36)
  const top = RAIL + 2 - h
  const wall = r.pick(['paper', 'paper-2', 'stone-1', 'white'] as const)
  const roof = r.pick(['roof-2', 'roof-3', 'shu-2', 'roof-1'] as const)
  g.rect(x, top, w, h, wall)
  g.vline(x + w - 1, top, RAIL, 'stone-2')
  windows(g, x + 4, top + 5, Math.max(1, Math.floor((w - 8) / 9)), h > 30 ? 2 : 1, 6, 5, env, r)
  if (r.chance(0.5)) {
    g.poly([x - 3, top + 1, x + w / 2, top - 9, x + w + 3, top + 1], roof)
    g.hline(x - 3, x + w + 2, top + 1, 'ink-2')
  } else {
    g.poly([x - 3, top + 1, x + 4, top - 6, x + w - 4, top - 6, x + w + 3, top + 1], roof)
    g.hline(x - 3, x + w + 2, top + 1, 'ink-2')
  }
  if (env.season === 'winter' && r.chance(0.3)) g.hline(x + 2, x + w - 3, top - 6, 'snow-1')
  // 門前的生垣或木柵
  if (r.chance(0.6)) {
    g.rect(x - 2, RAIL - 9, w + 4, 11, 'leaf-3')
    g.hline(x - 2, x + w + 1, RAIL - 9, 'leaf-2')
    g.dither(x - 2, RAIL - 5, w + 4, 6, 'leaf-4', 6)
    if (env.season === 'winter') for (let i = x; i < x + w; i += 5) g.px(i + r.int(0, 3), RAIL - r.int(4, 8), 'shu-1')
  } else {
    g.rect(x - 2, RAIL - 8, w + 4, 10, 'wood-2')
    for (let i = x - 1; i < x + w + 2; i += 3) g.vline(i, RAIL - 8, RAIL + 1, 'wood-3')
  }
}

function shop(g: Gfx, x: number, w: number, r: Rng, env: Env) {
  const top = RAIL - 30
  g.rect(x, top, w, 32, r.pick(['wood-2', 'paper', 'stone-1'] as const))
  g.rect(x + 2, top + 12, w - 4, 20, env.time === 'day' ? 'roof-2' : 'lamp-2')
  for (let i = x + 4; i < x + w - 3; i += 8) g.vline(i, top + 12, RAIL, 'wood-3')
  // 遮陽篷與招牌（色塊）
  const k = r.pick(['shu-1', 'leaf-3', 'cloth-1', 'gold-2'] as const)
  for (let i = 0; i < w; i += 4) g.rect(x + i, top + 8, 2, 4, k)
  g.rect(x, top + 8, w, 1, 'ink-2')
  g.rect(x + 4, top + 2, w - 8, 5, 'paper')
  g.frame(x + 4, top + 2, w - 8, 5, 'wood-3')
  g.rect(x + 7, top + 4, Math.max(2, w - 20), 1, r.pick(['ink-2', 'shu-2', 'leaf-4'] as const))
  g.poly([x - 2, top + 1, x + 3, top - 4, x + w - 3, top - 4, x + w + 2, top + 1], 'roof-2')
  // 店前的盆栽、立牌
  g.rect(x + w - 8, RAIL - 6, 5, 6, 'wood-1')
  g.circle(x + w - 6, RAIL - 8, 3, 'leaf-3')
}

const STATIONS = ['HASE', 'YUIGAHAMA', 'GOKURAKUJI', 'KOSHIGOE', 'INAMURAGASAKI'] as const
function station(g: Gfx, x: number, r: Rng, env: Env) {
  const name = r.pick(STATIONS)
  const bw = name.length * 4 + 5
  const w = 74 + bw
  // 月台（軌道後面）、屋簷、站名牌
  g.rect(x, RAIL - 8, w, 9, 'stone-2')
  g.hline(x, x + w - 1, RAIL - 8, 'stone-1')
  g.hline(x, x + w - 1, RAIL - 7, 'gold-1')
  for (let i = x + 10; i < x + 60; i += 24) g.rect(i, RAIL - 32, 2, 24, 'wood-3')
  g.poly([x + 4, RAIL - 30, x + 8, RAIL - 36, x + 60, RAIL - 36, x + 64, RAIL - 30], 'roof-2')
  g.hline(x + 4, x + 63, RAIL - 30, 'roof-3')
  if (env.time !== 'day') g.rect(x + 30, RAIL - 29, 4, 2, 'lamp-1')
  g.rect(x + 16, RAIL - 14, 14, 2, 'wood-1')
  g.vline(x + 17, RAIL - 12, RAIL - 9, 'wood-3')
  g.vline(x + 28, RAIL - 12, RAIL - 9, 'wood-3')
  const bx = x + 70
  g.rect(bx + 3, RAIL - 20, 1, 12, 'stone-3')
  g.rect(bx + bw - 4, RAIL - 20, 1, 12, 'stone-3')
  g.rect(bx, RAIL - 28, bw, 9, 'white')
  g.frame(bx, RAIL - 28, bw, 9, 'stone-3')
  g.text(name, bx + 3, RAIL - 27, 'ink')
  g.hline(bx + 1, bx + bw - 2, RAIL - 21, 'leaf-3')
  return w
}

/** 鎌倉大佛：青銅的坐像（綠鏽用抖色），在石台上 */
function daibutsu(g: Gfx, x: number, env: Env, r: Rng) {
  const night = isNight(env)
  // 後面的樹與松
  for (let i = -80; i <= 80; i += 9) g.circle(x + i, 66 + Math.round(Math.abs(i) * 0.25) + r.int(-3, 3), 11, 'leaf-4')
  g.rect(x - 86, 70, 172, RAIL - 68, 'leaf-4')
  for (let i = 0; i < 20; i++) g.circle(x + r.int(-80, 80), r.int(64, 100), r.int(1, 3), env.season === 'autumn' ? 'momiji-2' : env.season === 'spring' ? 'sakura-1' : 'leaf-3')
  pine(g, x - 62, RAIL - 4, 14)
  pine(g, x + 64, RAIL - 4, 13)
  // 石台、蓮座
  g.rect(x - 40, RAIL - 12, 80, 14, 'stone-2')
  g.hline(x - 40, x + 39, RAIL - 12, 'stone-1')
  g.hline(x - 40, x + 39, RAIL - 5, 'stone-3')
  const B: Px = 'roof-1'
  const S: Px = 'roof-2'
  const D: Px = 'roof-3'
  g.rect(x - 34, RAIL - 16, 68, 4, S)
  for (let i = x - 33; i < x + 33; i += 5) g.hline(i, i + 3, RAIL - 16, B)
  // 膝（盤腿）與手（定印）
  g.ellipse(x, RAIL - 22, 32, 6, B)
  g.rect(x - 32, RAIL - 22, 64, 6, B)
  g.ellipse(x, RAIL - 26, 10, 3, S)
  g.ellipse(x, RAIL - 27, 7, 2, B)
  g.px(x - 2, RAIL - 28, D)
  g.px(x + 2, RAIL - 28, D)
  // 身體與衣褶
  g.poly([x - 18, RAIL - 50, x + 18, RAIL - 50, x + 27, RAIL - 24, x - 27, RAIL - 24], B)
  g.ellipse(x - 18, RAIL - 47, 5, 4, B)
  g.ellipse(x + 18, RAIL - 47, 5, 4, B)
  for (const k of [-12, -6, 6, 12]) g.line(x + k, RAIL - 46, x + Math.round(k * 1.5), RAIL - 28, S)
  g.line(x - 10, RAIL - 50, x, RAIL - 40, S)
  g.line(x + 10, RAIL - 50, x, RAIL - 40, S)
  // 頭：螺髮、肉髻、長耳垂
  g.rect(x - 4, RAIL - 54, 8, 5, B)
  g.ellipse(x, RAIL - 63, 9, 10, B)
  g.ellipse(x, RAIL - 73, 5, 3, B)
  g.rect(x - 11, RAIL - 66, 2, 11, B)
  g.rect(x + 9, RAIL - 66, 2, 11, B)
  for (let yy = RAIL - 75; yy < RAIL - 67; yy += 2) for (let xx = x - 8; xx <= x + 8; xx += 2) if (Math.abs(xx - x) < 9 - (RAIL - 67 - yy) * 0.3) g.px(xx + ((yy >> 1) & 1), yy, S)
  g.hline(x - 6, x - 3, RAIL - 63, D)
  g.hline(x + 3, x + 6, RAIL - 63, D)
  g.px(x, RAIL - 66, D)
  g.vline(x, RAIL - 62, RAIL - 60, S)
  g.hline(x - 2, x + 2, RAIL - 57, D)
  // 右邊的影子（實的一塊，交界抖一下）、左邊的亮面、綠鏽
  const u = g.pal.u32
  for (let yy = RAIL - 76; yy < RAIL - 16; yy++)
    for (let xx = x - 34; xx < x + 35; xx++) {
      const i = yy * g.w + xx
      if (g.buf[i] !== u[B]) continue
      const edge = Math.round((yy - (RAIL - 76)) * 0.12) + 3
      if (xx - x > edge || (xx - x > edge - 3 && dotOn(xx, yy, 8))) g.buf[i] = u[S]
    }
  for (const [ax, ay, bx, by] of [[-9, -70, -8, -60], [-17, -48, -24, -26], [-30, -21, -20, -18]] as const) g.line(x + ax, RAIL + ay, x + bx, RAIL + by, 'stone-1')
  for (let i = 0; i < 7; i++) g.vline(x - 20 + i * 6, RAIL - 44 + (i % 3), RAIL - 38 + (i % 3) * 2, 'leaf-3')
  if (night) for (const dx of [-36, 36]) g.rect(x + dx - 1, RAIL - 14, 3, 2, 'lamp-2')
  // 石燈籠
  lantern(g, x - 48, RAIL - 1, env)
  lantern(g, x + 48, RAIL - 1, env)
}

function shrineGate(g: Gfx, x: number, r: Rng, env: Env) {
  // 段葛：一路往裡面的石燈籠與櫻並木，前面朱色的大鳥居
  g.rect(x - 52, 92, 104, RAIL - 90, 'leaf-4')
  for (let i = -48; i <= 48; i += 10) g.circle(x + i, 92 + r.int(-3, 3), 9, 'leaf-4')
  for (let i = 0; i < 3; i++) {
    seasonTree(g, x - 40 + i * 9, RAIL - 6 - i * 2, 9 - i * 2, env)
    seasonTree(g, x + 40 - i * 9, RAIL - 6 - i * 2, 9 - i * 2, env)
  }
  g.poly([x - 16, RAIL + 1, x - 6, RAIL - 12, x + 6, RAIL - 12, x + 16, RAIL + 1], 'stone-1')
  g.hline(x - 6, x + 5, RAIL - 12, 'stone-2')
  for (let i = 0; i < 3; i++) {
    const y = RAIL - 1 - i * 4
    const off = 17 - i * 4
    for (const sx of [-1, 1]) {
      g.rect(x + sx * off - 1, y - 5 + i, 3, 5 - i, 'stone-2')
      g.rect(x + sx * off - 2, y - 6 + i, 5, 1, 'stone-3')
    }
  }
  torii(g, x, RAIL + 2, 70, 80)
}

function ajisai(g: Gfx, x0: number, x1: number, r: Rng, env: Env) {
  // 石牆上一整排的紫陽花（夏）；春天杜鵑、秋天楓、冬天山茶
  g.rect(x0, RAIL - 14, x1 - x0, 16, 'stone-2')
  for (let y = RAIL - 14, n = 0; y < RAIL + 2; y += 4, n++) {
    g.hline(x0, x1, y, 'stone-3')
    for (let x = x0 + (n % 2) * 5; x < x1; x += 10) g.vline(x, y, y + 3, 'stone-3')
  }
  g.hline(x0, x1, RAIL - 14, 'stone-1')
  const flowers: Px[] =
    env.season === 'summer' ? ['sea-1', 'cloth-1', 'lavender', 'sakura-2', 'sea-2'] : env.season === 'spring' ? ['sakura-2', 'sakura-1', 'shu-1'] : env.season === 'winter' ? ['shu-1', 'shu-2'] : ['momiji-1', 'momiji-2']
  for (let x = x0 + 6; x < x1 - 6; x += r.int(10, 16)) {
    const y = RAIL - 16 - r.int(0, 3)
    g.circle(x, y, r.int(6, 8), env.season === 'winter' ? 'leaf-4' : 'leaf-3')
    g.circle(x + 5, y + 2, 5, 'leaf-3')
    g.dither(x - 7, y + 1, 14, 6, 'leaf-4', 6)
    const n = env.season === 'summer' ? 4 : env.season === 'autumn' ? 2 : 5
    for (let i = 0; i < n; i++) {
      const fx = x + r.int(-6, 6)
      const fy = y + r.int(-6, 3)
      const k = r.pick(flowers)
      if (env.season === 'summer') {
        g.circle(fx, fy, 2, k)
        g.px(fx - 1, fy - 1, 'white')
      } else g.px(fx, fy, k)
    }
  }
}

function ground(g: Gfx, w: number, r: Rng, env: Env, view: number) {
  COAST = []
  // 人行道（磁磚）與馬路
  g.rect(0, PATH, w, 17, 'stone-1')
  for (let y = PATH + 5; y < PATH + 17; y += 6) g.hline(0, w, y, 'stone-2')
  for (let x = 0, n = 0; x < w; x += 8, n++) g.vline(x + (n % 2) * 4, PATH + 1, PATH + 16, 'stone-2')
  g.dither(0, PATH + 1, w, 2, 'paper', 4)
  g.rect(0, PATH + 17, w, 2, 'stone-2')
  g.rect(0, PATH + 19, w, H - PATH - 19, 'stone-3')
  g.dither(0, PATH + 20, w, H - PATH - 20, 'stone-4', 4)
  for (let x = 0; x < w; x += 18) g.rect(x, H - 6, 9, 1, 'paper')

  let x = 0
  let last = ''
  const W = view
  const daibutsuAt = Math.round(W * 0.5) + r.int(380, 600)
  const toriiAt = r.chance(0.5) ? r.int(160, 260) : daibutsuAt + r.int(420, 600)
  let doneD = false
  let doneT = false
  const kinds = ['town', 'coast', 'ajisai', 'station'] as const
  while (x < w) {
    if (!doneD && x + 120 > daibutsuAt) {
      daibutsu(g, x + 90, env, r)
      x += 180
      doneD = true
      last = 'daibutsu'
      continue
    }
    if (!doneT && x + 60 > toriiAt) {
      shrineGate(g, x + 56, r, env)
      x += 112
      doneT = true
      last = 'torii'
      continue
    }
    const kind = r.weighted(kinds, (k) => (k === last ? 0 : k === 'coast' ? (x === 0 ? 0 : 2.2) : k === 'station' ? 0.4 : 1))
    last = kind
    if (kind === 'coast') {
      const len = r.int(170, 260)
      COAST.push([x, x + len])
      beachStrip(g, x, x + len, r, env)
      // 防風的松、衝浪板架、公車站
      pine(g, x + r.int(6, 14), RAIL + 1, r.int(10, 13))
      if (r.chance(0.6)) {
        const bx = x + r.int(50, len - 50)
        g.rect(bx, RAIL - 14, 1, 15, 'wood-3')
        g.rect(bx + 14, RAIL - 14, 1, 15, 'wood-3')
        for (let i = 0; i < 4; i++) {
          const k = r.pick(['white', 'sea-1', 'shu-1', 'gold-1', 'leaf-2'] as const)
          g.rect(bx + 2 + i * 3, RAIL - 22 + r.int(0, 3), 2, 20, k)
          g.px(bx + 2 + i * 3, RAIL - 22, 'ink-2')
        }
        g.hline(bx, bx + 14, RAIL - 10, 'wood-2')
      }
      pine(g, x + len - r.int(6, 14), RAIL + 1, r.int(9, 12))
      x += len
    } else if (kind === 'ajisai') {
      const len = r.int(120, 200)
      ajisai(g, x, x + len, r, env)
      x += len
    } else if (kind === 'station') {
      x += station(g, x, r, env)
    } else {
      for (let n = r.int(2, 4); n > 0 && x < w; n--) {
        const ww = r.int(30, 46)
        if (r.chance(0.35)) shop(g, x, ww, r, env)
        else house(g, x, ww, r, env)
        x += ww + r.int(2, 8)
      }
    }
  }
  track(g, w)
}

function front(g: Gfx, w: number, r: Rng, env: Env) {
  for (let x = r.int(160, 280); x < w; x += r.int(280, 460)) {
    const ww = r.int(30, 50)
    g.ellipse(x + ww / 2, H + 2, ww / 2, 12, 'leaf-4')
    g.ellipse(x + ww / 2, H + 3, ww / 2 - 2, 11, 'leaf-3')
    g.dither(x + 2, H - 4, ww - 4, 4, 'leaf-4', 6)
    const flowers: Px[] = env.season === 'summer' ? ['sea-1', 'cloth-1', 'lavender'] : env.season === 'spring' ? ['sakura-2', 'sakura-1'] : env.season === 'winter' ? ['shu-1'] : ['momiji-1', 'momiji-2']
    for (let i = 0; i < ww / 6; i++) {
      const fx = x + r.int(4, ww - 4)
      const fy = H - r.int(3, 9)
      const k = r.pick(flowers)
      if (env.season === 'summer') {
        g.circle(fx, fy, 3, k)
        g.px(fx - 1, fy - 1, 'white')
      } else g.circle(fx, fy, 1, k)
    }
  }
}

// ---------- 鎌倉的腳本 ----------
/** 江之電：奶油色的上半、綠色的下半，兩節 */
function enodenCar(g: Gfx, x0: number, lit: boolean, panto: boolean) {
  const w = 58
  g.rect(x0 + 1, 6, w - 2, 1, 'stone-2')
  g.rect(x0, 7, w, 18, 'paper')
  g.rect(x0, 16, w, 9, 'leaf-3')
  g.hline(x0, x0 + w - 1, 24, 'leaf-4')
  g.hline(x0, x0 + w - 1, 15, 'leaf-4')
  // 車頭的圓角
  g.cut(x0, 7, 1, 2)
  g.cut(x0 + w - 1, 7, 1, 2)
  // 窗（車頭的大窗、側窗）、門
  const win: Px = lit ? 'lamp-1' : 'roof-2'
  g.rect(x0 + 1, 9, 5, 5, win)
  g.rect(x0 + w - 6, 9, 5, 5, win)
  for (let i = x0 + 12; i < x0 + w - 12; i += 7) g.rect(i, 9, 5, 4, win)
  g.rect(x0 + 8, 9, 3, 15, 'paper-2')
  g.rect(x0 + w - 11, 9, 3, 15, 'paper-2')
  g.px(x0 + 1, 19, 'lamp-1')
  g.px(x0 + w - 2, 19, 'shu-1')
  // 台車與車輪
  g.rect(x0 + 6, 25, 12, 2, 'ink-2')
  g.rect(x0 + w - 18, 25, 12, 2, 'ink-2')
  for (const wx of [x0 + 8, x0 + 15, x0 + w - 16, x0 + w - 9]) g.rect(wx, 26, 2, 1, 'stone-3')
  if (panto) {
    const px = x0 + Math.round(w / 2)
    g.line(px - 5, 6, px, 1, 'ink-2')
    g.line(px + 5, 6, px, 1, 'ink-2')
    g.hline(px - 3, px + 3, 0, 'ink-2')
  }
}
const enoden = (lit: boolean) =>
  drawSprite(120, 28, (g) => {
    enodenCar(g, 1, lit, true)
    enodenCar(g, 61, lit, false)
    g.rect(59, 14, 2, 4, 'ink-2')
  })
const ENODEN = { day: enoden(false), lit: enoden(true) }

const ENODEN_CROSSING: EventDef = {
  id: 'kamakura-enoden',
  *run(s) {
    // 平交道：鈴聲響、紅燈交互閃、柵欄放下，江之電開過去，柵欄升起
    const cx = s.cam + s.W + 30
    let arm = 0
    let ring = false
    s.spawn({
      x: cx,
      y: 0,
      z: 'back',
      draw(g, x) {
        const l = Math.round(x) - 12
        g.rect(l, RAIL + 2, 24, PATH - RAIL - 2, 'stone-2')
        g.hline(l, l + 23, RAIL + 2, 'stone-1')
        for (let i = l + 4; i < l + 24; i += 6) g.vline(i, RAIL + 3, PATH - 2, 'stone-3')
        g.hline(l, l + 23, RAIL, 'stone-1')
        g.hline(l, l + 23, RAIL + 1, 'stone-3')
      },
    })
    // 柱子、警報燈、柵欄：立在軌道與人行道之間，畫在電車前面、旅人後面（back 的 paint 在 back 的角色之後畫）
    const postX = () => cx - s.cam
    s.paint('back', (g, t) => {
      const blink = ring && Math.floor(t * 3) % 2 === 0
      const red: Px = isNight(s.env) ? 'neon-1' : 'shu-1'
      for (const side of [-1, 1] as const) {
        const px = Math.round(postX()) + side * 15
        // 柱子（下面黃黑相間）
        g.rect(px, 98, 2, PATH + 2 - 98, 'stone-1')
        g.vline(px + 1, 98, PATH + 1, 'stone-2')
        for (let y = PATH - 8; y < PATH + 2; y += 4) g.rect(px, y, 2, 2, 'ink')
        for (let y = PATH - 6; y < PATH + 2; y += 4) g.rect(px, y, 2, 2, 'gold-1')
        // X 形的警標
        g.line(px - 4, 94, px + 5, 100, 'gold-1')
        g.line(px - 4, 95, px + 5, 101, 'ink')
        g.line(px + 5, 94, px - 4, 100, 'gold-1')
        g.line(px + 5, 95, px - 4, 101, 'ink')
        // 兩個紅燈
        g.rect(px - 5, 104, 12, 5, 'ink')
        g.rect(px - 4, 105, 3, 3, ring && blink ? red : 'roof-3')
        g.rect(px + 3, 105, 3, 3, ring && !blink ? red : 'roof-3')
        // 柵欄：從柱子往中間放下
        g.rect(px - 1, 114, 4, 4, 'stone-3')
        const th = arm * (Math.PI / 2)
        const L = 13
        for (let i = 0; i <= L; i++) {
          const ax = px + 1 - side * Math.round(Math.sin(th) * i)
          const ay = 115 - Math.round(Math.cos(th) * i)
          const k: Px = Math.floor(i / 3) % 2 ? 'ink' : 'gold-1'
          g.px(ax, ay, k)
          g.px(ax + (arm > 0.5 ? 0 : 1), ay + (arm > 0.5 ? 1 : 0), k)
        }
      }
    })
    yield () => postX() - 15 <= s.hero.x + 9
    s.hero.stop()
    ring = true
    s.hero.emote('note', 3)
    for (let i = 1; i <= 16; i++) {
      arm = i / 16
      yield 0.06
    }
    yield 0.8
    const dir = s.rng.chance(0.5) ? -1 : 1
    const lit = s.env.time !== 'day'
    const train = s.spawn({ frames: lit ? ENODEN.lit : ENODEN.day, x: dir < 0 ? s.cam + s.W + 70 : s.cam - 70, y: RAIL, vx: dir * 80, z: 'back', flip: dir > 0 })
    yield () => Math.abs(train.sx() - s.hero.x) < 50
    s.hero.emote('heart', 1.6)
    yield () => (dir < 0 ? train.sx() < -70 : train.sx() > s.W + 70)
    train.remove()
    ring = false
    for (let i = 15; i >= 0; i--) {
      arm = i / 16
      yield 0.06
    }
    yield 0.3
    s.hero.walk()
    yield () => postX() < -30
  },
}

// 鳶：從空中俯衝搶走旅人手上的紫芋霜淇淋
const KITE = [0, 1, 2].map((f) =>
  drawSprite(21, 10, (g) => {
    const wy = [0, 3, 6][f]!
    g.ellipse(10, 5, 4, 2, 'wood-2')
    g.rect(14, 4, 4, 2, 'wood-2')
    g.hline(17, 19, 3, 'wood-3')
    g.hline(17, 19, 6, 'wood-3')
    g.rect(5, 4, 2, 2, 'wood-2')
    g.px(4, 5, 'gold-2')
    g.poly([7, 4, 13, 4, 16, wy, 4, wy], 'wood-2')
    g.hline(5, 6, wy, 'wood-3')
    g.hline(14, 16, wy, 'wood-3')
    if (wy < 4) g.px(11, Math.max(1, wy + 1), 'paper-2')
  }),
)
const CONE = drawSprite(6, 10, (g) => {
  g.tri(1, 5, 3, 9, 5, 5, 'wood-1')
  g.px(3, 6, 'wood-2')
  g.ellipse(3, 4, 2, 2, 'lavender')
  g.ellipse(3, 2, 1, 1, 'lavender')
  g.px(3, 0, 'lavender')
  g.px(2, 3, 'sakura-1')
})

const TOBI: EventDef = {
  id: 'kamakura-tobi',
  when: { time: ['day', 'dusk'] },
  *run(s) {
    s.hero.stop()
    s.hero.emote('note', 1)
    yield 0.8
    let held = true
    const cone = s.spawn({
      frames: CONE,
      x: s.hero.x + 4,
      y: s.FLOOR - 6,
      space: 'screen',
      z: 'front',
      update(a) {
        if (held) a.x = s.hero.x + 4
      },
    })
    s.hero.emote('heart', 1.4)
    yield 1
    s.hero.walk()
    yield 1.4
    // 影子先掠過，鳶從右上俯衝下來
    const kite = s.spawn({ frames: KITE, fps: 0, x: s.W + 14, y: 26, space: 'screen', z: 'front' })
    kite.frame = 0
    const sx0 = kite.x
    const sy0 = kite.y
    const T = 1.1
    for (let t = 0; t < T; t += 1 / 60) {
      const u = t / T
      const tx = cone.x + 2
      const ty = cone.y - 6
      kite.x = sx0 + (tx - sx0) * u
      kite.y = sy0 + (ty - sy0) * u * u
      yield null
    }
    held = false
    cone.remove()
    s.hero.stop()
    s.hero.emote('surprise', 1.2)
    kite.fps = 8
    kite.vx = -70
    kite.vy = -60
    let carried = true
    s.spawn({
      x: 0,
      y: 0,
      space: 'screen',
      z: 'front',
      draw(g) {
        if (carried) g.sprite(CONE, Math.round(kite.x - 3), Math.round(kite.y - 2))
      },
    })
    yield 0.4
    s.hero.jump(8)
    s.hero.face('left')
    yield () => kite.y < -12 || kite.x < -16
    carried = false
    s.hero.emote('sweat', 1.6)
    yield 1.6
    s.hero.emote('dots', 1.2)
    yield 1
    s.hero.face('right')
    s.hero.walk()
  },
}

// 衝浪：趴在板子上划水，浪來了站起來，順利滑走或摔下去
const SURF_PADDLE = [0, 1].map((f) =>
  drawSprite(14, 5, (g) => {
    g.rect(1, 3, 12, 1, 'white')
    g.px(0, 3, 'white')
    g.rect(3, 2, 7, 1, 'ink-2')
    g.rect(10, 1, 2, 2, 'hair')
    g.px(f ? 5 : 7, 1, 'ink-2')
    g.px(f ? 4 : 8, 4, 'skin-1')
  }),
)
const SURF_STAND = drawSprite(14, 13, (g) => {
  g.rect(1, 11, 12, 1, 'white')
  g.hline(2, 11, 11, 'white')
  g.px(12, 10, 'white')
  g.rect(6, 4, 3, 5, 'ink-2')
  g.px(5, 9, 'ink-2')
  g.px(9, 9, 'ink-2')
  g.px(4, 10, 'ink-2')
  g.px(10, 10, 'ink-2')
  g.line(5, 5, 2, 4, 'ink-2')
  g.line(9, 5, 12, 6, 'ink-2')
  g.rect(6, 1, 3, 3, 'skin-1')
  g.rect(6, 1, 3, 1, 'hair')
})

const SURFER: EventDef = {
  id: 'kamakura-surfer',
  *run(s) {
    // 等到看得到海的路段，旅人停下來看人衝浪
    const span = COAST.find(([a, b]) => b - 70 > s.cam + s.W * 0.5 && a < s.cam + s.W + 420)
    if (!span) return
    const [a, b] = span
    yield () => (a + b) / 2 - s.cam < s.W * 0.62
    s.hero.stop()
    s.hero.emote('question', 1.2)
    const x0 = Math.max(a + 24, s.cam + s.hero.x + 24)
    const x1 = Math.min(b - 24, s.cam + s.W - 10)
    // 浪頭：一道白色的浪由左往右推過來（畫在衝浪的人後面）
    let crest = -1
    s.spawn({
      x: 0,
      y: 0,
      z: 'back',
      draw(g) {
        if (crest < 0) return
        const cx = Math.round(crest - s.cam)
        for (let i = -16; i <= 0; i++) {
          if (cx + i < a - s.cam || cx + i > b - s.cam) continue
          const y = 103 + Math.round(((i + 16) / 16) * 3)
          g.px(cx + i, y, 'white')
          if ((i & 1) === 0) g.px(cx + i, y + 1, 'foam')
        }
      },
    })
    const surfer = s.spawn({ frames: SURF_PADDLE, fps: 3, x: x0 + 10, y: 108, z: 'back' })
    yield 1.4
    crest = x0 - 20
    while (crest < surfer.x - 4) {
      crest += 0.5
      yield null
    }
    surfer.frames = [SURF_STAND]
    surfer.frame = 0
    s.hero.emote('surprise', 1)
    const wipe = s.rng.chance(0.4)
    const ride = Math.max(0.6, Math.min(wipe ? 1.4 : 2.4, (x1 - surfer.x) / 34))
    for (let t = 0; t < ride; t += 1 / 60) {
      surfer.x += 34 / 60
      crest = surfer.x + 4
      surfer.y = 107 + Math.round(Math.sin(t * 5))
      yield null
    }
    crest = -1
    if (wipe) {
      // 摔下去：水花，板子飛起來
      surfer.hidden = true
      const board = s.spawn({ x: surfer.x, y: 104, z: 'back', vx: 8, vy: -40, gravity: 90, draw: (g, x, y) => g.rect(Math.round(x) - 5, Math.round(y), 11, 1, 'white') })
      // 水花：落回海面（浪的那一列）就消失，不會掉到軌道與人行道上
      for (let i = 0; i < 6; i++)
        s.spawn({
          x: surfer.x + s.rng.range(-4, 4),
          y: 105,
          z: 'back',
          vx: s.rng.range(-14, 14),
          vy: s.rng.range(-36, -20),
          gravity: 80,
          draw: (g, x, y) => g.px(x, y, 'foam'),
          update(a) {
            if ((a.vy > 0 && a.y > 108) || a.age > 0.9) a.remove()
          },
        })
      yield () => board.y > 107
      board.vy = 0
      board.gravity = 0
      board.vx = 0
      s.hero.emote('sweat', 1.6)
      yield 1.2
      surfer.frames = SURF_PADDLE
      surfer.hidden = false
      surfer.x = board.x - 2
      surfer.y = 108
      board.remove()
      yield 0.6
    } else {
      surfer.frames = SURF_PADDLE
      surfer.y = 108
      s.hero.emote('heart', 1.4)
      yield 1.4
    }
    s.hero.walk()
    yield () => surfer.sx() < -16
  },
}

// 紫陽花上的蝸牛：慢慢爬下來、橫過人行道，旅人等牠過去
const SNAIL = [0, 1].map((f) =>
  drawSprite(9, 6, (g) => {
    g.rect(0, 4, 7 + f, 1, 'paper-2')
    g.px(7 + f, 3, 'paper-2')
    g.px(8, 1 + f, 'paper-2')
    g.px(6 + f, 2, 'paper-2')
    g.circle(3, 2, 2, 'wood-1')
    g.px(3, 2, 'wood-3')
    g.px(4, 1, 'wood-2')
  }),
)
const BUSH = drawSprite(26, 20, (g) => {
  g.circle(8, 12, 7, 'leaf-3')
  g.circle(17, 11, 8, 'leaf-3')
  g.rect(3, 13, 20, 6, 'leaf-3')
  g.dither(2, 13, 22, 6, 'leaf-4', 7)
  const balls: Array<[number, number, Px]> = [[6, 7, 'sea-1'], [13, 5, 'lavender'], [20, 7, 'cloth-1'], [10, 12, 'sakura-2'], [18, 13, 'sea-1']]
  for (const [x, y, k] of balls) {
    g.circle(x, y, 3, k)
    g.px(x - 1, y - 1, 'white')
  }
})

const SNAIL_EVENT: EventDef = {
  id: 'kamakura-snail',
  when: { season: ['summer'] },
  *run(s) {
    const bx = s.cam + s.W + 20
    const bush = s.spawn({ frames: BUSH, x: bx, y: PATH + 2, z: 'back' })
    const snail = s.spawn({ frames: SNAIL, fps: 0, x: bx - 4, y: PATH - 12, z: 'back', flip: true })
    yield () => bush.sx() < s.hero.x + 30
    s.hero.stop()
    s.hero.emote('question', 1.4)
    yield 1
    // 爬下葉子，橫過人行道（往前，就是往畫面下面）
    snail.fps = 2
    snail.flip = true
    let trail = 0
    const sx0 = snail.x
    s.spawn({
      x: sx0,
      y: 0,
      z: 'back',
      draw(g, x) {
        for (let i = 0; i < trail; i += 2) g.px(Math.round(x) - 1 - Math.round(i * 0.3), PATH + 1 + i, 'foam')
      },
    })
    yield* s.move(snail, sx0 - 3, 3)
    snail.y = PATH + 1
    snail.z = 'front'
    for (let t = 0; t < 7; t += 1 / 60) {
      snail.y = PATH + 1 + t * 2.2
      snail.x = sx0 - 3 - t * 0.66
      trail = Math.round(t * 2.2)
      if (Math.abs(t - 2) < 1 / 120) s.hero.emote('dots', 2)
      if (Math.abs(t - 4.5) < 1 / 120) s.hero.emote('zzz', 2)
      yield null
    }
    s.hero.emote('heart', 1.4)
    yield 1
    s.hero.walk()
    yield () => bush.sx() < -20 && snail.sx() < -10
  },
}

export const KAMAKURA: AreaDef = {
  id: 'kamakura',
  name: '鎌倉',
  romaji: 'KAMAKURA',
  tags: ['town', 'shrine', 'coast', 'station'],
  length: LEN,
  horizon: HZ,
  sky,
  layers: [
    { speed: SP_FAR, draw: farLayer },
    { speed: 0.3, draw: hills },
    { speed: SP_BEACH, draw: midLayer },
  ],
  ground: { speed: 1, draw: ground },
  front: { speed: 1.3, draw: front },
  events: [ENODEN_CROSSING, TOBI, SURFER, SNAIL_EVENT],
}
