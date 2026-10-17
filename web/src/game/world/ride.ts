import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Px } from '../../services/pixelwalk/palette'

import type { Season, TimeOfDay } from '../engine/types'

import { foliage, hash2, leafTones } from './kits/draw'
import type { Kit, TravelMode } from './types'

/**
 * 坐車的畫面（規格 §8.2）：剪票口選好目的地 → 淡出 → 2–3 秒的車窗（窗外的風景往後捲）→ 到站。
 * 電車、單軌、巴士、飛機、渡輪各一種窗；窗外照目的地的地方 kit（近畿：山、町家、田、電線桿；沖繩：海、甘蔗、椰子）、
 * 時段（天空直接選色，燈不變暗）與季節。整個畫面由 game.setOverlay 疊上去（不進 snapshot）。
 */
export interface RideScene {
  mode: TravelMode
  kit: Kit
  time: TimeOfDay
  season: Season
}

/** 天空的三段（不跟著時段混色：直接選） */
function skyOf(time: TimeOfDay): [Px, Px, Px] {
  if (time === 'night') return ['sky-night-1', 'sky-night-2', 'sky-night-3']
  if (time === 'dusk') return ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3']
  return ['sky-day-1', 'sky-day-2', 'sky-day-3']
}

/** 窗外的風景：x 是往後捲的距離（px），畫在 (x0, y0) 起的 w×h */
function scenery(g: Gfx, s: RideScene, x0: number, y0: number, w: number, h: number, scroll: number) {
  const [s1, s2, s3] = skyOf(s.time)
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
    const band = yy < cy - 10 ? s1 : yy < cy + 6 ? s2 : yy < cy + 18 ? s3 : 'sea-2'
    g.hline(cx - dx, cx + dx, yy, band)
    if (yy >= cy + 18) for (let x = cx - dx; x <= cx + dx; x++) if (hash2(x + Math.floor(t * 30), yy, 5) % 23 === 0) g.px(x, yy, 'sea-1')
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
    else cabin(g, scene, tt)
  }
}

/** 出發、到站的效果音（audio 的 SfxName） */
export const DEPART_SFX: Record<TravelMode, string> = { rail: 'trainDepart', monorail: 'trainDepart', bus: 'bus', plane: 'plane', ferry: 'ferry' }
export const ARRIVE_SFX: Record<TravelMode, string> = { rail: 'trainArrive', monorail: 'trainArrive', bus: 'bus', plane: 'door', ferry: 'ferry' }
