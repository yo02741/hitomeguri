import { drawSprite } from '../build'
import type { Gfx } from '../gfx'
import { cedar, roundTree, seasonTree, skyBase } from '../kit'
import type { Px } from '../palette'
import type { Rng } from '../rng'
import type { Sprite } from '../sprite'
import { type Actor, type AreaDef, type Env, type EventDef, FLOOR, H, type Script, type Stage } from '../types'

/**
 * 奈良：若草山的緩丘與春日山的原始林、興福寺五重塔與東大寺大佛殿・南大門的大屋頂（中景），
 * 奈良公園的草地與到處都是的鹿、仙貝攤、春日大社參道成排長青苔的石燈籠、朱色迴廊與釣燈籠。
 * 層：若草山 0.12、寺院 0.4、參道 1、前景 1.3。
 */
const PATH = FLOOR - 8

// ---------- 小工具 ----------
/** 平滑的起伏：每 step 一個控制點、餘弦內插 */
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

/** 草地的顏色：冬天的芝生是枯黃的 */
function lawn(env: Env): [Px, Px] {
  if (env.season === 'winter') return ['dirt-1', 'sand-2']
  if (env.season === 'autumn') return ['leaf-2', 'dirt-1']
  return ['leaf-2', 'leaf-3']
}

/** 奈良公園的樹：杉、常綠的大樹、季節的樹（櫻、楓）混著 */
function parkTree(g: Gfx, x: number, y: number, s: number, env: Env, r: Rng) {
  const roll = r.next()
  if (roll < 0.25) cedar(g, x, y, Math.round(s * 4.2))
  else if (roll < 0.5) roundTree(g, x, y, s, 'leaf-3', 'leaf-4')
  else seasonTree(g, x, y, s, env)
}

// ---------- 遠景：若草山與春日山 ----------
function hills(g: Gfx, w: number, r: Rng, env: Env) {
  // 最遠的山
  const far = profile(w, 70, 98, 14, r)
  for (let x = 0; x < w; x++) g.vline(x, far[x]!, H, 'roof-1')
  // 春日山的原始林：圓圓的樹冠疊成的稜線
  const forest = profile(w, 40, 104, 14, r)
  const dots: Px | null = env.season === 'autumn' ? 'momiji-2' : env.season === 'spring' ? 'sakura-1' : null
  for (let x = 0; x < w; x++) {
    const y = forest[x]! - (((x * 13) % 7 < 3 ? 1 : 0) + ((x * 5) % 11 < 2 ? 1 : 0))
    g.vline(x, y, H, 'leaf-4')
    if ((x * 7) % 9 < 2) g.px(x, y + 2, 'leaf-3')
  }
  for (let i = 0; i < w / 8; i++) {
    const x = r.int(0, w)
    g.dither(x - 3, forest[Math.min(w, x)]! + r.int(2, 8), 6, 3, 'leaf-3', 6)
  }
  if (dots) for (let i = 0; i < w / 5; i++) {
    const x = r.int(0, w)
    g.px(x, forest[Math.min(w, x)]! + r.int(3, 12), dots)
  }
  // 若草山：三層的緩丘，整片是草（沒有樹）
  const [grassK, grassD]: [Px, Px] =
    env.season === 'winter' ? ['dirt-2', 'wood-2'] : env.season === 'autumn' ? ['dirt-1', 'dirt-2'] : ['leaf-2', 'leaf-3']
  for (let cx = Math.round(w * r.range(0.25, 0.4)); cx < w; cx += r.int(Math.round(w * 0.6), Math.round(w * 0.9))) {
    const half = 78
    const ys: number[] = []
    for (let d = -half; d <= half; d++) {
      const t = d / half
      // 三個笠疊起來：中間最高
      const a = Math.cos((t * Math.PI) / 2)
      const bump = Math.max(0, Math.cos(t * Math.PI * 1.5)) * 3
      ys.push(Math.round(110 - a * 30 - bump))
    }
    for (let i = 0; i < ys.length; i++) {
      const x = cx - half + i
      const y = ys[i]!
      g.vline(x, y, H, grassK)
      if (i > half) g.dither(x, y, 1, H - y, grassD, 5)
      // 三段的分界（山腰上的小路）
      for (const off of [10, 19]) g.px(x, y + off + Math.round(Math.abs(i - half) / 18), grassD)
    }
  }
}

// ---------- 中景：興福寺五重塔、東大寺大佛殿・南大門 ----------
/** 屋簷：一條往兩端翹起的瓦屋頂（x0–x1、簷的 y、高 h） */
function eave(g: Gfx, x0: number, x1: number, y: number, h: number, k: Px = 'roof-3', top: Px = 'roof-2') {
  g.poly([x0 - 2, y - 1, x0 + h, y - h, x1 - h, y - h, x1 + 2, y - 1, x1, y + 1, x0, y + 1], k)
  g.hline(x0 + h, x1 - h, y - h, top)
  g.px(x0 - 2, y - 2, k)
  g.px(x1 + 2, y - 2, k)
}

/** 興福寺五重塔：深色的木構、白壁、黃銅的相輪；x 中心、y 地面 */
function kofukuji(g: Gfx, x: number, y: number, env: Env) {
  const lit = env.time !== 'day'
  for (let i = 0; i < 5; i++) {
    const bw = 12 - i
    const yy = y - 4 - i * 11
    g.rect(x - bw / 2, yy - 8, bw, 8, 'wood-2')
    g.rect(x - bw / 2 + 2, yy - 7, bw - 4, 6, lit && i === 0 ? 'lamp-2' : 'paper')
    g.vline(x, yy - 7, yy - 2, 'wood-3')
    const ew = 13 - i * 1.2
    eave(g, Math.round(x - ew), Math.round(x + ew), yy - 8, 3)
  }
  g.rect(x - 7, y - 4, 14, 4, 'stone-2')
  g.vline(x, y - 76, y - 63, 'gold-2')
  for (let i = 0; i < 4; i++) g.hline(x - 1, x + 1, y - 74 + i * 3, 'gold-2')
  g.px(x, y - 77, 'gold-1')
}

/** 東大寺大佛殿：寬大的入母屋屋頂、兩端金色的鴟尾、正面唐破風下的觀相窗；x 左緣、y 地面 */
function daibutsuden(g: Gfx, x: number, y: number, env: Env) {
  const W = 104
  const mid = x + W / 2
  const night = env.time !== 'day'
  g.rect(x - 2, y - 3, W + 4, 3, 'stone-2')
  g.hline(x - 2, x + W + 1, y - 3, 'stone-1')
  // 一樓（裳階）：白壁、柱
  g.rect(x + 4, y - 17, W - 8, 14, 'paper')
  for (let i = x + 4; i <= x + W - 4; i += 8) g.rect(i, y - 17, 2, 14, 'wood-2')
  g.rect(mid - 8, y - 14, 16, 11, night ? 'lamp-2' : 'wood-3')
  for (let i = mid - 7; i < mid + 8; i += 3) g.vline(i, y - 14, y - 4, 'wood-2')
  eave(g, x, x + W, y - 17, 5)
  // 二樓
  g.rect(x + 14, y - 34, W - 28, 13, 'paper')
  for (let i = x + 14; i <= x + W - 14; i += 7) g.rect(i, y - 34, 2, 13, 'wood-2')
  g.hline(x + 14, x + W - 14, y - 26, 'wood-2')
  // 大屋頂
  const yE = y - 34
  g.poly([x - 3, yE + 1, x + 10, yE - 10, x + 22, yE - 18, x + W - 22, yE - 18, x + W - 10, yE - 10, x + W + 3, yE + 1, x + W, yE + 3, x, yE + 3], 'roof-3')
  // 瓦的直條：從屋頂的斜面往下
  const roofTop = (i: number) => {
    const d = Math.min(i - x, x + W - i)
    return d < 13 ? yE + 1 - Math.round(((d + 3) * 11) / 16) : d < 25 ? yE - 10 - Math.round(((d - 13) * 8) / 12) : yE - 18
  }
  for (let i = x + 5; i < x + W - 4; i += 3) g.vline(i, roofTop(i) + 2, yE + 1, 'roof-2')
  g.rect(x + 22, yE - 20, W - 44, 3, 'roof-3')
  g.hline(x + 22, x + W - 23, yE - 21, 'roof-2')
  // 鴟尾（金色、往外彎）
  for (const [sx, dir] of [
    [x + 22, -1],
    [x + W - 23, 1],
  ] as const) {
    g.rect(sx - 1, yE - 25, 3, 5, 'gold-1')
    g.px(sx + dir * 2, yE - 26, 'gold-1')
    g.px(sx + dir * 2, yE - 25, 'gold-1')
    g.vline(sx + (dir > 0 ? 1 : -1), yE - 24, yE - 21, 'gold-2')
  }
  // 唐破風與觀相窗
  g.ellipse(mid, yE - 2, 10, 5, 'roof-3')
  g.rect(mid - 10, yE - 2, 21, 5, 'roof-3')
  g.ellipse(mid, yE + 1, 7, 3, 'gold-2')
  g.ellipse(mid, yE + 2, 6, 3, night ? 'lamp-1' : 'wood-3')
  g.rect(mid - 7, yE + 3, 15, 2, 'roof-3')
}

/** 東大寺南大門：兩重的屋頂、粗的柱；x 左緣、y 地面 */
function nandaimon(g: Gfx, x: number, y: number) {
  const W = 58
  g.rect(x, y - 2, W, 2, 'stone-2')
  g.rect(x + 4, y - 20, W - 8, 18, 'wood-2')
  for (let i = 0; i < 4; i++) g.rect(x + 7 + i * 13, y - 20, 8, 18, 'wood-3')
  for (let i = 0; i < 5; i++) g.rect(x + 4 + i * 12.5, y - 20, 3, 18, 'wood-1')
  eave(g, x, x + W, y - 20, 4)
  g.rect(x + 8, y - 32, W - 16, 9, 'wood-2')
  for (let i = x + 10; i < x + W - 9; i += 5) g.rect(i, y - 31, 2, 7, 'wood-3')
  eave(g, x - 2, x + W + 2, y - 32, 8)
  g.rect(x + 14, y - 42, W - 28, 3, 'roof-3')
  g.hline(x + 14, x + W - 15, y - 43, 'roof-2')
}

function temples(g: Gfx, w: number, r: Rng, env: Env) {
  const ground = 117
  const [la, lb] = lawn(env)
  // 林子當底
  for (let x = 0; x < w; x += r.int(10, 18)) parkTree(g, x, ground + 1, r.int(6, 9), env, r)
  let x = r.int(10, 60)
  const order = r.chance(0.5) ? ['daibutsuden', 'pagoda', 'gate'] : ['pagoda', 'daibutsuden', 'gate']
  let n = 0
  while (x < w) {
    const kind = order[n % order.length]
    n++
    if (kind === 'daibutsuden') {
      daibutsuden(g, x, ground, env)
      x += 104
    } else if (kind === 'pagoda') {
      kofukuji(g, x + 14, ground, env)
      x += 30
    } else {
      nandaimon(g, x, ground)
      x += 58
    }
    // 之間：樹、小鹿的剪影
    const gap = r.int(70, 120)
    for (let t = x + 8; t < x + gap - 6; t += r.int(10, 18)) parkTree(g, t, ground + 2, r.int(7, 10), env, r)
    x += gap
  }
  g.rect(0, ground, w, H - ground, la)
  g.dither(0, ground + 2, w, H - ground - 2, lb, 4)
  for (let i = 0; i < w / 30; i++) {
    const dx = r.int(0, w)
    const dy = ground + r.int(3, 8)
    g.rect(dx - 2, dy - 3, 5, 2, 'dirt-2')
    g.px(dx + 3, dy - 4, 'dirt-2')
    g.px(dx - 2, dy - 1, 'wood-2')
    g.px(dx + 2, dy - 1, 'wood-2')
  }
}

// ---------- 地面：奈良公園、參道的石燈籠、春日大社的朱色迴廊 ----------
/** 燈籠的位置（萬燈籠的腳本用）：世界座標 */
const LAMPS: Array<{ x: number; y: number; s: number }> = []

/** 春日燈籠（石）：x 中心、y 地面、s 大小；長了青苔 */
function stoneLantern(g: Gfx, x: number, y: number, s: number, env: Env, r: Rng) {
  const p = (v: number) => Math.round(v * s)
  const roll = r.next()
  const lit = env.time === 'night' ? roll < 0.3 : env.time === 'dusk' ? roll < 0.1 : false
  g.rect(x - p(4), y - p(3), p(8) + 1, p(3), 'stone-3')
  g.rect(x - p(1), y - p(13), p(2) + 1, p(10), 'stone-2')
  g.hline(x - p(1), x + p(1), y - p(8), 'stone-3')
  g.rect(x - p(3), y - p(15), p(6) + 1, p(2), 'stone-2')
  g.rect(x - p(3), y - p(20), p(6) + 1, p(5), 'stone-1')
  g.rect(x - p(1), y - p(19), p(2) + 1, p(3), lit ? 'lamp-1' : 'stone-4')
  g.poly([x - p(6), y - p(20), x - p(3), y - p(23), x + p(3) + 1, y - p(23), x + p(6) + 1, y - p(20)], 'stone-3')
  g.px(x - p(6), y - p(21), 'stone-3')
  g.px(x + p(6) + 1, y - p(21), 'stone-3')
  g.circle(x, y - p(24), Math.max(1, p(1)), 'stone-3')
  g.dither(x - p(6), y - p(23), p(12) + 2, p(3), 'leaf-3', 5)
  g.dither(x - p(4), y - p(3), p(8) + 1, p(2), 'leaf-3', 6)
  LAMPS.push({ x, y: y - p(18), s })
}

/** 釣燈籠（青銅）：吊在迴廊的簷下；x 中心、y 上緣 */
function hangingLantern(g: Gfx, x: number, y: number, env: Env) {
  g.vline(x, y, y + 2, 'stone-3')
  g.tri(x - 3, y + 5, x, y + 2, x + 3, y + 5, 'gold-2')
  g.rect(x - 2, y + 5, 5, 5, 'wood-3')
  g.rect(x - 1, y + 6, 3, 3, env.time === 'night' ? 'lamp-2' : 'gold-2')
  g.hline(x - 2, x + 2, y + 10, 'gold-2')
  LAMPS.push({ x, y: y + 7, s: 0.5 })
}

/** 春日大社的迴廊：朱色的柱、白壁、綠色的連子窗、檜皮葺的屋頂、簷下一排釣燈籠；x0–x1、y 地面 */
function kairo(g: Gfx, x0: number, x1: number, y: number, env: Env, r: Rng) {
  const top = y - 34
  g.rect(x0, y - 3, x1 - x0, 3, 'stone-2')
  g.hline(x0, x1 - 1, y - 3, 'stone-1')
  g.rect(x0, top + 9, x1 - x0, y - 3 - top - 9, 'white')
  // 連子窗
  for (let i = x0 + 2; i < x1 - 6; i += 10) {
    g.rect(i + 1, top + 12, 7, 8, 'ink-2')
    for (let j = i + 2; j < i + 8; j += 2) g.vline(j, top + 12, top + 19, 'leaf-2')
    g.hline(i + 1, i + 7, top + 11, 'shu-2')
    g.hline(i + 1, i + 7, top + 20, 'shu-2')
  }
  for (let i = x0; i < x1; i += 10) {
    g.rect(i, top + 8, 2, y - 3 - top - 8, 'shu-1')
    g.vline(i + 1, top + 8, y - 4, 'shu-2')
  }
  g.rect(x0, top + 7, x1 - x0, 2, 'shu-1')
  g.hline(x0, x1 - 1, top + 9, 'shu-2')
  // 屋頂（檜皮葺：厚、褐色）
  g.poly([x0 - 3, top + 7, x0 + 2, top, x1 - 2, top, x1 + 3, top + 7], 'wood-3')
  g.hline(x0 + 2, x1 - 3, top, 'wood-2')
  g.hline(x0 - 3, x1 + 2, top + 7, 'hair')
  g.dither(x0, top + 1, x1 - x0, 3, 'wood-2', 4)
  // 中間的樓門（高一點、兩重簷）
  if (x1 - x0 > 110 && r.chance(0.7)) {
    const gx = x0 + Math.round((x1 - x0) / 2) - 18
    g.rect(gx + 2, top - 10, 32, 10, 'shu-1')
    g.rect(gx + 8, top - 8, 20, 6, 'white')
    for (let i = gx + 9; i < gx + 28; i += 3) g.vline(i, top - 8, top - 3, 'leaf-2')
    g.poly([gx - 4, top - 9, gx + 4, top - 17, gx + 32, top - 17, gx + 40, top - 9], 'wood-3')
    g.hline(gx + 4, gx + 31, top - 17, 'wood-2')
    g.hline(gx - 4, gx + 39, top - 9, 'hair')
    g.rect(gx + 12, y - 22, 12, 19, 'roof-3')
    g.rect(gx + 10, y - 23, 2, 20, 'shu-1')
    g.rect(gx + 24, y - 23, 2, 20, 'shu-1')
  }
  for (let i = x0 + 5; i < x1 - 4; i += 10) hangingLantern(g, i + 1, top + 9, env)
}

/** 坐著或站著的鹿（地面的點綴） */
function deerDecor(g: Gfx, x: number, y: number, r: Rng) {
  const roll = r.next()
  const s = roll < 0.4 ? DEER_LIE : roll < 0.7 ? DEER.eat[0]! : DEER.stand
  g.sprite(s, Math.round(x - s.w / 2), y - s.h, { flip: r.chance(0.5) })
}

/** 鹿仙貝的小攤：木的台子、一疊疊的仙貝、白布 */
function senbeiStall(g: Gfx, x: number, y: number) {
  g.rect(x, y - 13, 20, 13, 'wood-2')
  g.rect(x + 1, y - 12, 18, 5, 'white')
  g.hline(x + 1, x + 18, y - 9, 'shu-2')
  for (let i = 0; i < 4; i++) {
    g.ellipse(x + 3 + i * 4.5, y - 15, 2, 1, 'wood-1')
    g.ellipse(x + 3 + i * 4.5, y - 16, 2, 1, 'dirt-1')
    g.vline(x + 3 + Math.round(i * 4.5), y - 17, y - 14, 'paper')
  }
  g.rect(x - 1, y - 14, 22, 1, 'wood-3')
  g.rect(x + 1, y - 3, 2, 3, 'wood-3')
  g.rect(x + 17, y - 3, 2, 3, 'wood-3')
}

function park(g: Gfx, w: number, r: Rng, env: Env) {
  LAMPS.length = 0
  const [la, lb] = lawn(env)
  const back = PATH - 9
  let x = 0
  let sinceKairo = r.int(150, 300)
  let sinceStall = 0
  while (x < w) {
    const roll = r.next()
    if (sinceKairo > 420 && roll < 0.5) {
      const len = r.int(130, 190)
      g.rect(x, back, len, PATH - back, 'leaf-4')
      for (let i = x + 6; i < x + len; i += r.int(14, 22)) cedar(g, i, back - 30, r.int(22, 34))
      kairo(g, x + 8, x + len - 8, PATH - 2, env, r)
      for (let i = x + 4; i < x + len; i += 22) stoneLantern(g, i, PATH, 1, env, r)
      x += len
      sinceKairo = 0
      continue
    }
    if (roll < 0.45) {
      // 參道：杉林、苔，兩排石燈籠（後排小、前排大）
      const len = r.int(120, 200)
      g.rect(x, back - 4, len, PATH - back + 4, 'leaf-4')
      g.dither(x, back - 4, len, PATH - back + 4, 'leaf-3', 4)
      for (let i = x + r.int(0, 10); i < x + len; i += r.int(18, 30)) cedar(g, i, back - 2, r.int(32, 48))
      for (let i = x + 6; i < x + len - 4; i += 13) stoneLantern(g, i, back + 3, 0.7, env, r)
      for (let i = x + 12; i < x + len - 6; i += 19) stoneLantern(g, i, PATH, 1, env, r)
      x += len
      sinceKairo += len
      continue
    }
    // 公園的草地：大樹、鹿、仙貝攤
    const len = r.int(110, 200)
    g.rect(x, back, len, PATH - back, la)
    g.dither(x, back + 2, len, PATH - back - 2, lb, 4)
    for (let i = x + r.int(4, 20); i < x + len - 8; i += r.int(26, 48)) parkTree(g, i, back + 2, r.int(10, 14), env, r)
    if (sinceStall > 260 && r.chance(0.7)) {
      senbeiStall(g, x + r.int(10, Math.max(11, len - 40)), PATH - 1)
      sinceStall = 0
    }
    for (let i = 0; i < r.int(1, 3); i++) deerDecor(g, x + r.int(10, len - 10), PATH - r.int(0, 3), r)
    // 落葉、花瓣
    const fall: Px | null = env.season === 'autumn' ? 'momiji-1' : env.season === 'spring' ? 'sakura-1' : null
    if (fall) for (let i = 0; i < len / 4; i++) g.px(x + r.int(0, len), r.int(back + 1, PATH - 1), r.chance(0.5) ? fall : env.season === 'autumn' ? 'momiji-2' : 'sakura-2')
    x += len
    sinceKairo += len
    sinceStall += len
  }
  // 路緣
  for (let i = 0; i < w; i++) if ((i * 7) % 5 < 2) g.vline(i, PATH - 2, PATH, la === 'dirt-1' ? 'sand-2' : 'leaf-3')
  // 砂利的路
  g.rect(0, PATH, w, H - PATH, 'sand-2')
  g.hline(0, w, PATH, 'stone-1')
  g.dither(0, PATH + 1, w, 2, 'stone-1', 6)
  for (let i = 0; i < w / 2; i++) g.px(r.int(0, w), r.int(PATH + 2, H - 9), r.pick(['dirt-1', 'stone-1', 'sand-1', 'dirt-2'] as const))
  // 最下面一條草地（鹿啃得很短）
  g.rect(0, H - 8, w, 8, la)
  g.dither(0, H - 5, w, 5, lb, 5)
  for (let i = 0; i < w / 3; i++) g.vline(r.int(0, w), H - 9 - r.int(0, 1), H - 8, la)
  for (let i = 0; i < w / 40; i++) {
    // 鹿的糞（奈良的日常）
    const dx = r.int(0, w)
    g.px(dx, H - 4, 'wood-3')
    g.px(dx + 2, H - 3, 'wood-3')
  }
}

// ---------- 前景：樹幹與垂下來的枝葉 ----------
function front(g: Gfx, w: number, r: Rng, env: Env) {
  const leaf: [Px, Px] =
    env.season === 'spring' ? ['sakura-1', 'sakura-2'] : env.season === 'autumn' ? ['momiji-1', 'momiji-2'] : env.season === 'winter' ? ['leaf-3', 'leaf-4'] : ['leaf-2', 'leaf-3']
  for (let x = r.int(480, 700); x < w; x += r.int(560, 820)) {
    g.rect(x, 0, 8, H, 'wood-3')
    g.rect(x + 1, 0, 2, H, 'wood-2')
    g.dither(x + 5, 0, 3, H, 'ink-2', 6)
    for (let i = 0; i < 16; i++) {
      const lx = x + r.int(-44, 48)
      const ly = r.int(-4, 12) + Math.round(Math.abs(lx - x) / 10)
      g.ellipse(lx, ly, r.int(6, 10), r.int(4, 6), leaf[0])
      g.dither(lx - 10, ly + 1, 20, 6, leaf[1], 8)
    }
    g.line(x + 4, 10, x - 30, 6, 'wood-3')
    g.line(x + 4, 14, x + 34, 9, 'wood-3')
    g.ellipse(x + 4, H, 12, 4, 'leaf-3')
  }
  // 草叢
  for (let x = r.int(60, 200); x < w; x += r.int(150, 300))
    for (let i = 0; i < r.int(4, 8); i++) {
      const gx = x + i * r.int(2, 4)
      g.line(gx, H, gx + r.int(-2, 2), H - r.int(5, 10), i % 2 ? 'leaf-3' : 'leaf-2')
    }
}

// ---------- 奈良的角色：鹿 ----------
interface DeerPose {
  leg: number
  head: 'up' | 'bow' | 'eat' | 'look'
  fawn?: boolean
  run?: boolean
  buck?: boolean
}
/** 鹿（朝右）：褐色、白屁股、細腿；仔鹿小一號、身上有白斑 */
function deer(p: DeerPose): Sprite {
  const f = p.fawn ? 0.72 : 1
  const W = p.fawn ? 20 : 26
  const Hh = p.fawn ? 17 : 22
  return drawSprite(W, Hh, (g) => {
    const s = (v: number) => Math.round(v * f)
    const by = Hh - 1 - s(8)
    const coat: Px = 'dirt-2'
    const dark: Px = 'wood-2'
    // 腿：遠的兩支深一點
    const legY = by + s(3)
    const legLen = Hh - 1 - legY
    const leg = (x: number, d: number, k: Px) => {
      if (p.run) {
        g.line(x, legY, x + d * 2, legY + legLen, k)
      } else g.rect(x + d, legY, 1, legLen, k)
    }
    leg(s(5), p.run ? -1 : -p.leg, 'wood-3')
    leg(s(15), p.run ? 1 : p.leg, 'wood-3')
    // 身體
    g.ellipse(s(10), by, s(6), s(3), coat)
    g.hline(s(6), s(14), by - s(3), dark)
    g.hline(s(7), s(13), by + s(2), 'dirt-1')
    g.rect(s(3), by - s(2), 2, s(3), 'white')
    g.px(s(3), by - s(3), 'ink')
    leg(s(7), p.run ? 1 : p.leg, dark)
    leg(s(13), p.run ? -1 : -p.leg, dark)
    if (p.fawn)
      for (const [sx, sy] of [
        [6, -1],
        [9, -2],
        [12, -1],
        [8, 0],
        [11, 0],
      ] as const)
        g.px(s(sx), by + sy, 'white')
    // 脖子與頭
    const neck = (hx: number, hy: number) => g.poly([s(13), by - s(1), s(15), by - s(3), hx + 1, hy, hx - 1, hy + 1, s(15), by + s(1)], coat)
    let hx: number
    let hy: number
    if (p.head === 'up' || p.head === 'look') {
      hx = s(18)
      hy = by - s(7)
    } else if (p.head === 'bow') {
      hx = s(20)
      hy = by
    } else {
      hx = s(19)
      hy = Hh - 3
    }
    neck(hx, hy)
    g.ellipse(hx, hy, s(2) + (p.fawn ? 0 : 0), s(2), coat)
    if (p.head === 'look') {
      // 臉朝向看的人
      g.px(hx - 1, hy, 'ink')
      g.px(hx + 1, hy, 'ink')
      g.px(hx, hy + 2, 'ink')
      g.px(hx - 2, hy - 2, coat)
      g.px(hx + 2, hy - 2, coat)
    } else {
      const down = p.head === 'eat' || p.head === 'bow' ? 1 : 0
      g.rect(hx + 1, hy - 1 + down, s(4), 2, coat)
      g.px(hx + s(4), hy - 1 + down, 'ink')
      g.px(hx, hy - 1, 'ink')
      // 大耳朵：一隻往後、一隻往上
      g.line(hx - 2, hy - 2, hx - 4, hy - 4, coat)
      g.px(hx - 3, hy - 3, 'paper')
      g.line(hx - 1, hy - 2, hx - 1, hy - 4, dark)
    }
    if (p.buck && !p.fawn) {
      g.line(hx - 1, hy - 2, hx - 2, hy - 6, 'paper-2')
      g.px(hx - 1, hy - 5, 'paper-2')
    }
  })
}
const DEER = {
  stand: deer({ leg: 0, head: 'up' }),
  walk: [1, 0, -1, 0].map((leg) => deer({ leg, head: 'up' })),
  bow: deer({ leg: 0, head: 'bow' }),
  eat: [deer({ leg: 0, head: 'eat' }), deer({ leg: 1, head: 'eat' })],
  look: deer({ leg: 0, head: 'look' }),
  run: [deer({ leg: 0, head: 'up', run: true }), deer({ leg: 1, head: 'up' }), deer({ leg: 0, head: 'up', run: true }), deer({ leg: -1, head: 'up' })],
}
const BUCK = {
  stand: deer({ leg: 0, head: 'up', buck: true }),
  walk: [1, 0, -1, 0].map((leg) => deer({ leg, head: 'up', buck: true })),
  bow: deer({ leg: 0, head: 'bow', buck: true }),
}
const FAWN = {
  stand: deer({ leg: 0, head: 'up', fawn: true }),
  walk: [1, 0, -1, 0].map((leg) => deer({ leg, head: 'up', fawn: true })),
  look: deer({ leg: 0, head: 'look', fawn: true }),
}
/** 趴著的鹿 */
const DEER_LIE = drawSprite(20, 12, (g) => {
  g.ellipse(9, 8, 6, 3, 'dirt-2')
  g.hline(5, 13, 5, 'wood-2')
  g.rect(3, 6, 2, 3, 'white')
  g.hline(5, 14, 11, 'wood-2')
  g.poly([12, 7, 14, 5, 16, 1, 17, 2, 15, 8], 'dirt-2')
  g.ellipse(16, 2, 2, 2, 'dirt-2')
  g.rect(17, 2, 2, 2, 'dirt-2')
  g.px(19, 2, 'ink')
  g.px(16, 1, 'ink')
  g.px(14, 0, 'dirt-2')
})

/** 鹿仙貝：圓的、淺褐色 */
const SENBEI = drawSprite(7, 7, (g) => {
  g.circle(3, 3, 2, 'wood-1')
  g.px(2, 2, 'dirt-1')
  g.px(4, 4, 'dirt-2')
})

/** 等條件成立，最多 max 秒（不會卡住） */
function* until(s: Stage, cond: () => boolean, max = 15): Script {
  const t0 = s.t
  yield () => cond() || s.t - t0 > max
}

/** 鹿鞠躬，旅人也點頭回禮 */
const BOW_EVENT: EventDef = {
  id: 'nara-bow',
  *run(s) {
    const isBuck = s.rng.chance(0.4)
    const set = isBuck ? BUCK : DEER
    // 鹿從前面慢慢走過來（一秒 14px，不是原地踏步）
    const d = s.spawn({ frames: set.walk, fps: 6, x: s.cam + s.W + 14, y: s.FLOOR + 1, flip: true, vx: -14 })
    yield* until(s, () => d.sx() < s.hero.x + 60, 20)
    d.vx = 0
    s.hero.stop()
    yield* s.move(d, s.hero.worldX + 26, 14)
    d.frames = [set.stand]
    d.frame = 0
    yield 0.6
    for (let i = 0; i < 2; i++) {
      d.frames = [set.bow]
      yield 0.45
      d.frames = [set.stand]
      yield 0.35
    }
    s.hero.emote('surprise', 0.8)
    yield 0.9
    s.hero.jump(3)
    yield 0.5
    d.frames = [set.bow]
    yield 0.45
    d.frames = [set.stand]
    yield 0.3
    s.hero.jump(3)
    yield 0.5
    s.hero.emote('heart', 1.4)
    yield 1.2
    // 鹿走過旅人身後，旅人繼續走
    d.frames = set.walk
    s.hero.walk()
    // 走出畫面就結束
    d.flip = true
    d.vx = -16
    yield () => d.sx() < -20
  },
}

/** 拿出鹿仙貝：鹿群從後面追上來，旅人逃跑，最後還是被搶走 */
const SENBEI_EVENT: EventDef = {
  id: 'nara-senbei',
  *run(s) {
    const hero = s.hero
    try {
      hero.stop()
      yield 0.3
      const cake = s.spawn({ frames: SENBEI, x: hero.x + 4, y: hero.y - 6, space: 'screen', z: 'front' })
      cake.update = (a) => {
        a.x = hero.x + 4
        a.y = hero.y - 6
      }
      hero.emote('note', 1.2)
      yield 1.2
      // 後面來了一群鹿
      const herd: Actor[] = []
      for (let i = 0; i < 4; i++) {
        const set = i === 1 ? BUCK : DEER
        herd.push(s.spawn({ frames: i === 1 ? set.walk : DEER.run, fps: 10, x: s.cam - 16 - i * 22, y: s.FLOOR + 1 - (i % 2) * 3, z: i % 2 ? 'back' : 'front' }))
      }
      // 鹿比旅人跑得快一點
      let caught = false
      for (const [i, d] of herd.entries())
        d.update = (a, dt) => {
          const target = hero.worldX - 14 - i * 13
          if (a.x < target) a.x = Math.min(target, a.x + (caught ? 30 : 56 + i * 2) * dt)
        }
      yield* until(s, () => herd[0]!.sx() > 12, 4)
      hero.face('left')
      hero.emote('surprise', 0.9)
      hero.jump(6)
      yield 0.8
      hero.face('right')
      hero.speed = 2
      hero.walk()
      hero.emote('sweat', 4)
      yield* until(s, () => herd[0]!.x >= hero.worldX - 15, 12)
      caught = true
      hero.stop()
      hero.speed = 1
      hero.face('left')
      cake.remove()
      herd[0]!.frames = DEER.eat
      herd[0]!.fps = 4
      hero.emote('dots', 1.6)
      yield 0.5
      for (const d of herd.slice(1)) {
        d.frames = [DEER.bow]
        d.fps = 0
      }
      yield 1.6
      for (const d of herd.slice(1)) d.frames = [DEER.stand]
      hero.emote('sweat', 1.2)
      yield 1.2
      hero.face('right')
      hero.walk()
      for (const d of herd) {
        d.update = undefined
        d.frames = DEER.eat
        d.fps = 3
      }
      yield* until(s, () => herd.every((d) => d.sx() < -16), 20)
    } finally {
      hero.face('right')
      hero.speed = 1
    }
  },
}

/** 仔鹿跟著旅人走一段，鹿媽媽在前面等 */
const FAWN_EVENT: EventDef = {
  id: 'nara-fawn',
  when: { season: ['spring', 'summer'] },
  *run(s) {
    const hero = s.hero
    const y = s.FLOOR - 2
    const f = s.spawn({ frames: [FAWN.stand], fps: 8, x: s.cam - 12, y })
    // 從後面小跑步追上來
    f.frames = FAWN.walk
    let follow = true
    f.update = (a, dt) => {
      if (!follow) return
      const target = hero.worldX - 18
      const v = a.x < target - 2 ? 60 : hero.walking ? 22 * hero.speed : 0
      a.x = Math.min(target, a.x + v * dt)
      a.fps = v > 0 ? (v > 30 ? 12 : 7) : 0
      if (v === 0) a.frame = 0
    }
    yield* until(s, () => f.x >= hero.worldX - 19, 8)
    hero.stop()
    hero.face('left')
    hero.emote('heart', 1.4)
    f.frames = [FAWN.look]
    yield 1.6
    f.frames = FAWN.walk
    hero.face('right')
    hero.walk()
    yield 2.5
    // 小跳一下
    f.vy = -50
    f.gravity = 300
    yield () => f.vy > 0 && f.y >= y
    f.vy = f.gravity = 0
    f.y = y
    yield 2.5
    // 前面鹿媽媽在等
    const mom = s.spawn({ frames: [DEER.look], fps: 0, x: s.cam + s.W + 14, y: s.FLOOR + 1 - 4 })
    yield* until(s, () => mom.sx() < hero.x + 50, 15)
    hero.stop()
    mom.frames = [DEER.stand]
    mom.flip = true
    hero.emote('note', 1.4)
    yield 0.6
    follow = false
    f.fps = 12
    yield* s.move(f, mom.x - 14, 44)
    f.frames = [FAWN.stand]
    f.fps = 0
    f.frame = 0
    yield 0.5
    mom.frames = [DEER.bow]
    yield 0.6
    mom.frames = [DEER.stand]
    yield 0.6
    hero.walk()
    mom.frames = DEER.eat
    mom.fps = 3
    yield* until(s, () => mom.sx() < -16, 20)
  },
}

/** 抖色的圓（燈的光暈） */
function glow(g: Gfx, x: number, y: number, r: number, k: Px, level: number) {
  if (level <= 0) return
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, (r + 0.5) * (r + 0.5) - dy * dy)))
    g.dither(x - dx, y + dy, dx * 2 + 1, 1, k, level)
  }
}

/** 萬燈籠：天黑之後，石燈籠與釣燈籠由近到遠一盞盞亮起來 */
const MANTORO_EVENT: EventDef = {
  id: 'nara-mantoro',
  kind: 'ambient',
  when: { time: ['dusk', 'night'] },
  *run(s) {
    const x0 = s.cam
    let fade = 16
    s.paint('back', (g, t) => {
      const reach = x0 + t * 70
      for (const l of LAMPS) {
        const sx = l.x - s.cam
        if (sx < -8 || sx > s.W + 8 || l.x > reach) continue
        const age = Math.min(1, (reach - l.x) / 60)
        const lv = Math.round(Math.min(fade, age * 16))
        if (lv <= 0) continue
        const r = Math.round(1 + 3 * l.s)
        glow(g, sx, l.y, r + 2, 'lamp-2', Math.round(lv / 8))
        glow(g, sx, l.y, r, 'lamp-2', Math.round(lv / 3))
        g.rect(sx - Math.max(1, Math.round(l.s)), l.y - 1, Math.max(2, Math.round(l.s * 2)) + 1, 3, 'lamp-1')
      }
    })
    yield 22
    for (let i = 16; i >= 0; i--) {
      fade = i
      yield 0.12
    }
  },
}

export const NARA: AreaDef = {
  id: 'nara',
  name: '奈良',
  romaji: 'NARA',
  tags: ['town', 'shrine', 'deer', 'nature'],
  length: 1400,
  sky: (g, env, r) => skyBase(g, env, r, 106),
  layers: [
    { speed: 0.12, draw: hills },
    { speed: 0.4, draw: temples },
  ],
  ground: { speed: 1, draw: park },
  front: { speed: 1.3, draw: front },
  events: [BOW_EVENT, SENBEI_EVENT, FAWN_EVENT, MANTORO_EVENT],
}
