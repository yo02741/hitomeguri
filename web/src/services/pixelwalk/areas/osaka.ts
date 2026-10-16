import { drawSprite } from '../build'
import type { Gfx } from '../gfx'
import { seasonTree, skyBase } from '../kit'
import type { Px } from '../palette'
import { rng, type Rng } from '../rng'
import { sprite } from '../sprite'
import { type AreaDef, type Env, type EventDef, FLOOR, H, type Stage } from '../types'
import { dark, say, tod } from './tokyo'

/**
 * 大阪：遠景是通天閣，有時候看得到石垣上的大阪城；中景是道頓堀的河岸，一整排招牌與霓虹（抽象的色塊與燈），
 * 河面映著招牌；地面是有屋頂的商店街（アーケード）、章魚燒攤與河邊步道。前景偶爾停著腳踏車。
 * 遠景 0.12、中景 0.45、地面 1、前景 1.3。
 */
const PATH = FLOOR - 8
const FAR = 0.12
const MID = 0.45
/** 河岸（中景）：建築的下緣、河面 */
const BANK = 108
const RIVER = 112
/** 遊船的吃水線 */
const WATERLINE = 123

const lit = (env: Env) => env.time !== 'day'

function sky(g: Gfx, env: Env, r: Rng) {
  skyBase(g, env, r, 108)
  if (env.time === 'night') {
    g.dither(0, 72, g.w, 12, 'sky-dusk-1', 2)
    g.dither(0, 84, g.w, 30, 'sky-dusk-1', 4)
  }
}

// ---------- 遠景：通天閣、大阪城 ----------
/** 通天閣：塔腳的拱、細的塔身、上面方形的展望台與頂上的光球 */
function tsutenkaku(g: Gfx, cx: number, base: number, env: Env) {
  const night = env.time === 'night'
  const body: Px = night ? 'roof-2' : 'stone-1'
  const edge: Px = night ? 'lamp-2' : 'stone-2'
  // 塔腳（四隻腳、中間是拱）
  for (let y = base - 18; y <= base; y++) {
    const t = (y - (base - 18)) / 18
    const half = Math.round(5 + 10 * t * t)
    const inner = y > base - 10 ? Math.round((half - 3) * Math.sqrt((y - (base - 10)) / 10)) : -1
    if (inner >= 0) {
      g.hline(cx - half, cx - inner - 1, y, body)
      g.hline(cx + inner + 1, cx + half, y, body)
    } else g.hline(cx - half, cx + half, y, body)
    g.px(cx - half, y, edge)
    g.px(cx + half, y, edge)
  }
  g.rect(cx - 7, base - 21, 15, 3, night ? 'lamp-1' : 'paper')
  // 塔身
  g.rect(cx - 4, base - 54, 9, 33, body)
  for (let y = base - 52; y < base - 22; y += 3) g.line(cx - 4, y, cx + 4, y + 2, edge)
  g.vline(cx - 4, base - 54, base - 21, edge)
  g.vline(cx + 4, base - 54, base - 21, edge)
  // 展望台
  g.rect(cx - 8, base - 66, 17, 12, night ? 'roof-3' : 'paper')
  g.rect(cx - 7, base - 63, 15, 3, night ? 'lamp-1' : 'roof-1')
  // 招牌的帶（色塊，不寫字）
  g.rect(cx - 8, base - 58, 17, 3, night ? 'neon-2' : 'sea-2')
  g.hline(cx - 9, cx + 9, base - 67, night ? 'lamp-2' : 'stone-3')
  g.hline(cx - 8, cx + 8, base - 54, night ? 'lamp-2' : 'stone-3')
  // 頂上
  g.rect(cx - 4, base - 71, 9, 4, body)
  g.vline(cx, base - 78, base - 71, edge)
  g.circle(cx, base - 73, 2, night ? 'lamp-1' : 'white')
  if (night) for (let y = base - 50; y < base - 22; y += 4) g.px(cx, y, 'neon-1')
}

/** 大阪城：綠色小山、石垣、白牆綠瓦的天守、金色的鯱 */
function castle(g: Gfx, cx: number, base: number, env: Env) {
  const night = env.time === 'night'
  // 小山（樹）
  g.ellipse(cx, base + 4, 40, 12, env.season === 'autumn' ? 'momiji-2' : 'leaf-4')
  g.dither(cx - 40, base - 8, 80, 12, env.season === 'spring' ? 'sakura-1' : 'leaf-3', 5)
  // 石垣
  g.poly([cx - 22, base - 4, cx + 22, base - 4, cx + 17, base - 16, cx - 17, base - 16], 'stone-2')
  for (let y = base - 13; y < base - 4; y += 3) g.hline(cx - 20, cx + 20, y, 'stone-3')
  const wall: Px = night ? 'lamp-1' : 'white'
  const roof: Px = 'leaf-2'
  // 五層，往上變窄
  const tiers = [
    [15, 7],
    [13, 6],
    [11, 6],
    [9, 5],
    [7, 6],
  ] as const
  let y = base - 16
  tiers.forEach(([half, h], i) => {
    const top = y - h
    g.rect(cx - half + 2, top, half * 2 - 3, h, i === 4 ? 'roof-3' : wall)
    if (i === 4) {
      g.hline(cx - half + 3, cx + half - 3, top + 2, 'gold-1')
      g.px(cx - 2, top + 4, 'gold-1')
      g.px(cx + 2, top + 4, 'gold-1')
    } else for (let x = cx - half + 4; x < cx + half - 2; x += 4) g.rect(x, top + 2, 2, 2, night ? 'lamp-2' : 'roof-3')
    g.poly([cx - half - 2, top + 1, cx + half + 2, top + 1, cx + half - 1, top - 2, cx - half + 1, top - 2], roof)
    g.hline(cx - half - 2, cx + half + 1, top + 1, 'leaf-3')
    if (i === 1) g.tri(cx - 4, top - 2, cx, top - 6, cx + 4, top - 2, roof) // 千鳥破風
    y = top - 2
  })
  g.tri(cx - 6, y, cx, y - 4, cx + 6, y, roof)
  g.px(cx - 4, y - 2, 'gold-1')
  g.px(cx + 4, y - 2, 'gold-1')
}

function farBlock(g: Gfx, x: number, bw: number, top: number, k: Px, env: Env, lr: Rng) {
  g.rect(x, top, bw, H - top, k)
  if (env.time === 'night') {
    for (let yy = top + 3; yy < 112; yy += 4) for (let xx = x + 2; xx < x + bw - 1; xx += 3) if (lr.chance(0.2)) g.px(xx, yy, lr.chance(0.7) ? 'lamp-1' : 'lamp-2')
  }
}

function farCity(g: Gfx, w: number, r: Rng, env: Env) {
  const lr = rng(r.int(1, 1e9))
  const back = tod<Px>(env, 'cloud-2', 'sky-dusk-1', 'sky-night-2')
  const front = tod<Px>(env, 'snow-2', 'roof-1', 'roof-2')
  for (let x = -4; x < w; ) {
    const bw = r.int(8, 18)
    farBlock(g, x, bw, r.int(74, 100), back, env, lr)
    if (r.chance(0.15)) g.vline(x + Math.round(bw / 2), r.int(62, 70), 100, back)
    x += bw + r.int(-1, 5)
  }
  const at1 = Math.round(w * r.range(0.4, 0.48))
  const at2 = Math.round(w * r.range(0.78, 0.84))
  const hasCastle = r.chance(0.65)
  if (hasCastle) castle(g, at2, 104, env)
  tsutenkaku(g, at1, 108, env)
  for (let x = -6; x < w; ) {
    const bw = r.int(10, 22)
    const mid = x + bw / 2
    const top = Math.abs(mid - at1) < 22 || (hasCastle && Math.abs(mid - at2) < 46) ? 104 : r.int(88, 104)
    farBlock(g, x, bw, top, front, env, lr)
    x += bw + r.int(0, 7)
  }
}

// ---------- 中景：道頓堀的河岸 ----------
/** 招牌（中景座標）：夜裡的河面倒影腳本用 */
const signs: Array<{ x: number; w: number; k: Px }> = []

const NEON: Px[] = ['neon-1', 'neon-2', 'lamp-1', 'lamp-2', 'sky-dusk-2']
const SIGN_DAY: Px[] = ['shu-1', 'gold-1', 'sea-2', 'leaf-2', 'momiji-1', 'lavender', 'sakura-2', 'white']

/** 一圈燈泡（夜裡亮、白天是金色的點） */
function bulbs(g: Gfx, x: number, y: number, w: number, h: number, env: Env) {
  const a: Px = lit(env) ? 'lamp-1' : 'gold-2'
  const b: Px = lit(env) ? 'lamp-2' : 'gold-2'
  for (let i = 0; i < w; i += 2) {
    g.px(x + i, y, i % 4 ? a : b)
    g.px(x + i, y + h - 1, i % 4 ? b : a)
  }
  for (let j = 0; j < h; j += 2) {
    g.px(x, y + j, j % 4 ? a : b)
    g.px(x + w - 1, y + j, j % 4 ? b : a)
  }
}

function riverBuilding(g: Gfx, x: number, bw: number, top: number, env: Env, r: Rng, lr: Rng) {
  const face = r.pick<Px>(['stone-1', 'paper-2', 'stone-2', 'roof-1', 'wood-1'])
  g.rect(x, top, bw, BANK - top, face)
  g.rect(x - 1, top - 2, bw + 2, 2, dark(face))
  for (let yy = top + 4; yy < BANK - 4; yy += 6)
    for (let xx = x + 3; xx + 3 < x + bw; xx += 5) {
      const on = lit(env) && lr.chance(env.time === 'night' ? 0.45 : 0.15)
      g.rect(xx, yy, 3, 3, on ? 'lamp-1' : env.time === 'day' ? 'roof-1' : 'roof-3')
    }
  // 大招牌（橫的，伸出來）
  const kind = r.next()
  const dayK = r.pick(SIGN_DAY)
  const k = lit(env) ? lr.pick(NEON) : dayK
  if (kind < 0.45) {
    const sw = Math.max(16, bw - r.int(2, 8))
    const sh = r.int(10, 16)
    const sx = x + Math.round((bw - sw) / 2)
    const sy = r.int(top + 4, Math.max(top + 5, BANK - sh - 8))
    g.rect(sx, sy, sw, sh, lit(env) ? 'ink-2' : k)
    if (lit(env)) {
      g.rect(sx + 2, sy + 2, sw - 4, sh - 4, k)
      g.rect(sx + 4, sy + 4, Math.round(sw / 3), sh - 8, lr.pick(NEON))
    } else {
      g.rect(sx + 3, sy + 3, Math.round(sw / 3), sh - 6, k === 'white' ? 'shu-1' : 'white')
      g.rect(sx + 5 + Math.round(sw / 3), sy + 4, Math.round(sw / 3), 2, k === 'white' ? 'ink-2' : 'white')
    }
    bulbs(g, sx, sy, sw, sh, env)
    signs.push({ x: sx, w: sw, k })
  } else if (kind < 0.8) {
    // 直的招牌，好幾塊
    const sx = x + bw - 8
    for (let yy = top + 3; yy < BANK - 10; yy += 10) {
      const dayK = r.pick(SIGN_DAY)
      const kk = lit(env) ? lr.pick(NEON) : dayK
      g.rect(sx, yy, 9, 9, kk)
      g.frame(sx, yy, 9, 9, 'ink-2')
      g.rect(sx + 3, yy + 2, 3, 5, kk === 'white' || kk === 'lamp-1' || kk === 'gold-1' ? 'ink-2' : 'white')
      signs.push({ x: sx, w: 9, k: kk })
    }
  } else {
    // 霓虹管：一圈一圈的線
    const sx = x + 3
    const sw = bw - 6
    const sy = top + 6
    const n1: Px = lit(env) ? lr.pick(NEON) : 'stone-3'
    const n2: Px = lit(env) ? lr.pick(NEON) : 'stone-3'
    g.frame(sx, sy, sw, 14, n1)
    g.frame(sx + 2, sy + 2, sw - 4, 10, n2)
    g.hline(sx + 4, sx + sw - 5, sy + 6, n1)
    signs.push({ x: sx, w: sw, k: lit(env) ? n1 : 'stone-1' })
  }
  // 屋頂的看板架
  if (r.chance(0.35) && bw > 28) {
    const bx = x + 3
    const dayK = r.pick(SIGN_DAY)
    const kk = lit(env) ? lr.pick(NEON) : dayK
    g.rect(bx, top - 14, bw - 6, 9, kk)
    bulbs(g, bx, top - 14, bw - 6, 9, env)
    for (let i = 0; i < bw - 6; i += 4) g.line(bx + i, top - 2, bx + i + 4, top - 5, 'stone-3')
  }
}

function riverside(g: Gfx, w: number, r: Rng, env: Env) {
  const lr = rng(r.int(1, 1e9))
  signs.length = 0
  for (let x = r.int(-8, 0); x < w; ) {
    const bw = r.int(26, 48)
    riverBuilding(g, x, bw, r.int(50, 86), env, r, lr)
    x += bw + (r.chance(0.3) ? r.int(4, 12) : r.int(0, 2))
  }
  // 石砌的河岸
  g.rect(0, BANK, w, RIVER - BANK, 'stone-2')
  g.hline(0, w, BANK, 'stone-1')
  for (let x = 0; x < w; x += 6) g.vline(x, BANK + 1, RIVER - 1, 'stone-3')
  // 河面
  const water = tod<Px>(env, 'sea-3', 'sea-3', 'roof-3')
  g.rect(0, RIVER, w, PATH - RIVER + 4, water)
  for (let y = RIVER + 2; y < PATH + 2; y += 3) for (let x = r.int(0, 8); x < w; x += r.int(10, 22)) g.hline(x, x + r.int(2, 6), y, env.time === 'night' ? 'ink-2' : 'sea-2')
  // 招牌的倒影
  for (const s of signs) {
    const k = lit(env) ? s.k : 'sea-2'
    for (let y = RIVER + 1; y < PATH + 2; y += 2) {
      const off = ((y * 7 + s.x) % 5) - 2
      g.dither(s.x + off, y, s.w, 1, k, lit(env) ? 9 - Math.floor((y - RIVER) / 3) : 5)
    }
  }
}

// ---------- 地面：河邊步道、商店街、章魚燒 ----------
/** 地面的東西在哪（世界座標）：腳本用 */
const stalls: number[] = []
const walks: Array<{ x: number; w: number }> = []

/** 河邊步道：石板、欄杆、路燈、樹（後面看得到河） */
function promenade(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  g.rect(x, PATH, w, H - PATH, 'paper-2')
  for (let yy = PATH + 4, n = 0; yy < H; yy += 6, n++) {
    g.hline(x, x + w - 1, yy, 'dirt-2')
    for (let xx = x + (n % 2) * 6; xx < x + w; xx += 12) g.vline(xx, yy - 5, yy - 1, 'dirt-2')
  }
  g.dither(x, PATH + 1, w, 3, 'dirt-2', 4)
  // 樹與路燈
  // 樹少一點（後面是河，遊船要看得到）
  for (let tx = x + r.int(10, 24); tx < x + w - 12; tx += r.int(96, 130)) {
    if (env.season === 'winter' && lit(env)) {
      // 冬天的燈飾
      seasonTree(g, tx, PATH - 1, 8, env)
      for (let i = 0; i < 16; i++) g.px(tx - 8 + ((i * 7) % 17), PATH - 19 + ((i * 5) % 14), 'lamp-1')
    } else seasonTree(g, tx, PATH - 1, 8, env)
    const lx = tx + 40
    if (lx < x + w - 4) {
      g.rect(lx, PATH - 36, 2, 36, 'ink-2')
      g.rect(lx - 2, PATH - 40, 6, 4, lit(env) ? 'lamp-1' : 'paper')
      g.frame(lx - 3, PATH - 41, 8, 6, 'ink-2')
    }
  }
  // 欄杆
  g.hline(x, x + w - 1, PATH - 10, 'ink-2')
  g.hline(x, x + w - 1, PATH - 9, 'stone-3')
  g.hline(x, x + w - 1, PATH - 5, 'ink-2')
  for (let px = x + 2; px < x + w; px += 12) {
    g.rect(px, PATH - 11, 3, 11, 'stone-1')
    g.frame(px, PATH - 12, 3, 12, 'ink-2')
  }
  walks.push({ x, w })
}

/** 商店街的一間店 */
function arcadeShop(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  const top = PATH - 34
  const kind = r.int(0, 4)
  const wall = r.pick<Px>(['wood-2', 'paper-2', 'stone-2', 'wood-3'])
  g.rect(x, top, w, PATH - top, wall)
  // 招牌
  const k = r.pick(SIGN_DAY)
  g.rect(x + 1, top, w - 2, 8, k)
  g.rect(x + 3, top + 2, Math.round(w / 3), 4, k === 'white' || k === 'gold-1' ? 'ink-2' : 'white')
  g.rect(x + 5 + Math.round(w / 3), top + 3, Math.round(w / 4), 2, k === 'white' || k === 'gold-1' ? 'ink-2' : 'white')
  g.frame(x + 1, top, w - 2, 8, 'ink-2')
  const fy = top + 10
  const inside: Px = lit(env) ? 'lamp-1' : 'paper'
  if (kind === 0) {
    // 水果、蔬菜：斜的台子
    g.rect(x + 2, fy, w - 4, PATH - fy - 10, 'wood-3')
    g.poly([x + 1, PATH, x + w - 1, PATH, x + w - 1, PATH - 12, x + 1, PATH - 8], 'wood-1')
    for (let i = x + 3; i < x + w - 3; i += 3) g.circle(i, PATH - 11 + ((i - x) % 2), 1, r.pick<Px>(['shu-1', 'gold-1', 'leaf-2', 'momiji-1']))
    for (let i = x + 4; i < x + w - 4; i += 6) g.rect(i, fy + 3, 4, 3, 'paper')
  } else if (kind === 1) {
    // 衣服：掛一排
    g.rect(x + 2, fy, w - 4, PATH - fy, inside)
    g.hline(x + 2, x + w - 3, fy + 2, 'stone-3')
    for (let i = x + 4; i < x + w - 5; i += 5) g.rect(i, fy + 3, 4, 9, r.pick<Px>(['sakura-2', 'lavender', 'gold-1', 'cloth-1', 'shu-1', 'leaf-2']))
    g.rect(x + w - 10, PATH - 14, 7, 14, 'stone-3')
  } else if (kind === 2) {
    // 串炸：紅燈籠、暖簾、木頭
    g.rect(x + 2, fy, w - 4, PATH - fy, lit(env) ? 'lamp-2' : 'wood-3')
    g.rect(x + 3, fy, w - 6, 8, 'roof-3')
    for (let i = x + 7; i < x + w - 3; i += 6) g.vline(i, fy + 1, fy + 7, 'paper')
    g.ellipse(x + 4, fy + 11, 3, 4, lit(env) ? 'lamp-2' : 'shu-1')
    g.hline(x + 2, x + 6, fy + 8, 'ink-2')
    g.hline(x + 2, x + 6, fy + 14, 'ink-2')
    g.rect(x + 3, PATH - 8, w - 6, 3, 'wood-1')
  } else if (kind === 3) {
    // 藥妝：滿滿的東西
    g.rect(x + 2, fy, w - 4, PATH - fy, lit(env) ? 'lamp-1' : 'white')
    for (let yy = fy + 2; yy < PATH - 2; yy += 3) for (let xx = x + 3; xx < x + w - 3; xx += 2) g.px(xx, yy, r.pick<Px>(['shu-1', 'sea-2', 'leaf-2', 'gold-1', 'sakura-2', 'lavender', 'paper']))
    g.rect(x + 3, PATH - 6, 9, 6, 'shu-2')
  } else {
    // 喫茶：玻璃窗、遮陽篷
    g.rect(x + 3, fy + 5, w - 6, PATH - fy - 6, lit(env) ? 'lamp-2' : 'roof-2')
    g.frame(x + 3, fy + 5, w - 6, PATH - fy - 6, 'wood-3')
    for (let i = 0; i < w - 2; i++) g.vline(x + 1 + i, fy, fy + 3, Math.floor(i / 3) % 2 ? 'paper' : 'shu-2')
    for (let i = 0; i < w - 2; i += 3) g.px(x + 2 + i, fy + 4, Math.floor(i / 3) % 2 ? 'paper' : 'shu-2')
  }
  g.frame(x, top - 1, w, PATH - top + 1, 'ink-2')
}

/** 章魚燒攤：條紋遮陽篷、大燈籠、鐵板、老闆（腳本會換成動的） */
const STALL_W = 46
const GRILL_Y = PATH - 19
function takoyakiStall(g: Gfx, x: number, env: Env) {
  const w = STALL_W
  // 後面的牆
  g.rect(x, PATH - 40, w, 40, 'wood-3')
  g.rect(x + 2, PATH - 38, w - 4, 20, lit(env) ? 'lamp-2' : 'wood-2')
  // 招牌（屋頂上）
  g.rect(x + 3, PATH - 52, w - 6, 10, 'gold-1')
  g.frame(x + 3, PATH - 52, w - 6, 10, 'ink-2')
  for (let i = 0; i < 6; i++) g.circle(x + 10 + i * 5, PATH - 47, 1, 'wood-2')
  bulbs(g, x + 3, PATH - 52, w - 6, 10, env)
  // 遮陽篷
  for (let i = 0; i < w + 4; i++) g.vline(x - 2 + i, PATH - 42, PATH - 37, Math.floor(i / 4) % 2 ? 'white' : 'shu-1')
  for (let i = 0; i < w + 4; i += 4) g.px(x - 1 + i, PATH - 36, Math.floor(i / 4) % 2 ? 'white' : 'shu-1')
  g.hline(x - 2, x + w + 1, PATH - 42, 'shu-2')
  // 老闆（靜止的樣子）
  g.sprite(CHEF[0]!, x + w - 20, GRILL_Y - CHEF[0]!.h)
  // 櫃台與鐵板
  g.rect(x, GRILL_Y, w, PATH - GRILL_Y, 'wood-1')
  g.hline(x, x + w - 1, GRILL_Y, 'wood-2')
  g.rect(x + 2, GRILL_Y + 4, w - 4, PATH - GRILL_Y - 6, 'shu-1')
  for (let i = x + 6; i < x + w - 4; i += 8) g.vline(i, GRILL_Y + 5, PATH - 3, 'white')
  g.rect(x + 6, GRILL_Y - 3, 26, 3, 'stone-4')
  for (let i = 0; i < 6; i++) g.circle(x + 9 + i * 4, GRILL_Y - 3, 1, 'wood-1')
  // 大燈籠
  g.vline(x + 2, PATH - 36, PATH - 34, 'ink-2')
  g.ellipse(x + 2, PATH - 27, 5, 7, lit(env) ? 'lamp-2' : 'shu-1')
  g.hline(x - 2, x + 6, PATH - 34, 'ink-2')
  g.hline(x - 2, x + 6, PATH - 20, 'ink-2')
  g.rect(x, PATH - 29, 5, 3, lit(env) ? 'lamp-1' : 'white')
  g.frame(x, PATH - 40, w, 40, 'ink-2')
}

/** 章魚燒的老闆（上半身 16×16，頭綁毛巾、圍裙） */
const CHEF = [0, 1, 2].map((f) =>
  drawSprite(16, 16, (g) => {
    g.rect(3, 9, 9, 7, 'white')
    g.rect(5, 10, 5, 6, 'cloth-2')
    g.ellipse(7, 5, 4, 4, 'hair')
    g.rect(5, 4, 5, 5, 'skin-1')
    g.px(4, 6, 'skin-1')
    g.rect(3, 2, 9, 2, 'white')
    g.px(11, 1, 'white')
    g.px(5, 6, 'ink')
    g.px(6, 8, 'skin-2')
    // 手：拿著錐子翻
    if (f === 0) {
      g.rect(1, 10, 2, 4, 'white')
      g.px(1, 14, 'skin-1')
    } else {
      g.rect(1, 11 - f, 2, 3, 'white')
      g.px(0, 13 - f, 'skin-1')
      g.vline(0, 14 - f, 15, 'stone-3')
    }
  }),
)

/** 商店街：半透明的屋頂、吊旗、柱子，兩頭有門 */
function arcade(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  // 地板（花磚）
  g.rect(x, PATH, w, H - PATH, 'stone-1')
  for (let yy = PATH + 3, n = 0; yy < H; yy += 5, n++) for (let xx = x + (n % 2) * 5; xx < x + w; xx += 10) g.rect(xx, yy, 5, 2, 'paper-2')
  g.hline(x, x + w - 1, PATH, 'stone-3')
  // 店
  let sx = x + 8
  let tako = r.chance(0.3)
  while (sx < x + w - 30) {
    if (tako && sx > x + 40 && sx + STALL_W < x + w - 10) {
      takoyakiStall(g, sx, env)
      stalls.push(sx)
      sx += STALL_W + 1
      tako = false
      continue
    }
    const sw = Math.min(r.int(26, 38), x + w - 8 - sx)
    if (sw < 16) break
    arcadeShop(g, sx, sw, env, r)
    sx += sw + 1
  }
  // 屋頂
  const roofY = 60
  g.rect(x, roofY, w, 14, env.time === 'day' ? 'cloud-2' : 'roof-3')
  if (env.time === 'day') g.dither(x, roofY + 8, w, 6, 'stone-1', 6)
  g.hline(x, x + w - 1, roofY, 'stone-3')
  g.rect(x, roofY + 14, w, 2, 'stone-3')
  for (let i = x; i < x + w; i += 10) g.vline(i, roofY, roofY + 14, 'stone-3')
  if (lit(env)) for (let i = x + 5; i < x + w; i += 20) g.rect(i, roofY + 16, 3, 2, 'lamp-1')
  // 吊旗（季節）
  const flags: Px[] =
    env.season === 'spring' ? ['sakura-1', 'sakura-2', 'white'] : env.season === 'summer' ? ['sea-1', 'white', 'leaf-2'] : env.season === 'autumn' ? ['momiji-1', 'gold-1', 'momiji-2'] : ['shu-1', 'white', 'leaf-3']
  for (let i = x + 4, n = 0; i < x + w - 6; i += 9, n++) {
    g.vline(i, roofY + 16, roofY + 18, 'stone-3')
    const k = flags[n % flags.length]!
    g.poly([i - 3, roofY + 18, i + 4, roofY + 18, i + 4, roofY + 25, i + 0.5, roofY + 28, i - 3, roofY + 25], k)
    if (env.season === 'winter' && lit(env)) g.px(i, roofY + 29, 'lamp-1')
  }
  // 柱子
  for (let i = x + 30; i < x + w - 20; i += 80) {
    g.rect(i, roofY + 16, 3, PATH - roofY - 16, 'stone-3')
    g.vline(i, roofY + 16, PATH, 'stone-2')
  }
  // 兩頭的門
  gate(g, x, env, r)
  gate(g, x + w - 1, env, r)
}

/** 商店街的入口：兩根柱子、上面拱形的大招牌（燈泡框） */
function gate(g: Gfx, cx: number, env: Env, r: Rng) {
  const k = r.pick<Px>(['shu-1', 'sea-2', 'leaf-3', 'momiji-2'])
  g.rect(cx - 5, 52, 10, PATH - 52, 'stone-3')
  g.rect(cx - 4, 52, 3, PATH - 52, 'stone-2')
  g.frame(cx - 5, 52, 10, PATH - 52, 'ink-2')
  g.ellipse(cx, 50, 16, 8, k)
  g.rect(cx - 16, 50, 33, 10, k)
  for (let i = -12; i <= 12; i += 6) g.rect(cx + i - 2, 49, 4, 6, k === 'sea-2' || k === 'leaf-3' ? 'white' : 'paper')
  for (let a = 0; a < 24; a++) {
    const t = (a / 23) * Math.PI
    g.px(cx - Math.round(Math.cos(t) * 15), 50 - Math.round(Math.sin(t) * 7), (a % 2 ? lit(env) : !lit(env)) ? 'lamp-1' : 'gold-2')
  }
  g.hline(cx - 16, cx + 16, 59, 'ink-2')
  g.frame(cx - 17, 49, 35, 12, 'ink-2')
}

/** 一般的街：一兩間店＋章魚燒攤 */
function streetBlock(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  g.rect(x, PATH, w, H - PATH, 'stone-2')
  for (let yy = PATH + 5; yy < H; yy += 6) g.hline(x, x + w - 1, yy, 'stone-3')
  g.hline(x, x + w - 1, PATH, 'stone-3')
  const tx = x + Math.max(6, Math.round((w - STALL_W) / 2))
  let sx = x
  while (sx + 26 <= tx - 1) {
    const sw = Math.min(r.int(26, 36), tx - 1 - sx)
    arcadeShop(g, sx, sw, env, r)
    // 大燈籠招牌
    if (r.chance(0.5)) {
      g.ellipse(sx + sw / 2, PATH - 44, 7, 9, lit(env) ? 'lamp-2' : 'shu-1')
      for (let yy = PATH - 50; yy < PATH - 38; yy += 3) g.hline(sx + sw / 2 - 6, sx + sw / 2 + 6, yy, 'shu-2')
      g.rect(sx + sw / 2 - 4, PATH - 54, 9, 2, 'ink-2')
      g.rect(sx + sw / 2 - 4, PATH - 35, 9, 2, 'ink-2')
    }
    sx += sw + 1
  }
  takoyakiStall(g, tx, env)
  stalls.push(tx)
  sx = tx + STALL_W + 1
  while (sx + 20 <= x + w) {
    const sw = Math.min(r.int(26, 36), x + w - sx)
    arcadeShop(g, sx, sw, env, r)
    sx += sw + 1
  }
}

function street(g: Gfx, w: number, r: Rng, env: Env) {
  stalls.length = 0
  walks.length = 0
  let x = 0
  // 一開始是河邊，再來章魚燒、商店街，輪流
  for (let n = 0; x < w; n++) {
    const pw = n === 0 ? r.int(150, 190) : r.int(110, 180)
    promenade(g, x, pw, env, r)
    x += pw
    if (x >= w) break
    const sw = r.int(110, 150)
    streetBlock(g, x, sw, env, r)
    x += sw
    if (x >= w) break
    const aw = r.int(220, 320)
    arcade(g, x, aw, env, r)
    x += aw
  }
}

// ---------- 前景：腳踏車 ----------
function bike(g: Gfx, x: number, k: Px) {
  const y = H - 4
  g.ring(x, y - 4, 5, 'ink')
  g.ring(x + 20, y - 4, 5, 'ink')
  g.ring(x, y - 4, 4, 'stone-3')
  g.ring(x + 20, y - 4, 4, 'stone-3')
  g.line(x, y - 4, x + 8, y - 4, k)
  g.line(x + 8, y - 4, x + 5, y - 13, k)
  g.line(x + 8, y - 4, x + 16, y - 12, k)
  g.line(x + 5, y - 11, x + 16, y - 11, k)
  g.line(x + 16, y - 12, x + 20, y - 4, k)
  g.rect(x + 3, y - 15, 5, 2, 'ink-2')
  g.line(x + 16, y - 12, x + 17, y - 17, 'stone-3')
  g.hline(x + 15, x + 19, y - 17, 'ink-2')
  // 前籃
  g.rect(x + 18, y - 17, 7, 5, 'stone-2')
  g.frame(x + 18, y - 17, 7, 5, 'ink')
  g.vline(x + 21, y - 16, y - 13, 'stone-3')
}

function front(g: Gfx, w: number, r: Rng) {
  for (let x = r.int(160, 300); x < w - 30; x += r.int(320, 520)) {
    const n = r.int(1, 2)
    for (let i = 0; i < n; i++) bike(g, x + i * 12, r.pick<Px>(['shu-1', 'sea-2', 'white', 'leaf-2', 'stone-3']))
  }
}

// ---------- 大阪的腳本 ----------
/** 船盒裡的章魚燒（醬汁、美乃滋、海苔粉） */
const TRAY = drawSprite(12, 6, (g) => {
  g.poly([1, 2, 11, 2, 9, 5, 3, 5], 'wood-1')
  for (let i = 0; i < 4; i++) g.circle(3 + i * 2, 2, 1, 'wood-2')
  g.hline(2, 9, 1, 'wood-3')
  g.px(3, 1, 'white')
  g.px(6, 2, 'white')
  g.px(8, 1, 'white')
  g.px(4, 2, 'leaf-2')
  g.px(7, 1, 'leaf-2')
})
const BALL = drawSprite(4, 4, (g) => g.circle(2, 2, 1, 'wood-2'))

/** 前面 380px 內的章魚燒攤（地面的 x）：在這一區走完之前停得下來；沒有就 undefined */
const nextStall = (s: Stage) => stalls.find((k) => k + 6 > s.hero.worldX + 10 && k < s.hero.worldX + 380 && k - 6 - s.hero.x < s.area.length - 40)

const TAKOYAKI: EventDef = {
  id: 'osaka-takoyaki',
  weight: 1.3,
  ready: (s) => nextStall(s) !== undefined,
  *run(s) {
    const x = nextStall(s)
    if (x === undefined) return
    const stop = x - 6
    yield () => s.hero.worldX >= stop
    s.hero.stop()
    yield 0.3
    s.hero.emote('question', 1)
    // 老闆翻章魚燒
    const chef = s.spawn({ frames: CHEF, fps: 0, x: x + STALL_W - 20 + 8, y: GRILL_Y, z: 'back' })
    const done = [0, 0, 0, 0, 0, 0]
    s.paint('back', (g, t) => {
      const gx = x - s.cam
      g.rect(gx + 6, GRILL_Y - 3, 26, 3, 'stone-4')
      for (let i = 0; i < 6; i++) g.circle(gx + 9 + i * 4, GRILL_Y - 3, 1, done[i] ? 'wood-1' : 'gold-1')
      // 湯氣
      for (let i = 0; i < 3; i++) {
        const yy = GRILL_Y - 6 - ((t * 10 + i * 5) % 14)
        g.px(gx + 12 + i * 7 + Math.round(Math.sin(t * 3 + i) * 1), yy, 'white')
      }
    })
    yield 0.8
    for (let i = 5; i >= 0; i--) {
      chef.frame = 1 + (i % 2)
      done[i] = 1
      yield 0.25
      chef.frame = 0
      yield 0.12
    }
    say(s, chef, 'note', 22, 1.2)
    // 裝盒、遞給旅人
    const tray = s.spawn({ frames: TRAY, fps: 0, x: x + 20, y: GRILL_Y - 1, z: 'back' })
    yield 0.6
    yield* s.move(tray, s.hero.worldX + 6, 30)
    tray.space = 'screen'
    tray.z = 'front'
    tray.x = s.hero.x + 5
    tray.y = s.hero.y - 6
    s.hero.emote('heart', 1)
    yield 1
    // 吃一顆：好燙
    const ball = s.spawn({ frames: BALL, fps: 0, x: s.hero.x + 5, y: s.hero.y - 9, space: 'screen', z: 'front' })
    for (let i = 0; i < 10; i++) {
      ball.y -= 0.6
      ball.x += 0.1
      yield null
    }
    yield 0.2
    ball.remove()
    s.paint('front', (g, t) => {
      if (t > 1.6) return
      for (let i = 0; i < 3; i++) g.px(s.hero.x + 4 + i * 2, s.hero.y - 18 - ((t * 14 + i * 3) % 8), 'white')
    })
    s.hero.emote('sweat', 1.2)
    s.hero.jump(5)
    yield 0.5
    s.hero.jump(5)
    yield 0.9
    s.hero.emote('heart', 1.6)
    yield 1.4
    s.hero.walk()
    yield 1.4
  },
}

/** 大阪阿姨（燙捲的紫頭髮、豹紋上衣、購物袋） */
const OBA = [0, 1, 2, 3, -1].map((f) =>
  drawSprite(16, 25, (g) => {
    const stand = f < 0
    const st = stand ? 0 : [1, 0, -1, 0][f]!
    const y = !stand && f % 2 ? -1 : 0
    g.rect(5 - st, 18 + y, 2, 5 - y, 'roof-3')
    g.rect(5 - st, 23, 3, 1, 'ink-2')
    g.rect(4, 11 + y, 8, 8, 'gold-1')
    for (const [dx, dy] of [
      [5, 12],
      [8, 13],
      [10, 11],
      [6, 15],
      [9, 16],
      [5, 17],
      [10, 15],
    ] as const)
      g.px(dx, dy + y, 'wood-3')
    g.rect(7 + st, 18 + y, 2, 5 - y, 'roof-2')
    g.rect(7 + st, 23, 3, 1, 'ink-2')
    // 購物袋
    g.rect(1, 13 + y, 4, 7, 'sakura-2')
    g.vline(3, 10 + y, 12 + y, 'shu-2')
    g.rect(8, 12 + y, 2, 4, 'gold-2')
    g.px(8, 16 + y, 'skin-1')
    // 頭：燙捲
    g.ellipse(7, 5 + y, 5, 4, 'lavender')
    for (const [dx, dy] of [
      [3, 2],
      [6, 0],
      [9, 1],
      [2, 5],
      [12, 4],
    ] as const)
      g.circle(dx, dy + 1 + y, 1, 'lavender')
    g.rect(7, 4 + y, 5, 6, 'skin-1')
    g.rect(7, 3 + y, 5, 1, 'lavender')
    g.px(10, 6 + y, 'ink')
    g.px(11, 8 + y, 'shu-1')
    g.px(9, 8 + y, 'sakura-2')
  }),
)
const OBA_WALK = OBA.slice(0, 4)
const OBA_STAND = [OBA[4]!]
/** 對話框裡的糖 */
const CANDY_BUBBLE = sprite(
  `
  .kkkkkkkkk.
  kwwwwwwwwwk
  kwywrrrwywk
  kwyyrwryywk
  kwywrrrwywk
  kwwwwwwwwwk
  .kkwkkkkkk.
  ...kk......
`,
  { k: 'ink', w: 'white', r: 'shu-1', y: 'gold-1' },
)
const CANDY = sprite(
  `
  y.rr.y
  yrrrry
  y.rr.y
`,
  { y: 'gold-1', r: 'shu-1' },
)

const AME: EventDef = {
  id: 'osaka-ame',
  *run(s) {
    const oba = s.spawn({ frames: OBA_WALK, fps: 6, x: s.cam + s.W + 14, y: s.FLOOR, flip: true, vx: -26 })
    yield () => oba.sx() < s.hero.x + 44
    s.hero.stop()
    yield () => oba.sx() < s.hero.x + 19
    oba.vx = 0
    oba.frames = OBA_STAND
    oba.fps = 0
    const give = function* (dx: number) {
      const b = s.spawn({ frames: CANDY_BUBBLE, fps: 0, x: oba.x - 3, y: oba.y - 26, z: 'over' })
      yield 1.1
      b.remove()
      const c = s.spawn({ frames: CANDY, fps: 0, x: oba.x - 6, y: oba.y - 12, z: 'front', vx: -(oba.x - 6 - (s.hero.worldX + dx)) / 0.5, vy: -40, gravity: 160 })
      yield 0.5
      c.vx = 0
      c.vy = 0
      c.gravity = 0
      c.space = 'screen'
      c.x = s.hero.x + dx
      c.y = s.hero.y - 6
      return c
    }
    const c1 = yield* give(4)
    s.hero.emote('surprise', 0.8)
    yield 0.9
    s.hero.emote('heart', 1.2)
    yield 1
    // もう一個
    const c2 = yield* give(0)
    s.hero.emote('sweat', 1.2)
    yield 1.2
    s.hero.jump(4)
    s.hero.emote('note', 1.2)
    yield 0.8
    // 阿姨從後面走掉
    oba.frames = OBA_WALK
    oba.fps = 6
    oba.y = s.FLOOR - 3
    oba.vx = -28
    yield 0.6
    s.hero.walk()
    for (const c of [c1, c2]) c.update = (a) => void (a.y = s.hero.y - 6)
    yield 1.4
    c1.remove()
    c2.remove()
    yield () => oba.sx() < -20
  },
}

/** 河上的遊船：從右邊慢慢開過來，船上的人揮手 */
function drawBoat(g: Gfx, x: number, env: Env, t: number, wave: boolean) {
  const night = lit(env)
  const y = WATERLINE
  // 倒影
  g.dither(x + 2, y + 1, 56, 4, night ? 'lamp-2' : 'sea-2', 4)
  // 船身
  g.poly([x, y - 7, x + 60, y - 7, x + 56, y, x + 4, y], 'white')
  g.hline(x + 2, x + 57, y - 4, 'sea-2')
  g.hline(x + 1, x + 58, y - 3, 'sea-2')
  g.hline(x, x + 60, y - 7, 'stone-2')
  // 船艙（夜裡亮燈）
  if (night) g.rect(x + 4, y - 18, 52, 9, 'lamp-2')
  // 乘客
  for (let i = 0; i < 7; i++) {
    const px = x + 8 + i * 7
    const hair: Px = (['hair', 'wood-3', 'stone-1', 'gold-2', 'hair', 'ink-2', 'wood-2'] as const)[i]!
    g.rect(px - 1, y - 11, 4, 4, (['cloth-1', 'shu-1', 'leaf-2', 'paper', 'lavender', 'gold-1', 'sea-1'] as const)[i]!)
    g.circle(px + 1, y - 13, 1, 'skin-1')
    g.hline(px, px + 2, y - 15, hair)
    if (wave && i % 2 === 0) {
      const up = Math.floor(t * 6 + i) % 2
      g.vline(px - 2, y - 16 + up, y - 11, 'skin-1')
    }
  }
  // 頂篷
  g.rect(x + 3, y - 21, 54, 2, night ? 'roof-3' : 'shu-2')
  g.hline(x + 3, x + 56, y - 22, night ? 'roof-2' : 'shu-1')
  for (const px of [x + 4, x + 30, x + 55]) g.vline(px, y - 19, y - 8, 'stone-3')
  if (night) for (let i = x + 5; i < x + 56; i += 4) g.px(i, y - 19, i % 8 ? 'lamp-1' : 'lamp-2')
  g.hline(x + 4, x + 55, y, 'ink-2')
}

/** 前面的河邊步道：停下來的地方（步道進去 40px）右邊還有 70px 以上看得到河，在這一區走完之前停得下來 */
const riverWalk = (s: Stage) =>
  walks.find((k) => k.x + k.w - 70 > s.hero.worldX && k.x < s.hero.worldX + 420 && Math.max(k.x + 40, s.hero.worldX) - s.hero.x < s.area.length - 80)

const BOAT: EventDef = {
  id: 'osaka-boat',
  ready: (s) => riverWalk(s) !== undefined,
  *run(s) {
    // 河邊步道（看得到河）上停下來
    const seg = riverWalk(s)
    if (!seg) return
    const stop = Math.max(seg.x + 40, s.hero.worldX)
    yield () => s.hero.worldX >= stop
    s.hero.stop()
    // 船從步道右端的房子後面開出來（步道比畫面長就從畫面外）；看得到船了旅人才嚇一跳
    const openR = Math.min(s.W, seg.x + seg.w - s.cam)
    let wave = false
    const boat = s.spawn({ x: s.cam * MID + openR + 4, y: WATERLINE, space: MID, z: 'mid', vx: -40, draw: (g, sx, _y, a) => drawBoat(g, Math.round(sx), s.env, a.age, wave) })
    yield () => boat.sx() < openR - 30
    s.hero.emote('surprise', 0.9)
    yield () => boat.sx() < s.hero.x + 30
    boat.vx = -14
    wave = true
    s.hero.emote('heart', 1.4)
    s.hero.jump(4)
    yield 1.6
    s.hero.emote('note', 1.4)
    yield () => boat.sx() + 30 < s.hero.x
    boat.vx = -30
    yield 0.6
    s.hero.walk()
    yield () => boat.sx() + 62 < 0
  },
}

/** 夜裡河面的霓虹倒影晃來晃去 */
const RIPPLE: EventDef = {
  id: 'osaka-neon-river',
  kind: 'ambient',
  when: { time: ['night', 'dusk'] },
  *run(s) {
    s.paint('mid', (g, t) => {
      const cam = s.cam * MID
      for (const sg of signs) {
        const x = sg.x - cam
        if (x > s.W + 4 || x + sg.w < -4) continue
        for (let y = WATERLINE + 1; y < PATH + 2; y += 2) {
          const off = Math.round(Math.sin(t * 2.4 + y * 0.8 + sg.x * 0.1) * 2)
          const len = Math.max(2, Math.round(sg.w * (0.4 + 0.3 * Math.sin(t * 1.7 + y))))
          g.hline(x + off + Math.round((sg.w - len) / 2), x + off + Math.round((sg.w + len) / 2), y, sg.k)
        }
      }
    })
    yield 18
  },
}

export const OSAKA: AreaDef = {
  id: 'osaka',
  name: '大阪',
  romaji: 'OSAKA',
  tags: ['city', 'town'],
  length: 1400,
  sky,
  layers: [
    { speed: FAR, draw: farCity },
    { speed: MID, draw: riverside },
  ],
  ground: { speed: 1, draw: street },
  front: { speed: 1.3, draw: front },
  events: [TAKOYAKI, AME, BOAT, RIPPLE],
}
