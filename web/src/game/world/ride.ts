import { Gfx } from '../../services/pixelwalk/gfx'
import type { Px } from '../../services/pixelwalk/palette'

import type { Season, TimeOfDay } from '../engine/types'

import { foliage, hash2, leafTones } from './kits/draw'
import type { Kit, TravelMode } from './types'

/**
 * 坐車的畫面（規格 §8.2、§12）：剪票口選好目的地 → 淡出 → 2–3 秒的車窗（窗外的風景往後捲）→ 到站。
 * 電車、單軌、巴士、飛機、渡輪各一種窗；窗外照目的地的地方 kit（近畿：山、町家、田、電線桿；沖繩：海、甘蔗、椰子；
 * 關東：從高架看出去的大樓、遠方的高樓群、架線柱；北海道：遠山、田與牧場、白樺與針葉林、冬天是雪原）、
 * 時段（天空直接選色，燈不變暗）與季節。新幹線的那一段（shinkansen）是另一種車廂：圓角的小窗、一排一排的椅背、行李架。
 * 飛機往關東、北海道時窗下是陸地（街道的格子、田的拼布），近畿、沖繩照舊是海。整個畫面由 game.setOverlay 疊上去（不進 snapshot）。
 */
export interface RideScene {
  mode: TravelMode
  kit: Kit
  time: TimeOfDay
  season: Season
  /** 這一段搭新幹線（Leg.shinkansen）：車廂畫新幹線的樣子 */
  shinkansen?: boolean
}

/** 天空的三段（不跟著時段混色：直接選） */
function skyOf(time: TimeOfDay): [Px, Px, Px] {
  if (time === 'night') return ['sky-night-1', 'sky-night-2', 'sky-night-3']
  if (time === 'dusk') return ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3']
  return ['sky-day-1', 'sky-day-2', 'sky-day-3']
}

/** 往後捲：位置 i×span 的東西現在在哪（每 span px 一個，捲 speed 倍） */
const wrap = (v: number, m: number) => ((v % m) + m) % m

/** 關東：從高架上看出去。遠方的高樓群（夜裡零星亮燈）、中景的大樓與公寓（窗格）、近景的架線柱與護欄 */
function cityScenery(g: Gfx, s: RideScene, x0: number, y0: number, w: number, h: number, scroll: number) {
  const night = s.time === 'night'
  const late = s.time !== 'day'
  const horizon = y0 + Math.round(h * 0.62)
  // 遠方的高樓群（捲得慢）
  for (let i = -1; i < Math.ceil(w / 14) + 2; i++) {
    const k = i + Math.floor((scroll * 0.12) / 14)
    const xx = x0 + i * 14 - wrap(scroll * 0.12, 14)
    const bh = 10 + (hash2(k, 3) % 18)
    const bw = 8 + (hash2(k, 5) % 6)
    g.rect(xx, horizon - bh, bw, bh, night ? 'sky-night-3' : late ? 'sky-dusk-1' : 'stone-1')
    g.vline(xx + bw - 1, horizon - bh, horizon - 1, night ? 'sky-night-2' : late ? 'sky-dusk-1' : 'stone-2')
    if (late) for (let yy = horizon - bh + 2; yy < horizon - 1; yy += 3) for (let xxx = xx + 1; xxx < xx + bw - 1; xxx += 2) if (hash2(xxx, yy, k) % 4 === 0) g.px(xxx, yy, 'lamp-1')
    if (hash2(k, 7) % 5 === 0) g.px(xx + (bw >> 1), horizon - bh - 1, late ? 'lamp-3' : 'stone-3')
  }
  g.rect(x0, horizon, w, y0 + h - horizon, night ? 'roof-3' : 'stone-2')
  // 中景：一棟一棟的大樓（窗格，捲得中等）
  const span = 26
  for (let i = -1; i < Math.ceil(w / span) + 2; i++) {
    const k = i + Math.floor((scroll * 0.55) / span)
    const xx = x0 + i * span - wrap(scroll * 0.55, span)
    const bh = 18 + (hash2(k, 11) % 14)
    const top = horizon + 8 - bh
    const body: Px = (['paper', 'sand-1', 'stone-1', 'paper-2'] as const)[hash2(k, 13) % 4]!
    g.rect(xx + 1, top, span - 4, y0 + h - top, 'ink-2')
    g.rect(xx + 2, top + 1, span - 6, y0 + h - top - 1, body)
    for (let yy = top + 3; yy < y0 + h - 2; yy += 5)
      for (let xxx = xx + 4; xxx < xx + span - 6; xxx += 5) g.rect(xxx, yy, 3, 2, late ? (hash2(xxx, yy, k) % 3 ? 'lamp-1' : 'roof-3') : 'sky-day-2')
    if (hash2(k, 17) % 3 === 0) g.rect(xx + span - 6, top + 2, 2, 8, late ? 'neon-1' : 'shu-1')
  }
  // 近景：高架的護欄（窗的下緣）與架線柱（很快）
  g.rect(x0, y0 + h - 8, w, 8, 'stone-1')
  g.hline(x0, x0 + w - 1, y0 + h - 8, 'white')
  for (let xx = x0 - wrap(scroll * 1.8, 16); xx < x0 + w; xx += 16) g.vline(xx, y0 + h - 7, y0 + h - 1, 'stone-2')
  const near = wrap(scroll * 1.8, 110)
  for (let xx = x0 - near; xx < x0 + w + 110; xx += 110) {
    g.rect(xx, y0, 3, h, 'stone-3')
    g.vline(xx, y0, y0 + h - 1, 'stone-2')
    g.rect(xx - 6, y0 + 4, 15, 2, 'stone-3')
  }
  g.hline(x0, x0 + w - 1, y0 + 3, 'ink-2')
}

/** 北海道：遠山（冬天、秋天山頂白）、一大片田或雪原、白樺與針葉林、紅屋頂的牧舍與筒倉、近景的白樺與防雪柵 */
function northScenery(g: Gfx, s: RideScene, x0: number, y0: number, w: number, h: number, scroll: number) {
  const winter = s.season === 'winter'
  const night = s.time === 'night'
  const horizon = y0 + Math.round(h * 0.5)
  // 遠山（捲得很慢）
  for (let x = 0; x < w; x++) {
    const t = (x + scroll * 0.08) / 40
    const hh = Math.round(14 + Math.sin(t) * 6 + Math.sin(t * 2.7) * 3)
    g.vline(x0 + x, horizon - hh, horizon, night ? 'sky-night-3' : 'stone-2')
    if (winter || s.season === 'autumn') for (let k = 0; k < (winter ? 6 : 3); k++) g.px(x0 + x, horizon - hh + k, night ? 'stone-2' : 'snow-1')
  }
  const ground: Px = winter ? 'snow-1' : s.season === 'summer' ? 'leaf-2' : s.season === 'autumn' ? 'gold-1' : 'leaf-1'
  g.rect(x0, horizon, w, y0 + h - horizon, ground)
  // 田的分界（一條一條往後捲的畦）
  for (let i = 0; i < 6; i++) {
    const yy = horizon + 3 + i * 4
    if (yy >= y0 + h) break
    for (let xx = x0 - wrap(scroll * (0.3 + i * 0.12), 9); xx < x0 + w; xx += 9) g.hline(xx, xx + 4, yy, winter ? 'snow-2' : s.season === 'summer' ? 'leaf-3' : 'gold-2')
  }
  // 遠一點的林（針葉林是深綠的鋸齒，冬天上面有雪）
  for (let x = 0; x < w; x++) {
    const k = Math.floor((x + scroll * 0.25) / 5)
    if (hash2(k, 21) % 7 > 2) continue
    const hh = 4 + (hash2(k, 23) % 4)
    g.vline(x0 + x, horizon - hh + ((x + k) % 2), horizon + 1, 'leaf-4')
    if (winter && (x + k) % 3 === 0) g.px(x0 + x, horizon - hh + 1, 'snow-1')
  }
  // 中景：牧舍、筒倉、彩色鐵皮屋頂的房子
  const span = 70
  for (let i = -1; i < Math.ceil(w / span) + 2; i++) {
    const k = i + Math.floor((scroll * 0.5) / span)
    const xx = x0 + i * span - wrap(scroll * 0.5, span)
    if (hash2(k, 31) % 3 === 0) continue
    const by = horizon + 4
    const roof: Px = (['shu-2', 'leaf-3', 'cloth-2'] as const)[hash2(k, 33) % 3]!
    g.rect(xx + 6, by + 4, 14, 8, hash2(k, 35) % 2 ? 'shu-2' : 'paper')
    g.poly([xx + 4, by + 5, xx + 13, by - 1, xx + 22, by + 5], winter ? 'snow-1' : roof)
    g.rect(xx + 11, by + 7, 3, 3, night ? 'lamp-1' : 'sky-day-2')
    if (hash2(k, 37) % 2) {
      g.rect(xx + 24, by - 4, 5, 16, 'kawara-2')
      g.ellipse(xx + 26, by - 4, 2, 2, winter ? 'snow-1' : 'stone-2')
    }
  }
  // 近景：白樺（白的樹幹、黑的橫紋）與防雪柵（很快）
  const near = wrap(scroll * 1.7, 95)
  for (let xx = x0 - near; xx < x0 + w + 95; xx += 95) {
    g.rect(xx, y0 + 6, 3, h - 6, 'white')
    for (let yy = y0 + 10; yy < y0 + h; yy += 7) g.hline(xx, xx + 1, yy, 'ink-2')
    if (!winter) foliage(g, xx + 1, y0 + 8, 7, 6, s.season === 'autumn' ? { line: 'gold-2', dark: 'gold-2', mid: 'gold-1', light: 'sand-1' } : leafTones(s.season, 'hokkaido'), 3)
    else {
      g.line(xx + 1, y0 + 14, xx - 6, y0 + 6, 'stone-2')
      g.line(xx + 1, y0 + 12, xx + 8, y0 + 4, 'stone-2')
    }
  }
  if (winter) {
    // 防雪柵（板子一片一片的）
    for (let xx = x0 - wrap(scroll * 1.4, 6); xx < x0 + w; xx += 6) g.rect(xx, y0 + h - 9, 4, 9, 'stone-3')
    g.hline(x0, x0 + w - 1, y0 + h - 9, 'snow-1')
    // 雪花（窗外飄）
    for (let i = 0; i < 18; i++) g.px(x0 + wrap(hash2(i, 41) - scroll * 0.9, w), y0 + wrap(hash2(i, 43) + scroll * 0.35, h), 'white')
  }
}

/** 窗外的風景：x 是往後捲的距離（px），畫在 (x0, y0) 起的 w×h */
function scenery(g: Gfx, s: RideScene, x0: number, y0: number, w: number, h: number, scroll: number) {
  const [s1, s2, s3] = skyOf(s.time)
  if (s.kit === 'kanto' || s.kit === 'hokkaido') {
    g.bands(y0, Math.round(h * 0.62), [s1, s2, s3], x0, w)
    if (s.time === 'night') for (let i = 0; i < 12; i++) g.px(x0 + ((hash2(i, 3) % w) + Math.floor(scroll * 0.05)) % w, y0 + (hash2(i, 9) % Math.round(h * 0.35)), 'star')
    if (s.kit === 'kanto') cityScenery(g, s, x0, y0, w, h, scroll)
    else northScenery(g, s, x0, y0, w, h, scroll)
    return
  }
  g.bands(y0, Math.round(h * 0.55), [s1, s2, s3], x0, w)
  if (s.time === 'night') for (let i = 0; i < 12; i++) g.px(x0 + ((hash2(i, 3) % w) + Math.floor(scroll * 0.05)) % w, y0 + (hash2(i, 9) % Math.round(h * 0.4)), 'star')
  const horizon = y0 + Math.round(h * 0.55)
  if (s.kit === 'okinawa') {
    // 海與島影
    g.rect(x0, horizon, w, h - (horizon - y0), 'sea-1')
    g.dither(x0, horizon, w, 4, 'sea-2', 8)
    for (let i = 0; i < 8; i++) {
      const xx = x0 + ((((i * 53 - scroll * 0.4) % w) + w) % w)
      g.hline(xx, xx + 5, horizon + 6 + (i % 3) * 5, 'foam')
    }
    const ix = x0 + ((((120 - scroll * 0.15) % (w + 80)) + w + 80) % (w + 80)) - 40
    g.ellipse(ix, horizon, 24, 5, 'leaf-3')
    // 近一點是岸邊（沙、草）：中景的房子站在地上，不浮在海上
    const shore = horizon + 12
    g.rect(x0, shore, w, y0 + h - shore, 'leaf-2')
    g.hline(x0, x0 + w - 1, shore, 'sand-2')
    g.hline(x0, x0 + w - 1, shore + 1, 'sand-1')
  } else {
    // 遠山
    for (let x = 0; x < w; x++) {
      const t = (x + scroll * 0.15) / 30
      const hh = Math.round(10 + Math.sin(t) * 5 + Math.sin(t * 2.3) * 3)
      g.vline(x0 + x, horizon - hh, horizon, s.season === 'winter' ? 'stone-2' : 'leaf-3')
      if (s.season === 'winter') g.px(x0 + x, horizon - hh, 'snow-1')
    }
    g.rect(x0, horizon, w, h - (horizon - y0), s.season === 'autumn' ? 'gold-2' : s.season === 'winter' ? 'dirt-1' : 'leaf-2')
  }
  // 中景：房子與樹（捲得比較快）
  const mid = horizon + 2
  for (let i = -1; i < Math.ceil(w / 28) + 1; i++) {
    const off = (((scroll * 0.6) % 28) + 28) % 28
    const xx = x0 + i * 28 - off
    const k = hash2(i + Math.floor((scroll * 0.6) / 28), 7) % 4
    if (k === 0 || k === 1) {
      const roof: Px = s.kit === 'okinawa' ? 'kawara-2' : 'roof-2'
      g.rect(xx + 4, mid + 4, 14, 8, s.kit === 'okinawa' ? 'white' : 'paper')
      g.rect(xx + 2, mid, 18, 5, roof)
      g.rect(xx + 8, mid + 6, 3, 3, s.time === 'night' ? 'lamp-1' : 'sky-day-2')
    } else if (k === 2) foliage(g, xx + 10, mid + 4, 6, 5, leafTones(s.season, s.kit), i)
  }
  // 近景：電線桿、椰子（很快）
  const near = (((scroll * 1.8) % 90) + 90) % 90
  for (let xx = x0 - near; xx < x0 + w + 90; xx += 90) {
    if (s.kit === 'okinawa') {
      g.vline(xx, y0 + Math.round(h * 0.25), y0 + h, 'wood-2')
      g.line(xx, y0 + Math.round(h * 0.25), xx - 8, y0 + Math.round(h * 0.3), 'leaf-3')
      g.line(xx, y0 + Math.round(h * 0.25), xx + 8, y0 + Math.round(h * 0.3), 'leaf-3')
    } else {
      g.rect(xx, y0, 2, h, 'wood-3')
      g.hline(xx - 3, xx + 4, y0 + 4, 'wood-3')
    }
  }
}

/**
 * 畫面比 GBA 高（直拿的手機，邏輯高 160–256）時多出來的高度：車廂與飛機放在中間（上面是天花板、下面是地板），
 * 渡輪把多的高度給天空。高 160 時是 0，跟原本一樣。
 */
const extra = (g: Gfx) => Math.max(0, g.h - 160)

/** 車廂（電車、單軌、巴士）：牆、大窗、吊環、座椅；畫面高的時候天花板與地板跟著變高 */
function cabin(g: Gfx, s: RideScene, t: number) {
  const W = g.w
  const H = g.h
  const oy = Math.floor(extra(g) / 2)
  const scroll = t * (s.mode === 'bus' ? 70 : s.mode === 'monorail' ? 90 : 140)
  g.rect(0, 0, W, H, s.mode === 'bus' ? 'paper-2' : 'stone-1')
  g.rect(0, 0, W, 14 + oy, 'stone-2')
  g.hline(0, W - 1, 14 + oy, 'stone-3')
  // 天花板的燈（畫面高、天花板寬的時候）
  if (oy >= 12) for (let x = 20; x + 40 < W; x += 72) g.dither(x, Math.floor(oy / 2) + 2, 40, 3, 'white', 2)
  // 吊環
  if (s.mode !== 'bus') {
    g.hline(0, W - 1, 18 + oy, 'stone-3')
    for (let x = 16; x < W; x += 32) {
      g.vline(x, 18 + oy, 26 + oy, 'stone-3')
      g.ring(x, 29 + oy, 3, 'stone-4')
    }
  }
  const wy = 36 + oy
  const wh = 64
  const ww = W - 24
  const wall: Px = s.mode === 'bus' ? 'paper-2' : 'stone-1'
  g.rect(10, wy - 2, ww + 4, wh + 4, 'stone-4')
  // 窗框裡的風景（單軌是從高處看下去）
  scenery(g, s, 12, wy, ww, wh, scroll)
  // 捲到窗外的房子、電線桿蓋回車廂的牆與窗框（Gfx 沒有裁切）
  g.rect(0, wy - 2, 10, wh + 4, wall)
  g.rect(12 + ww + 2, wy - 2, W - (12 + ww + 2), wh + 4, wall)
  g.rect(10, wy - 2, 2, wh + 4, 'stone-4')
  g.rect(12 + ww, wy - 2, 2, wh + 4, 'stone-4')
  for (let x = 12 + Math.floor(ww / 3); x < 12 + ww; x += Math.floor(ww / 3)) g.rect(x - 1, wy, 3, wh, 'stone-4')
  g.dither(12, wy, ww, 3, 'white', 4)
  // 座椅（高 160 時一直到畫面底）
  const sy = wy + wh + 6
  const floor = Math.min(H, 160 + oy)
  g.rect(0, sy, W, floor - sy, s.mode === 'bus' ? 'stone-3' : 'cloth-2')
  g.rect(0, sy, W, 6, s.mode === 'bus' ? 'stone-2' : 'cloth-1')
  for (let x = 0; x < W; x += 24) g.vline(x, sy, floor - 1, s.mode === 'bus' ? 'stone-4' : 'roof-3')
  // 地板
  if (floor < H) {
    const [base, dot]: [Px, Px] = s.mode === 'bus' ? ['stone-4', 'ink-2'] : ['stone-3', 'stone-4']
    g.rect(0, floor, W, H - floor, base)
    g.hline(0, W - 1, floor, dot)
    g.dither(0, floor + 2, W, H - floor - 2, dot, 8)
  }
  // 車身輕輕晃
  if (Math.floor(t * 4) % 2 === 0) g.hline(0, W - 1, H - 1, 'ink-2')
}

/**
 * 新幹線的車廂：灰藍的牆、行李架、兩扇圓角的小窗（窗外照目的地的風景，捲得很快）、前面一排一排的椅背（白的頭枕套）。
 * 畫面高的時候天花板與地板跟著變高。
 */
function shinkansen(g: Gfx, s: RideScene, t: number) {
  const W = g.w
  const H = g.h
  const oy = Math.floor(extra(g) / 2)
  const scroll = t * 230
  g.rect(0, 0, W, H, 'paper')
  g.rect(0, 0, W, 16 + oy, 'stone-1')
  g.hline(0, W - 1, 16 + oy, 'stone-2')
  if (oy >= 12) for (let x = 12; x + 50 < W; x += 80) g.dither(x, Math.floor(oy / 2) + 3, 50, 3, 'white', 3)
  // 行李架
  g.rect(0, 20 + oy, W, 5, 'stone-2')
  g.hline(0, W - 1, 20 + oy, 'white')
  for (let x = 3; x < W; x += 5) g.vline(x, 21 + oy, 24 + oy, 'stone-1')
  g.hline(0, W - 1, 25 + oy, 'stone-3')
  // 牆（窗的高度有一條藍的線）
  const wy = 34 + oy
  const wh = 54
  g.rect(0, wy - 6, W, wh + 12, 'paper')
  g.hline(0, W - 1, wy + wh + 4, 'cloth-1')
  g.hline(0, W - 1, wy + wh + 5, 'cloth-2')
  const ww = Math.floor((W - 36) / 2)
  for (const x of [12, 24 + ww]) {
    // 每扇窗的風景先畫在自己的小畫布上再貼過來（不會畫到另一扇窗）
    const pane = new Gfx(ww, wh, g.pal)
    scenery(pane, s, 0, 0, ww, wh, scroll + x * 3)
    g.blit(pane, 0, 0, ww, wh, x, wy, true)
    // 圓角的窗框：四角蓋回牆的顏色，再描一圈
    for (const [cx, cy] of [[x, wy], [x + ww - 3, wy], [x, wy + wh - 3], [x + ww - 3, wy + wh - 3]] as const) {
      g.rect(cx, cy, 3, 3, 'paper')
    }
    g.hline(x + 3, x + ww - 4, wy - 1, 'stone-3')
    g.hline(x + 3, x + ww - 4, wy + wh, 'stone-3')
    g.vline(x - 1, wy + 3, wy + wh - 4, 'stone-3')
    g.vline(x + ww, wy + 3, wy + wh - 4, 'stone-3')
    for (const [cx, cy] of [[x, wy + 2], [x + 1, wy + 1], [x + 2, wy], [x + ww - 1, wy + 2], [x + ww - 2, wy + 1], [x + ww - 3, wy], [x, wy + wh - 3], [x + 1, wy + wh - 2], [x + 2, wy + wh - 1], [x + ww - 1, wy + wh - 3], [x + ww - 2, wy + wh - 2], [x + ww - 3, wy + wh - 1]] as const) g.px(cx, cy, 'stone-3')
    g.dither(x, wy, ww, 3, 'white', 4)
  }
  // 窗之外（風景捲出窗框的部分）蓋回牆
  g.rect(0, wy - 2, 11, wh + 4, 'paper')
  g.rect(13 + ww, wy - 2, 10, wh + 4, 'paper')
  g.rect(25 + ww * 2, wy - 2, W - (25 + ww * 2), wh + 4, 'paper')
  g.vline(11, wy + 3, wy + wh - 4, 'stone-3')
  // 前面的椅背（兩個一組、圓的肩、白的頭枕套、扶手），組與組之間看得到地板
  const sy = wy + wh + 10
  const floor = Math.min(H, 160 + oy)
  g.rect(0, sy + 4, W, floor - sy - 4, 'stone-3')
  g.dither(0, sy + 4, W, floor - sy - 4, 'stone-4', 4)
  for (let x = -8; x < W; x += 44) {
    for (const sx of [x, x + 18]) {
      g.rect(sx, sy + 1, 17, floor - sy - 1, 'ink-2')
      g.rect(sx + 1, sy, 15, floor - sy, 'ink-2')
      g.rect(sx + 1, sy + 1, 15, floor - sy - 1, 'cloth-1')
      g.vline(sx + 14, sy + 2, floor - 1, 'cloth-2')
      g.vline(sx + 15, sy + 2, floor - 1, 'cloth-2')
      g.hline(sx + 2, sx + 13, sy + 1, 'sky-day-1')
      // 頭枕套
      g.rect(sx + 3, sy - 1, 11, 6, 'white')
      g.hline(sx + 3, sx + 13, sy + 5, 'stone-1')
      g.px(sx + 3, sy - 1, 'paper')
      g.px(sx + 13, sy - 1, 'paper')
    }
    g.rect(x + 16, sy + 8, 3, floor - sy - 8, 'stone-2')
  }
  if (floor < H) {
    g.rect(0, floor, W, H - floor, 'stone-3')
    g.hline(0, W - 1, floor, 'stone-4')
    g.dither(0, floor + 2, W, H - floor - 2, 'stone-4', 6)
  }
  // 很穩，偶爾一點點晃
  if (Math.floor(t * 2) % 3 === 0) g.hline(0, W - 1, H - 1, 'ink-2')
}

/** 飛機：圓角的小窗、雲往後飄、下面是海 */
function plane(g: Gfx, s: RideScene, t: number) {
  const W = g.w
  const H = g.h
  g.rect(0, 0, W, H, 'paper')
  g.dither(0, 0, W, H, 'paper-2', 4)
  const oy = Math.floor(extra(g) / 2)
  const cx = Math.round(W / 2)
  const cy = 78 + oy
  const rx = 52
  const ry = 50
  const [s1, s2, s3] = skyOf(s.time)
  for (let y = -ry; y <= ry; y++) {
    const k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5))
    const dx = Math.floor((rx + 0.5) * Math.sqrt(Math.max(0, k)))
    g.hline(cx - dx - 3, cx + dx + 3, cy + y, 'stone-2')
  }
  for (let y = -ry + 4; y <= ry - 4; y++) {
    const k = 1 - (y * y) / ((ry - 3.5) * (ry - 3.5))
    const dx = Math.floor((rx - 3.5) * Math.sqrt(Math.max(0, k)))
    const yy = cy + y
    const land = s.kit === 'kanto' || s.kit === 'hokkaido'
    const band = yy < cy - 10 ? s1 : yy < cy + 6 ? s2 : yy < cy + 18 ? s3 : land ? groundBelow(s) : 'sea-2'
    g.hline(cx - dx, cx + dx, yy, band)
    if (yy >= cy + 18 && !land) for (let x = cx - dx; x <= cx + dx; x++) if (hash2(x + Math.floor(t * 30), yy, 5) % 23 === 0) g.px(x, yy, 'sea-1')
    if (yy >= cy + 18 && land) for (let x = cx - dx; x <= cx + dx; x++) {
      // 從上面看的地面：關東是街道的格子（夜裡是燈）、北海道是一塊一塊的田（冬天白、林是深色的）
      const gx = x + Math.floor(t * 30)
      if (s.kit === 'kanto') {
        if (gx % 7 === 0 || yy % 5 === 0) g.px(x, yy, s.time === 'night' ? 'lamp-2' : 'stone-3')
        else if (hash2(gx >> 2, yy >> 2, 9) % 6 === 0) g.px(x, yy, s.time === 'night' ? 'lamp-1' : 'paper')
      } else {
        const k = hash2(Math.floor(gx / 9), Math.floor(yy / 5), 13) % 4
        const patch: Px = s.season === 'winter' ? (k === 0 ? 'leaf-4' : 'snow-1') : (['leaf-2', 'gold-1', 'leaf-3', 'dirt-1'] as const)[k]!
        g.px(x, yy, gx % 9 === 0 ? (s.season === 'winter' ? 'snow-2' : 'leaf-4') : patch)
      }
    }
  }
  // 雲（整朵在窗裡才畫：Gfx 沒有裁切，窗是橢圓，越上下越窄）
  for (let i = 0; i < 5; i++) {
    const x = cx - rx + ((((i * 41 - t * 60) % (rx * 2 + 40)) + rx * 2 + 40) % (rx * 2 + 40)) - 20
    const y = cy - 24 + i * 9
    const half = (yy: number) => (rx - 3.5) * Math.sqrt(Math.max(0, 1 - ((yy - cy) * (yy - cy)) / ((ry - 3.5) * (ry - 3.5))))
    const room = Math.min(half(y - 5), half(y + 3))
    if (x - 10 < cx - room || x + 12 > cx + room) continue
    g.ellipse(x, y, 10, 3, 'cloud-1')
    g.ellipse(x + 6, y - 2, 6, 3, 'cloud-1')
    g.hline(x - 8, x + 8, y + 3, 'cloud-2')
  }
  g.hline(0, W - 1, 140 + oy, 'stone-2')
}

/** 飛機下面的地面的底色（關東、北海道） */
function groundBelow(s: RideScene): Px {
  if (s.kit === 'kanto') return s.time === 'night' ? 'roof-3' : 'stone-2'
  return s.season === 'winter' ? 'snow-1' : 'leaf-2'
}

/** 渡輪：甲板的欄杆、海浪、遠方的島（畫面高的時候天空變高） */
function ferry(g: Gfx, s: RideScene, t: number) {
  const W = g.w
  const H = g.h
  const dy = extra(g)
  const sea = 70 + dy
  const [s1, s2, s3] = skyOf(s.time)
  g.bands(0, sea, [s1, s2, s3])
  g.rect(0, sea, W, H - sea, 'sea-2')
  g.dither(0, sea, W, 6, 'sea-1', 8)
  for (let i = 0; i < 16; i++) {
    const x = ((((i * 37 - t * 50) % (W + 20)) + W + 20) % (W + 20)) - 10
    g.hline(x, x + 6, sea + 10 + (i % 5) * 12, i % 2 ? 'foam' : 'sea-1')
  }
  const ix = ((((W - t * 12) % (W + 120)) + W + 120) % (W + 120)) - 60
  g.ellipse(ix, sea, 30, 6, 'leaf-3')
  g.hline(ix - 30, ix + 30, sea, 'leaf-4')
  // 欄杆與甲板
  const deck = 118 + dy
  g.rect(0, deck, W, H - deck, 'white')
  g.rect(0, deck, W, 3, 'stone-2')
  for (let x = 4; x < W; x += 12) g.rect(x, deck - 14, 2, 14, 'white')
  g.rect(0, deck - 16, W, 3, 'white')
  g.hline(0, W - 1, deck - 13, 'stone-2')
}

/** game.setOverlay 用：每格畫一次（t 是 game 的動畫秒數；第一次畫的時候當作 0） */
export function rideOverlay(scene: RideScene) {
  let start = -1
  return (g: Gfx, t: number) => {
    if (start < 0) start = t
    const tt = Math.max(0, t - start)
    if (scene.mode === 'plane') plane(g, scene, tt)
    else if (scene.mode === 'ferry') ferry(g, scene, tt)
    else if (scene.shinkansen && scene.mode === 'rail') shinkansen(g, scene, tt)
    else cabin(g, scene, tt)
  }
}

/** 出發、到站的效果音（audio 的 SfxName） */
export const DEPART_SFX: Record<TravelMode, string> = { rail: 'trainDepart', monorail: 'trainDepart', bus: 'bus', plane: 'plane', ferry: 'ferry' }
export const ARRIVE_SFX: Record<TravelMode, string> = { rail: 'trainArrive', monorail: 'trainArrive', bus: 'bus', plane: 'door', ferry: 'ferry' }
