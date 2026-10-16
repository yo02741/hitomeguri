import { drawSprite } from '../build'
import { dotOn, Gfx } from '../gfx'
import { HERO } from '../hero'
import { cedar, cloud, peak } from '../kit'
import type { Palette, Px, Season, TimeOfDay } from '../palette'
import { frames } from '../sprite'
import { type AreaDef, type Env, FLOOR, H, type TransitionDef, type TransitionStage } from '../types'

/**
 * 轉場，第二批（DESIGN.md §14a）：隧道、新幹線、渡輪、飛機、地圖、鳥居、翻頁。
 * 走到這一區的盡頭時引擎挑一個；整個畫面的小場景（新幹線、渡輪、飛機、地圖）畫在 'over' 的離屏畫布上，
 * 用 GBA 式的擦除（百葉、波浪、圓形、滑下）蓋上去；swap 放在場景切換的那一刻，之後的鏡頭用下一區的時段。
 * 隧道與鳥居是在這一區裡發生的：前面起霧，山（鳥居）從霧裡出來，旅人走進去。
 * 動畫全部照「轉場開始後的秒數」（clock）畫，腳本只在固定的時間點做事（swap、藏旅人、走），
 * 所以測試只在幾個時間點 render 也跑得一樣。
 * 蓋著的畫面揭開、看得到下一區的那一刻叫 s.reveal()：地名牌這時候才出來（不會蓋在月台、碼頭、白光上）。
 */

// ---------- 小工具 ----------
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const smooth = (v: number) => {
  v = clamp01(v)
  return v * v * (3 - 2 * v)
}
const easeIn = (v: number) => clamp01(v) ** 2
const easeOut = (v: number) => 1 - (1 - clamp01(v)) ** 2
const lerp = (a: number, b: number, v: number) => a + (b - a) * v
const mod = (v: number, m: number) => ((v % m) + m) % m
/** 固定的亂數（裝飾的位置）：同一個 n 永遠一樣 */
function hash(n: number): number {
  let x = Math.imul((n | 0) ^ 0x5bd1e995, 0x9e3779b1)
  x ^= x >>> 15
  x = Math.imul(x, 0x85ebca6b)
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}
const textW = (s: string) => s.length * 4 - 1

/** 轉場的時鐘：一個看不見的 actor 每格加 dt（不靠 render，測試只取幾格也一樣） */
function clock(s: TransitionStage) {
  const c = { t: 0 }
  s.spawn({ x: -999, y: -999, space: 'screen', z: 'over', update: (_a, dt) => void (c.t += dt) })
  return {
    get t() {
      return c.t
    },
    at: (T: number) => () => c.t >= T,
  }
}

/** 離屏畫布（同畫面大小；寬度變了就重開） */
class Canvas {
  private g: Gfx | null = null
  get(like: Gfx, pal: Palette = like.pal): Gfx {
    if (!this.g || this.g.w !== like.w || this.g.h !== like.h) this.g = new Gfx(like.w, like.h, pal)
    this.g.pal = pal
    this.g.ox = 0
    this.g.oy = 0
    return this.g
  }
}

type Mask = null | 'all' | ((x: number, y: number) => boolean)
/** 把離屏的小場景貼到畫面：all 整個蓋、函式＝擦除的形狀 */
function compose(dst: Gfx, src: Gfx, mask: Mask) {
  if (!mask || src.w !== dst.w || src.h !== dst.h) return
  if (mask === 'all') return dst.buf.set(src.buf)
  const { w, h } = dst
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask(x, y)) dst.buf[y * w + x] = src.buf[y * w + x]!
}
/** 抖色貼上（透明的不貼）：從霧裡出來的山 */
function fadeBlit(dst: Gfx, src: Gfx, level: number) {
  const { w, h } = dst
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = src.buf[y * w + x]!
      if (v && dotOn(x, y, level)) dst.buf[y * w + x] = v
    }
}
/** 擦除：橫的百葉一條一條從右邊蓋過來（in）／往右收回去（out，左邊先露出來） */
const blinds = (p: number, W: number, out: boolean) => (x: number, y: number) => {
  const r = Math.floor(y / 10)
  const l = clamp01((p - (0.35 * r) / 15) / 0.65)
  return out ? x >= W * l : x >= W * (1 - l)
}
/** 擦除：圓（in 圓變大蓋住；out 圓洞變大露出來） */
const iris = (p: number, cx: number, cy: number, W: number, out: boolean) => {
  const R = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) + 2
  const r2 = (R * (out ? easeIn(p) : easeOut(p))) ** 2
  return (x: number, y: number) => {
    // 4px 一格的圓（GBA 的視窗邊緣有點階梯）
    const d = (((x >> 1) << 1) - cx) ** 2 + (((y >> 1) << 1) - cy) ** 2
    return out ? d > r2 : d <= r2
  }
}
/** 擦除：波浪從下面漲上來（in）／往下退（out，上面先露出來） */
const wave = (p: number, t: number, out: boolean) => (x: number, y: number) => {
  const edge = Math.round(3 * Math.sin(x * 0.17 + t * 9) + 2 * Math.sin(x * 0.05 - t * 4))
  return out ? y >= lerp(-8, H + 8, easeIn(p)) + edge : y >= lerp(H + 8, -8, easeOut(p)) + edge
}

/** 旅人（假的，畫在小場景裡）：x 腳的中心、y 腳底，同真的旅人 */
function drawHero(g: Gfx, x: number, y: number, t: number, walking: boolean, opts: { ink?: Px; level?: number; flip?: boolean } = {}) {
  const s = walking ? HERO.walk[Math.floor(t * 7) % 4]! : HERO.stand[0]!
  g.sprite(s, Math.round(x - 8), Math.round(y - 24), opts)
}

const SKY: Record<TimeOfDay, [Px, Px, Px]> = {
  day: ['sky-day-1', 'sky-day-2', 'sky-day-3'],
  dusk: ['sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3'],
  night: ['sky-night-1', 'sky-night-2', 'sky-night-3'],
}
/** 小場景的天空：色帶、日月星、雲（drift 是雲往左飄了多少 px） */
function drawSky(g: Gfx, time: TimeOfDay, horizon: number, drift = 0, sun = true) {
  const W = g.w
  const [a, b, c] = SKY[time]
  g.bands(0, horizon, [a, b, c])
  g.rect(0, horizon, W, H - horizon, c)
  if (time === 'night') {
    for (let i = 0; i < W / 6; i++) g.px(Math.floor(hash(i) * W), Math.floor(hash(i + 999) * (horizon - 10)), hash(i + 77) < 0.3 ? 'star' : 'sky-night-3')
    if (sun) {
      const mx = Math.round(W * 0.8)
      g.circle(mx, 20, 6, 'moon')
      g.circle(mx + 3, 18, 5, 'sky-night-1')
    }
    return
  }
  if (sun) {
    if (time === 'dusk') {
      const sx = Math.round(W * 0.76)
      g.circle(sx, horizon - 14, 11, 'lamp-2')
      g.circle(sx, horizon - 14, 8, 'lamp-1')
    } else g.circle(Math.round(W * 0.82), 20, 7, 'lamp-1')
  }
  const n = Math.ceil(W / 80)
  for (let i = 0; i < n; i++) {
    const span = W + 70
    const x = mod(hash(i + 31) * span - drift * (0.6 + hash(i + 5) * 0.6), span) - 40
    cloud(g, Math.round(x), 8 + Math.floor(hash(i + 13) * (horizon * 0.45)), 18 + Math.floor(hash(i + 17) * 14), time === 'dusk' ? 'sky-dusk-3' : 'cloud-1', time === 'dusk' ? 'sky-dusk-2' : 'cloud-2')
  }
}

/** 速度線：橫的白線往左飛（v 越快越長、越多） */
function speedLines(g: Gfx, t: number, v: number, y0: number, y1: number, k: Px = 'white') {
  if (v < 40) return
  const n = Math.round((g.w / 9) * Math.min(1, v / 300))
  const span = g.w + 90
  for (let i = 0; i < n; i++) {
    const y = Math.round(y0 + hash(i * 3 + 1) * (y1 - y0))
    const len = Math.round(6 + hash(i * 3 + 2) * 34 * Math.min(1, v / 400))
    const x = Math.round(mod(hash(i * 3 + 3) * span - t * v * (1 + hash(i) * 0.8), span) - 45)
    g.hline(x, x + len, y, k)
  }
}

/** 霧：一層會動的抖色（列與行各一組正弦，抖出來像一團一團），weight(x, y) 0–1 */
function mist(g: Gfx, k: Px, t: number, level: number, weight: (x: number, y: number) => number) {
  if (level <= 0) return
  const { w, buf } = g
  const v = g.pal.u32[k]
  const col = new Float32Array(w)
  for (let x = 0; x < w; x++) col[x] = Math.sin(x * 0.045 + t * 0.6) * 0.6 + Math.sin(x * 0.13 - t * 0.9) * 0.4
  for (let y = 0; y < H; y++) {
    const row = Math.sin(y * 0.16 + t * 0.4) * 0.5
    for (let x = 0; x < w; x++) {
      const L = Math.round(level * weight(x, y) * (0.75 + 0.25 * (col[x]! + row)))
      if (L > 0 && dotOn(x, y, L)) buf[y * w + x] = v
    }
  }
}
const mistInk = (env: Env): Px => (env.time === 'night' ? 'cloud-2' : 'cloud-1')

// ---------- 地點（地圖的位置、兩區的距離） ----------
/** 每一區在地圖上的經緯度；不在表裡的放在本州中間 */
const LOC: Record<string, [number, number]> = {
  hokkaido: [142.4, 43.3],
  shirakawago: [136.9, 36.26],
  tokyo: [139.76, 35.68],
  kamakura: [139.55, 35.32],
  fuji: [138.73, 35.36],
  kyoto: [135.77, 35.01],
  nara: [135.83, 34.68],
  osaka: [135.5, 34.69],
  miyajima: [132.32, 34.3],
  okinawa: [127.8, 26.3],
}
const MID_HONSHU: [number, number] = [138.0, 36.2]
const locOf = (a: AreaDef) => LOC[a.id] ?? MID_HONSHU
/** 兩區的直線距離（km） */
function km(a: AreaDef, b: AreaDef) {
  const [lo1, la1] = locOf(a)
  const [lo2, la2] = locOf(b)
  const r = Math.PI / 180
  const h = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
const isOkinawa = (a: AreaDef) => a.id === 'okinawa'
const has = (a: AreaDef, ...tags: AreaDef['tags']) => tags.some((t) => a.tags.includes(t))

// =====================================================================
// 新幹線：月台、白色長鼻（藍線）進站、開門、上車、開走（速度線），高架上奔馳，到站、下車
// =====================================================================
const CAR = 96
const NOSE = 46
const PLAT = FLOOR - 6

/** 列車：nose 是鼻尖的 x，top 是車頂的 y（車高 38）；車身一直接到畫面左邊外面 */
function train(g: Gfx, nose: number, top: number, night: boolean, open = 0) {
  const ns = nose - NOSE
  const bot = top + 38
  const far = -4000
  const shape: number[] = [ns, top]
  for (let i = 1; i <= 10; i++) {
    const u = i / 10
    shape.push(ns + NOSE * u, top + 1 + 25 * u ** 1.8)
  }
  shape.push(nose, top + 30, nose - 2, top + 33, nose - 7, bot, ns, bot)
  const sil = (k: Px, dx: number, dy: number) => {
    g.rect(far + dx, top + dy, ns - far + 1, 38, k)
    g.poly(shape.map((v, i) => v + (i % 2 ? dy : dx)), k)
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) sil('ink', dx, dy)
  sil('white', 0, 0)
  const L = Math.max(-8, Math.min(ns, -8))
  g.hline(L, ns, top + 1, 'stone-1')
  // 藍線（沿著鼻子往前收）
  g.rect(L, top + 22, ns - L, 3, 'cloth-2')
  g.hline(L, ns, top + 26, 'cloth-1')
  g.poly([ns, top + 22, ns + NOSE * 0.6, top + 23, nose - 3, top + 27, nose - 4, top + 29, ns + NOSE * 0.6, top + 26, ns, top + 25], 'cloth-2')
  // 裙板
  g.rect(L, top + 33, ns - L, 5, 'stone-2')
  g.poly([ns, top + 33, nose - 4, top + 33, nose - 7, bot, ns, bot], 'stone-2')
  // 駕駛窗、頭燈
  g.poly([ns + 5, top + 4, ns + 18, top + 7, ns + 20, top + 11, ns + 4, top + 9], 'roof-3')
  g.px(ns + 8, top + 5, 'sea-2')
  g.rect(nose - 14, top + 18, 3, 2, 'lamp-1')
  const door = (x: number, o: number) => {
    const off = Math.round(clamp01(o) * 9)
    g.frame(x - 5, top + 6, 11, 28, 'stone-2')
    g.rect(x - 4, top + 7, 9, 26, night ? 'lamp-1' : 'paper-2')
    if (off < 9) {
      g.rect(x - 4, top + 7, 9 - off, 26, 'white')
      if (off < 7) g.rect(x - 3, top + 9, 7 - off, 7, 'roof-3')
    }
  }
  for (let k = 0; ns - k * CAR > -CAR - 20; k++) {
    const front = ns - k * CAR
    const rear = front - CAR
    if (front > g.w + CAR) continue
    if (k > 0) g.vline(front, top + 2, bot - 1, 'stone-3')
    door(front - 12, k === 0 ? open : 0)
    door(rear + 12, 0)
    for (let x = front - 24; x > rear + 24; x -= 7) g.rect(x - 4, top + 9, 5, 4, night ? 'lamp-1' : 'roof-3')
    g.rect(front - 22, top + 35, 14, 3, 'stone-4')
    g.rect(rear + 8, top + 35, 14, 3, 'stone-4')
  }
}
/** 列車的門（第一節車廂、鼻子後面那一個）在鼻尖往左多少 */
const DOOR_BACK = NOSE + 12

/** 月台：遠處的街、軌道、列車、雨棚、柱子、站名牌、月台、旅人 */
function station(
  g: Gfx,
  env: Env,
  name: string,
  hx: number,
  t: number,
  tr: { nose: number; open: number; v: number } | null,
  hero: { x: number; y: number; walk: boolean } | null,
) {
  const W = g.w
  const night = env.time === 'night'
  const lit = env.time !== 'day'
  drawSky(g, env.time, 100, t * 3)
  for (let x = 0; x < W; x++) g.vline(x, Math.round(90 + 5 * Math.sin(x * 0.031) + 3 * Math.sin(x * 0.083 + 1)), 104, 'leaf-4')
  for (let i = 0, x = -6; x < W; i++) {
    const bw = 10 + Math.floor(hash(i) * 14)
    const bh = 6 + Math.floor(hash(i + 50) * 18)
    g.rect(x, 104 - bh, bw, bh, i % 3 === 0 ? 'roof-1' : 'stone-3')
    if (lit) for (let wy = 104 - bh + 3; wy < 102; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) if (hash(wx * 7 + wy) < 0.45) g.px(wx, wy, 'lamp-1')
    x += bw + Math.floor(hash(i + 9) * 8)
  }
  // 軌道
  g.rect(0, 104, W, PLAT - 104, 'stone-3')
  g.dither(0, 106, W, PLAT - 106, 'stone-4', 5)
  for (let x = mod(hx + 30, 150) - 150; x < W + 10; x += 150) {
    g.rect(x, 56, 3, 50, 'stone-3')
    g.rect(x - 6, 58, 15, 2, 'stone-3')
  }
  g.hline(0, W, 61, 'ink-2')
  g.hline(0, W, 127, 'stone-1')
  g.hline(0, W, 130, 'stone-2')
  if (tr) {
    train(g, tr.nose, 92, night, tr.open)
    speedLines(g, t, tr.v, 94, 128)
  }
  // 雨棚、燈
  g.rect(0, 18, W, 9, 'roof-2')
  g.hline(0, W, 18, 'roof-1')
  g.hline(0, W, 26, 'roof-1')
  g.rect(0, 27, W, 3, 'roof-3')
  for (let x = 6; x < W; x += 36) g.rect(x, 30, 8, 1, lit ? 'lamp-1' : 'paper')
  // 柱子（避開旅人與車門）
  for (let x = hx + 70; x < W + 10; x += 120) pillar(g, x)
  for (let x = hx - 64; x > -10; x -= 120) pillar(g, x)
  // 站名牌（3×5 的羅馬字）
  const bw = textW(name) + 10
  const sx = Math.round(clamp(hx + 120, bw / 2 + 4, W - bw / 2 - 4))
  g.vline(sx - bw / 2 + 3, 30, 36, 'stone-3')
  g.vline(sx + bw / 2 - 3, 30, 36, 'stone-3')
  g.rect(sx - bw / 2, 36, bw, 12, 'white')
  g.frame(sx - bw / 2, 36, bw, 12, 'ink')
  g.hline(sx - bw / 2 + 1, sx + bw / 2 - 2, 45, 'cloth-1')
  g.text(name, sx - bw / 2 + 5, 38, 'ink')
  // 月台
  g.rect(0, PLAT, W, H - PLAT, 'stone-1')
  g.hline(0, W, PLAT, 'white')
  g.rect(0, PLAT + 3, W, 2, 'gold-1')
  for (let x = 0; x < W; x += 2) g.px(x, PLAT + 3, 'gold-2')
  g.hline(0, W, 147, 'stone-2')
  g.hline(0, W, 155, 'stone-2')
  for (let x = mod(hx, 24); x < W; x += 24) g.vline(x, 148, 154, 'stone-2')
  if (hero) drawHero(g, hero.x, hero.y, t, hero.walk)
}
function pillar(g: Gfx, x: number) {
  g.rect(x - 2, 30, 5, PLAT - 30, 'stone-2')
  g.vline(x + 2, 30, PLAT - 1, 'stone-3')
  g.rect(x - 3, PLAT - 2, 7, 2, 'stone-3')
}

/** 高架上奔馳：遠山（富士）、田、高架橋、電線桿、速度線 */
function trainRun(g: Gfx, env: Env, t: number) {
  const W = g.w
  const V = 420
  drawSky(g, env.time, 96, t * 8)
  peak(g, Math.round(W * 0.78 - t * 10), 50, 100, 48, 'roof-1', 'snow-1')
  for (let x = 0; x < W; x++) g.vline(x, Math.round(88 + 5 * Math.sin((x + t * 18) * 0.02) + 3 * Math.sin((x + t * 18) * 0.057)), 104, 'roof-1')
  const hill: Px = env.season === 'autumn' ? 'momiji-2' : env.season === 'winter' ? 'stone-2' : 'leaf-3'
  for (let x = 0; x < W; x++) g.vline(x, Math.round(99 + 4 * Math.sin((x + t * 110) * 0.045) + 2 * Math.sin((x + t * 110) * 0.11)), 110, hill)
  const field: Px = env.season === 'spring' ? 'leaf-1' : env.season === 'summer' ? 'leaf-2' : env.season === 'autumn' ? 'gold-1' : 'snow-1'
  const furrow: Px = env.season === 'winter' ? 'snow-2' : env.season === 'autumn' ? 'gold-2' : 'leaf-3'
  g.rect(0, 108, W, H - 108, field)
  for (let y = 112; y < H; y += 6) for (let x = mod(-t * V * ((y - 100) / 60), 26) - 26; x < W; x += 26) g.hline(x, x + 12, y, furrow)
  // 高架橋
  g.rect(0, 118, W, 5, 'stone-2')
  g.hline(0, W, 118, 'stone-1')
  g.hline(0, W, 122, 'stone-3')
  for (let x = mod(-t * V, 44) - 44; x < W + 6; x += 44) {
    g.rect(x, 123, 6, H - 123, 'stone-2')
    g.vline(x + 5, 123, H, 'stone-3')
  }
  for (let x = mod(-t * V, 170) - 170; x < W + 10; x += 170) {
    g.rect(x, 62, 3, 56, 'stone-3')
    g.rect(x - 5, 64, 13, 2, 'stone-3')
  }
  g.hline(0, W, 67, 'ink-2')
  train(g, Math.round(W * 0.66), 80, env.time === 'night')
  speedLines(g, t, V, 70, 126)
}

/**
 * 新幹線的站（站名牌上的羅馬字）：這一區或最近的那一站。
 * 白川鄉、奈良、沖繩沒有新幹線，不搭；北海道是北海道新幹線的新函館北斗，只跟東京直通（其他地方搭飛機）
 */
const SHINKANSEN_AT: Record<string, string> = {
  hokkaido: 'SHIN-HAKODATE-HOKUTO',
  tokyo: 'TOKYO',
  kamakura: 'SHIN-YOKOHAMA',
  fuji: 'SHIN-FUJI',
  kyoto: 'KYOTO',
  osaka: 'SHIN-OSAKA',
  miyajima: 'HIROSHIMA',
}
const stationOf = (a: AreaDef) => SHINKANSEN_AT[a.id] ?? a.romaji

export const SHINKANSEN: TransitionDef = {
  id: 'shinkansen',
  weight: 2,
  fits: (a, b) => {
    if (!SHINKANSEN_AT[a.id] || !SHINKANSEN_AT[b.id] || km(a, b) < 100) return false
    if (a.id === 'hokkaido' || b.id === 'hokkaido') return a.id === 'tokyo' || b.id === 'tokyo'
    return true
  },
  *run(s) {
    const c = clock(s)
    const cv = new Canvas()
    const hx = s.hero.x
    const from = stationOf(s.area)
    const to = stationOf(s.next)
    let swapped = false
    s.hero.stop()
    // 時間點
    const T = { inEnd: 0.4, arrive: 0.25, stop: 1.55, open: 1.8, walkEnd: 2.55, inEnd2: 2.8, close: 3.05, go: 3.1, cut: 4.0, cut2: 5.0, stop2: 6.2, open2: 6.45, out2: 6.75, wipe: 6.95, end: 7.35 }
    const stop1 = hx + 16 + DOOR_BACK
    const stop2 = hx + DOOR_BACK
    s.paint('over', (g) => {
      const t = c.t
      const W = g.w
      const o = cv.get(g)
      if (!swapped && t < T.cut) {
        // 出發的月台
        let nose = stop1
        let v = 0
        if (t < T.stop) {
          const u = clamp01((t - T.arrive) / (T.stop - T.arrive))
          nose = lerp(-30, stop1, 1 - (1 - u) ** 2)
          v = (2 * (stop1 + 30) * (1 - u)) / (T.stop - T.arrive)
        } else if (t > T.go) {
          const a = (2 * (W + 260 - stop1)) / (T.cut - T.go) ** 2
          nose = stop1 + 0.5 * a * (t - T.go) ** 2
          v = a * (t - T.go)
        }
        const open = t < T.open ? clamp01((t - T.stop) / 0.25) : t < T.inEnd2 ? 1 : 1 - clamp01((t - T.inEnd2) / 0.25)
        let hero: { x: number; y: number; walk: boolean } | null = { x: hx, y: FLOOR, walk: false }
        if (t >= T.open && t < T.walkEnd) hero = { x: lerp(hx, hx + 16, clamp01((t - T.open - 0.05) / 0.7)), y: FLOOR, walk: true }
        else if (t >= T.walkEnd && t < T.inEnd2) hero = { x: hx + 16, y: lerp(FLOOR, FLOOR - 9, (t - T.walkEnd) / (T.inEnd2 - T.walkEnd)), walk: true }
        else if (t >= T.inEnd2) hero = null
        station(o, s.env, from, hx, t, t >= T.arrive ? { nose: Math.round(nose), open, v } : null, hero)
      } else if (!swapped) trainRun(o, s.env, t - T.cut)
      else {
        // 到站
        const u = clamp01((t - T.cut2) / (T.stop2 - T.cut2))
        const nose = lerp(-30, stop2, 1 - (1 - u) ** 2)
        const v = (2 * (stop2 + 30) * (1 - u)) / (T.stop2 - T.cut2)
        const open = t < T.wipe ? clamp01((t - T.stop2) / 0.25) : 1
        let hero: { x: number; y: number; walk: boolean } | null = null
        if (t >= T.open2) hero = { x: hx, y: lerp(FLOOR - 9, FLOOR, clamp01((t - T.open2) / (T.out2 - T.open2))), walk: t < T.out2 }
        station(o, s.env, to, hx, t, { nose: Math.round(nose), open, v }, hero)
      }
      const mask: Mask = t < T.inEnd ? blinds(t / T.inEnd, W, false) : t >= T.wipe ? blinds((t - T.wipe) / (T.end - T.wipe), W, true) : 'all'
      compose(g, o, mask)
    })
    yield c.at(T.inEnd)
    s.hero.hidden = true
    yield c.at(T.cut2)
    s.swap()
    swapped = true
    s.hero.stop()
    s.hero.hidden = true
    yield c.at(T.wipe)
    // 擦除開始，下一區露出來
    s.reveal()
    s.hero.hidden = false
    yield c.at(T.end)
    s.hero.walk()
  },
}

// =====================================================================
// 渡輪：碼頭上船、汽笛的煙、開出去；海上（波浪、海鷗）；到下一個碼頭、下船
// =====================================================================
const DECK = 126
/** 船（156×66）：sprite 的上緣在 DECK - 50，水線在 DECK + 14 */
function shipSprite(night: boolean) {
  return drawSprite(156, 66, (g) => {
    const win: Px = night ? 'lamp-1' : 'sea-3'
    // 煙囪、桅杆
    g.poly([52, 6, 63, 6, 65, 28, 50, 28], 'paper')
    g.rect(51, 11, 13, 4, 'shu-1')
    g.rect(52, 6, 12, 2, 'ink-2')
    g.vline(100, 2, 18, 'stone-3')
    g.hline(96, 104, 7, 'stone-3')
    // 船橋、客艙
    g.rect(70, 18, 36, 10, 'white')
    g.rect(72, 20, 32, 3, night ? 'lamp-2' : 'roof-3')
    for (let x = 75; x < 104; x += 5) g.vline(x, 20, 22, 'white')
    g.rect(40, 28, 72, 22, 'white')
    g.hline(40, 111, 28, 'stone-1')
    for (let x = 44; x < 108; x += 7) g.rect(x, 33, 4, 4, win)
    for (let x = 44; x < 108; x += 7) g.rect(x, 41, 4, 3, win)
    g.rect(43, 23, 13, 4, 'shu-1') // 救生艇
    g.hline(44, 54, 23, 'shu-2')
    // 船身
    g.poly([2, 50, 138, 50, 152, 41, 155, 42, 145, 64, 8, 64, 1, 56], 'white')
    g.poly([3, 54, 147, 54, 146, 57, 4, 57], 'cloth-2')
    g.poly([6, 61, 144, 61, 143, 64, 8, 64], 'shu-2')
    g.hline(2, 138, 50, 'stone-1')
    for (let x = 60; x < 136; x += 9) g.px(x, 59, 'sea-3')
    // 船頭的欄杆
    for (let x = 112; x < 138; x += 3) g.vline(x, 45, 49, 'stone-2')
    g.hline(112, 140, 45, 'stone-2')
  })
}
const SHIP = { day: shipSprite(false), night: shipSprite(true) }
const GULL = frames(
  [
    `
    w.......w
    .w.....w.
    ..wwkww..
    `,
    `
    ....k....
    .wwwwwww.
    w.......w
    `,
  ],
  { w: 'white', k: 'stone-3' },
)

/** 海：色帶、浪花（v 是往左流的速度）、遠島、燈塔 */
function sea(g: Gfx, env: Env, t: number, v: number, islands: boolean) {
  const W = g.w
  drawSky(g, env.time, 96, t * 4 + t * v * 0.02)
  if (islands) {
    const off = t * v * 0.04
    for (let x = 0; x < W; x++) {
      const xx = x + off
      const h = Math.max(0, 7 * Math.sin(xx * 0.021) + 4 * Math.sin(xx * 0.063 + 2) - 2)
      if (h > 0) g.vline(x, Math.round(96 - h), 96, 'leaf-4')
    }
  }
  g.bands(96, H - 96, ['sea-1', 'sea-2', 'sea-3'])
  const rows = [99, 103, 108, 114, 121, 129, 138, 148, 156]
  rows.forEach((y, i) => {
    const depth = (y - 92) / 64
    const step = Math.round(20 + 30 * (1 - depth))
    const len = Math.round(2 + depth * 6)
    const k: Px = i < 2 ? 'sea-1' : 'foam'
    for (let x = mod(hash(i) * 40 - t * (6 + v * depth), step) - step; x < W; x += step) g.hline(x, x + len, y + (Math.floor(t * 2 + x * 0.1) % 2), k)
  })
}
function harbor(g: Gfx, env: Env, t: number, hx: number) {
  const W = g.w
  sea(g, env, t, 0, true)
  // 防波堤と燈塔
  const bx = Math.round(W * 0.62)
  g.rect(bx, 99, W - bx, 3, 'stone-2')
  g.hline(bx, W, 99, 'stone-1')
  const lx = W - 22
  g.rect(lx - 3, 80, 7, 19, 'white')
  g.rect(lx - 3, 84, 7, 3, 'shu-1')
  g.rect(lx - 3, 92, 7, 3, 'shu-1')
  g.rect(lx - 4, 77, 9, 3, 'shu-2')
  if (env.time !== 'day' && Math.floor(t * 1.5) % 2 === 0) g.rect(lx - 1, 78, 3, 2, 'lamp-1')
  void hx
}
/** 碼頭（前景，整個寬度）：棧板在 FLOOR */
function pier(g: Gfx, env: Env, hx: number) {
  const W = g.w
  for (let x = mod(hx - 12, 26) - 26; x < W; x += 26) g.rect(x, 145, 4, H - 145, 'wood-3')
  g.rect(0, FLOOR, W, 3, 'wood-1')
  g.rect(0, FLOOR + 3, W, 4, 'wood-2')
  for (let x = mod(hx, 8); x < W; x += 8) g.vline(x, FLOOR + 3, FLOOR + 6, 'wood-3')
  g.hline(0, W, FLOOR + 7, 'ink-2')
  // 燈、繫船柱
  const px = hx - 44
  g.rect(px, 98, 2, FLOOR - 98, 'stone-3')
  g.rect(px - 3, 94, 8, 5, env.time === 'day' ? 'paper' : 'lamp-1')
  g.frame(px - 3, 94, 8, 5, 'stone-4')
  g.rect(hx + 48, FLOOR - 4, 5, 4, 'stone-4')
  g.hline(hx + 47, hx + 53, FLOOR - 4, 'stone-3')
}
function ship(g: Gfx, env: Env, left: number, bob: number, hero: { x: number; y: number; walk: boolean; t: number } | null, onDeck: boolean) {
  const top = DECK - 50 + bob
  g.sprite(env.time === 'night' ? SHIP.night : SHIP.day, Math.round(left), top)
  if (hero && onDeck) drawHero(g, hero.x, hero.y + bob, hero.t, hero.walk)
  // 船尾的欄杆（在旅人前面）
  for (let x = Math.round(left) + 4; x < left + 39; x += 3) g.vline(x, DECK - 6 + bob, DECK - 1 + bob, 'stone-1')
  g.hline(Math.round(left) + 3, Math.round(left) + 39, DECK - 6 + bob, 'stone-1')
}
function gangway(g: Gfx, x0: number, y0: number, x1: number, y1: number) {
  g.line(x0, y0, x1, y1, 'wood-3')
  g.line(x0, y0 - 1, x1, y1 - 1, 'wood-1')
  g.line(x0, y0 - 5, x1, y1 - 5, 'stone-2')
}

export const FERRY: TransitionDef = {
  id: 'ferry',
  weight: 1.6,
  fits: (a, b) => has(a, 'coast') || has(b, 'coast'),
  *run(s) {
    const c = clock(s)
    const cv = new Canvas()
    const hx = s.hero.x
    let swapped = false
    s.hero.stop()
    const T = { inEnd: 0.5, walk: 0.6, foot: 1.05, deck: 1.5, puff: 1.6, go: 1.9, cut: 3.3, cut2: 4.5, stop2: 6.1, down: 6.25, land: 6.75, wipe: 6.95, end: 7.45 }
    const left0 = hx
    const left2 = hx - 30
    s.paint('over', (g) => {
      const t = c.t
      const W = g.w
      const o = cv.get(g)
      const bob = Math.floor(t * 1.6) % 2
      if (!swapped && t < T.cut) {
        harbor(o, s.env, t, hx)
        const a = (2 * (W + 12 - left0)) / (T.cut - T.go) ** 2
        const left = t < T.go ? left0 : left0 + 0.5 * a * (t - T.go) ** 2
        // 旅人：碼頭 → 舷梯 → 甲板
        let hero = { x: hx, y: FLOOR, walk: false, t }
        let onDeck = false
        if (t >= T.walk && t < T.foot) hero = { x: lerp(hx, hx + 10, (t - T.walk) / (T.foot - T.walk)), y: FLOOR, walk: true, t }
        else if (t >= T.foot && t < T.deck) {
          const u = (t - T.foot) / (T.deck - T.foot)
          hero = { x: lerp(hx + 10, hx + 20, u), y: lerp(FLOOR, DECK, u), walk: true, t }
          onDeck = u > 0.6
        } else if (t >= T.deck) {
          hero = { x: left + 20, y: DECK, walk: false, t }
          onDeck = true
        }
        ship(o, s.env, left, t < T.go ? 0 : bob, hero, onDeck)
        if (t < T.puff + 0.2) gangway(o, hx + 9, FLOOR, hx + 18, DECK + 1)
        // 汽笛的煙
        if (t > T.puff && t < T.puff + 1) {
          const u = (t - T.puff) / 1
          for (let i = 0; i < 3; i++) o.circle(Math.round(left + 57 - u * 10 - i * 5), Math.round(DECK - 46 - u * 16 - i * 4), 2 + i + u * 2, 'cloud-1')
        }
        if (t > T.go + 0.3) for (let i = 0; i < 6; i++) o.hline(left - 6 - i * 10 - (t * 40) % 10, left - 2 - i * 10 - (t * 40) % 10, DECK + 13 + (i % 2), 'foam')
        pier(o, s.env, hx)
        if (!onDeck && t < T.deck) drawHero(o, hero.x, hero.y, t, hero.walk)
      } else if (!swapped) {
        // 海上：船停在畫面中間，海往後流；海鷗跟著飛
        const u = t - T.cut
        const V = 150
        sea(o, s.env, t, V, true)
        const left = Math.round(W * 0.5 - 78)
        for (let i = 0; i < 9; i++) {
          const x = left - 4 - mod(i * 13 + u * V * 0.6, 117)
          o.hline(x - 6 + i, x, DECK + 13 + (i % 3), 'foam')
        }
        ship(o, s.env, left, bob, { x: left + 20, y: DECK, walk: false, t }, true)
        for (let i = 0; i < 6; i++) o.px(left + 150 + (i % 3), DECK + 10 + Math.floor(hash(i + Math.floor(t * 12)) * 5), 'foam')
        for (let i = 0; i < 3; i++) {
          const gx = Math.round(left + 30 + i * 46 + 18 * Math.sin(u * 1.1 + i * 2))
          const gy = Math.round(50 + i * 9 + 6 * Math.sin(u * 2.3 + i))
          o.sprite(GULL[Math.floor(u * 5 + i) % 2]!, gx, gy)
        }
      } else {
        // 到港
        harbor(o, s.env, t, hx)
        const u = clamp01((t - T.cut2) / (T.stop2 - T.cut2))
        const left = lerp(-170, left2, 1 - (1 - u) ** 2)
        let hero = { x: left + 20, y: DECK, walk: false, t }
        let onDeck = true
        if (t >= T.down) {
          const k = clamp01((t - T.down) / (T.land - T.down))
          hero = { x: lerp(left2 + 20, hx, k), y: lerp(DECK, FLOOR, k), walk: k < 1, t }
          onDeck = k < 0.4
        }
        ship(o, s.env, left, t < T.stop2 ? bob : 0, hero, onDeck)
        if (t >= T.stop2) gangway(o, hx - 1, FLOOR, hx - 9, DECK + 1)
        pier(o, s.env, hx)
        if (!onDeck) drawHero(o, hero.x, hero.y, t, hero.walk)
      }
      const mask: Mask = t < T.inEnd ? wave(t / T.inEnd, t, false) : t >= T.wipe ? wave((t - T.wipe) / (T.end - T.wipe), t, true) : 'all'
      compose(g, o, mask)
    })
    yield c.at(T.inEnd)
    s.hero.hidden = true
    yield c.at(T.cut2)
    s.swap()
    swapped = true
    s.hero.stop()
    s.hero.hidden = true
    yield c.at(T.wipe)
    // 擦除開始，下一區露出來
    s.reveal()
    s.hero.hidden = false
    yield c.at(T.end)
    s.hero.walk()
  },
}

// =====================================================================
// 飛機：跑道上加速、抬頭起飛，穿過雲層到雲海上；下降穿過雲，降落在下一個機場
// =====================================================================
function rotPts(pts: number[], a: number, cx: number, cy: number) {
  const co = Math.cos(a)
  const si = Math.sin(a)
  const out: number[] = []
  for (let i = 0; i < pts.length; i += 2) out.push(cx + pts[i]! * co - pts[i + 1]! * si, cy + pts[i]! * si + pts[i + 1]! * co)
  return out
}
const PLANE_PARTS: Array<[Px, number[]]> = [
  ['cloth-1', [-24, -4, -29, -15, -23, -15, -15, -4]],
  ['white', [-27, -4, 20, -4, 24, -3, 26, -1, 27, 1, 25, 3, 20, 4, -14, 4, -22, 1, -27, -1]],
  ['cloth-1', [-14, 2, 22, 2, 21, 3, -14, 3]],
  ['stone-2', [-29, -2, -20, -2, -22, 0, -30, 0]],
  ['stone-2', [-3, 1, 6, 1, -6, 9, -11, 9]],
  ['stone-3', [-2, 4, 6, 4, 6, 7, -2, 7]],
  ['roof-3', [20, -3, 23, -3, 25, -1, 20, -1]],
]
/** 飛機的 sprite：角度 -2..2（負的抬頭），64×40，中心在 (32, 20) */
const PLANE = [-0.22, -0.11, 0, 0.11, 0.2].map((a) =>
  drawSprite(64, 40, (g) => {
    for (const [k, pts] of PLANE_PARTS) g.poly(rotPts(pts, a, 32, 20), k)
    for (let x = -12; x <= 17; x += 2) {
      const [px, py] = rotPts([x, -2], a, 32, 20)
      g.px(Math.round(px!), Math.round(py!), 'roof-2')
    }
  }),
)
const plane = (g: Gfx, x: number, y: number, pose: -2 | -1 | 0 | 1 | 2, gear = false) => {
  if (gear) {
    g.rect(Math.round(x) - 5, Math.round(y) + 5, 1, 3, 'stone-4')
    g.rect(Math.round(x) - 7, Math.round(y) + 8, 4, 2, 'ink')
    g.rect(Math.round(x) + 18, Math.round(y) + 5, 1, 3, 'stone-4')
    g.rect(Math.round(x) + 17, Math.round(y) + 8, 3, 2, 'ink')
  }
  g.sprite(PLANE[pose + 2]!, Math.round(x - 32), Math.round(y - 20))
}
const RUNWAY = 122
function airport(g: Gfx, env: Env, t: number) {
  const W = g.w
  const lit = env.time !== 'day'
  drawSky(g, env.time, 104, t * 4)
  for (let x = 0; x < W; x++) g.vline(x, Math.round(98 + 3 * Math.sin(x * 0.04) + 2 * Math.sin(x * 0.11)), 106, 'leaf-4')
  // 航廈、塔台
  const tx = Math.round(W * 0.16)
  g.rect(tx - 3, 70, 7, 36, 'stone-2')
  g.vline(tx + 3, 70, 105, 'stone-3')
  g.rect(tx - 7, 62, 15, 8, 'stone-1')
  g.rect(tx - 6, 64, 13, 3, lit ? 'lamp-1' : 'sea-3')
  g.rect(tx - 8, 60, 17, 2, 'stone-3')
  const ax = tx + 16
  const aw = Math.round(W * 0.42)
  g.rect(ax, 94, aw, 12, 'stone-1')
  g.rect(ax, 92, aw, 2, 'stone-2')
  for (let x = ax + 3; x < ax + aw - 3; x += 5) g.rect(x, 97, 3, 4, lit ? 'lamp-1' : 'sea-2')
  g.rect(0, 106, W, H - 106, 'leaf-2')
  g.dither(0, 106, W, H - 106, 'leaf-3', 5)
  g.rect(0, RUNWAY, W, 18, 'stone-4')
  g.hline(0, W, RUNWAY + 1, 'paper')
  g.hline(0, W, RUNWAY + 16, 'paper')
  for (let x = 0; x < W; x += 16) g.rect(x, RUNWAY + 9, 8, 1, 'paper')
  for (let x = 4; x < W; x += 24) {
    g.px(x, RUNWAY - 1, lit ? 'lamp-2' : 'stone-2')
    g.px(x, RUNWAY + 18, lit ? 'lamp-2' : 'stone-2')
  }
}
/** 雲海：上緣 y（起伏），下面全白 */
function cloudSea(g: Gfx, top: number, off: number) {
  const W = g.w
  for (let x = 0; x < W; x++) {
    const xx = x + off
    const y = Math.round(top + 3 * Math.sin(xx * 0.07) + 2 * Math.sin(xx * 0.17 + 1) - Math.abs(4 * Math.sin(xx * 0.035)))
    g.vline(x, y, H, 'cloud-1')
    g.px(x, y + 4, 'cloud-2')
  }
  g.dither(0, top + 8, W, H, 'cloud-2', 4)
}
/** 穿過雲：灰白的底、一團團白雲往 (vx, vy) 飛、雲絲（速度線） */
function cloudRush(g: Gfx, t: number, level: number, vx: number, vy: number) {
  if (level <= 0) return
  const W = g.w
  g.dither(0, 0, W, H, 'cloud-2', level)
  const n = Math.round((W / 26) * Math.min(1, level / 10))
  for (let i = 0; i < n; i++) {
    const sp = 0.6 + hash(i) * 0.8
    const r = 9 + Math.floor(hash(i * 5 + 2) * 16)
    const x = Math.round(mod(hash(i * 5) * (W + 80) + t * vx * sp, W + 80) - 40)
    const y = Math.round(mod(hash(i * 5 + 1) * (H + 60) + t * vy * sp, H + 60) - 30)
    cloud(g, x - r, y, r * 3)
  }
  const m = Math.round((W / 14) * (level / 16))
  for (let i = 0; i < m; i++) {
    const y = Math.round(mod(hash(i * 7 + 3) * H + t * vy * 1.6, H))
    const x = Math.round(mod(hash(i * 7 + 4) * (W + 40) + t * vx * 2, W + 40) - 20)
    g.line(x, y, x + Math.round(vx * 0.05), y + Math.round(vy * 0.05), 'cloud-1')
  }
}
/** 雲裡的飛機：畫在雲上面，前面再飄過幾片近的雲 */
function planeInCloud(g: Gfx, x: number, y: number, pose: -2 | -1 | 0 | 1 | 2, level: number, t: number, vx: number) {
  plane(g, x, y, pose)
  if (level < 10) return
  for (let i = 0; i < 2; i++) cloud(g, Math.round(mod(hash(i + 400) * (g.w + 120) + t * vx * 1.8, g.w + 120) - 90), Math.round(y - 6 + i * 10), 60)
}

export const PLANE_TR: TransitionDef = {
  id: 'plane',
  weight: 1.6,
  fits: (a, b) => ['hokkaido', 'okinawa'].includes(a.id) || ['hokkaido', 'okinawa'].includes(b.id) || km(a, b) >= 600,
  *run(s) {
    const c = clock(s)
    const cv = new Canvas()
    const hx = s.hero.x
    let swapped = false
    s.hero.stop()
    const T = { inEnd: 0.45, climb: 1.9, cut: 3.3, land: 4.4, wipe: 6.0, end: 6.45 }
    s.paint('over', (g) => {
      const t = c.t
      const W = g.w
      const o = cv.get(g)
      if (!swapped && t < T.climb) {
        // 起飛（鏡頭不動）
        airport(o, s.env, t)
        const u = clamp01((t - 0.15) / (T.climb - 0.15))
        const x = lerp(-40, W + 90, u ** 1.7)
        const lift = Math.max(0, x - W * 0.5)
        const pose = x < W * 0.44 ? 0 : x < W * 0.5 ? -1 : -2
        plane(o, x, RUNWAY + 9 - 9 - lift * 0.36, pose, lift < 6)
      } else if (!swapped) {
        // 爬升：穿過雲 → 雲海上
        const u = t - T.climb
        drawSky(o, s.env.time, 100, u * 30)
        const seaTop = lerp(-20, 112, smooth((u - 0.35) / 1.0))
        cloudSea(o, seaTop, u * 70)
        const lv = u < 0.45 ? 16 : Math.round(16 * (1 - clamp01((u - 0.45) / 0.45)))
        cloudRush(o, u, lv, -220, 170)
        planeInCloud(o, Math.round(W * 0.42), 74 + Math.round(Math.sin(u * 3) * 1.5), u < 0.8 ? -2 : u < 1.05 ? -1 : 0, lv, u, -220)
      } else if (t < T.land) {
        // 下降：雲海升上來 → 進雲裡
        const u = t - T.cut
        drawSky(o, s.env.time, 100, u * 30)
        cloudSea(o, lerp(112, -30, smooth(u / 0.9)), u * 70 + 200)
        const lv = Math.round(16 * clamp01((u - 0.45) / 0.45))
        cloudRush(o, u, lv, -220, -170)
        planeInCloud(o, Math.round(W * 0.42), 74, u < 0.15 ? 0 : 1, lv, u, -220)
      } else {
        // 降落
        const u = t - T.land
        airport(o, s.env, t)
        const p = clamp01(u / (T.end - T.land))
        const x = lerp(-50, W * 0.7, 1 - (1 - p) ** 2.2)
        const td = W * 0.34
        const air = Math.max(0, td - x)
        plane(o, x, RUNWAY - air * 0.34, air > 30 ? 1 : air > 4 ? -1 : 0, air < 12)
        if (air <= 0 && x < td + 50) for (let i = 0; i < 3; i++) o.circle(Math.round(x - 10 - (x - td) * 0.4 - i * 5), RUNWAY + 8 - i, 1 + Math.min(3, (x - td) / 12), 'stone-1')
        cloudRush(o, u, Math.round(16 * (1 - clamp01(u / 0.4))), -220, -170)
      }
      const mask: Mask = t < T.inEnd ? iris(t / T.inEnd, hx, FLOOR - 12, W, false) : t >= T.wipe ? iris((t - T.wipe) / (T.end - T.wipe), hx, FLOOR - 12, W, true) : 'all'
      compose(g, o, mask)
    })
    yield c.at(T.inEnd)
    s.hero.hidden = true
    yield c.at(T.cut)
    s.swap()
    swapped = true
    s.hero.stop()
    s.hero.hidden = true
    yield c.at(T.wipe)
    // 擦除開始，下一區露出來
    s.reveal()
    s.hero.hidden = false
    yield c.at(T.end)
    s.hero.walk()
  },
}

// =====================================================================
// 地圖：GBA 的世界地圖滑下來，點沿著虛線從這一區飛到下一區，地圖收上去
// =====================================================================
// 海岸線（經度、緯度），簡化過
const ISLANDS: number[][] = [
  // 北海道
  [141.94, 45.52, 142.58, 44.93, 143.35, 44.35, 144.27, 44.02, 144.66, 43.91, 145.33, 44.35, 145.19, 44.02, 145.13, 43.66, 145.58, 43.33, 145.82, 43.38, 145.5, 43.2, 144.85, 43.03, 144.38, 42.98, 143.33, 42.28, 143.25, 41.92, 142.77, 42.16, 141.6, 42.63, 140.97, 42.32, 140.37, 42.52, 140.58, 42.1, 141.15, 41.8, 140.73, 41.77, 140.2, 41.4, 140.13, 41.87, 139.85, 42.45, 140.23, 42.8, 140.5, 42.98, 140.47, 43.37, 141.0, 43.2, 141.3, 43.25, 141.4, 43.85, 141.64, 43.94, 141.7, 44.88, 141.67, 45.4],
  // 本州
  [140.91, 41.53, 141.46, 41.43, 141.55, 40.52, 141.8, 40.2, 141.97, 39.64, 141.9, 39.27, 141.62, 38.9, 141.52, 38.3, 141.0, 38.15, 140.95, 37.8, 140.98, 37.0, 140.65, 36.6, 140.6, 36.3, 140.87, 35.72, 140.3, 35.15, 139.88, 34.9, 139.82, 35.3, 140.1, 35.6, 139.8, 35.65, 139.65, 35.45, 139.62, 35.15, 139.5, 35.3, 139.15, 35.25, 139.1, 34.97, 138.85, 34.6, 138.85, 35.1, 138.4, 34.95, 138.22, 34.6, 137.7, 34.66, 137.0, 34.58, 136.85, 35.0, 136.6, 34.9, 136.85, 34.48, 136.8, 34.27, 136.2, 34.05, 136.0, 33.7, 135.76, 33.43, 135.35, 33.68, 135.15, 34.2, 135.42, 34.65, 135.18, 34.68, 135.0, 34.65, 134.68, 34.78, 133.95, 34.6, 133.37, 34.45, 133.2, 34.4, 132.45, 34.35, 132.2, 34.15, 132.1, 33.95, 131.25, 33.95, 130.92, 33.95, 130.9, 34.2, 131.4, 34.42, 131.85, 34.7, 132.07, 34.9, 132.7, 35.4, 132.63, 35.43, 133.1, 35.57, 133.25, 35.55, 134.2, 35.53, 134.65, 35.65, 135.2, 35.77, 135.38, 35.5, 135.75, 35.5, 136.07, 35.65, 135.95, 35.95, 136.1, 36.2, 136.6, 36.6, 136.75, 36.9, 136.9, 37.4, 137.33, 37.52, 137.0, 37.05, 136.98, 36.85, 137.22, 36.75, 137.85, 37.05, 138.25, 37.18, 138.55, 37.37, 139.05, 37.95, 139.45, 38.22, 139.82, 38.92, 139.72, 39.95, 140.0, 40.2, 139.93, 40.65, 140.2, 40.78, 140.35, 41.25, 140.75, 40.85, 140.9, 40.95, 141.2, 41.3],
  // 四國
  [134.05, 34.35, 134.4, 34.23, 134.6, 34.23, 134.58, 34.07, 134.7, 33.9, 134.18, 33.25, 133.55, 33.5, 133.28, 33.38, 133.02, 32.72, 132.72, 32.92, 132.56, 33.22, 132.42, 33.45, 132.0, 33.34, 132.35, 33.52, 132.7, 33.75, 132.7, 33.85, 132.78, 33.98, 133.0, 34.07, 133.18, 33.92, 133.3, 33.97, 133.55, 34.02, 133.65, 34.13, 133.8, 34.3],
  // 九州
  [130.95, 33.95, 130.85, 33.9, 130.8, 33.92, 130.4, 33.6, 130.15, 33.6, 129.97, 33.45, 129.85, 33.3, 129.55, 33.35, 129.7, 33.15, 129.65, 32.95, 129.85, 32.75, 129.75, 32.58, 130.2, 32.6, 130.37, 32.78, 130.15, 32.9, 130.42, 33.03, 130.6, 32.8, 130.6, 32.65, 130.58, 32.5, 130.38, 32.2, 130.18, 32.03, 130.2, 31.8, 130.25, 31.7, 130.3, 31.27, 130.65, 31.25, 130.55, 31.6, 130.75, 31.75, 130.85, 31.4, 130.66, 30.99, 131.08, 31.3, 131.1, 31.47, 131.35, 31.37, 131.38, 31.6, 131.45, 31.9, 131.65, 32.42, 131.68, 32.58, 131.9, 32.95, 131.88, 33.25, 131.6, 33.25, 131.5, 33.3, 131.75, 33.55, 131.45, 33.6, 131.2, 33.6, 131.0, 33.73],
  // 佐渡、淡路
  [138.22, 38.2, 138.45, 38.33, 138.52, 38.12, 138.4, 37.82, 138.25, 37.8, 138.3, 38.0],
  [134.95, 34.6, 135.02, 34.55, 134.85, 34.25, 134.75, 34.3],
  // 沖繩本島（放在左下的框裡）
  [128.26, 26.87, 128.25, 26.7, 128.1, 26.58, 127.95, 26.45, 127.98, 26.32, 127.78, 26.2, 127.82, 26.13, 127.68, 26.08, 127.66, 26.22, 127.74, 26.32, 127.71, 26.44, 127.82, 26.5, 127.96, 26.58, 127.88, 26.62, 127.86, 26.7, 127.95, 26.72, 128.17, 26.78],
]
const MOUNTAINS = [137.6, 36.3, 137.75, 35.85, 140.6, 39.2, 140.85, 40.4, 140.3, 37.7, 142.9, 43.6, 142.3, 42.9, 131.1, 32.9, 133.3, 33.75, 133.5, 35.1, 135.85, 34.05, 139.45, 36.75]
/** 地圖的中心（含左下沖繩的框，整張置中） */
const mapCx = (W: number) => Math.round(W / 2 + 18)
function proj(lon: number, lat: number, W: number): [number, number] {
  const cx = mapCx(W)
  if (lat < 28) return [cx - 82 + (lon - 127.95) * 14.8, 130 + (26.48 - lat) * 18.8]
  return [cx + (lon - 137.7) * 7.4, 80 + (38.25 - lat) * 9.4]
}
/** 地圖只用不隨時段變的顏色（sky-*、lamp-*、neon-*、star），夜裡也是同一張 */
function buildMap(like: Gfx): Gfx {
  const g = new Gfx(like.w, H, like.pal)
  const W = g.w
  const cx = mapCx(W)
  g.rect(0, 0, W, H, 'sky-day-1')
  for (let y = 9, r = 0; y < H - 6; y += 11, r++)
    for (let x = 6 + (r % 2) * 10; x < W - 6; x += 20) {
      g.px(x, y, 'sky-day-2')
      g.hline(x + 1, x + 2, y + 1, 'sky-day-2')
      g.px(x + 3, y, 'sky-day-2')
    }
  // 沖繩的框
  for (let x = cx - 97; x <= cx - 67; x += 2) {
    g.px(x, 114, 'sky-night-2')
    g.px(x, 146, 'sky-night-2')
  }
  for (let y = 114; y <= 146; y += 2) {
    g.px(cx - 97, y, 'sky-night-2')
    g.px(cx - 67, y, 'sky-night-2')
  }
  const shapes = ISLANDS.map((pts) => {
    const out: number[] = []
    for (let i = 0; i < pts.length; i += 2) out.push(...proj(pts[i]!, pts[i + 1]!, W))
    return out
  })
  const draw = (k: Px, dx: number, dy: number) => shapes.forEach((p) => g.poly(p.map((v, i) => v + (i % 2 ? dy : dx)), k))
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 2], [1, 1], [-1, 1]] as const) draw('sky-night-1', dx, dy)
  draw('lamp-2', 0, 1)
  draw('lamp-1', 0, 0)
  for (let i = 0; i < MOUNTAINS.length; i += 2) {
    const [x, y] = proj(MOUNTAINS[i]!, MOUNTAINS[i + 1]!, W).map(Math.round) as [number, number]
    g.tri(x - 3, y + 2, x, y - 2, x + 3, y + 2, 'sky-dusk-3')
    g.px(x, y - 2, 'lamp-2')
  }
  const [fx, fy] = proj(138.73, 35.36, W).map(Math.round) as [number, number]
  g.tri(fx - 4, fy + 2, fx, fy - 3, fx + 4, fy + 2, 'sky-dusk-1')
  g.tri(fx - 1, fy - 1, fx, fy - 3, fx + 1, fy - 1, 'star')
  // 方位
  const nx = cx - 74
  g.ring(nx, 26, 6, 'sky-night-2')
  g.tri(nx - 2, 26, nx, 19, nx + 2, 26, 'neon-1')
  g.tri(nx - 2, 26, nx, 33, nx + 2, 26, 'star')
  g.text('N', nx - 1, 12, 'sky-night-1')
  // 外框
  g.frame(0, 0, W, H, 'sky-night-1')
  g.frame(1, 1, W - 2, H - 2, 'sky-night-1')
  g.frame(2, 2, W - 4, H - 4, 'sky-day-3')
  return g
}
function mapLabel(g: Gfx, text: string, x: number, y: number, side: 1 | -1) {
  const w = textW(text) + 4
  const bx = Math.round(clamp(side > 0 ? x + 5 : x - 5 - w, 5, g.w - 5 - w))
  const by = Math.round(clamp(y - 4, 5, H - 14))
  g.rect(bx, by, w, 9, 'sky-night-1')
  g.text(text, bx + 2, by + 2, 'star')
}
function marker(g: Gfx, x: number, y: number, big: boolean) {
  const X = Math.round(x)
  const Y = Math.round(y)
  g.circle(X, Y, big ? 4 : 3, 'sky-night-1')
  g.circle(X, Y, big ? 3 : 2, 'neon-1')
  g.px(X - 1, Y - 1, 'star')
}

export const MAP: TransitionDef = {
  id: 'map',
  weight: 2,
  *run(s) {
    const c = clock(s)
    let cache: Gfx | null = null
    const fromA = s.area
    const toA = s.next
    s.hero.stop()
    let A: [number, number] = [0, 0]
    let B: [number, number] = [0, 0]
    let ctrl: [number, number] = [0, 0]
    let len = 0
    const setup = (W: number) => {
      A = proj(...locOf(fromA), W)
      B = proj(...locOf(toA), W)
      const dx = B[0] - A[0]
      const dy = B[1] - A[1]
      len = Math.hypot(dx, dy)
      let px = len ? -dy / len : 0
      let py = len ? dx / len : -1
      if (py > 0 || (py === 0 && px > 0)) {
        px = -px
        py = -py
      }
      const h = 9 + len * 0.2
      ctrl = [(A[0] + B[0]) / 2 + px * h, (A[1] + B[1]) / 2 + py * h]
    }
    setup(s.W)
    const bez = (u: number): [number, number] => [
      (1 - u) ** 2 * A[0] + 2 * (1 - u) * u * ctrl[0] + u * u * B[0],
      (1 - u) ** 2 * A[1] + 2 * (1 - u) * u * ctrl[1] + u * u * B[1],
    ]
    const travel = clamp(0.5 + len / 110, 0.7, 1.6)
    const T = { inEnd: 0.35, go: 0.8, arrive: 0.8 + travel, swap: 1.35 + travel, end: 1.75 + travel }
    s.paint('over', (g, _t) => {
      const t = c.t
      const W = g.w
      if (!cache || cache.w !== W) {
        cache = buildMap(g)
        setup(W)
      }
      const oy = t < T.inEnd ? -Math.round(H * (1 - easeOut(t / T.inEnd))) + (t > T.inEnd * 0.8 ? 1 : 0) : t > T.swap ? -Math.round(H * easeIn((t - T.swap) / (T.end - T.swap))) : 0
      if (oy <= -H) return
      g.blit(cache, 0, -oy, W, H + oy, 0, 0, true)
      g.oy = oy
      // 虛線：飛過的那一段
      const prog = smooth((t - T.go) / travel)
      const n = Math.max(8, Math.ceil(len * 1.4))
      for (let i = 0; i <= n * prog; i++) {
        if (Math.floor(i / 3) % 2) continue
        const [x, y] = bez(i / n)
        g.px(Math.round(x), Math.round(y), 'sky-night-1')
      }
      const sideA: 1 | -1 = B[0] >= A[0] ? -1 : 1
      const close = Math.abs(A[1] - B[1]) < 12 && Math.abs(A[0] - B[0]) < 60
      const lyA = close ? Math.min(A[1], B[1]) - 8 + (A[1] <= B[1] ? 0 : 16) : A[1]
      const lyB = close ? Math.min(A[1], B[1]) - 8 + (A[1] <= B[1] ? 16 : 0) : B[1]
      marker(g, A[0], A[1], false)
      if (t < T.go ? Math.floor(t * 6) % 2 === 0 : true) mapLabel(g, fromA.romaji, A[0], lyA, sideA)
      if (t >= T.arrive) {
        marker(g, B[0], B[1], t - T.arrive < 0.12)
        mapLabel(g, toA.romaji, B[0], lyB, sideA > 0 ? -1 : 1)
      } else if (t >= T.go) {
        const [x, y] = bez(prog)
        marker(g, x, y - Math.abs(Math.sin(t * 9)) * 2, true)
      }
      g.oy = 0
      // 地圖下緣的影子
      if (oy < 0) g.dither(0, H + oy, W, 3, 'sky-night-1', 8)
    })
    yield c.at(T.swap)
    s.swap()
    // 地圖往上收，左上（地名牌的位置）最後才露出來：收完再叫
    s.hero.walk()
    yield c.at(T.end)
    s.reveal()
  },
}

// =====================================================================
// 隧道：前面起霧，山與隧道口從霧裡出來；旅人走進去，畫面暗下來，隧道裡的燈一盞一盞往後跑；
// 出口一片白，換區，從另一頭的隧道口走出來
// =====================================================================
/** 隧道口的山的顏色（山、陰影）：冬天是乾的枯山（常綠的杉）；積雪只在會下雪的地區（snowy）的冬天、或正在下雪 */
const MT: Record<Season, [Px, Px]> = { spring: ['leaf-3', 'leaf-4'], summer: ['leaf-3', 'leaf-4'], autumn: ['momiji-2', 'wood-3'], winter: ['dirt-2', 'wood-2'] }
const MT_SNOW: [Px, Px] = ['snow-2', 'stone-2']
const snowyAt = (area: AreaDef, env: Env) => (env.season === 'winter' && !!area.snowy) || env.weather === 'snow'
const SLOPE = [-8, 86, 6, 70, 24, 58, 50, 44, 90, 30, 140, 20, 220, 12, 1000, 8]
const slopeY = (dx: number) => {
  for (let i = 0; i + 2 < SLOPE.length; i += 2)
    if (dx <= SLOPE[i + 2]!) return lerp(SLOPE[i + 1]!, SLOPE[i + 3]!, (dx - SLOPE[i]!) / (SLOPE[i + 2]! - SLOPE[i]!))
  return 8
}
const ARCH = 22
const archHalf = (y: number, r: number) => (y >= 116 ? r : y >= 116 - r ? Math.floor(Math.sqrt(r * r - (116 - y) ** 2)) : -1)
function seg(g: Gfx, a: number, b: number, y: number, k: Px) {
  if (b >= a) g.hline(a, b, y, k)
}
/** 隧道口的山：P 是洞門外側的 x（dir 1：山在右邊、入口；-1：山在左邊、出口）；area 是山在的那一區 */
function portal(g: Gfx, P: number, dir: 1 | -1, env: Env, area: AreaDef) {
  const X = (dx: number) => Math.round(P + dir * dx)
  const snow = snowyAt(area, env)
  const [body, dark] = snow ? MT_SNOW : MT[env.season]
  const pts: number[] = []
  for (let i = 0; i < SLOPE.length; i += 2) pts.push(X(SLOPE[i]!), SLOPE[i + 1]!)
  pts.push(X(1000), H, X(44), H, X(44), 86)
  g.poly(pts, body)
  for (let i = 0; i + 2 < SLOPE.length; i += 2) g.line(X(SLOPE[i]!), SLOPE[i + 1]!, X(SLOPE[i + 2]!), SLOPE[i + 3]!, 'ink-2')
  const lo = Math.min(X(44), X(1000))
  g.dither(lo, 104, 956, H - 104, dark, 6)
  for (let dx = 52; dx < 640; dx += 15 + Math.floor(hash(dx) * 8)) {
    if (X(dx) < -20 || X(dx) > g.w + 20) continue
    cedar(g, X(dx), Math.round(slopeY(dx) + 9 + hash(dx + 1) * 6), 14 + Math.floor(hash(dx + 2) * 8), snow ? 'stone-3' : 'leaf-4', snow ? 'snow-1' : 'leaf-3')
  }
  // 洞門（石砌）
  const ax = X(ARCH)
  const x0 = Math.min(X(0), X(44))
  const x1 = Math.max(X(0), X(44))
  const wall = g.pal.u32['stone-2']
  for (let y = 84; y < H; y++) {
    if (y < 87) {
      g.hline(x0 - 2, x1 + 2, y, y === 84 ? 'stone-1' : 'stone-3')
      continue
    }
    const hw = archHalf(y, 15)
    const hr = archHalf(y, 18)
    if (hr < 0) g.hline(x0, x1, y, 'stone-2')
    else {
      seg(g, x0, ax - hr - 1, y, 'stone-2')
      seg(g, ax + hr + 1, x1, y, 'stone-2')
      if (hw < 0) g.hline(ax - hr, ax + hr, y, 'stone-1')
      else {
        seg(g, ax - hr, ax - hw - 1, y, 'stone-1')
        seg(g, ax + hw + 1, ax + hr, y, 'stone-1')
      }
    }
    // 石縫
    const { w, buf } = g
    if (y >= H) continue
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) {
      if (buf[y * w + x] !== wall) continue
      const row = Math.floor((y - 87) / 6)
      if ((y - 87) % 6 === 5 || (x - x0 + (row % 2) * 5) % 10 === 0) buf[y * w + x] = g.pal.u32['stone-3']
    }
  }
  g.rect(ax - 2, 97, 5, 5, 'stone-3')
  // 洞口裡的影子（旅人走進去會暗一點）
  for (let y = 101; y <= FLOOR; y++) {
    const hw = archHalf(y, 15)
    if (hw >= 0) g.dither(ax - hw, y, hw * 2 + 1, 1, 'ink', 7)
  }
}
/** 洞口裡面（旅人後面）：黑的，深處有幾盞燈 */
function portalInside(g: Gfx, P: number, dir: 1 | -1) {
  const ax = Math.round(P + dir * ARCH)
  for (let y = 101; y < H; y++) {
    const hw = archHalf(y, 15)
    if (hw >= 0) g.hline(ax - hw, ax + hw, y, y < FLOOR - 2 ? 'ink' : 'stone-4')
  }
  g.px(ax - 3, 110, 'lamp-2')
  g.px(ax + 4, 110, 'lamp-2')
  g.px(ax - 1, 112, 'lamp-2')
  g.px(ax + 2, 112, 'lamp-2')
}
/** 隧道裡：牆上的燈（跟著走）、天花板的燈（近，跑得快）、旅人被燈照到亮一下 */
function tunnelInside(g: Gfx, t: number, hx: number, glow: number) {
  const W = g.w
  g.rect(0, 0, W, H, 'ink')
  g.rect(0, 36, W, FLOOR - 42, 'roof-3')
  g.hline(0, W, 36, 'ink-2')
  g.hline(0, W, FLOOR - 7, 'ink-2')
  const v = 30
  for (let x = mod(-t * v, 24) - 24; x < W; x += 24) g.vline(Math.round(x), 37, FLOOR - 8, 'ink-2')
  g.rect(0, FLOOR - 6, W, H - FLOOR + 6, 'stone-4')
  g.hline(0, W, FLOOR - 6, 'stone-3')
  for (let x = mod(-t * v, 20) - 20; x < W; x += 20) g.rect(Math.round(x), 151, 10, 1, 'stone-3')
  let near = 99
  const pool = (cx: number, cy: number, rx: number, ry: number) => {
    // 光暈：由外往內三圈抖色（圓的）
    for (const [f, lv] of [[1, 2], [0.66, 4], [0.36, 6]] as const)
      for (let dy = -Math.round(ry * f); dy <= Math.round(ry * f); dy++) {
        const hw = Math.round(rx * f * Math.sqrt(Math.max(0, 1 - (dy / (ry * f + 0.5)) ** 2)))
        g.dither(cx - hw, cy + dy, hw * 2 + 1, 1, 'lamp-2', lv)
      }
  }
  for (let x = mod(-t * v + 30, 48) - 48; x < W + 48; x += 48) {
    const X = Math.round(x)
    pool(X, 45, 13, 8)
    pool(X, FLOOR - 1, 16, 4)
    g.rect(X - 3, 44, 7, 2, 'lamp-1')
    g.hline(X - 3, X + 3, 46, 'lamp-2')
    near = Math.min(near, Math.abs(X - hx))
  }
  for (let x = mod(-t * v * 2.4, 40) - 40; x < W + 40; x += 40) {
    const X = Math.round(x)
    pool(X + 5, 9, 10, 5)
    g.rect(X, 8, 10, 2, 'lamp-2')
    g.hline(X + 1, X + 8, 8, 'lamp-1')
  }
  drawHero(g, hx, FLOOR, t, true)
  drawHero(g, hx, FLOOR, t, true, { ink: 'ink', level: Math.round(clamp(3 + near / 2.5, 3, 12)) })
  if (glow > 0) {
    // 出口：右邊一個拱形的亮洞，越走越大
    const r = Math.round(10 + glow * 40)
    const cx = Math.round(W - r * 0.55)
    const cy = FLOOR - 6 - r
    for (const [k, d] of [['lamp-2', 3], ['lamp-1', 1], ['white', 0]] as const) {
      g.circle(cx, cy, r + d, k)
      g.rect(cx - r - d, cy, (r + d) * 2 + 1, H - cy, k)
    }
  }
}

/** 隧道的兩頭：不在沖繩（沒有接本州的隧道）、不在大都市（高架、斑馬線旁邊不會冒出一座山） */
const tunnelEnd = (a: AreaDef) => !isOkinawa(a) && !has(a, 'city')

export const TUNNEL: TransitionDef = {
  id: 'tunnel',
  weight: 1.3,
  // 至少一頭在山裡、田裡
  fits: (a, b) => tunnelEnd(a) && tunnelEnd(b) && (has(a, 'nature', 'mountain', 'snow', 'farm') || has(b, 'nature', 'mountain', 'snow', 'farm')),
  *run(s) {
    const c = clock(s)
    const cvF = new Canvas()
    const cvB = new Canvas()
    let mistLv = 0
    let mtLv = 0
    s.hero.walk()
    // 起霧（前面一片白）
    const hx0 = s.hero.x
    s.paint('over', (g) => {
      const near = hx0 + 18
      mist(g, mistInk(s.env), c.t, mistLv, (x, y) => clamp01((x - near) / 70) * (0.35 + 0.65 * clamp01((y - 20) / 110)))
    })
    let entry: { P: number } | null = null
    const P0 = { v: 0 }
    s.spawn({
      x: 0,
      y: 0,
      z: 'back',
      draw: (g) => {
        if (!entry) return
        const P = entry.P - s.cam
        if (mtLv >= 16) return portalInside(g, P, 1)
        const o = cvB.get(g)
        o.clear(null)
        portalInside(o, P, 1)
        fadeBlit(g, o, mtLv)
      },
    })
    s.spawn({
      x: 0,
      y: 0,
      z: 'front',
      draw: (g) => {
        if (!entry) return
        const P = entry.P - s.cam
        if (mtLv >= 16) return portal(g, P, 1, s.env, s.area)
        const o = cvF.get(g)
        o.clear(null)
        portal(o, P, 1, s.env, s.area)
        fadeBlit(g, o, mtLv)
      },
    })
    for (let i = 1; i <= 9; i++) {
      mistLv = i
      yield 0.08
    }
    entry = { P: s.cam + s.hero.x + 40 }
    P0.v = entry.P
    for (let i = 1; i <= 16; i++) {
      mtLv = i
      mistLv = Math.max(0, 9 - Math.round(i * 0.6))
      yield 0.06
    }
    mistLv = 0
    // 旅人走到洞口中間
    yield () => entry!.P - s.cam + ARCH <= s.hero.x
    let dark = 0
    const cover = s.paint('over', (g) => g.cover('ink', dark))
    for (let i = 1; i <= 16; i++) {
      dark = i
      yield 0.03
    }
    // 隧道裡
    s.hero.hidden = true
    const t0 = c.t
    let glow = 0
    let white = 0
    const hx = s.hero.x
    let palIn: Palette | null = null
    const inside = s.paint('over', (g) => {
      // 隧道裡用進去時的調色盤（swap 之後時段變了也不跳色）
      palIn ??= g.pal
      const keep = g.pal
      g.pal = palIn
      tunnelInside(g, c.t - t0, hx, glow)
      g.pal = keep
      if (white > 0) g.cover('white', white)
    })
    cover.stop()
    yield c.at(t0 + 0.8)
    s.swap()
    // 入口的山留在上一區（不畫了）
    entry = null
    s.hero.stop()
    s.hero.hidden = true
    // 出口的山（新的一區）：旅人在洞口裡
    const Q = s.cam + s.hero.x + 4 + ARCH
    s.spawn({ x: Q, y: 0, z: 'back', draw: (g, x) => portalInside(g, x, -1) })
    s.spawn({ x: Q, y: 0, z: 'front', draw: (g, x) => portal(g, x, -1, s.env, s.area) })
    while (c.t < t0 + 1.9) {
      glow = clamp01((c.t - t0 - 1.1) / 0.8)
      yield null
    }
    for (let i = 1; i <= 16; i++) {
      white = i
      yield 0.02
    }
    inside.stop()
    // 白光開始退：出口的山與下一區露出來
    s.reveal()
    s.hero.hidden = false
    s.hero.walk()
    const fade = s.paint('over', (g) => g.cover('white', white))
    for (let i = 15; i >= 0; i--) {
      white = i
      yield 0.035
    }
    fade.stop()
    // 山捲出畫面再結束（不讓它突然消失）
    yield () => Q - s.cam + 4 < 0
  },
}

// =====================================================================
// 鳥居：起了薄霧，一座大鳥居從霧裡出來；旅人走到鳥居下，白光一閃，換區；
// 新的一區裡旅人從同一座鳥居下走出來，鳥居跟霧一起散掉
// =====================================================================
const TORII_BIG = drawSprite(94, 102, (g) => {
  const L = 15
  const R = 73
  for (const x of [L, R]) {
    g.rect(x, 20, 6, 78, 'shu-1')
    g.rect(x + 4, 20, 2, 78, 'shu-2')
    g.rect(x - 1, 95, 8, 7, 'ink-2')
  }
  g.rect(8, 33, 78, 5, 'shu-1')
  g.hline(8, 85, 37, 'shu-2')
  g.rect(44, 18, 6, 15, 'shu-1')
  g.rect(41, 21, 12, 10, 'ink-2')
  g.frame(41, 21, 12, 10, 'gold-2')
  g.rect(4, 13, 86, 5, 'shu-1')
  g.hline(4, 89, 17, 'shu-2')
  g.poly([0, 3, 14, 7, 47, 8, 80, 7, 94, 3, 92, 9, 80, 12, 47, 13, 14, 12, 2, 9], 'ink-2')
  g.hline(12, 82, 8, 'stone-3')
})

export const TORII: TransitionDef = {
  id: 'torii',
  weight: 1.2,
  fits: (a, b) => has(a, 'shrine') || has(b, 'shrine'),
  *run(s) {
    const c = clock(s)
    let mistLv = 0
    let haze = 0
    let tLv = 0
    let white = 0
    s.hero.walk()
    s.paint('mid', (g) => mist(g, mistInk(s.env), c.t, haze, (_x, y) => clamp01((y - 64) / 50)))
    s.paint('over', (g) => {
      mist(g, mistInk(s.env), c.t, mistLv, (_x, y) => clamp01((y - 118) / 36))
      if (white > 0) g.cover('white', white)
    })
    const D = 72
    const gate = s.spawn({ x: s.cam + s.hero.x + D, y: FLOOR - 2, z: 'back', draw: (g, x, y) => g.sprite(TORII_BIG, Math.round(x - 47), Math.round(y - 102), { level: tLv }) })
    for (let i = 1; i <= 20; i++) {
      haze = Math.round(i * 0.45)
      mistLv = Math.round(i * 0.4)
      tLv = Math.max(0, Math.round((i - 4) * 1))
      yield 0.07
    }
    tLv = 16
    yield () => gate.sx() <= s.hero.x
    s.hero.stop()
    yield 0.3
    for (let i = 1; i <= 16; i++) {
      white = i
      yield 0.018
    }
    gate.remove()
    s.swap()
    s.hero.stop()
    // 新的一區：同一座鳥居在旅人頭上
    const gate2 = s.spawn({ x: s.cam + s.hero.x, y: FLOOR - 2, z: 'back', draw: (g, x, y) => g.sprite(TORII_BIG, Math.round(x - 47), Math.round(y - 102), { level: tLv }) })
    yield 0.15
    s.hero.walk()
    // 白光開始退
    s.reveal()
    for (let i = 15; i >= 0; i--) {
      white = i
      yield 0.035
    }
    yield 0.4
    for (let i = 15; i >= 0; i--) {
      tLv = i
      haze = Math.round(i * 0.56)
      mistLv = Math.round(i * 0.5)
      yield 0.07
    }
    gate2.remove()
  },
}

// =====================================================================
// 翻頁：把這一格當成旅遊書的一頁，從右下角翻過去，下一頁是下一區（常常換了季節、時段）
// =====================================================================
export const PAGE: TransitionDef = {
  id: 'page',
  weight: 1.1,
  *run(s) {
    const c = clock(s)
    let snap: Uint32Array | null = null
    let pal0: Palette | null = null
    let fold = Infinity
    s.paint('over', (g) => {
      if (!snap) {
        snap = g.buf.slice()
        pal0 = g.pal
        return
      }
      if (snap.length !== g.buf.length || !pal0) return
      const { w, buf } = g
      const u = pal0.u32
      const [white, paper, paper2, edge, ink] = [u['white'], u['paper'], u['paper-2'], u['stone-2'], u['ink']]
      for (let y = 0; y < H; y++) {
        // 折線有點斜：下面先翻
        const F = Math.round(fold - (y - H / 2) * 0.22)
        const L = Math.max(0, 2 * F - w)
        const row = y * w
        for (let x = 0; x < Math.min(w, F); x++) {
          const i = row + x
          if (x < L) {
            buf[i] = snap[i]!
            if (x >= L - 3 && dotOn(x, y, 5)) buf[i] = ink
          } else {
            // 紙的背面：靠折線亮、外緣暗
            const d = (F - x) / Math.max(1, F - L)
            buf[i] = x === L ? edge : d < 0.12 ? white : dotOn(x, y, Math.round(clamp01((d - 0.35) * 1.6) * 16)) ? paper2 : paper
          }
        }
        // 翻起來的頁在新的一頁上的影子
        for (let x = Math.max(0, F); x < Math.min(w, F + 6); x++) if (dotOn(x, y, 7 - (x - F))) buf[row + x] = ink
      }
    })
    yield () => snap !== null
    s.swap()
    fold = s.W + 40
    const t0 = c.t
    const T = 1.3
    while (c.t - t0 < T) {
      const u = smooth((c.t - t0) / T)
      fold = lerp(s.W + 40, -40, u)
      // 左上（地名牌的位置）最後才翻開：翻到九成再叫
      if (u >= 0.9) s.reveal()
      yield null
    }
  },
}

/** 轉場，第二批 */
export const MORE_TRANSITIONS: TransitionDef[] = [SHINKANSEN, FERRY, PLANE_TR, MAP, TUNNEL, TORII, PAGE]
