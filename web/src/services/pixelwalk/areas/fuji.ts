import { drawSprite, mirrored } from '../build'
import { dotOn, type Gfx } from '../gfx'
import { cloud, isNight, pine, seasonTree, skyBase } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import type { Sprite } from '../sprite'
import { type AreaDef, type Env, type EventDef, FLOOR, H } from '../types'

/**
 * 富士山（静岡・河口湖）：很大的富士山（雪頂跟著季節、黃昏是紅富士、夏夜有登山的燈），
 * 前面河口湖的對岸與倒影；中景新倉山的五重塔、松林與新幹線的高架；地面一畦畦的茶園（防霜風扇）、湖邊步道、農家。
 * 層：富士與湖 0.06、對岸 0.13、高架與塔與松 0.35（同速，新幹線畫完再把塔與松蓋回去）、地面 1、前景 1.3。
 */
const LEN = 1400
const PATH = FLOOR - 8
const SP_FUJI = 0.06
const SP_MID = 0.35
/** 山頂、山腳（被對岸擋住）、山腳半寬、山頂平台半寬 */
const TOP = 22
const BASE = 112
const HM = BASE - TOP
const HALF = 168
const PLAT = 6
/** 湖面從這裡開始 */
const SHORE = 108
/** 新幹線高架的橋面（車輪的 y） */
const DECK = 103

/** 富士山在長條上的中心：走到一半時在畫面 0.58 的位置 */
const fujiX = (W: number) => Math.round(W * 0.58 + LEN * SP_FUJI * 0.45)
/**
 * 畫好的富士山中心（長條的 x，腳本用：畫面 x = fujiCx - cam·SP_FUJI）。
 * 跟著長條記下來，不用現在的畫面寬重算：畫面變窄時長條不重畫，山頂還在原來的地方
 */
let fujiCx = 0

/** 某個高度的山的半寬（凹的稜線：上陡下緩） */
function halfAt(y: number) {
  const f = Math.max(0, Math.min(1, (BASE - y) / HM))
  return PLAT + (1 - Math.pow(f, 1 / 1.5)) * (HALF - PLAT)
}

/** 只塗在已經有東西的格子上（不會點到天空） */
function shadeOn(g: Gfx, x: number, y: number, w: number, h: number, k: Px, level: number) {
  const u = g.pal.u32[k]
  for (let yy = Math.max(0, y); yy < Math.min(g.h, y + h); yy++)
    for (let xx = Math.max(0, x); xx < Math.min(g.w, x + w); xx++) if (g.buf[yy * g.w + xx] && dotOn(xx, yy, level)) g.buf[yy * g.w + xx] = u
}

// ---------- 富士山與河口湖 ----------
interface FujiInk {
  body: Px
  shade: Px
  snow: Px
  snowShade: Px
  lake: Px
  ripple: Px
  rBody: Px
  rSnow: Px
}
function fujiInk(env: Env): FujiInk {
  if (env.time === 'dusk')
    return { body: 'sky-dusk-1', shade: 'ink-2', snow: 'sakura-1', snowShade: 'sakura-2', lake: 'sky-dusk-1', ripple: 'sky-dusk-3', rBody: 'ink-2', rSnow: 'sakura-2' }
  if (env.time === 'night')
    return { body: 'roof-3', shade: 'ink', snow: 'snow-1', snowShade: 'snow-2', lake: 'sky-night-2', ripple: 'sky-night-3', rBody: 'sky-night-1', rSnow: 'roof-1' }
  if (env.season === 'summer')
    return { body: 'cloth-2', shade: 'roof-2', snow: 'snow-1', snowShade: 'snow-2', lake: 'sea-2', ripple: 'sea-1', rBody: 'sea-3', rSnow: 'snow-2' }
  return { body: 'roof-1', shade: 'roof-2', snow: 'snow-1', snowShade: 'snow-2', lake: 'sea-2', ripple: 'sea-1', rBody: 'roof-2', rSnow: 'snow-2' }
}
/** 雪：cap 山頂往下幾成是雪、chance／max 雪溝（往下伸的白條）多不多、多長 */
const SNOW = {
  winter: { cap: 0.5, chance: 0.6, max: 16, wide: true },
  spring: { cap: 0.36, chance: 0.6, max: 18, wide: true },
  autumn: { cap: 0.17, chance: 0.45, max: 9, wide: true },
  summer: { cap: 0.03, chance: 0.2, max: 20, wide: false },
} as const

function fujiLayer(g: Gfx, w: number, r: Rng, env: Env, view: number) {
  const cx = fujiX(view)
  fujiCx = cx
  const c = fujiInk(env)
  const sn = SNOW[env.season]
  // 雪溝：每 1–4 格一條，中間長、兩邊短
  const tongue = new Int16Array(HALF * 2 + 1)
  for (let i = 0; i < tongue.length; ) {
    const gw = sn.wide ? r.int(2, 4) : r.int(1, 2)
    const L = r.chance(sn.chance) ? r.int(3, sn.max) : r.int(-3, 1)
    for (let j = 0; j < gw && i < tongue.length; j++, i++) tongue[i] = Math.round(L - (L > 0 ? Math.abs(j - (gw - 1) / 2) * 2 : 0))
  }
  const snowY = TOP + sn.cap * HM
  const isSnowAt = (x: number, y: number) => y < snowY + tongue[Math.max(0, Math.min(tongue.length - 1, x - cx + HALF))]!
  for (let y = TOP; y < SHORE; y++) {
    const half = halfAt(y)
    const b = Math.round((y - TOP) * 0.14) + 1
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      const dx = x - cx
      const shade = dx > b || (dx > b - 4 && dotOn(x, y, 8))
      g.px(x, y, isSnowAt(x, y) ? (shade ? c.snowShade : c.snow) : shade ? c.shade : c.body)
    }
  }
  // 山頂的火口緣：幾個小突起
  const rim = isSnowAt(cx, TOP) ? c.snow : c.body
  for (const dx of [-5, -4, 1, 2, 3]) g.px(cx + dx, TOP - 1, dx > 1 ? (isSnowAt(cx, TOP) ? c.snowShade : c.shade) : rim)
  g.px(cx + 2, TOP - 2, isSnowAt(cx, TOP) ? c.snowShade : c.shade)
  // 山腰的稜（淡淡的放射線）
  for (const k of [-0.9, -0.45, 0.35, 0.8]) {
    for (let y = Math.round(snowY + 8); y < SHORE - 6; y++) {
      const x = Math.round(cx + k * (halfAt(y) - 4))
      if ((y & 1) === 0 && !isSnowAt(x, y)) g.px(x, y, k < 0 ? c.shade : 'ink-2')
    }
  }
  // 夏天的夜裡：登山道的頭燈一路排上去、山小屋的燈
  if (isNight(env) && env.season === 'summer') {
    // 吉田口的登山道：之字形往上，越上面越靠近山頂
    for (let y = SHORE - 20; y > TOP + 5; y--) {
      const ph = (y % 10) / 10
      const x = Math.round(cx - halfAt(y) * 0.4 + (ph < 0.5 ? ph : 1 - ph) * 14 - 3)
      if (r.chance(0.55)) g.px(x, y, 'lamp-1')
    }
    for (const y of [TOP + 30, TOP + 48, TOP + 62]) g.rect(cx - Math.round(halfAt(y) * 0.3), y, 2, 1, 'lamp-2')
  }
  // 帶狀的雲（有時）
  if (r.chance(0.4) && !isNight(env)) {
    const [k, sh] = env.time === 'dusk' ? (['sakura-1', 'sky-dusk-2'] as const) : (['cloud-1', 'cloud-2'] as const)
    const y = Math.round(TOP + HM * r.range(0.5, 0.62))
    cloud(g, cx - r.int(90, 130), y, r.int(56, 80), k, sh)
    if (r.chance(0.6)) cloud(g, cx + r.int(30, 70), y + r.int(2, 8), r.int(30, 48), k, sh)
  }

  // 湖面與倒富士（照畫好的山一列一列反過來、壓扁，每三列斷一下像波紋）
  g.rect(0, SHORE, w, H - SHORE, c.lake)
  const U = g.pal.u32
  const snowV = new Set([U[c.snow], U[c.snowShade]])
  const bodyV = new Set([U[c.body], U[c.shade], U['ink-2']])
  const cloudV = new Set([U['cloud-1'], U['cloud-2'], U['sakura-1'], U['sky-dusk-2']])
  const K = 0.3
  for (let j = 0; j <= (SHORE - TOP) * K; j++) {
    const ys = Math.round(SHORE - 1 - j / K)
    const yr = SHORE + j
    const shift = j % 4 === 3 ? 1 : 0
    for (let x = Math.max(0, cx - HALF); x <= Math.min(w - 1, cx + HALF); x++) {
      const v = g.buf[ys * w + x]!
      const k: Px | null = snowV.has(v) ? c.rSnow : bodyV.has(v) ? c.rBody : cloudV.has(v) && !snowV.has(v) ? c.ripple : null
      if (!k || (j % 3 === 2 && dotOn(x, yr, 7))) continue
      g.px(x + shift, yr, k)
    }
  }
  // 波紋與反光
  for (let i = 0; i < w / 5; i++) {
    const y = r.int(SHORE + 2, H - 1)
    const x = r.int(0, w)
    g.hline(x, x + r.int(2, 6), y, c.ripple)
  }
  if (env.time === 'day') for (let i = 0; i < w / 14; i++) g.px(r.int(0, w), r.int(SHORE + 3, H - 1), 'white')
  // 湖上的小船
  for (let x = r.int(20, 80); x < w; x += r.int(140, 260)) {
    const y = r.int(SHORE + 5, SHORE + 12)
    g.rect(x, y, 7, 2, env.time === 'night' ? 'roof-2' : 'white')
    g.hline(x + 1, x + 5, y + 2, 'roof-3')
    g.rect(x + 2, y - 3, 2, 3, 'cloth-1')
    g.px(x + 2, y - 4, 'skin-1')
    if (env.time === 'night') g.px(x + 5, y - 1, 'lamp-1')
  }
}

/** 湖的對岸：低低的山、岸邊的旅館（夜裡亮燈，燈影落在湖上） */
function farShore(g: Gfx, w: number, r: Rng, env: Env) {
  const k: Px = env.season === 'winter' ? 'stone-3' : env.season === 'autumn' ? 'wood-2' : 'leaf-4'
  const hi: Px = env.season === 'winter' ? 'snow-2' : env.season === 'autumn' ? 'momiji-2' : env.season === 'spring' ? 'sakura-2' : 'leaf-3'
  let x = 0
  // 起伏：一段段的圓丘（樹林）
  while (x < w) {
    const ww = r.int(30, 70)
    const hh = r.int(5, 13)
    g.ellipse(x + ww / 2, SHORE - 1, ww / 2 + 4, hh, k)
    x += ww - r.int(4, 14)
  }
  g.cut(0, SHORE, w, H - SHORE)
  shadeOn(g, 0, SHORE - 16, w, 8, hi, env.season === 'summer' ? 3 : 5)
  // 旅館與民宿
  for (let x = r.int(10, 50); x < w; x += r.int(26, 70)) {
    const ww = r.int(5, 12)
    const hh = r.int(3, 7)
    g.rect(x, SHORE - hh, ww, hh, env.time === 'night' ? 'roof-2' : 'paper')
    g.hline(x, x + ww - 1, SHORE - hh - 1, 'roof-2')
    if (env.time !== 'day')
      for (let i = x + 1; i < x + ww - 1; i += 2) {
        if (!r.chance(env.time === 'night' ? 0.7 : 0.3)) continue
        g.px(i, SHORE - hh + 1, 'lamp-1')
        if (hh > 4) g.px(i, SHORE - hh + 3, 'lamp-2')
        for (let y = SHORE + 1; y < SHORE + r.int(5, 12); y += 2) g.px(i, y, 'lamp-2')
      }
  }
  // 岸邊的倒影
  for (let i = 0; i < 3; i++) g.dither(0, SHORE + i, w, 1, k, 10 - i * 3)
}

// ---------- 中景：新倉山淺間公園的五重塔（忠靈塔）、松林 ----------
function chureito(g: Gfx, x: number, y: number, env: Env) {
  const lit = isNight(env)
  for (let i = 0; i < 5; i++) {
    const w = 15 - i * 2
    const yy = y - 5 - i * 5
    g.rect(x - Math.round(w * 0.3), yy, Math.round(w * 0.6), 5, lit ? 'wood-3' : 'shu-2')
    g.vline(x - Math.round(w * 0.3), yy, yy + 4, lit ? 'wood-2' : 'shu-1')
    if (lit) g.px(x, yy + 2, 'lamp-2')
    g.poly([x - w / 2 - 1, yy + 1, x - w * 0.3, yy - 1, x + w * 0.3, yy - 1, x + w / 2 + 1, yy + 1], 'roof-3')
    if (env.season === 'winter') g.hline(x - Math.round(w * 0.3), x + Math.round(w * 0.3), yy - 1, 'snow-1')
  }
  g.vline(x, y - 36, y - 26, 'gold-2')
  for (let i = 0; i < 3; i++) g.hline(x - 1, x + 1, y - 34 + i * 2, 'gold-2')
}

/** 中景那一條（新幹線畫完要把塔與松蓋回去） */
let MID: Gfx | null = null

function midLayer(g: Gfx, w: number, r: Rng, env: Env, view: number) {
  MID = g
  const W = view
  const blossom: Px | null = env.season === 'spring' ? 'sakura-1' : env.season === 'autumn' ? 'momiji-1' : null
  const blossom2: Px = env.season === 'spring' ? 'sakura-2' : 'momiji-2'
  // 新倉山：樹林的山丘，塔在右邊的山腰
  const hillAt = [Math.round(W * 0.72) + r.int(0, 60)]
  if (w - hillAt[0]! > 520) hillAt.push(hillAt[0]! + r.int(380, 460))
  for (const hx of hillAt) {
    const hw = 66
    const hillTop = (xx: number) => 124 - Math.round(40 * Math.pow(Math.cos(((xx - hx) / hw) * (Math.PI / 2)), 0.8))
    for (let i = -hw; i <= hw; i += 5) g.circle(hx + i, hillTop(hx + i) + 6, 7, 'leaf-4')
    for (let xx = hx - hw; xx <= hx + hw; xx++) g.vline(xx, hillTop(xx) + 4, H, 'leaf-4')
    g.rect(hx - hw - 4, 124, hw * 2 + 8, H - 124, 'leaf-4')
    for (let i = 0; i < 40; i++) {
      const xx = hx + r.int(-hw + 6, hw - 6)
      const yy = r.int(hillTop(xx) + 3, 126)
      if (blossom && r.chance(0.7)) {
        const k = env.season === 'autumn' ? r.pick(['momiji-1', 'momiji-2', 'gold-1'] as const) : blossom
        g.circle(xx, yy, r.int(1, 3), k)
        g.circle(xx + r.int(-3, 3), yy + 2, 1, k)
        g.px(xx + 1, yy + 1, blossom2)
      } else g.circle(xx, yy, r.int(1, 2), env.season === 'winter' ? 'stone-3' : 'leaf-3')
    }
    if (env.season === 'winter') shadeOn(g, hx - hw - 8, 80, hw * 2 + 16, 48, 'snow-1', 4)
    chureito(g, hx + 20, hillTop(hx + 20) + 4, env)
  }
  // 松林（湖岸的小岬）
  for (let x = r.int(10, 60); x < w; x += r.int(90, 170)) {
    if (hillAt.some((hx) => Math.abs(x - hx) < 100)) continue
    const ww = r.int(36, 70)
    g.ellipse(x + ww / 2, 126, ww / 2, 7, 'leaf-4')
    g.rect(x, 126, ww, H - 126, 'leaf-4')
    for (let i = x + 6; i < x + ww - 4; i += r.int(9, 14)) pine(g, i, r.int(121, 125), r.int(7, 10))
    if (env.season === 'winter') shadeOn(g, x - 6, 104, ww + 12, 22, 'snow-1', 3)
  }
}

/** 新幹線的高架：擋音牆、橋面、細細的橋墩（跟塔與松同一個距離） */
function viaduct(g: Gfx, w: number) {
  g.rect(0, DECK - 2, w, 2, 'stone-1')
  g.rect(0, DECK, w, 2, 'stone-2')
  g.hline(0, w, DECK + 2, 'stone-3')
  for (let x = 6; x < w; x += 30) {
    g.rect(x, DECK + 3, 2, H - DECK - 3, 'stone-2')
    g.vline(x + 1, DECK + 3, H, 'stone-3')
  }
}

// ---------- 地面：茶園、湖邊步道、農家 ----------
interface Tea {
  x0: number
  x1: number
  a: number
}
/** 這一次造訪的茶園（世界座標；採茶的腳本用） */
let TEA: Tea[] = []
function teaTop(t: Tea, x: number) {
  const u = (x - t.x0) / (t.x1 - t.x0)
  const e = Math.max(0, Math.min(1, u / 0.2, (1 - u) / 0.2))
  const s = e * e * (3 - 2 * e)
  return Math.round(PATH - 2 - t.a * s * (0.8 + 0.2 * Math.sin(Math.PI * u)))
}
// 一畦一畦的高度：越遠（上面）越細
const ROW_H = [2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7]
const ROW_OF: number[] = []
const ROW_POS: number[] = []
ROW_H.forEach((h, i) => {
  for (let p = 0; p < h; p++) {
    ROW_OF.push(i)
    ROW_POS.push(p)
  }
})

function teaInk(env: Env): { hi: Px; body: Px; gap: Px } {
  if (env.season === 'winter') return { hi: 'leaf-3', body: 'leaf-4', gap: 'ink-2' }
  if (env.season === 'spring') return { hi: 'leaf-1', body: 'leaf-3', gap: 'leaf-4' }
  return { hi: 'leaf-2', body: 'leaf-3', gap: 'leaf-4' }
}

function teaField(g: Gfx, t: Tea, r: Rng, env: Env) {
  const c = teaInk(env)
  for (let x = t.x0; x < t.x1; x++) {
    const top = teaTop(t, x)
    if (top < PATH - 2) g.px(x, top - 1, 'leaf-4')
    for (let y = top; y < PATH - 1; y++) {
      const d = Math.min(y - top, ROW_OF.length - 1)
      const row = ROW_OF[d]!
      const p = ROW_POS[d]!
      let k = p === 0 ? c.hi : p === ROW_H[row]! - 1 ? c.gap : c.body
      if (p === 0 && (x + row * 3) % 5 === 0) k = c.body
      if (p === 1 && env.season === 'spring' && (x * 7 + row * 5) % 9 === 0) k = 'leaf-1'
      g.px(x, y, k)
    }
  }
  // 秋天開的白色茶花、冬天的霜
  const dots = env.season === 'autumn' ? 'white' : env.season === 'winter' ? 'snow-2' : null
  if (dots)
    for (let i = 0; i < (t.x1 - t.x0) / 5; i++) {
      const x = r.int(t.x0 + 4, t.x1 - 4)
      const y = r.int(teaTop(t, x) + 1, PATH - 4)
      g.px(x, y, dots)
      if (dots === 'white' && r.chance(0.5)) g.px(x, y + 1, 'gold-1')
    }
  // 防霜風扇：細長的柱子上一個小風扇，斜斜朝下
  for (let x = t.x0 + r.int(18, 30); x < t.x1 - 18; x += r.int(36, 56)) {
    const top = teaTop(t, x)
    if (PATH - top < 10) continue
    const base = top + 5
    const ty = top - r.int(14, 19)
    g.vline(x, ty + 1, base, 'stone-3')
    g.rect(x - 1, ty, 4, 2, 'stone-2')
    g.ellipse(x - 3, ty + 2, 1, 2, 'stone-1')
    g.px(x - 3, ty + 2, 'stone-3')
  }
  g.hline(t.x0, t.x1, PATH - 1, 'dirt-2')
}

function lakeside(g: Gfx, x0: number, x1: number, r: Rng, env: Env) {
  const grassK: Px = env.season === 'winter' ? 'snow-1' : env.season === 'autumn' ? 'leaf-3' : 'leaf-2'
  g.rect(x0, PATH - 5, x1 - x0, 5, grassK)
  g.dither(x0, PATH - 3, x1 - x0, 3, env.season === 'winter' ? 'snow-2' : 'leaf-3', 6)
  g.hline(x0, x1, PATH - 6, env.season === 'winter' ? 'snow-2' : 'leaf-3')
  // 花壇：春芝櫻、夏薰衣草、秋掃帚草（紅色的圓球）
  for (let x = x0 + r.int(4, 16); x < x1 - 12; x += r.int(20, 40)) {
    const fw = r.int(12, 22)
    if (env.season === 'spring') {
      g.rect(x, PATH - 7, fw, 3, 'sakura-2')
      g.dither(x, PATH - 7, fw, 2, 'sakura-1', 7)
    } else if (env.season === 'summer')
      for (let i = x; i < x + fw; i += 2) {
        g.vline(i, PATH - 11, PATH - 6, 'leaf-3')
        g.vline(i, PATH - 11, PATH - 9, 'lavender')
      }
    else if (env.season === 'autumn')
      for (let i = x; i < x + fw; i += 7) {
        g.circle(i + 3, PATH - 9, 3, 'momiji-2')
        g.px(i + 2, PATH - 11, 'momiji-1')
      }
  }
  // 木樁圍欄與路燈
  for (let x = x0 + 4; x < x1 - 2; x += 12) {
    g.rect(x, PATH - 8, 2, 8, 'wood-2')
    g.px(x, PATH - 8, 'wood-1')
  }
  g.hline(x0 + 4, x1 - 6, PATH - 6, 'wood-3')
  for (let x = x0 + r.int(30, 60); x < x1 - 20; x += r.int(110, 160)) {
    g.rect(x, PATH - 30, 2, 30, 'roof-2')
    g.rect(x - 2, PATH - 33, 6, 3, isNight(env) ? 'lamp-1' : 'stone-1')
    g.hline(x - 2, x + 3, PATH - 34, 'roof-3')
  }
  if (env.season === 'spring' || env.season === 'autumn')
    for (let x = x0 + r.int(20, 50); x < x1 - 20; x += r.int(70, 120)) seasonTree(g, x, PATH - 2, r.int(8, 10), env)
}

function farmhouse(g: Gfx, x: number, w: number, r: Rng, env: Env) {
  const top = PATH - 30
  g.rect(x, top + 8, w, 22, 'paper')
  g.rect(x, top + 8, w, 1, 'wood-3')
  for (let i = x; i < x + w; i += 12) g.vline(i, top + 8, PATH - 1, 'wood-3')
  g.vline(x + w - 1, top + 8, PATH - 1, 'wood-3')
  const lit = env.time !== 'day'
  g.rect(x + 4, top + 14, 10, 8, lit ? 'lamp-2' : 'paper-2')
  g.vline(x + 9, top + 14, top + 21, 'wood-3')
  g.rect(x + w - 14, top + 16, 8, PATH - top - 16, 'wood-2')
  // 入母屋的瓦屋頂
  g.poly([x - 4, top + 9, x + 6, top - 2, x + w - 6, top - 2, x + w + 4, top + 9], 'roof-2')
  g.hline(x + 6, x + w - 7, top - 3, 'roof-3')
  g.hline(x - 4, x + w + 3, top + 9, 'roof-3')
  for (let i = x; i < x + w; i += 3) g.vline(i, top, top + 7, 'roof-1')
  if (env.season === 'winter') g.hline(x + 6, x + w - 7, top - 3, 'snow-1')
  // 生垣
  g.rect(x - 6, PATH - 7, w + 12, 7, 'leaf-3')
  g.hline(x - 6, x + w + 5, PATH - 7, 'leaf-2')
  g.dither(x - 6, PATH - 4, w + 12, 4, 'leaf-4', 6)
  // 柿子樹（秋天結果）
  if (r.chance(0.6)) {
    const tx = x + w + 12
    g.rect(tx - 1, PATH - 24, 3, 24, 'wood-3')
    const leaf: Px = env.season === 'winter' ? 'wood-3' : env.season === 'autumn' ? 'momiji-2' : 'leaf-3'
    g.circle(tx, PATH - 30, 9, leaf)
    g.circle(tx - 7, PATH - 25, 6, leaf)
    g.circle(tx + 7, PATH - 26, 6, leaf)
    if (env.season === 'autumn') for (let i = 0; i < 9; i++) g.px(tx + r.int(-10, 10), PATH - r.int(22, 36), 'momiji-1')
  }
}

function teaFactory(g: Gfx, x: number, env: Env) {
  const w = 54
  g.rect(x, PATH - 26, w, 26, 'stone-1')
  for (let i = x + 1; i < x + w; i += 3) g.vline(i, PATH - 25, PATH - 1, 'stone-2')
  g.poly([x - 3, PATH - 25, x + w / 2, PATH - 33, x + w + 3, PATH - 25], 'roof-1')
  g.hline(x - 3, x + w + 2, PATH - 25, 'roof-2')
  g.rect(x + 8, PATH - 16, 14, 16, 'roof-2')
  g.rect(x + 30, PATH - 20, 16, 6, env.time === 'day' ? 'roof-2' : 'lamp-1')
  // 高煙囪
  g.rect(x + w - 10, PATH - 66, 5, 40, 'stone-2')
  g.vline(x + w - 6, PATH - 66, PATH - 27, 'stone-3')
  g.rect(x + w - 11, PATH - 67, 7, 2, 'stone-3')
  g.rect(x + w - 10, PATH - 60, 5, 2, 'shu-2')
}

function vending(g: Gfx, x: number, env: Env) {
  g.rect(x, PATH - 16, 9, 16, 'white')
  g.frame(x, PATH - 16, 9, 16, 'stone-3')
  g.rect(x + 1, PATH - 15, 7, 6, env.time === 'day' ? 'sea-1' : 'lamp-1')
  for (let i = 0; i < 3; i++) g.px(x + 2 + i * 2, PATH - 8, (['shu-1', 'gold-1', 'leaf-2'] as const)[i]!)
  g.rect(x + 2, PATH - 5, 5, 2, 'stone-4')
}

function ground(g: Gfx, w: number, r: Rng, env: Env) {
  TEA = []
  // 路：壓實的土路，上緣一排草
  g.rect(0, PATH, w, H - PATH, 'dirt-1')
  g.dither(0, PATH + 10, w, H - PATH - 10, 'dirt-2', 4)
  g.hline(0, w, PATH, 'dirt-2')
  for (let i = 0; i < w / 5; i++) g.px(r.int(0, w), r.int(PATH + 2, H - 1), r.pick(['dirt-2', 'sand-1', 'stone-2'] as const))
  if (env.season === 'winter') g.dither(0, PATH + 1, w, 6, 'snow-2', 4)

  let x = 0
  let last = ''
  const kinds = ['tea', 'lake', 'hamlet'] as const
  while (x < w) {
    let kind: (typeof kinds)[number] = x === 0 ? 'tea' : r.weighted(kinds, (k) => (k === last ? 0 : k === 'tea' ? 1.4 : 1))
    if (x > 0 && last === 'hamlet' && kind === 'hamlet') kind = 'lake'
    last = kind
    if (kind === 'tea') {
      const len = r.int(200, 330)
      const t: Tea = { x0: x, x1: x + len, a: r.int(15, 22) }
      teaField(g, t, r, env)
      TEA.push(t)
      x += len
    } else if (kind === 'lake') {
      const len = r.int(150, 250)
      lakeside(g, x, x + len, r, env)
      x += len
    } else {
      let xx = x + r.int(4, 12)
      if (r.chance(0.5)) {
        teaFactory(g, xx, env)
        xx += 62
      }
      const fw = r.int(46, 60)
      farmhouse(g, xx, fw, r, env)
      xx += fw + 32
      vending(g, xx, env)
      xx += 12
      // 公車站牌
      g.rect(xx + 6, PATH - 22, 1, 22, 'stone-3')
      g.circle(xx + 6, PATH - 24, 3, 'shu-1')
      g.circle(xx + 6, PATH - 24, 1, 'white')
      x = xx + 18
    }
    // 路邊的草
    for (let i = 0; i < 6; i++) {
      const gx = x - r.int(4, 120)
      g.vline(gx, PATH - 1, PATH + 1, env.season === 'winter' ? 'stone-2' : 'leaf-3')
    }
  }
}

function front(g: Gfx, w: number, r: Rng, env: Env) {
  const c = teaInk(env)
  for (let x = r.int(140, 260); x < w; x += r.int(260, 440)) {
    if (env.season === 'autumn' && r.chance(0.5)) {
      // 芒草
      for (let i = 0; i < 9; i++) {
        const sx = x + i * 3
        const h = r.int(16, 26)
        g.line(sx, H, sx + 3, H - h, 'paper-2')
        g.line(sx + 3, H - h, sx + 6, H - h + 4, 'paper')
      }
      continue
    }
    // 茶的畦頭（圓圓的一排）
    const ww = r.int(36, 64)
    g.ellipse(x + ww / 2, H + 2, ww / 2, 13, c.gap)
    g.ellipse(x + ww / 2, H + 3, ww / 2 - 1, 12, c.body)
    g.ellipse(x + ww / 2 - 3, H - 4, ww / 2 - 8, 4, c.hi)
    g.dither(x + 2, H - 6, ww - 4, 6, c.body, 6)
    if (env.season === 'winter') g.dither(x + 4, H - 11, ww - 8, 3, 'snow-1', 6)
  }
}

// ---------- 富士山的腳本 ----------
const SHIN_NOSE = drawSprite(30, 10, (g) => {
  // 鴨嘴般的長車頭：車尖在左下
  g.poly([0, 9, 4, 6, 12, 4, 22, 0, 30, 0, 30, 10, 1, 10], 'white')
  g.hline(2, 29, 7, 'cloth-2')
  g.hline(4, 29, 6, 'cloth-1')
  g.poly([14, 3, 20, 1, 24, 1, 24, 4, 15, 4], 'roof-3')
  g.px(2, 8, 'lamp-1')
  g.hline(5, 29, 9, 'stone-2')
}, 'ink-2')
const shinCar = (lit: boolean) =>
  drawSprite(32, 10, (g) => {
    g.rect(0, 0, 32, 10, 'white')
    g.hline(0, 31, 7, 'cloth-2')
    g.hline(0, 31, 6, 'cloth-1')
    for (let x = 3; x < 29; x += 3) g.rect(x, 3, 2, 1, lit ? 'lamp-1' : 'roof-2')
    g.vline(0, 2, 8, 'stone-1')
    g.hline(0, 31, 9, 'stone-2')
  }, 'ink-2')
const SHIN = { nose: SHIN_NOSE, tail: mirrored(SHIN_NOSE), car: shinCar(false), carLit: shinCar(true) }
const SHIN_CARS = 6
const SHIN_LEN = 30 * 2 + 32 * SHIN_CARS

const SHINKANSEN: EventDef = {
  id: 'fuji-shinkansen',
  *run(s) {
    // 聽到聲音：旅人停下來；新幹線從高架上呼嘯而過，旅人轉頭目送
    const dir = s.rng.chance(0.6) ? -1 : 1
    s.hero.stop()
    s.hero.emote('question', 1)
    if (dir > 0) s.hero.face('left')
    yield 0.9
    const lit = s.env.time !== 'day'
    const left0 = dir < 0 ? s.W + 8 : -SHIN_LEN - 8
    const tr = s.spawn({
      x: left0 + Math.round(s.cam * SP_MID),
      y: DECK,
      space: SP_MID,
      z: 'mid',
      vx: dir * 300,
      draw(g, x, y) {
        const l = Math.round(x)
        const parts: Sprite[] = [SHIN.nose, ...Array.from({ length: SHIN_CARS }, () => (lit ? SHIN.carLit : SHIN.car)), SHIN.tail]
        const seq = dir < 0 ? parts : parts.slice().reverse().map((p) => (p === SHIN.nose ? SHIN.tail : p === SHIN.tail ? SHIN.nose : p))
        let cx = l
        for (const p of seq) {
          g.sprite(p, cx, y - p.h - 1)
          cx += p.w
        }
        // 擋音牆蓋住車輪；車尾捲起的風
        g.rect(l - 2, DECK - 2, SHIN_LEN + 4, 2, 'stone-1')
        const tail = dir < 0 ? l + SHIN_LEN + 4 : l - 16
        for (let i = 0; i < 3; i++) g.hline(tail + i * 3, tail + i * 3 + 8, y - 4 - i * 3, 'cloud-2')
        // 塔、松、山丘在新幹線前面
        if (MID) g.blit(MID, l - 20 + Math.round(s.cam * SP_MID), y - 24, SHIN_LEN + 40, 26, l - 20, y - 24)
      },
    })
    const front = () => (dir < 0 ? tr.sx() : tr.sx() + SHIN_LEN)
    yield () => (dir < 0 ? front() < s.hero.x + 10 : front() > s.hero.x - 10)
    s.hero.emote('surprise', 1.2)
    s.hero.face(dir < 0 ? 'left' : 'right')
    yield () => (dir < 0 ? tr.sx() + SHIN_LEN < -4 : tr.sx() > s.W + 4)
    s.hero.face('right')
    s.hero.emote('note', 1.2)
    yield 0.8
    s.hero.walk()
  },
}

/** 笠雲：山頂戴上一頂雲的斗笠，慢慢浮現、慢慢散掉 */
const KASAGUMO: EventDef = {
  id: 'fuji-kasagumo',
  kind: 'ambient',
  when: { time: ['day', 'dusk'] },
  *run(s) {
    let level = 0
    const [k, sh] = s.env.time === 'dusk' ? (['sakura-1', 'sky-dusk-2'] as const) : (['cloud-1', 'cloud-2'] as const)
    const side = s.rng.chance(0.6) ? s.rng.pick([-1, 1] as const) : 0
    s.paint('mid', (g) => {
      if (level <= 0) return
      const x = fujiCx - Math.round(s.cam * SP_FUJI)
      const lens = (cx: number, cy: number, rx: number, ry: number) => {
        g.at(0, 0, () => {
          for (let dy = -ry; dy <= ry; dy++) {
            const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / ((ry + 0.5) * (ry + 0.5))))
            for (let dx = -half; dx <= half; dx++) if (dotOn(cx + dx, cy + dy, level)) g.px(cx + dx, cy + dy, dy > 0 ? sh : k)
          }
        })
      }
      lens(x, TOP - 1, 22, 2)
      lens(x - 1, TOP - 5, 17, 2)
      lens(x + 1, TOP - 8, 10, 1)
      // 吊るし雲（離山頂一段距離的扁雲）
      if (side) lens(x + side * 58, TOP + 14, 12, 1)
    })
    for (let i = 1; i <= 16; i++) {
      level = i
      yield 0.2
    }
    yield 10
    for (let i = 16; i >= 0; i--) {
      level = i
      yield 0.2
    }
  },
}

// 白鷺：白身、黃嘴、黑腳往後拖
const EGRET = [0, 1, 2].map((f) =>
  drawSprite(13, 9, (g) => {
    const wy = [1, 4, 6][f]!
    g.rect(3, 4, 6, 2, 'white')
    g.rect(1, 3, 2, 2, 'white')
    g.px(0, 3, 'gold-1')
    g.hline(9, 12, 5, 'stone-3')
    g.poly([4, 4, 8, 4, 7, wy, 5, wy], 'white')
    if (wy < 4) g.px(6, wy, 'snow-2')
  }, 'stone-3'),
)

const EGRETS: EventDef = {
  id: 'fuji-egrets',
  kind: 'ambient',
  when: { time: ['day', 'dusk'] },
  *run(s) {
    // 一群白鷺從右邊飛過茶園，一隻一隻錯開拍翅
    const n = s.rng.int(4, 7)
    const y0 = s.rng.int(46, 70)
    const birds = Array.from({ length: n }, (_, i) =>
      s.spawn({
        frames: EGRET,
        fps: 5,
        x: s.W + 10 + i * s.rng.int(12, 18),
        y: y0 + (i % 2) * 6 + i * 3,
        space: 'screen',
        z: 'mid',
        vx: -s.rng.range(30, 36),
        update(a) {
          a.y += Math.sin(a.age * 3 + i) * 0.04
        },
      }),
    )
    birds.forEach((b, i) => (b.age = i * 0.13))
    yield () => birds.every((b) => b.x < -12)
  },
}

// 採茶的人：手拭巾包頭、藍底白點的絣、紅色的襷、腰上一個竹籃
const PICKER = [0, 1, 2].map((f) =>
  drawSprite(14, 22, (g) => {
    const bend = f === 2 ? 0 : 1
    g.rect(4, 9 + bend, 7, 12 - bend, 'cloth-2')
    for (let i = 0; i < 6; i++) g.px(5 + ((i * 3) % 6), 11 + bend + i * 2, 'paper')
    g.line(4, 9 + bend, 10, 15 + bend, 'shu-1')
    g.line(10, 9 + bend, 4, 15 + bend, 'shu-1')
    g.rect(4, 16, 7, 1, 'shu-2')
    // 籃子
    g.rect(1, 13, 4, 5, 'wood-1')
    g.hline(1, 4, 15, 'wood-2')
    g.px(2, 12, 'leaf-2')
    // 頭與手拭巾
    g.ellipse(8, 5 + bend, 3, 3, 'skin-1')
    g.rect(5, 1 + bend, 7, 3, 'white')
    g.px(4, 3 + bend, 'white')
    g.px(6, 2 + bend, 'shu-1')
    g.px(9, 2 + bend, 'shu-1')
    g.px(10, 6 + bend, 'ink')
    // 手：摘（往前下）、丟進籃子（往後）、揮手（往上）
    if (f === 0) g.rect(10, 12 + bend, 3, 2, 'skin-1')
    else if (f === 1) g.rect(3, 10, 2, 2, 'skin-1')
    else {
      g.vline(11, 4, 9, 'cloth-2')
      g.rect(11, 2, 2, 2, 'skin-1')
    }
  }),
)
const LEAF = drawSprite(4, 3, (g) => {
  g.rect(0, 1, 3, 1, 'leaf-2')
  g.px(1, 0, 'leaf-1')
}, 'leaf-4')

const TEA_PICKER: EventDef = {
  id: 'fuji-tea-picker',
  *run(s) {
    // 茶園裡有人在採茶；旅人走近，一片茶葉飛到旅人頭上
    const want = s.cam + s.W + 16
    const t = TEA.find((f) => f.x1 - (f.x1 - f.x0) * 0.25 > want && f.x0 < want + 100)
    const px = t ? Math.min(want + 140, Math.max(want, Math.round(t.x0 + (t.x1 - t.x0) * 0.35))) : want
    const inField = !!t && px < t.x1 - 30 && teaTop(t, px) < PATH - 12
    // 從路上走來的：腳底比旅人高 3px（走在旅人後面一點，錯身時不會疊在同一條線上）
    const fy = inField ? Math.min(PATH - 4, teaTop(t!, px) + 13) : s.FLOOR - 3
    const c = teaInk(s.env)
    // 附近沒有茶園：背著籃子從路上走過來
    let picking = inField
    const p = s.spawn({
      x: px,
      y: fy,
      flip: true,
      draw(g, x, y, a) {
        const f = picking ? Math.floor(a.age * 2.5) % 2 : inField ? 2 : 1
        const sp = PICKER[f]!
        const bob = !inField && a.vx !== 0 && Math.floor(a.age * 6) % 2 ? 1 : 0
        g.sprite(sp, Math.round(x - sp.w / 2), Math.round(y - sp.h) - bob, { flip: a.flip })
        if (inField) {
          // 前面的一畦茶擋住腰以下
          const l = Math.round(x - 11)
          g.ellipse(l + 11, y - 2, 12, 5, c.body)
          g.hline(l + 2, l + 20, y - 7, c.hi)
          g.hline(l, l + 22, y + 2, c.gap)
          g.dither(l + 2, y - 2, 18, 4, c.gap, 4)
        }
      },
    })
    if (!inField) p.vx = -14
    yield () => p.sx() < s.hero.x + (inField ? 34 : 26)
    p.vx = 0
    s.hero.stop()
    s.hero.emote('note', 1.4)
    yield 1.4
    picking = false
    // 揮手，丟一片葉子過來
    const leaf = s.spawn({ frames: LEAF, x: p.x - 6, y: fy - 18, vx: (s.hero.worldX + 1 - (p.x - 6)) / 0.9, vy: -60, gravity: 130, z: 'front' })
    yield () => leaf.y >= s.FLOOR - 24 && leaf.vy > 0
    leaf.vx = 0
    leaf.vy = 0
    leaf.gravity = 0
    leaf.x = s.hero.worldX + 1
    leaf.y = s.FLOOR - 23
    s.hero.emote('surprise', 1)
    yield 1.2
    s.hero.jump(6)
    leaf.vx = -14
    leaf.vy = -30
    leaf.gravity = 120
    yield 0.6
    leaf.remove()
    s.hero.emote('heart', 1.4)
    yield 1
    picking = inField
    s.hero.walk()
    // 從路上來的往回走：走出畫面就結束（不用走到一個固定的地方，旅人一直往前，很快就看不到）
    if (!inField) p.vx = -12
    yield () => p.sx() < -16
  },
}

// 拍照：拿出相機，閃一下，跳出一張照片（有時候被鳥擋到）
const CROW = [0, 1].map((f) =>
  drawSprite(16, 9, (g) => {
    g.ellipse(8, 5, 5, 2, 'ink-2')
    g.rect(1, 3, 3, 3, 'ink-2')
    g.px(0, 4, 'stone-3')
    g.poly(f ? [6, 4, 11, 4, 12, 0, 8, 1] : [6, 5, 11, 5, 12, 8, 8, 8], 'ink-2')
    g.hline(13, 15, 5, 'ink-2')
  }),
)

const PHOTO: EventDef = {
  id: 'fuji-photo',
  *run(s) {
    s.hero.stop()
    s.hero.face('right')
    s.hero.emote('dots', 1.4)
    yield 0.5
    s.hero.hold = 'camera'
    yield 1.2
    const bomb = s.rng.chance(0.45)
    if (bomb) {
      const crow = s.spawn({ frames: CROW, fps: 8, x: s.W + 10, y: s.FLOOR - 26, space: 'screen', z: 'front', vx: -150, flip: false })
      yield () => crow.x < s.hero.x + 24
    }
    let flash = 0
    s.paint('over', (g) => {
      if (flash > 0) g.cover('white', flash)
    })
    flash = 12
    yield 0.06
    flash = 6
    yield 0.06
    flash = 0
    const time = s.env.time
    let fade = 16
    s.spawn({
      x: s.hero.x + 4,
      y: s.FLOOR - 30,
      space: 'screen',
      z: 'over',
      vy: -8,
      update(a) {
        if (a.vy < 0 && a.y < s.FLOOR - 40) a.vy = 0
      },
      draw(g, x, y) {
        const l = Math.round(x - 14)
        const t = Math.round(y - 22)
        g.at(0, 0, () => {
          const box = (xx: number, yy: number, w: number, h: number, k: Px) => {
            for (let j = yy; j < yy + h; j++) for (let i = xx; i < xx + w; i++) if (dotOn(i, j, fade)) g.px(i, j, k)
          }
          box(l - 1, t - 1, 30, 24, 'ink')
          box(l, t, 28, 22, 'white')
          const sky: Px = time === 'night' ? 'sky-night-2' : time === 'dusk' ? 'sky-dusk-2' : 'sky-day-1'
          box(l + 2, t + 2, 24, 14, sky)
          for (let j = 0; j < 10; j++) box(l + 14 - j - 1, t + 5 + j, j * 2 + 3, 1, j < 3 ? 'snow-1' : time === 'dusk' ? 'sky-dusk-1' : 'roof-1')
          box(l + 2, t + 15, 24, 2, 'leaf-3')
          if (bomb) {
            box(l + 4, t + 3, 16, 10, 'ink-2')
            box(l + 16, t + 2, 8, 4, 'ink-2')
            box(l + 7, t + 5, 2, 2, 'white')
          }
        })
      },
    })
    if (bomb) {
      s.hero.emote('sweat', 1.6)
      yield 0.8
      s.hero.jump(5)
      yield 1
    } else {
      s.hero.emote('heart', 1.6)
      yield 1.8
    }
    for (let i = 16; i >= 0; i -= 2) {
      fade = i
      yield 0.05
    }
    s.hero.hold = null
    s.hero.walk()
  },
}

export const FUJI: AreaDef = {
  id: 'fuji',
  name: '富士山',
  romaji: 'FUJI',
  tags: ['nature', 'farm', 'mountain'],
  length: LEN,
  sky: (g, env, r) => skyBase(g, env, r, 108),
  layers: [
    { speed: SP_FUJI, draw: fujiLayer },
    { speed: 0.13, draw: farShore },
    { speed: SP_MID, draw: viaduct },
    { speed: SP_MID, draw: midLayer },
  ],
  ground: { speed: 1, draw: ground },
  front: { speed: 1.3, draw: front },
  events: [SHINKANSEN, TEA_PICKER, PHOTO, KASAGUMO, EGRETS],
}
