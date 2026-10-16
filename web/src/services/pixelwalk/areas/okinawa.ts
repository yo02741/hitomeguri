import { drawSprite, mirrored } from '../build'
import type { Gfx } from '../gfx'
import { cloud, isNight } from '../kit'
import type { Px } from '../palette'
import { rng as makeRng, type Rng } from '../rng'
import { type AreaDef, type Env, type EventDef, FLOOR, H, type Stage } from '../types'

/**
 * 沖繩：翡翠綠到深藍的海、水平線上平平的離島與礁湖的白浪；中景是海邊的村子（紅瓦屋頂上坐著風獅爺、珊瑚石牆、福木、芭蕉、甘蔗田），
 * 地面是白沙路，路旁扶桑花、椰子樹、石牆圍起來的老房子，偶爾經過守禮門。不下雪（沒有冬天）。
 * 層：海與天空（不動）、離島與浪 0.12、海邊的村子 0.4、地面 1、前景 1.3。
 */
const PATH = FLOOR - 8
/** 水平線 */
const HZ = 88
/** 礁湖的白浪（外海深藍、內側翡翠綠） */
const REEF = HZ + 12
/** 中景的沙灘的浪打上來的線 */
const SHORE = 115
/** 中景的房子站在哪 */
const MB = 125
const FAR = 0.12
const MID = 0.4

const sunX = (W: number) => Math.round(W * 0.72)
const moonX = (W: number) => Math.round(W * 0.62)

// 各層有東西的地方（腳本找看得到海的位置用）：x0–x1（該層的座標），top 是最高點的 y
interface Span {
  x0: number
  x1: number
  top: number
  /** 最低點的 y（沒寫就是一直到地面） */
  bot?: number
}
const occ: { far: Span[]; mid: Span[]; ground: Span[] } = { far: [], mid: [], ground: [] }
const hits = (list: Span[], x0: number, x1: number, top: number, bottom: number) =>
  list.some((s) => s.x1 >= x0 && s.x0 <= x1 && s.top < bottom && (s.bot ?? H) > top)
/** 畫面上 x0–x1、y 在 top–bottom 之間，各層都沒有東西擋住（看得到海） */
function seaClear(cam: number, x0: number, x1: number, top: number, bottom: number) {
  const speed = { far: FAR, mid: MID, ground: 1 }
  return (['far', 'mid', 'ground'] as const).every((k) => !hits(occ[k], x0 + cam * speed[k], x1 + cam * speed[k], top, bottom))
}

// ---------- 小工具 ----------
/** 實心圓，maxY 以下不畫（沉到海裡的太陽） */
function disc(g: Gfx, cx: number, cy: number, r: number, k: Px, maxY = H, level = 16) {
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy
    if (y >= maxY) break
    const dx = Math.floor((r + 0.5) * Math.sqrt(Math.max(0, 1 - (dy * dy) / ((r + 0.5) * (r + 0.5)))))
    if (level >= 16) g.hline(cx - dx, cx + dx, y, k)
    else g.dither(cx - dx, y, dx * 2 + 1, 1, k, level)
  }
}

/** 海（天空裡不捲動的那一塊）：水平線深藍、往近處變淺，礁湖裡是翡翠綠 */
function seaColumn(g: Gfx, env: Env, x: number, w: number) {
  const grey = env.weather !== 'clear'
  g.bands(HZ, REEF - HZ, ['sea-3', 'sea-2'], x, w)
  g.rect(x, REEF, w, H - REEF, grey ? 'sea-2' : 'sea-1')
  if (!grey) {
    g.dither(x, REEF, w, 2, 'sea-2', 6)
    g.dither(x, REEF + 3, w, H - REEF - 3, 'leaf-1', 4)
    g.dither(x, SHORE - 5, w, 5, 'foam', 2)
  }
  g.hline(x, x + w - 1, HZ, 'sea-3')
}

/** 水面上的光（夕陽、月亮）：一段一段斷開的橫線，越近越寬 */
function glitter(g: Gfx, x: number, r: Rng, a: Px, b: Px, y1 = SHORE, spread = 7, skip = 0.35) {
  for (let y = HZ + 1; y < y1; y++) {
    if (r.chance(skip)) continue
    const d = (y - HZ) / (y1 - HZ)
    const half = Math.max(0, Math.round((1 + d * spread) * r.range(0.3, 1)))
    const off = Math.round(r.range(-1, 1) * (1 + d * 3))
    g.hline(x + off - half, x + off + half, y, d < 0.3 || r.chance(0.4) ? a : b)
  }
}

/** 夏天的入道雲：一團團疊上去，右下有陰影 */
function thunderhead(g: Gfx, x: number, w: number, r: Rng) {
  const puffs: Array<[number, number, number]> = []
  const h = Math.round(w * 0.75)
  for (let i = 0; i < 8; i++) {
    const t = i / 8
    puffs.push([x + w / 2 + r.range(-0.35, 0.35) * w * (1 - t), HZ - 6 - t * h, Math.max(4, (w / 2) * (1 - t * 0.6) * r.range(0.45, 0.7))])
  }
  // 底部橫向攤開的幾團
  for (let i = 0; i < 4; i++) puffs.push([x + 6 + (i * (w - 12)) / 3, HZ - 4, Math.max(5, w * 0.16)])
  for (const [cx, cy, rad] of puffs) g.ellipse(cx + 2, cy + 2, rad, rad * 0.8, 'cloud-2')
  for (const [cx, cy, rad] of puffs) g.ellipse(cx, cy, rad, rad * 0.8, 'cloud-1')
}

// ---------- 天空 ----------
function okiSky(g: Gfx, env: Env, r: Rng) {
  const W = g.w
  const grey = env.weather !== 'clear'
  const t = env.time
  if (t === 'day') g.bands(0, HZ, grey ? ['stone-2', 'stone-1', 'cloud-2'] : ['sky-day-1', 'sky-day-2', 'sky-day-3'])
  else if (t === 'dusk') g.bands(0, HZ, grey ? ['stone-3', 'stone-2', 'sky-dusk-2'] : ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3'])
  else g.bands(0, HZ, ['sky-night-1', 'sky-night-2', 'sky-night-3'])
  seaColumn(g, env, 0, W)
  if (grey) {
    for (let i = 0; i < Math.ceil(W / 40); i++) cloud(g, r.int(-10, W), r.int(4, 44), r.int(18, 34), t === 'night' ? 'sky-night-2' : 'stone-1', t === 'night' ? 'sky-night-1' : 'stone-2')
    return
  }
  if (t === 'day') {
    g.circle(sunX(W), 17, 7, 'lamp-1')
    if (env.season === 'summer') thunderhead(g, r.int(-10, Math.round(W * 0.35)), r.int(56, 76), r)
    for (let i = 0; i < Math.ceil(W / 80); i++) cloud(g, r.int(-10, W), r.int(8, 50), r.int(14, 28))
  } else if (t === 'dusk') {
    const sx = sunX(W)
    sunAt(g, sx, HZ - 11)
    for (let i = 0; i < Math.ceil(W / 70); i++) {
      const cx = r.int(-10, W)
      const cw = r.int(16, 30)
      if (cx + cw > sx - 20 && cx < sx + 20) continue
      cloud(g, cx, r.int(10, 56), cw, 'sky-dusk-3', 'sky-dusk-2')
    }
    glitter(g, sx, r, 'lamp-1', 'lamp-2')
  } else {
    for (let i = 0; i < Math.round(W / 4); i++) g.px(r.int(0, W), r.int(0, HZ - 6), r.chance(0.3) ? 'star' : 'sky-night-3')
    const mx = moonX(W)
    disc(g, mx, 22, 9, 'sky-night-3', H, 5)
    g.circle(mx, 22, 6, 'moon')
    g.px(mx - 2, 20, 'star')
    g.px(mx + 2, 24, 'sky-night-3')
    g.px(mx + 1, 19, 'sky-night-3')
    glitter(g, mx, r, 'moon', 'sky-night-3', SHORE, 4, 0.5)
  }
}

/** 黃昏的太陽（maxY 以下沉進海裡） */
function sunAt(g: Gfx, x: number, y: number, maxY = HZ) {
  disc(g, x, y, 16, 'lamp-2', maxY, 4)
  disc(g, x, y, 10, 'lamp-2', maxY)
  disc(g, x, y, 7, 'lamp-1', maxY)
}

// ---------- 遠景：離島、礁湖的浪 ----------
function okiFar(g: Gfx, w: number, r: Rng, env: Env) {
  occ.far = []
  let x = r.int(10, 70)
  while (x < w - 10) {
    const iw = r.int(24, 66)
    const h = r.int(3, 5)
    g.poly([x, HZ + 1, x + 3, HZ - h, x + iw - 5, HZ - h - r.int(0, 1), x + iw, HZ + 1], 'roof-1')
    let top = HZ - h
    if (r.chance(0.6)) {
      // 伊江島那種：平平的島上一座尖尖的小山
      const px = x + r.int(Math.round(iw * 0.3), Math.round(iw * 0.7))
      const ph = r.int(5, 8)
      g.poly([px - 5, HZ - h + 1, px - 1, HZ - h - ph, px + 1, HZ - h - ph, px + 5, HZ - h + 1], 'roof-1')
      top -= ph
    }
    g.hline(x + 1, x + iw - 1, HZ, 'roof-2')
    occ.far.push({ x0: x - 2, x1: x + iw + 2, top })
    x += iw + r.int(90, 220)
  }
  // 礁的白浪
  for (let x = r.int(0, 8); x < w; ) {
    const len = r.int(2, 12)
    g.hline(x, x + len, REEF, 'foam')
    if (len > 6) g.hline(x + 2, x + len - 2, REEF - 1, 'white')
    x += len + r.int(3, 18)
  }
  // 海面的光點
  const night = isNight(env)
  for (let i = 0; i < w / 4; i++) {
    const y = r.int(HZ + 2, SHORE - 2)
    if (Math.abs(y - REEF) < 2) continue
    const xx = r.int(0, w)
    const len = y > REEF ? r.int(1, 3) : 1
    g.hline(xx, xx + len - 1, y, night ? 'sea-2' : y > REEF ? 'foam' : 'sea-1')
  }
}

// ---------- 中景：海邊的村子 ----------
/** 紅瓦屋頂（寄棟）：白色的灰泥線、屋脊；cx 中心、eave 屋簷的 y、w 屋簷寬、h 屋頂高 */
function redRoof(g: Gfx, cx: number, eave: number, w: number, h: number, step = 3) {
  const half = Math.round(w / 2)
  const top = eave - h
  const tw = Math.max(4, Math.round(w * 0.5))
  const th = Math.round(tw / 2)
  g.poly([cx - half, eave + 1, cx - th, top, cx + th, top, cx + half, eave + 1], 'momiji-2')
  // 瓦的接縫（白灰泥）：從屋脊往下的直線
  for (let i = cx - th + 2; i < cx + th - 1; i += step) g.vline(i, top + 2, eave - 1, 'momiji-1')
  g.dither(cx - half, eave - 2, w, 3, 'shu-2', 8)
  g.hline(cx - th, cx + th, top, 'white')
  g.hline(cx - th, cx + th, top + 1, 'paper-2')
  g.line(cx - th, top, cx - half + 1, eave, 'white')
  g.line(cx + th, top, cx + half - 1, eave, 'white')
  g.hline(cx - half, cx + half, eave + 1, 'shu-2')
  return top
}

/** 珊瑚石牆：一塊塊不規則的灰白石頭 */
function coralWall(g: Gfx, x0: number, x1: number, top: number, base: number, r: Rng) {
  g.rect(x0, top, x1 - x0, base - top, 'stone-2')
  for (let y = top, row = 0; y < base; row++) {
    const sh = Math.min(base - y, r.int(3, 5))
    for (let x = x0 + (row % 2 ? -r.int(0, 3) : 0); x < x1; ) {
      const sw = r.int(4, 9)
      const a = Math.max(x0, x)
      const b = Math.min(x1, x + sw - 1)
      if (b > a) {
        g.rect(a, y, b - a, sh - 1, r.chance(0.7) ? 'stone-1' : 'paper-2')
        if (r.chance(0.3)) g.px(r.int(a, b - 1), y + r.int(0, sh - 2), 'stone-3')
        if (r.chance(0.5)) g.px(a, y, 'white')
      }
      x += sw
    }
    y += sh
  }
  // 上緣凹凸
  for (let x = x0; x < x1; x += r.int(3, 7)) g.cut(x, top, 1, 1)
  g.dither(x0, base - 3, x1 - x0, 3, 'leaf-3', 3)
}

/** 福木：厚厚圓圓的葉子，像一根綠色的柱子 */
function fukugi(g: Gfx, x: number, base: number, h: number, w: number, r: Rng) {
  g.rect(x - 1, base - 4, 3, 4, 'wood-3')
  const top = base - h
  g.ellipse(x, top + h * 0.45, w / 2, h * 0.45, 'leaf-4')
  for (let i = 0; i < Math.round(h / 3); i++) {
    const yy = r.int(top + 2, base - 6)
    const xx = x + r.int(-Math.round(w / 2) + 2, Math.round(w / 2) - 2)
    g.ellipse(xx, yy, 2, 1, 'leaf-3')
    if (r.chance(0.4)) g.px(xx - 1, yy - 1, 'leaf-2')
  }
}

function palm(g: Gfx, x: number, base: number, h: number, lean: number, r: Rng, thick = 2) {
  // 幹：一節一節
  const tx = x + lean
  const ty = base - h
  for (let i = 0; i <= h; i++) {
    const t = i / h
    const xx = Math.round(x + lean * t * t)
    const yy = base - i
    g.hline(xx, xx + thick - 1, yy, i % 3 === 0 ? 'wood-2' : 'wood-1')
  }
  // 葉：往外伸再垂下
  const fr = Math.max(8, Math.round(h * 0.45))
  const dirs: Array<[number, number]> = [
    [-1, 0.9], [-1, 0.35], [-0.6, -0.4], [0.6, -0.4], [1, 0.35], [1, 0.9], [-0.2, -0.8], [0.25, -0.75],
  ]
  for (const [dx, lift] of dirs) {
    let px = tx + (thick >> 1)
    let py = ty
    let vx = dx
    let vy = -lift * 0.9
    const len = Math.round(fr * r.range(0.8, 1.1) * (Math.abs(dx) < 0.5 ? 0.6 : 1))
    for (let i = 0; i < len; i++) {
      px += vx
      py += vy
      vy += 0.11
      vx *= 0.99
      const X = Math.round(px)
      const Y = Math.round(py)
      g.px(X, Y, 'leaf-3')
      g.px(X, Y - 1, i < len * 0.6 ? 'leaf-2' : 'leaf-3')
      if (i > 1 && i % 2 === 0) g.px(X, Y + 1 + (i > len * 0.5 ? 1 : 0), 'leaf-3')
    }
  }
  g.circle(tx + (thick >> 1), ty + 1, 1, 'wood-3')
  g.px(tx + (thick >> 1) - 2, ty + 2, 'wood-2')
  g.px(tx + (thick >> 1) + 2, ty + 2, 'wood-2')
}

function banana(g: Gfx, x: number, base: number, s: number, r: Rng) {
  g.rect(x - 1, base - s, 3, s, 'leaf-3')
  g.vline(x + 1, base - s, base - 1, 'leaf-4')
  const leaves: Array<[number, number]> = [[-1, 1.1], [1, 1.1], [-1, 0.4], [1, 0.5], [0.3, 1.6]]
  for (const [dx, lift] of leaves) {
    let px = x
    let py = base - s
    let vx = dx * 0.9
    let vy = -lift
    const len = Math.round(s * r.range(0.8, 1.1))
    for (let i = 0; i < len; i++) {
      px += vx
      py += vy
      vy += 0.12
      const X = Math.round(px)
      const Y = Math.round(py)
      const wdt = i < 2 || i > len - 2 ? 1 : 2
      g.vline(X, Y - wdt, Y + wdt, 'leaf-2')
      g.px(X, Y, 'leaf-1')
      if (r.chance(0.12)) g.cut(X, Y + wdt, 1, 1)
    }
  }
}

function sugarcane(g: Gfx, x0: number, x1: number, base: number, top: number, env: Env, r: Rng) {
  g.rect(x0, base - 5, x1 - x0, 5, 'leaf-4')
  for (let x = x0 + 1; x < x1 - 1; x += 2) {
    const t = top + r.int(0, 4)
    g.vline(x, t, base - 1, r.chance(0.5) ? 'leaf-3' : 'leaf-2')
    if (r.chance(0.5)) g.px(x, r.int(t + 3, base - 3), 'dirt-1')
    // 葉
    const ly = r.int(t + 1, t + 8)
    const d = r.chance(0.5) ? 1 : -1
    g.line(x, ly, x + d * r.int(2, 4), ly - r.int(1, 3), 'leaf-2')
    if (env.season === 'autumn' && r.chance(0.6)) {
      // 甘蔗的花穗（銀白）
      g.vline(x, t - 4, t - 1, 'paper-2')
      g.px(x + d, t - 4, 'white')
    }
  }
  g.dither(x0, top, x1 - x0, 4, 'leaf-1', 3)
}

function okiMid(g: Gfx, w: number, r: Rng, env: Env) {
  occ.mid = []
  const night = isNight(env)
  // 沙灘、浪打上來的白線、陸地
  g.rect(0, SHORE + 1, w, H - SHORE - 1, 'sand-1')
  g.dither(0, SHORE + 3, w, 3, 'sand-2', 4)
  g.rect(0, SHORE + 6, w, H - SHORE - 6, 'leaf-3')
  g.dither(0, SHORE + 6, w, 2, 'sand-2', 6)
  g.dither(0, SHORE + 9, w, H - SHORE - 9, 'leaf-4', 5)
  for (let x = 0; x < w; ) {
    const len = r.int(4, 16)
    g.hline(x, x + len, SHORE, 'foam')
    if (r.chance(0.5)) g.hline(x + 1, x + len - 2, SHORE + 1, 'white')
    x += len + r.int(1, 6)
  }
  let x = r.int(0, 20)
  while (x < w) {
    const k = r.next()
    if (k < 0.3) {
      // 什麼都沒有：看得到海和沙灘（偶爾一艘小船）
      const gap = r.int(40, 90)
      if (r.chance(0.35)) {
        const bx = x + r.int(6, gap - 18)
        g.poly([bx, SHORE + 2, bx + 14, SHORE + 2, bx + 12, SHORE + 5, bx + 2, SHORE + 5], 'wood-2')
        g.hline(bx + 1, bx + 13, SHORE + 2, 'shu-1')
      }
      x += gap
      continue
    }
    if (k < 0.6) {
      // 村子：兩三間紅瓦屋頂，福木圍著
      const n = r.int(1, 3)
      const start = x
      fukugi(g, x + 4, MB, r.int(20, 26), 10, r)
      x += 8
      for (let i = 0; i < n; i++) {
        const hw = r.int(24, 32)
        const cx = x + hw / 2
        g.rect(x + 2, MB - 9, hw - 4, 9, 'wood-2')
        for (let j = x + 4; j < x + hw - 4; j += 4) g.vline(j, MB - 8, MB - 2, 'wood-3')
        // 亂數不管時段都抽：夕陽腳本換成夜晚重畫時，房子不會跑掉
        const dusky = r.chance(0.5)
        if (night || (env.time === 'dusk' && dusky)) g.rect(Math.round(cx) - 3, MB - 7, 6, 4, 'lamp-2')
        const top = redRoof(g, Math.round(cx), MB - 10, hw + 2, r.int(7, 9))
        // 屋脊上的風獅爺（小小的）
        const sx = Math.round(cx) + r.int(-2, 2)
        g.rect(sx - 1, top - 3, 3, 3, 'wood-1')
        g.px(sx + 1, top - 4, 'wood-2')
        g.px(sx - 1, top - 4, 'wood-2')
        g.px(sx + 1, top - 2, 'ink-2')
        coralWall(g, x - 2, x + hw + 2, MB - 4, MB + 1, r)
        x += hw + r.int(2, 6)
        if (r.chance(0.5)) {
          fukugi(g, x + 3, MB, r.int(18, 24), 9, r)
          x += 8
        }
      }
      fukugi(g, x + 4, MB, r.int(20, 26), 10, r)
      x += 10
      occ.mid.push({ x0: start - 4, x1: x, top: MB - 28 })
      x += r.int(4, 20)
      continue
    }
    if (k < 0.7) {
      // 甘蔗田
      const fw = r.int(40, 70)
      sugarcane(g, x, x + fw, MB, MB - 16, env, r)
      occ.mid.push({ x0: x, x1: x + fw, top: MB - 20 })
      x += fw + r.int(4, 16)
      continue
    }
    if (k < 0.9) {
      // 沙灘上的椰子樹
      const n = r.int(1, 3)
      for (let i = 0; i < n; i++) {
        const h = r.int(20, 30)
        const lean = r.int(-6, 6)
        palm(g, x, SHORE + 4, h, lean, r, 2)
        // 葉子之間看得到海：只算樹幹與樹冠
        const crown = SHORE + 4 - h
        occ.mid.push({ x0: x + lean - 12, x1: x + lean + 12, top: crown - 6, bot: crown + 9 })
        occ.mid.push({ x0: Math.min(x, x + lean) - 1, x1: Math.max(x, x + lean) + 3, top: crown })
        x += r.int(10, 22)
      }
      x += r.int(8, 30)
      continue
    }
    // 芭蕉
    banana(g, x + 6, MB, 8, r)
    banana(g, x + 16, MB, 10, r)
    occ.mid.push({ x0: x - 4, x1: x + 26, top: MB - 20 })
    x += 30 + r.int(4, 18)
  }
}

// ---------- 地面：白沙路與路旁 ----------
const SHISA = drawSprite(
  11,
  9,
  (g) => {
    // 坐著的風獅爺（朝右）：陶土色的大頭、紅色捲捲的鬃毛、張嘴露牙、尾巴往上捲
    g.rect(2, 5, 4, 3, 'wood-1')
    g.rect(5, 6, 2, 2, 'wood-2')
    g.rect(5, 1, 4, 4, 'wood-1')
    g.rect(4, 1, 1, 4, 'momiji-2')
    g.rect(5, 0, 3, 1, 'momiji-2')
    g.px(3, 2, 'momiji-2')
    g.px(3, 4, 'momiji-2')
    g.px(7, 2, 'ink')
    g.px(9, 3, 'wood-1')
    g.px(8, 4, 'white')
    g.px(9, 4, 'white')
    g.px(1, 3, 'momiji-2')
    g.px(1, 4, 'momiji-2')
    g.px(2, 2, 'momiji-2')
  },
  'wood-3',
)
const SHISA_L = mirrored(SHISA)

function hibiscus(g: Gfx, x: number, base: number, w: number, r: Rng) {
  const h = Math.round(w * 0.6)
  g.ellipse(x + w / 2, base - h / 2, w / 2, h / 2, 'leaf-3')
  for (let i = 0; i < w / 3; i++) g.ellipse(x + r.int(2, w - 2), base - r.int(2, h), 2, 1, r.chance(0.5) ? 'leaf-2' : 'leaf-4')
  g.rect(x + 1, base - 2, w - 2, 2, 'leaf-4')
  for (let i = 0; i < Math.max(2, w / 6); i++) {
    const fx = x + r.int(2, w - 3)
    const fy = base - r.int(3, h)
    const k = r.pick(['shu-1', 'shu-1', 'sakura-2', 'gold-1'] as const)
    g.rect(fx - 1, fy, 3, 1, k)
    g.rect(fx, fy - 1, 1, 3, k)
    g.px(fx, fy, k === 'gold-1' ? 'shu-2' : 'gold-1')
  }
}

function coralRoad(g: Gfx, w: number, r: Rng) {
  g.rect(0, PATH, w, H - PATH, 'paper')
  g.dither(0, PATH + 3, w, H - PATH - 3, 'sand-1', 6)
  g.dither(0, PATH + 16, w, H - PATH - 16, 'sand-2', 2)
  for (let i = 0; i < w / 4; i++) g.px(r.int(0, w), r.int(PATH + 1, H - 1), r.pick(['white', 'stone-1', 'sand-2', 'white'] as const))
  g.hline(0, w, PATH, 'stone-1')
  g.dither(0, PATH + 1, w, 1, 'stone-1', 6)
}

/** 石牆圍起來的老房子：紅瓦屋頂、屋脊的風獅爺，門柱上一對風獅爺，門後是屏風牆（ヒンプン） */
function yashiki(g: Gfx, x: number, w: number, env: Env, r: Rng) {
  const wallTop = PATH - 14
  const eave = PATH - 24
  const night = isNight(env)
  const hx = x + 6
  const hw = w - 12
  // 後面的福木
  for (let i = x + 2; i < x + w; i += r.int(12, 18)) fukugi(g, i, wallTop + 2, r.int(36, 46), r.int(12, 16), r)
  // 房子的牆（木頭的雨戶），夜裡透光
  g.rect(hx, eave, hw, wallTop - eave, 'wood-2')
  for (let i = hx + 3; i < hx + hw - 2; i += 6) {
    const roll = r.next()
    const lit = night ? roll < 0.6 : env.time === 'dusk' && roll < 0.25
    g.rect(i, eave + 3, 4, 6, lit ? 'lamp-2' : 'wood-3')
    if (lit) g.vline(i + 2, eave + 3, eave + 8, 'lamp-1')
  }
  g.hline(hx, hx + hw - 1, eave + 1, 'wood-3')
  const top = redRoof(g, hx + Math.round(hw / 2), eave, hw + 10, r.int(13, 16), 3)
  // 屋脊上的風獅爺
  g.sprite(r.chance(0.5) ? SHISA : SHISA_L, hx + Math.round(hw / 2) - 5 + r.int(-4, 4), top - 7)
  // 石牆與門
  const gate = x + r.int(Math.round(w * 0.3), Math.round(w * 0.6))
  coralWall(g, x, gate - 4, wallTop, PATH, r)
  coralWall(g, gate + 14, x + w, wallTop, PATH, r)
  // 門後的屏風牆
  g.rect(gate + 2, wallTop + 2, 10, PATH - wallTop - 2, 'stone-2')
  g.rect(gate + 3, wallTop + 3, 8, PATH - wallTop - 4, 'stone-1')
  g.dither(gate + 3, wallTop + 3, 8, PATH - wallTop - 4, 'stone-2', 4)
  g.hline(gate - 4, gate + 17, PATH - 1, 'stone-3')
  // 門柱與一對風獅爺
  for (const [px, s] of [[gate - 4, SHISA], [gate + 12, SHISA_L]] as const) {
    g.rect(px, wallTop - 4, 6, PATH - wallTop + 4, 'stone-1')
    g.vline(px + 5, wallTop - 4, PATH - 1, 'stone-2')
    g.hline(px, px + 5, wallTop - 4, 'white')
    g.sprite(s, px - 2, wallTop - 12)
  }
  return top - 7
}

/** 守禮門：朱色的柱子、兩層的紅瓦屋頂、中間的匾額 */
function shureimon(g: Gfx, cx: number, env: Env, r: Rng) {
  const night = isNight(env)
  // 後面深綠的樹林與石牆，讓朱色跳出來
  g.rect(cx - 52, PATH - 46, 104, 46, 'leaf-4')
  for (let i = cx - 52; i < cx + 52; i += 7) g.circle(i + r.int(0, 3), PATH - 46 + r.int(-2, 2), r.int(5, 7), 'leaf-4')
  for (let i = 0; i < 30; i++) g.ellipse(cx - 50 + r.int(0, 100), PATH - r.int(14, 50), 2, 1, 'leaf-3')
  coralWall(g, cx - 52, cx - 36, PATH - 12, PATH, r)
  coralWall(g, cx + 36, cx + 52, PATH - 12, PATH, r)
  const pil = [-29, -11, 9, 27]
  const pk: Px = night ? 'shu-2' : 'shu-1'
  // 下層的樑與天花板
  g.rect(cx - 32, PATH - 34, 64, 6, 'shu-2')
  g.rect(cx - 32, PATH - 33, 64, 2, pk)
  for (let i = cx - 30; i < cx + 30; i += 4) g.px(i, PATH - 30, 'gold-1')
  for (const p of pil) {
    g.rect(cx + p, PATH - 30, 3, 28, pk)
    g.vline(cx + p + 2, PATH - 30, PATH - 3, 'shu-2')
    g.rect(cx + p - 2, PATH - 4, 7, 4, 'stone-1')
    g.hline(cx + p - 2, cx + p + 4, PATH - 4, 'white')
    g.vline(cx + p + 4, PATH - 4, PATH - 1, 'stone-2')
  }
  // 下層的屋頂（左右兩邊翹起來）
  g.poly([cx - 40, PATH - 34, cx - 34, PATH - 40, cx + 34, PATH - 40, cx + 40, PATH - 34], 'momiji-2')
  g.hline(cx - 41, cx + 40, PATH - 34, 'shu-2')
  g.px(cx - 41, PATH - 35, 'momiji-2')
  g.px(cx + 40, PATH - 35, 'momiji-2')
  for (let i = cx - 33; i < cx + 33; i += 3) g.vline(i, PATH - 39, PATH - 35, 'momiji-1')
  g.hline(cx - 34, cx + 33, PATH - 40, 'white')
  // 中段：匾額
  g.rect(cx - 16, PATH - 47, 32, 7, 'shu-2')
  g.rect(cx - 15, PATH - 47, 30, 2, pk)
  g.rect(cx - 8, PATH - 47, 16, 6, 'ink')
  g.frame(cx - 8, PATH - 47, 16, 6, 'gold-1')
  for (let i = 0; i < 4; i++) g.rect(cx - 6 + i * 3, PATH - 45, 2, 2, 'gold-2')
  // 上層的屋頂
  g.poly([cx - 26, PATH - 47, cx - 20, PATH - 55, cx + 20, PATH - 55, cx + 26, PATH - 47], 'momiji-2')
  g.hline(cx - 27, cx + 26, PATH - 47, 'shu-2')
  g.px(cx - 27, PATH - 48, 'momiji-2')
  g.px(cx + 26, PATH - 48, 'momiji-2')
  for (let i = cx - 19; i < cx + 19; i += 3) g.vline(i, PATH - 54, PATH - 48, 'momiji-1')
  g.hline(cx - 20, cx + 19, PATH - 55, 'white')
  g.rect(cx - 21, PATH - 57, 3, 2, 'gold-1')
  g.rect(cx + 18, PATH - 57, 3, 2, 'gold-1')
  if (night || env.time === 'dusk') {
    // 點燈
    for (const p of [-36, 34]) {
      g.rect(cx + p, PATH - 8, 3, 8, 'stone-3')
      g.rect(cx + p - 1, PATH - 11, 5, 3, 'lamp-1')
    }
  }
}

function streetLamp(g: Gfx, x: number, env: Env) {
  g.rect(x, PATH - 30, 2, 30, 'stone-3')
  g.hline(x, x + 5, PATH - 30, 'stone-3')
  const on = env.time !== 'day'
  g.rect(x + 4, PATH - 29, 4, 2, on ? 'lamp-1' : 'stone-1')
  if (isNight(env)) {
    g.hline(x + 4, x + 7, PATH - 27, 'lamp-2')
    g.dither(x + 3, PATH - 26, 6, 1, 'lamp-2', 6)
  }
}

function okiGround(g: Gfx, w: number, r: Rng, env: Env) {
  occ.ground = []
  coralRoad(g, w, r)
  let x = r.int(0, 20)
  let sinceHouse = 200
  let gate = false
  const gateAt = r.int(Math.round(w * 0.35), Math.round(w * 0.55))
  while (x < w) {
    if (!gate && x >= gateAt) {
      shureimon(g, x + 54, env, r)
      occ.ground.push({ x0: x, x1: x + 108, top: PATH - 58 })
      x += 116
      gate = true
      continue
    }
    const k = r.next()
    if (sinceHouse > 330 || k < 0.16) {
      const hw = r.int(56, 76)
      const top = yashiki(g, x, hw, env, r)
      occ.ground.push({ x0: x, x1: x + hw, top: Math.min(top, PATH - 60) })
      x += hw + r.int(2, 8)
      sinceHouse = 0
      continue
    }
    const start = x
    if (k < 0.56) {
      // 開闊的地方：扶桑花與椰子樹，看得到海
      const gap = r.int(60, 120)
      for (let i = x + r.int(0, 10); i < x + gap - 14; i += r.int(24, 40)) hibiscus(g, i, PATH, r.int(12, 18), r)
      if (r.chance(0.6)) {
        const px = x + r.int(10, gap - 10)
        const h = r.int(40, 54)
        const lean = r.int(-10, 10)
        palm(g, px, PATH, h, lean, r, 3)
        occ.ground.push({ x0: px + lean - 18, x1: px + lean + 20, top: PATH - h - 6, bot: PATH - h + 14 })
        occ.ground.push({ x0: Math.min(px, px + lean) - 1, x1: Math.max(px, px + lean) + 4, top: PATH - h })
      }
      if (r.chance(0.4)) streetLamp(g, x + gap - 6, env)
      occ.ground.push({ x0: x, x1: x + gap, top: PATH - 12 })
      x += gap
    } else if (k < 0.68) {
      const fw = r.int(50, 90)
      sugarcane(g, x, x + fw, PATH, PATH - 24, env, r)
      occ.ground.push({ x0: x, x1: x + fw, top: PATH - 30 })
      x += fw
    } else if (k < 0.82) {
      // 芭蕉與低的石牆
      const fw = r.int(40, 64)
      banana(g, x + 10, PATH - 2, 14, r)
      if (fw > 50) banana(g, x + 30, PATH - 2, 17, r)
      coralWall(g, x, x + fw, PATH - 9, PATH, r)
      hibiscus(g, x + fw - 18, PATH, 14, r)
      occ.ground.push({ x0: x - 10, x1: x + fw + 10, top: PATH - 34 })
      x += fw
    } else {
      // 一排福木（防風林）
      const fw = r.int(24, 40)
      for (let i = x + 6; i < x + fw; i += 11) fukugi(g, i, PATH - 1, r.int(36, 46), 14, r)
      hibiscus(g, x, PATH, 16, r)
      occ.ground.push({ x0: x - 2, x1: x + fw + 6, top: PATH - 52 })
      x += fw + 6
    }
    sinceHouse += x - start
  }
}

// ---------- 前景 ----------
function okiFront(g: Gfx, w: number, r: Rng) {
  for (let x = r.int(120, 260); x < w; x += r.int(260, 460)) {
    if (r.chance(0.5)) hibiscus(g, x, H + 4, r.int(26, 36), r)
    else {
      banana(g, x, H + 6, 20, r)
      hibiscus(g, x + 10, H + 4, 22, r)
    }
  }
}

// ---------- 沖繩的腳本 ----------
// 螃蟹：紅色的，橫著跑，舉起大螯
const CRAB = [0, 1, 2].map((f) =>
  drawSprite(14, 9, (g) => {
    const up = f === 2
    g.ellipse(7, 5, 4, 2, 'momiji-1')
    g.hline(5, 9, 4, 'gold-1')
    g.px(5, 2, 'ink')
    g.px(9, 2, 'ink')
    g.px(5, 3, 'momiji-2')
    g.px(9, 3, 'momiji-2')
    // 腳（跑的時候交錯）
    const a = f === 1 ? 1 : 0
    for (const lx of [3, 4, 10, 11]) g.px(lx + (lx < 7 ? -a : a), 7 + ((lx + a) % 2), 'momiji-2')
    g.px(2, 8, 'momiji-2')
    g.px(12, 8, 'momiji-2')
    // 螯
    if (up) {
      g.rect(1, 0, 2, 3, 'momiji-1')
      g.rect(11, 0, 2, 3, 'momiji-1')
      g.px(2, 3, 'momiji-2')
      g.px(11, 3, 'momiji-2')
    } else {
      g.rect(1, 4, 2, 2, 'momiji-1')
      g.rect(11, 4, 2, 2, 'momiji-1')
    }
  }),
)
// 寄居蟹：背著白色的螺殼慢慢爬；縮起來的時候只剩殼
const HERMIT = [0, 1, 2].map((f) =>
  drawSprite(12, 10, (g) => {
    g.ellipse(5, 5, 4, 4, 'stone-1')
    g.px(3, 3, 'white')
    g.line(3, 6, 6, 3, 'stone-2')
    g.px(5, 5, 'stone-2')
    g.px(6, 6, 'stone-3')
    if (f < 2) {
      g.rect(8, 6, 2, 3, 'momiji-1')
      g.px(10, 5, 'ink')
      g.px(10, 6, 'momiji-2')
      g.px(8 + f, 9, 'momiji-2')
      g.px(10 - f, 9, 'momiji-2')
    }
  }),
)

const CRAB_EVENT: EventDef = {
  id: 'okinawa-crab',
  *run(s) {
    // 紅色的螃蟹橫著跑過來，在旅人前面舉起大螯，再衝過去；旅人跳起來。後面還有一隻慢吞吞的寄居蟹
    const crab = s.spawn({ frames: CRAB.slice(0, 2), fps: 14, x: s.cam + s.W + 10, y: s.FLOOR + 2, z: 'front', vx: -36 })
    yield () => crab.sx() < s.hero.x + 44
    crab.vx = 0
    s.hero.stop()
    crab.fps = 0
    crab.frames = [CRAB[2]!]
    crab.frame = 0
    s.hero.emote('surprise', 1)
    yield 0.9
    crab.frames = CRAB.slice(0, 2)
    crab.fps = 16
    crab.vx = -95
    yield () => crab.sx() < s.hero.x + 26
    s.hero.jump(14)
    yield () => crab.sx() < -20
    crab.remove()
    s.hero.emote('sweat', 1.2)
    yield 1.2
    const hermit = s.spawn({ frames: HERMIT.slice(0, 2), fps: 5, x: s.cam + s.W + 8, y: s.FLOOR + 2, z: 'front', flip: true, vx: -10 })
    s.hero.walk()
    yield () => hermit.sx() < s.hero.x + 46
    s.hero.stop()
    s.hero.emote('question', 0.9)
    yield 0.5
    // 太早跳了
    s.hero.jump(10)
    yield 0.7
    s.hero.emote('dots', 1)
    yield () => hermit.sx() < s.hero.x + 16
    s.hero.jump(12)
    yield 0.2
    // 嚇得縮進殼裡，被旅人跳過去
    hermit.vx = 0
    hermit.frames = [HERMIT[2]!]
    hermit.frame = 0
    hermit.fps = 0
    yield 1
    s.hero.walk()
    yield 0.8
    hermit.frames = HERMIT.slice(0, 2)
    hermit.fps = 5
    hermit.vx = -10
    yield () => hermit.sx() < -12
  },
}

/** 找一個看得到海的位置（畫面 x）：x±half、top–bottom 之間各層都沒擋住；找不到回傳 null。cam：地面捲到哪的時候（預設現在） */
function findSea(s: Stage, top: number, bottom: number, from: number, half = 7, cam = s.cam) {
  for (let x = Math.round(from); x < s.W - 14; x += 3) if (seaClear(cam, x - half, x + half, top, bottom)) return x
  return null
}
/** 照常走的話，sec 秒內會走到 ok 的地方（地面每 step px 試一次，到這一區的盡頭為止） */
function ahead(s: Stage, sec: number, ok: (cam: number) => boolean, step = 2) {
  const end = Math.min(s.cam + 22 * s.hero.speed * sec, s.area.length - 40)
  for (let c = s.cam; c <= end; c += step) if (ok(c)) return true
  return false
}

const TURTLE_HEAD = [0, 1].map((f) =>
  drawSprite(8, 6, (g) => {
    g.ellipse(4, 3, 2, 2, 'leaf-3')
    g.rect(2, 4, 5, 2, 'leaf-3')
    g.px(f ? 3 : 5, 2, 'ink')
    g.px(f ? 2 : 6, 3, 'leaf-2')
  }, 'leaf-4'),
)

const TURTLE_EVENT: EventDef = {
  id: 'okinawa-turtle',
  // 14 秒內走得到看得見淺灘的地方才挑
  ready: (s) => ahead(s, 13.5, (c) => findSea(s, SHORE - 11, SHORE - 1, s.hero.x + 18, 6, c) !== null, 6),
  *run(s) {
    // 淺灘上海龜探出頭來換氣，看看旅人，又潛下去
    let spot: number | null = null
    const t0 = s.t
    yield () => (spot = findSea(s, SHORE - 11, SHORE - 1, s.hero.x + 18, 6)) !== null || s.t - t0 > 14
    if (spot === null) return
    s.hero.stop()
    const y = SHORE - 5
    const wx = spot + s.cam * MID
    let ripple = true
    let shell = 16
    // 水底的龜殼影子、一圈圈的波紋
    s.paint('sky', (g, t) => {
      const x = Math.round(wx - s.cam * MID)
      if (shell > 0) {
        g.dither(x - 7, y, 11, 3, 'sea-3', Math.min(8, shell))
        g.dither(x - 6, y + 1, 9, 1, 'leaf-4', Math.min(10, shell))
      }
      if (ripple) {
        const r = 3 + Math.floor((t * 5) % 5)
        g.hline(x - r - 1, x - r, y + 1, 'foam')
        g.hline(x + r, x + r + 1, y + 1, 'foam')
      }
    })
    yield 1.2
    const head = s.spawn({ frames: TURTLE_HEAD, fps: 0, x: wx + 3, y: y + 3, space: MID, z: 'sky', flip: true })
    // 慢慢浮上來
    for (let i = 0; i < 4; i++) {
      head.y = y + 3 - i
      yield 0.15
    }
    ripple = false
    // 噗：吐一口氣
    s.spawn({
      x: wx + 1,
      y: y - 5,
      space: MID,
      z: 'sky',
      draw(g, x, yy, a) {
        const up = Math.round(a.age * 8)
        g.px(x, yy - up, 'white')
        g.px(x - 1 - (up >> 2), yy - up + 2, 'foam')
        g.px(x + 1 + (up >> 2), yy - up + 2, 'foam')
        if (a.age > 0.6) a.remove()
      },
    })
    s.hero.emote('surprise', 0.9)
    yield 1.1
    // 轉頭看旅人
    head.frame = 1
    s.hero.emote('heart', 1.6)
    yield 1.8
    head.frame = 0
    yield 0.5
    for (let i = 0; i < 4; i++) {
      head.y += 1
      yield 0.12
    }
    head.remove()
    ripple = true
    yield 0.8
    ripple = false
    // 影子往外海游走、淡掉
    for (let i = 0; i < 16; i++) {
      shell = 16 - i
      yield 0.06
    }
    shell = 0
    s.hero.walk()
  },
}

// 三線的老爺爺：坐在小板凳上，草帽、花襯衫
const SANSHIN = [0, 1].map((f) =>
  drawSprite(22, 22, (g) => {
    // 板凳
    g.rect(4, 17, 11, 2, 'wood-2')
    g.rect(5, 19, 2, 3, 'wood-3')
    g.rect(12, 19, 2, 3, 'wood-3')
    // 腳
    g.rect(11, 15, 5, 3, 'stone-3')
    g.rect(14, 15, 2, 6, 'stone-3')
    g.rect(14, 20, 3, 1, 'wood-3')
    // 身體：花襯衫（かりゆし）
    g.rect(6, 9, 7, 8, 'sea-1')
    g.px(7, 11, 'white')
    g.px(10, 13, 'white')
    g.px(8, 15, 'shu-1')
    g.px(11, 10, 'shu-1')
    // 頭：白髮、草帽
    g.ellipse(10, 6, 3, 3, 'skin-2')
    g.px(12, 6, 'ink')
    g.px(8, 7, 'stone-1')
    g.rect(6, 2, 9, 2, 'sand-2')
    g.rect(8, 0, 5, 2, 'sand-2')
    g.hline(6, 14, 3, 'dirt-2')
    // 三線：黑的琴身、長長的琴桿往右上
    g.rect(9, 12, 5, 4, 'ink-2')
    g.rect(10, 13, 3, 2, 'paper')
    g.line(13, 12, 19, 5, 'ink')
    g.rect(18, 3, 2, 3, 'ink')
    g.px(17, 3, 'gold-1')
    // 撥弦的手
    g.rect(10 + f, 13 - f, 2, 2, 'skin-2')
    g.rect(15, 9, 2, 2, 'skin-2')
  }),
)
const NOTE = [
  drawSprite(6, 7, (g) => {
    g.vline(3, 0, 4, 'ink-2')
    g.px(4, 1, 'ink-2')
    g.rect(1, 4, 3, 2, 'ink-2')
  }, 'white'),
  drawSprite(8, 7, (g) => {
    g.vline(2, 0, 4, 'ink-2')
    g.vline(5, 0, 4, 'ink-2')
    g.hline(2, 5, 0, 'ink-2')
    g.rect(0, 4, 3, 2, 'ink-2')
    g.rect(3, 4, 3, 2, 'ink-2')
  }, 'white'),
]

const SANSHIN_EVENT: EventDef = {
  id: 'okinawa-sanshin',
  *run(s) {
    // 路邊彈三線的老爺爺：旅人停下來聽，跟著左右搖
    const man = s.spawn({ frames: SANSHIN, fps: 4, x: s.cam + s.W + 14, y: s.FLOOR - 4, flip: true })
    let n = 0
    let next = 0
    // 音符從琴身冒出來、搖搖晃晃往上飄
    s.spawn({
      x: 0,
      y: 0,
      update(a) {
        if (a.age < next || !man.alive || man.sx() > s.W + 8) return
        next = a.age + 0.55
        const ox = man.x - 4
        s.spawn({
          frames: NOTE[n++ % 2]!,
          x: ox,
          y: man.y - 16,
          vy: -11,
          z: 'front',
          update(b) {
            b.x = ox - b.age * 5 + Math.round(Math.sin(b.age * 5) * 2)
            if (b.age > 1.3) b.level = 8
            if (b.age > 1.9) b.remove()
          },
        })
      },
    })
    yield () => man.sx() < s.hero.x + 34
    s.hero.stop()
    s.hero.emote('note', 1.4)
    for (let i = 0; i < 6; i++) {
      s.hero.face(i % 2 ? 'right' : 'left')
      s.hero.jump(3)
      yield 0.5
    }
    s.hero.face('right')
    s.hero.emote('heart', 1.4)
    yield 1.4
    s.hero.walk()
    yield () => man.sx() < -16
  },
}

// 鯨魚：遠方的海面上躍出來（座頭鯨，白色的長胸鰭）
function whale(g: Gfx, x: number, y: number, ph: number) {
  // ph 0–1 躍起、1–1.6 往旁邊倒下去、之後是水花
  if (ph < 1) {
    const up = Math.round(Math.sin(ph * Math.PI * 0.5) * 16)
    const top = y - up
    g.poly([x - 3, y, x - 2, top + 3, x + 1, top, x + 4, top + 2, x + 4, y], 'roof-3')
    g.vline(x + 3, top + 3, y - 1, 'stone-1')
    g.vline(x + 2, top + 5, y - 1, 'stone-2')
    if (up > 8) {
      g.line(x - 2, top + 6, x - 7, top + 10, 'stone-1')
      g.line(x + 4, top + 6, x + 9, top + 9, 'stone-1')
    }
  } else if (ph < 1.6) {
    const t = (ph - 1) / 0.6
    const top = y - 16 + Math.round(t * 9)
    g.poly([x - 1 + Math.round(t * 5), top, x + 8, top + 5, x + 9 + Math.round(t * 2), y, x - 3, y], 'roof-3')
    g.line(x + 1, top + 4, x + 9, top + 3, 'stone-1')
  }
  // 浪花
  const sp = ph < 1 ? 1 + Math.round(ph * 2) : ph < 2.4 ? 3 + Math.round((ph - 1) * 4) : 0
  if (sp > 0) {
    const hgt = ph > 1.4 && ph < 2.4 ? Math.round((1 - Math.abs(ph - 1.9) * 2) * 11) : 1
    g.rect(x - sp, y - 1, sp * 2 + 4, 2, 'foam')
    if (hgt > 1) {
      g.rect(x, y - hgt, 6, hgt, 'white')
      g.px(x - 2, y - hgt + 2, 'foam')
      g.px(x + 7, y - hgt + 1, 'foam')
      g.px(x + 3, y - hgt - 1, 'foam')
    }
  }
}

const WHALE_EVENT: EventDef = {
  id: 'okinawa-whale',
  ready: (s) => ahead(s, 9.5, (c) => findSea(s, HZ - 18, HZ + 2, s.hero.x + 40, 9, c) !== null, 4),
  *run(s) {
    // 遠方的鯨魚躍出水面；旅人拿出相機的時候已經沉下去了，遠遠的又噴了一次水
    let spot: number | null = null
    const t0 = s.t
    yield () => (spot = findSea(s, HZ - 18, HZ + 2, s.hero.x + 40, 9)) !== null || s.t - t0 > 10
    if (spot === null) return
    s.hero.stop()
    const wx = spot + s.cam * FAR
    const y = HZ + 3
    let ph = 0
    const t1 = s.t
    const h = s.paint('sky', (g) => whale(g, Math.round(wx - s.cam * FAR), y, ph))
    let emoted = false
    yield () => {
      ph = (s.t - t1) * 1.1
      if (!emoted && ph > 0.5) {
        emoted = true
        s.hero.emote('surprise', 1.2)
      }
      return ph > 2.6
    }
    h.stop()
    yield 0.4
    s.hero.hold = 'camera'
    yield 1.4
    s.hero.emote('dots', 1.2)
    yield 1
    // 噴氣
    const bx = Math.round(wx - s.cam * FAR) + 16
    const blow = s.paint('sky', (g, t) => {
      const hh = Math.round(Math.min(1, t * 3) * 7)
      g.vline(bx, y - hh, y - 1, t < 0.8 ? 'white' : 'foam')
      if (hh > 4) {
        g.px(bx - 1, y - hh, 'foam')
        g.px(bx + 1, y - hh, 'foam')
        g.px(bx - 2, y - hh + 1, 'foam')
        g.px(bx + 2, y - hh + 1, 'foam')
      }
      g.hline(bx - 2, bx + 3, y, 'roof-3')
    })
    s.hero.emote('surprise', 0.8)
    yield 1.2
    blow.stop()
    s.hero.emote('sweat', 1.2)
    yield 1
    s.hero.hold = null
    s.hero.walk()
  },
}

/** 地面捲到 cam 的時候，夕陽沉下去的整段（半徑 10 的太陽多留 2px：x ±12、從 HZ-23 到水平線）都沒有被房子、樹擋住 */
function sunClear(W: number, cam: number) {
  const sx = sunX(W)
  return seaClear(cam, sx - 12, sx + 12, HZ - 23, HZ + 1)
}
const SUNSET_EVENT: EventDef = {
  id: 'okinawa-sunset',
  when: { time: ['dusk'] },
  weight: 0.8,
  ready: (s) => s.env.weather === 'clear' && ahead(s, 9.5, (c) => sunClear(s.W, c)),
  *run(s) {
    // 夕陽慢慢沉進海裡，天黑下來、月亮與星星出來
    if (s.env.weather !== 'clear') return
    const sx = sunX(s.W)
    // 走到看得到太陽沉下去的整段才停；一直被擋住就不看了
    const t0 = s.t
    yield () => sunClear(s.W, s.cam) || s.t - t0 > 10
    if (!sunClear(s.W, s.cam)) return
    s.hero.stop()
    s.hero.emote('dots', 1.4)
    let sy = HZ - 11
    let shine = 1
    const h = s.paint('sky', (g, t) => {
      // 天黑以後的畫面（換色的時候新的那一格）不畫
      if (g.pal.key !== 'dusk') return
      // 蓋掉天空裡原本的太陽與倒影，畫正在沉的
      g.bands(0, HZ, ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3'], sx - 18, 37)
      seaColumn(g, s.env, sx - 18, 37)
      sunAt(g, sx, Math.round(sy))
      if (shine > 0) glitter(g, sx, makeRng(Math.floor(t * 5) + 1), 'lamp-1', 'lamp-2', SHORE, 7 * shine, 0.35 + (1 - shine) * 0.5)
    })
    const t1 = s.t
    let loved = false
    yield () => {
      const k = (s.t - t1) / 8
      sy = HZ - 11 + k * 30
      shine = Math.max(0, 1 - Math.max(0, sy - (HZ - 4)) / 20)
      if (!loved && k > 0.5) {
        loved = true
        s.hero.emote('heart', 1.6)
      }
      return k >= 1
    }
    s.setEnv({ time: 'night' })
    yield 1.4
    h.stop()
    s.hero.emote('note', 1.2)
    yield 1.4
    s.hero.walk()
  },
}

export const OKINAWA: AreaDef = {
  id: 'okinawa',
  name: '沖繩',
  romaji: 'OKINAWA',
  tags: ['coast', 'town', 'nature'],
  length: 1400,
  seasons: ['spring', 'summer', 'autumn'],
  horizon: HZ,
  sky: okiSky,
  layers: [
    { speed: FAR, draw: okiFar },
    { speed: MID, draw: okiMid },
  ],
  ground: { speed: 1, draw: okiGround },
  front: { speed: 1.3, draw: okiFront },
  events: [CRAB_EVENT, TURTLE_EVENT, WHALE_EVENT, SANSHIN_EVENT, SUNSET_EVENT],
}
