import type { Festival, PackItem } from '../../../services/bundles'
import { rng as makeRng, type Rng, seedOf } from '../../../services/pixelwalk/rng'

import { MapView } from '../../engine/map'
import { tileDef } from '../../engine/tiles'
import { B, type Dir, type GameMap, type MapEntity, type MapName, passable, type TileLayer } from '../../engine/types'
import { hash2 } from '../kits/draw'
import '../kits/kinki'
import '../kits/okinawa'
import { bloomPairs, objectInfo } from '../kits/objects'
import { inBbox, kmBetween, offsetKm } from '../geo'
import { climateOf, dateLabel, type Flower, festivalsIn } from '../season'
import type { FactRef, InnData, Kit, Link, NpcData, PhotoSpotData, PrefData, PrefSpot, ShopData, SignData, StampData, Town, TownStop, TravelData, TravelDest, World } from '../types'

import { FOLK_IDS, folkOf } from '../../sprites/folk'

import { compile, type Compiled, type InteriorKind, landmarkBlueprint, poiBlueprint } from './blueprints'
import { classify, isP3Pref, type LandmarkKind, type Size, sizeOf, stripDisambig } from './classify'
import { Grid, tid, U } from './grid'
import { airportHall, castleOffice, type Interior, type InteriorOut, innRoom, juyosho, shopRoom, stationHall } from './interiors'
import { type KitRoles, rolesOf } from './roles'
import { stationRomaji } from '../romaji'

/**
 * 一個鎮的生成器（規格 §8.2 的 1–8 步）。種子＝市区町村碼＋生成器版本：同一份資料每次一樣。
 *  1. 以車站為中心、北朝上，景點的距離 log 壓縮進 44–64 × 34–48 格。
 *  2. 地形：沖繩的海（往海灘、岬、島、橋的方向是海）；近畿、關東、北海道只有資料有橋、「川」的時候畫河。
 *     關東的街上、有鐵路的車站：車站北邊一條高架鐵道橫過地圖（橋面在上層，人從下面走過去）。
 *  3. 擺車站、地標（依類型套藍圖；大小看分數與文化指定）、店（旅館、食堂、老舖、茶屋）。海灘、岬、島、海上的橋另外畫在海邊。
 *  4. 每個地標前面：告示牌＋拍攝點。
 *  5. 道路：從車站到每個地標、店的最小生成樹＋幾條環線（A*，街上 2 格寬直角、郊外 1 格會彎），過河的地方是橋。
 *  6. 填空：路邊成排的房子（町家／赤瓦／大樓／鐵皮屋頂）、田（田、甘蔗田、旱田、麥田、馬鈴薯田；有花田的北海道的鎮是
 *     薰衣草與花田）、樹林、灌木；地圖邊一圈樹（沖繩靠海的一邊是海）。關東、北海道另外有斑馬線、紅綠燈、電線桿、
 *     自動販賣機（街上）、矢羽根、牧場的柵欄、牧草、筒倉（北海道的郊外）。
 *  7. NPC：事實 NPC（祭典、老舖、城的蓋章地點、平年的櫻花、到別的鎮的距離）、路人、委託；祭典那個月另外有攤子、提燈、人。
 *  8. 可達性：從車站出口 flood fill，門、拍攝點、NPC、告示牌都要走得到，走不到就把擋路的填空拆掉鑿路。
 * 室內（車站大廳、授与所、城的蓋章處、店、旅館、機場）跟著鎮一起做。
 */
export interface TownGenInput {
  pref: PrefData
  town: Town
  world: World
  genVersion: number
}

export interface BloomCell {
  layer: TileLayer
  i: number
  base: number
  bloom: number
  flower: Flower
}

export interface FestivalLayer {
  tiles: Array<{ layer: TileLayer; i: number; id: number }>
  /** 攤子、提燈的範圍裡要清掉的實體（沒有） */
  entities: MapEntity[]
  /** 祭典 NPC（事實台詞在套用時依那個月的祭典填；look：手畫的路人，旁邊的人不撞衫） */
  festivalNpcs: Array<{ x: number; y: number; seed: number; look: string }>
}

export interface Arrival {
  map: string
  x: number
  y: number
  dir: Dir
}

export interface TownGen {
  map: GameMap
  interiors: Map<string, GameMap>
  /** 坐車到這一鎮的這個地方時站哪 */
  stops: Record<string, Arrival>
  bloom: BloomCell[]
  festival: FestivalLayer
  /** 地標：rect 是拍照算分的本體（城是城門）；area 是整個藍圖蓋到的範圍（城是石垣圍起來的整塊） */
  landmarks: Array<{ spotId: string; kind: LandmarkKind; rect: { x: number; y: number; w: number; h: number }; area: { x: number; y: number; w: number; h: number } }>
  /** 委託用的景點：真的放上地圖、有告示牌也有拍攝點的地標（有類型或簡介的；機場不算） */
  questSpots: string[]
  /** 這一鎮的旅館（民宿）：進你的房間的地方 */
  inn?: { map: string; stairs: { x: number; y: number } }
  /** 生成花的毫秒 */
  ms: number
}

// ---------- 小工具 ----------
interface Pt {
  x: number
  y: number
}
const key = (x: number, y: number) => `${x},${y}`
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const DIRS: Array<[number, number]> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

/** 依權重挑（rng） */
function pickW<T>(r: Rng, list: Array<[T, number]>): T {
  return r.weighted(list, (x) => x[1])[0]
}

/** 平滑的值雜訊（0–1）：樹林、田的分布 */
function noise(x: number, y: number, seed: number, scale: number): number {
  const fx = x / scale
  const fy = y / scale
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const h = (a: number, b: number) => (hash2(a, b, seed) % 1000) / 1000
  const sx = fx - x0
  const sy = fy - y0
  const u = sx * sx * (3 - 2 * sx)
  const v = sy * sy * (3 - 2 * sy)
  const a = h(x0, y0) * (1 - u) + h(x0 + 1, y0) * u
  const b = h(x0, y0 + 1) * (1 - u) + h(x0 + 1, y0 + 1) * u
  return a * (1 - v) + b * v
}

// ---------- 擺東西 ----------
interface Placed {
  id: string
  kind: string
  x: number
  y: number
  w: number
  h: number
  front: Pt
  photo?: Pt
  sign?: Pt
  npc: Pt[]
  doors: Array<{ x: number; y: number; interior: InteriorKind }>
  target: { x: number; y: number; w: number; h: number }
  spot?: PrefSpot
  shinise?: PackItem
  objects: number[]
}

/** 藍圖蓋到格子上 */
function stamp(g: Grid, c: Compiled, ox: number, oy: number, r: Rng, roles: KitRoles, id: string, kind: string): Placed {
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const cell = c.cells[y * c.w + x]!
      if (cell.void) continue
      const X = ox + x
      const Y = oy + y
      const keep = cell.mark || cell.ch === '=' || cell.ch === ':' || cell.ch === 'D'
      g.setUse(X, Y, keep ? U.keep : U.body)
      g.ground(X, Y, cell.g)
      if (cell.l) g.layer('lower', X, Y, cell.l)
      if (cell.o) g.layer('over', X, Y, cell.o)
      if (cell.bush) g.layer('lower', X, Y, pickW(r, roles.bushes))
    }
  const doors: Placed['doors'] = []
  const objs: number[] = []
  for (const o of c.objects) {
    const n = g.object(o.name, ox + o.x, oy + o.y, U.body, { doors: !!o.interior })
    objs.push(n)
    if (o.interior) for (const d of g.doorsOf(n)) doors.push({ ...d, interior: o.interior })
  }
  // 樹：藍圖指定的種類，放得下才放
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (!c.cells[y * c.w + x]!.tree) continue
      const name = r.pick(c.trees)
      if (fits(g, name, ox + x, oy + y, (u, i) => (u === U.body || u === U.free) && !g.owner[i])) objs.push(g.object(name, ox + x, oy + y, U.body))
    }
  const m = (k: keyof Compiled['marks']) => c.marks[k].map((p) => ({ x: ox + p.x, y: oy + p.y }))
  const t = targetOf(c)
  return { id, kind, x: ox, y: oy, w: c.w, h: c.h, front: m('front')[0]!, photo: m('photo')[0], sign: m('sign')[0], npc: m('npc'), doors, target: { x: ox + t.x, y: oy + t.y, w: t.w, h: t.h }, objects: objs }
}

/** 拍照的範圍最大幾格（畫面是 11–15 × 10 格：放得進最窄的畫面，上下留一點） */
export const TARGET_MAX_W = 10
export const TARGET_MAX_H = 8

/**
 * 拍照算分的「地標本體」（藍圖裡的格子）：main 的物件合起來；太大（寺的山門＋本堂）就取最靠近拍攝點的那一個
 * （最下面的：山門、鳥居）；沒有 main 的（公園、庭園、展望台）是告示牌那一列以上的整塊（池、看台）。
 * 還是太大就留靠近拍攝點的那一塊（下面、拍攝點的左右）。從拍攝點打開取景框時，鏡頭會移到放得下這一塊的地方。
 */
export function targetOf(c: Pick<Compiled, 'w' | 'h' | 'objects' | 'marks'>): { x: number; y: number; w: number; h: number } {
  const union = (list: Compiled['objects']) => {
    const x0 = Math.min(...list.map((o) => o.x))
    const y0 = Math.min(...list.map((o) => o.y))
    const x1 = Math.max(...list.map((o) => o.x + o.w))
    const y1 = Math.max(...list.map((o) => o.y + o.h))
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }
  const mains = c.objects.filter((o) => o.main)
  const signY = c.marks.sign[0]?.y ?? c.marks.photo[0]?.y ?? c.h - 2
  let r = mains.length ? union(mains) : { x: 0, y: 0, w: c.w, h: Math.max(1, signY) }
  if (mains.length > 1 && (r.w > TARGET_MAX_W || r.h > TARGET_MAX_H)) {
    const near = [...mains].sort((a, b) => b.y + b.h - (a.y + a.h) || a.x - b.x)[0]!
    r = union([near])
  }
  if (r.h > TARGET_MAX_H) r = { ...r, y: r.y + r.h - TARGET_MAX_H, h: TARGET_MAX_H }
  if (r.w > TARGET_MAX_W) {
    const px = c.marks.photo[0]?.x ?? r.x + r.w / 2
    const x = Math.max(r.x, Math.min(r.x + r.w - TARGET_MAX_W, Math.round(px - TARGET_MAX_W / 2)))
    r = { ...r, x, w: TARGET_MAX_W }
  }
  return r
}

/** 物件的格子都在地圖裡、都符合 ok */
function fits(g: Grid, name: string, x: number, y: number, ok: (u: number, i: number) => boolean): boolean {
  const info = objectInfo(name)
  if (!info) return false
  for (let cy = 0; cy < info.h; cy++)
    for (let cx = 0; cx < info.w; cx++) {
      if (info.cells[cy]![cx] === '.') continue
      const X = x + cx
      const Y = y + cy
      if (!g.inside(X, Y)) return false
      const i = g.i(X, Y)
      if (!ok(g.use[i]!, i)) return false
    }
  return true
}

/** 找位置用的偏移：離 (0, 0) 由近到遠（一樣近時先上後下、先左後右），算一次 */
let ORDER: Int16Array | null = null
function order(): Int16Array {
  if (ORDER) return ORDER
  const R = 64
  const list: Array<[number, number]> = []
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) list.push([dx, dy])
  list.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]) || a[1] - b[1] || a[0] - b[0])
  ORDER = new Int16Array(list.flat())
  return ORDER
}

/** 兩張積分圖（方形範圍裡有幾格不是空地、幾格是地標或店）：找位置時一次 O(1) */
class Occupancy {
  private readonly g: Grid
  private readonly W: number
  private readonly H: number
  private busy: Int32Array
  private hard: Int32Array
  constructor(g: Grid) {
    this.g = g
    this.W = g.w + 1
    this.H = g.h + 1
    this.busy = new Int32Array(this.W * this.H)
    this.hard = new Int32Array(this.W * this.H)
    this.rebuild()
  }
  rebuild() {
    const { g, W } = this
    for (let y = 0; y < g.h; y++) {
      let rb = 0
      let rh = 0
      for (let x = 0; x < g.w; x++) {
        const u = g.use[y * g.w + x]!
        if (u !== U.free) rb++
        if (u === U.body || u === U.keep || u === U.shop) rh++
        this.busy[(y + 1) * W + x + 1] = this.busy[y * W + x + 1]! + rb
        this.hard[(y + 1) * W + x + 1] = this.hard[y * W + x + 1]! + rh
      }
    }
  }
  private sum(a: Int32Array, x: number, y: number, w: number, h: number) {
    const x0 = Math.max(0, x)
    const y0 = Math.max(0, y)
    const x1 = Math.min(this.g.w, x + w)
    const y1 = Math.min(this.g.h, y + h)
    if (x1 <= x0 || y1 <= y0) return 0
    const W = this.W
    return a[y1 * W + x1]! - a[y0 * W + x1]! - a[y1 * W + x0]! + a[y0 * W + x0]!
  }
  /** 這一塊全是空地，四周 gap 格沒有地標、店 */
  fits(x: number, y: number, w: number, h: number, gap: number) {
    return this.sum(this.busy, x, y, w, h) === 0 && this.sum(this.hard, x - gap, y - gap, w + gap * 2, h + gap * 2) === 0
  }
}

/** 從 (tx, ty) 往外找放得下 w×h（四周空 gap 格）的地方 */
function findSpot(g: Grid, occ: Occupancy, w: number, h: number, tx: number, ty: number, gap: number, margin: number): Pt | null {
  const o = order()
  for (let k = 0; k < o.length; k += 2) {
    const x = tx + o[k]!
    const y = ty + o[k + 1]!
    if (x < margin || y < margin || x + w > g.w - margin || y + h > g.h - margin) continue
    if (occ.fits(x, y, w, h, gap)) return { x, y }
  }
  return null
}

// ---------- 路 ----------
class Heap {
  private k: number[] = []
  private v: number[] = []
  get size() {
    return this.k.length
  }
  push(pri: number, val: number) {
    const k = this.k
    const v = this.v
    k.push(pri)
    v.push(val)
    let i = k.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (k[p]! <= k[i]!) break
      ;[k[p], k[i]] = [k[i]!, k[p]!]
      ;[v[p], v[i]] = [v[i]!, v[p]!]
      i = p
    }
  }
  pop(): number {
    const k = this.k
    const v = this.v
    const top = v[0]!
    const lk = k.pop()!
    const lv = v.pop()!
    if (k.length) {
      k[0] = lk
      v[0] = lv
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < k.length && k[l]! < k[m]!) m = l
        if (r < k.length && k[r]! < k[m]!) m = r
        if (m === i) break
        ;[k[m], k[i]] = [k[i]!, k[m]!]
        ;[v[m], v[i]] = [v[i]!, v[m]!]
        i = m
      }
    }
    return top
  }
}

/** A* 的暫存（一張地圖一份，重複用） */
const bufs = new WeakMap<Grid, { best: Float64Array; came: Int32Array }>()

/** A*（有轉彎的代價、啟發值加權）：回傳格子的路線；走不到回 null */
function roadPath(g: Grid, a: Pt, b: Pt, cost: (x: number, y: number) => number, turn: number): Pt[] | null {
  const W = g.w
  const N = W * g.h
  let buf = bufs.get(g)
  if (!buf) bufs.set(g, (buf = { best: new Float64Array(N * 4), came: new Int32Array(N * 4) }))
  const best = buf.best.fill(Infinity)
  const came = buf.came.fill(-1)
  const heap = new Heap()
  const h = (x: number, y: number) => (Math.abs(x - b.x) + Math.abs(y - b.y)) * 1.6
  for (let d = 0; d < 4; d++) {
    const s = (a.y * W + a.x) * 4 + d
    best[s] = 0
    heap.push(h(a.x, a.y), s)
  }
  const goal = b.y * W + b.x
  let guard = 0
  while (heap.size && guard++ < 60000) {
    const s = heap.pop()
    const cell = s >> 2
    const d = s & 3
    const x = cell % W
    const y = (cell - x) / W
    if (cell === goal) {
      const out: Pt[] = []
      for (let t = s; t >= 0; t = came[t]!) out.push({ x: (t >> 2) % W, y: Math.floor((t >> 2) / W) })
      return out.reverse()
    }
    const base = best[s]!
    for (let nd = 0; nd < 4; nd++) {
      const [dx, dy] = DIRS[nd]!
      const nx = x + dx
      const ny = y + dy
      if (!g.inside(nx, ny)) continue
      const isGoal = ny * W + nx === goal
      const c = isGoal ? 1 : cost(nx, ny)
      if (!Number.isFinite(c)) continue
      const ns = (ny * W + nx) * 4 + nd
      const nb = base + c + (nd !== d ? turn : 0)
      if (nb < best[ns]!) {
        best[ns] = nb
        came[ns] = s
        heap.push(nb + h(nx, ny), ns)
      }
    }
  }
  return null
}

// ---------- 主程式 ----------
const SIZES: Array<[number, number]> = [
  [44, 34],
  [48, 36],
  [52, 40],
  [56, 42],
  [60, 45],
  [64, 48],
]

/** 開發用：每一步花的毫秒（最後一次生成） */
export const genPhases: Record<string, number> = {}
let phaseAt = 0
const phase = (name: string) => {
  const t = now()
  genPhases[name] = t - phaseAt
  phaseAt = t
}

/**
 * 名城的章在車站（資料 st 的第一個寫著「…駅」，例：「福知山観光案内所（JR福知山駅構内）」「…（若桜鉄道若桜駅前）」）：
 * 放在這一鎮哪一個車站的大廳（名字對得上的站優先，沒有就是代表的車站）。
 * 「道の駅」不是車站、「ロープウェイ／ケーブル」的駅在山上（城那邊），都不算。不在車站、或這一鎮沒有車站的大廳 → null。
 */
export function stampStationOf(c: Pick<PackItem, 'st'>, town: Pick<Town, 'stops'>): TownStop | null {
  const where = c.st?.[0] ?? ''
  if (!where.includes('駅') || /道の駅|ロープウェイ|ケーブル/.test(where)) return null
  // 有大廳的站：代表的車站（巴士站、機場以外）、單軌的其他站
  const halls = town.stops.filter((s, i) => (i === 0 ? s.kind !== 'airport' && s.kind !== 'bus' : s.kind === 'monorail'))
  return halls.find((s) => where.includes(`${s.name}駅`)) ?? halls[0] ?? null
}

export function generateTown(input: TownGenInput): TownGen {
  const t0 = now()
  phaseAt = t0
  const { pref, town, world } = input
  const kit = town.kit
  const r = makeRng(seedOf(town.id, input.genVersion))
  // 關東、北海道：政令指定都市的區（札幌市中央区…）一定是街上；北海道有鐵路的「市」（函館、小樽…）也是街上，房子是鐵皮屋頂的民家為主
  const p3 = kit === 'kanto' || kit === 'hokkaido'
  const mun = p3 ? pref.municipality(town.id) : undefined
  const ward = !!mun?.c
  const cityTown = p3 && !town.urban && !ward && kit === 'hokkaido' && /市$/.test(mun?.n ?? '') && (town.stops[0]?.kind === 'rail')
  const urban = town.urban || (p3 && ward) || cityTown
  const kitRoles = rolesOf(kit)
  const roles: KitRoles = cityTown && kitRoles.townHouses ? { ...kitRoles, urbanHouses: kitRoles.townHouses } : kitRoles

  // 地標：類型、大小（分數前兩名可以是大的，第 7 名以後一律小）
  const spots = town.spots.map((id) => pref.spotById(id)).filter((s): s is PrefSpot => !!s)
  const castleOf = (s: PrefSpot) => pref.castles.find((c) => c.s === s.id && (c.st?.length ?? 0) > 0)
  // 名城的章放在資料寫的地點（st 的第一個）：寫在車站裡的（例：「福知山観光案内所（JR福知山駅構内）」）放在這一鎮車站的大廳，
  // 城裡不放蓋章的小屋；其他的放在城的蓋章處（城牆裡的小屋）
  const stationCastles: Array<{ castle: PackItem; spot: PrefSpot; stop: TownStop }> = []
  for (const s of spots) {
    const c = castleOf(s)
    const stop = c ? stampStationOf(c, town) : null
    // 一個車站的大廳放一個名城的章（第二個照舊放在城裡）
    if (c && stop && !stationCastles.some((x) => x.stop.id === stop.id)) stationCastles.push({ castle: c, spot: s, stop })
  }
  const castleAtCastle = (s: PrefSpot) => (stationCastles.some((x) => x.spot.id === s.id) ? undefined : castleOf(s))
  // P3 的縣：已經上線的京都、沖繩照舊（GEN_VERSION 不改）
  const p3pref = isP3Pref(town.pref)
  /**
   * 名城的章在城裡的時候放哪（P3）：資料的 st 第一個寫的是屋外（「本丸櫓門下」「…（券売所外）」「…付近 (屋外)」）→ 城門邊的蓋章台，
   * 不另外蓋一間小屋；寫的是這一鎮另一個地標的名字（郡山城的「柳沢文庫」）→ 蓋章台放在那個地標前面；其他的照舊是城牆裡的小屋。
   * 京都、沖繩一律是小屋（P2）。
   */
  const castlePlace = (s: PrefSpot): { mode: 'hut' | 'table' } | { mode: 'landmark'; spot: PrefSpot } | null => {
    const c = castleAtCastle(s)
    if (!c) return null
    if (!p3pref) return { mode: 'hut' }
    const where = c.st![0]!
    const same = spots.find((x) => x.id !== s.id && (x.n === where || stripDisambig(x.n) === where))
    if (same) return { mode: 'landmark', spot: same }
    return { mode: OUTDOOR_STAMP.test(where) ? 'table' : 'hut' }
  }
  const castleStamp = (c: PackItem, spotId: string): StampData => {
    const face = c.no ? `${c.g === 'zoku' ? '続日本100名城' : '日本100名城'} No.${c.no}` : undefined
    return { stampId: `castle:${c.id}`, stampKind: 'castle', pref: pref.pref, name: c.n, castleId: c.id, spotId, ...(face ? { face } : {}) }
  }
  const SMALLER: Record<Size, Size> = { L: 'M', M: 'S', S: 'S' }
  // 同一鎮的寺：本堂、山門的樣子依序換（4 種），不會兩座一模一樣（大小也不同時可以一樣）
  let temples = 0
  const base = seedOf(town.id, 'temple') % 4
  const plans = spots.map((s, rank) => {
    let kind = classify(s, kit, town.pref)
    // 名城（蓋章地點在城裡）一律畫城：類型是史跡、名字沒有「城」的（五稜郭）也是，章才有地方蓋（P3；京都、沖繩的名城本來就是城）
    if (p3pref && castleAtCastle(s) && kind !== 'castle' && kind !== 'palace') kind = 'castle'
    const special = kind === 'bridge' || kind === 'island' || kind === 'beach' || kind === 'cape' || kind === 'river'
    let size = sizeOf(s)
    if (rank >= 2 && size === 'L') size = 'M'
    if (rank >= 6) size = 'S'
    const variant = kind === 'temple' ? (base + temples++) % 4 : seedOf(s.id) % 2
    const bp = (sz: Size) => compile(landmarkBlueprint(kind, sz, kit, { stamp: castlePlace(s)?.mode === 'hut', variant, p3: p3pref }), kit)
    return { spot: s, kind, special, rank, size, bp: special ? null : bp(size), smaller: special || size === 'S' ? null : bp(SMALLER[size]) }
  })
  // 老舖：點在這一鎮的區界裡（m）；舊資料沒有 m 時：外框裡、離鎮中心最近的那一鎮
  const shiniseHere = pref.shinise
    .filter((x) => (x.m !== undefined ? x.m === town.id : inBbox(town.bbox, x) && nearestTownOf(world, pref.pref, x) === town.id))
    .sort((a, b) => (a.f ? 0 : 1) - (b.f ? 0 : 1) || kmBetween(a, town.center) - kmBetween(b, town.center) || (a.id < b.id ? -1 : 1))
    .slice(0, 3)

  // 1. 大小：地標、店的面積加起來不超過內側的 45%（沖繩有海，32%）
  const need = plans.reduce((t, p) => t + (p.bp ? (p.bp.w + 2) * (p.bp.h + 2) : 30), 0) + 200 + shiniseHere.length * 50
  const share = kit === 'okinawa' ? 0.32 : 0.45
  const [W, H] = SIZES.find(([w, h]) => (w - 4) * (h - 4) * share >= need) ?? SIZES[SIZES.length - 1]!
  const name: MapName = { ja: town.name.ja, romaji: town.name.romaji ?? '', zh: town.name.zh ?? town.name.ja }
  const seaBorder = kit === 'okinawa' && plans.some((p) => p.kind === 'beach' || p.kind === 'island' || p.kind === 'cape' || p.kind === 'bridge')
  const g = new Grid({
    id: town.mapId,
    name,
    w: W,
    h: H,
    outdoor: true,
    ground: roles.grass,
    border: seaBorder ? { ground: tid('okinawa/deep') } : { ground: tid(roles.grass), lower: tid(roles.borderTree[0]), over: tid(roles.borderTree[1]) },
  })
  g.map.bgm = BGM_OF[kit]
  g.map.setting = urban ? 'urban' : 'rural'
  // 地圖邊兩格：樹（或海）
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) g.setUse(x, y, U.edge)

  // 投影：車站在中間，距離 log 壓縮
  const cx = Math.floor(W / 2)
  const cy = Math.floor(H / 2)
  const Rx = W / 2 - 8
  const Ry = H / 2 - 7
  const dmax = Math.max(1.5, ...spots.map((s) => kmBetween(s, town.center)))
  const project = (p: { lat: number; lng: number }): Pt => {
    const o = offsetKm(town.center, p)
    const d = Math.hypot(o.x, o.y)
    if (d < 1e-6) return { x: cx, y: cy }
    const k = Math.log(1 + d / 0.6) / Math.log(1 + dmax / 0.6)
    return { x: Math.round(cx + (o.x / d) * k * Rx), y: Math.round(cy + (o.y / d) * k * Ry) }
  }

  phase('setup')
  // 2. 地形
  const sea = kit === 'okinawa' ? paintSea(g, plans.filter((p) => p.special).map((p) => project(p.spot)), { x: cx, y: cy }, r, town.island) : false
  const river = kit !== 'okinawa' ? paintRiver(g, plans, project, { x: cx, y: cy }, r, roles) : null

  phase('terrain')
  // 3. 車站（或巴士站、機場）、地標、店
  const placed: Placed[] = []
  const stops: Record<string, Arrival> = {}
  const main = town.stops[0]!
  const stationPoi = poiBlueprint(main.kind === 'bus' ? 'bus' : 'station', kit)
  // 札幌這類的政令指定都市的區（北海道）：高架的大車站，不是鄉下的木造站舍
  const cityStation = kit === 'hokkaido' && ward && main.kind === 'rail'
  const stationBp = main.kind === 'airport' ? null : compile(cityStation ? { ...stationPoi, legend: { ...stationPoi.legend, S: { ...stationPoi.legend!.S!, obj: 'hokkaido/station-city' } } } : stationPoi, kit)
  const gap = 1
  const occ = new Occupancy(g)
  const place = (c: Compiled, tx: number, ty: number, id: string, kind: string): Placed | null => {
    const p = findSpot(g, occ, c.w, c.h, tx - c.front.x, ty - c.front.y, gap, 2)
    if (!p) return null
    const pl = stamp(g, c, p.x, p.y, r, roles, id, kind)
    placed.push(pl)
    occ.rebuild()
    return pl
  }
  let station: Placed | null = null
  if (stationBp) station = place(stationBp, cx, cy + 3, 'poi:station', main.kind === 'bus' ? 'bus' : 'station')
  const roadTile = urban ? roles.street : roles.road
  // 關東的街上、有鐵路的車站：車站北邊 3 格那一列先留給高架鐵道（鋪成路：高架下的路），地標、店都不會蓋在上面
  // （高架不穿過大樓、不隔在拍攝點與地標之間）
  let viaductRow = -1
  if (kit === 'kanto' && urban && station?.kind === 'station' && main.kind === 'rail' && station.y - 3 >= 3) {
    viaductRow = station.y - 3
    for (let x = 2; x < W - 2; x++)
      if (g.free(x, viaductRow)) {
        g.ground(x, viaductRow, roadTile)
        g.setUse(x, viaductRow, U.road)
      }
    occ.rebuild()
  }

  // 海灘、岬、島、橋（沿海、河）
  for (const p of plans.filter((x) => x.special)) {
    const at = project(p.spot)
    const pl =
      (p.kind === 'bridge' || p.kind === 'river') && kit !== 'okinawa' ? riverBridge(g, river, at, roles, p.spot, p.kind === 'bridge') : sea ? coastFeature(g, p.kind, at, roles, r, p.spot, kit) : null
    if (pl) placed.push(pl)
  }
  occ.rebuild()
  const placeLandmark = (p: (typeof plans)[number]) => {
    if (p.special || !p.bp) return
    const at = project(p.spot)
    const pl = place(p.bp, at.x, at.y, `lm:${p.spot.id}`, p.kind) ?? (p.smaller ? place(p.smaller, at.x, at.y, `lm:${p.spot.id}`, p.kind) : null)
    if (pl) pl.spot = p.spot
  }
  // 機場（進出這一鎮的地方）最先，再來分數前 6 名
  for (const p of plans) if (p.kind === 'airport') placeLandmark(p)
  if (!station) station = placed.find((p) => p.kind === 'airport') ?? null
  for (const p of plans) if (p.kind !== 'airport' && p.rank < 6) placeLandmark(p)

  // 店：旅館（起點的鎮）、食堂；巴士站、單軌的其他站；老舖、茶屋
  const startTown = world.towns.find((t) => t.pref === town.pref)?.id === town.id
  const near = station ? station.front : { x: cx, y: cy }
  if (startTown && main.kind !== 'airport') place(compile(poiBlueprint('inn', kit), kit), near.x - 8, near.y + 2, 'poi:inn', 'inn')
  place(compile(poiBlueprint('shokudo', kit), kit), near.x + 9, near.y + 1, 'poi:shokudo', 'shokudo')
  for (const s of town.stops.slice(1)) {
    if (s.kind === 'bus') place(compile(poiBlueprint('bus', kit), kit), near.x + 4, near.y + 4, 'poi:bus', 'bus')
    else if (s.kind === 'monorail') {
      const at = s.id.startsWith('st:') ? project(s) : near
      place(compile(poiBlueprint('monorail', kit), kit), at.x, at.y, `poi:${s.id}`, 'monorail')
    }
  }
  for (const s of shiniseHere) {
    const at = project(s)
    const pl = place(compile(poiBlueprint(s.g === 'teahouse' ? 'teahouse' : 'shinise', kit), kit), at.x, at.y, `poi:shinise:${s.id}`, s.g === 'teahouse' ? 'teahouse' : 'shinise')
    if (pl) pl.shinise = s
  }
  for (const p of plans) if (p.kind !== 'airport' && p.rank >= 6) placeLandmark(p)
  if (!station) station = placed[0] ?? null
  // 名城的蓋章台（P3：屋外的蓋章地點、蓋在別的地標的）：城（或那個地標）藍圖的 n 格，路人不站那裡
  const tables: Array<{ at: Pt; stamp: StampData }> = []
  for (const p of plans) {
    const how = castlePlace(p.spot)
    if (!how || how.mode === 'hut') continue
    const c = castleAtCastle(p.spot)!
    const castlePl = placed.find((x) => x.spot?.id === p.spot.id)
    const host = how.mode === 'landmark' ? (placed.find((x) => x.spot?.id === how.spot.id) ?? castlePl) : castlePl
    const at = host?.npc.shift() ?? null
    if (!host || !at) continue
    g.layer('lower', at.x, at.y, 'world/stamp-table')
    g.setUse(at.x, at.y, U.keep)
    tables.push({ at, stamp: castleStamp(c, p.spot.id) })
  }

  phase('place')
  // 5. 路
  layRoads(g, placed, station, r, roles, roadTile, urban, p3pref)

  // 郊外的鎮：藍圖的步道（紅磚）換成土的步道
  if (!urban && roles.ruralPath && roles.ruralPath !== roles.path) swapGround(g, roles.path, roles.ruralPath)
  // 關東的街上：有鐵路的車站北邊，一條高架鐵道橫過地圖
  if (viaductRow >= 0) viaduct(g, viaductRow)

  phase('roads')
  // 6. 填空
  fillTown(g, r, roles, urban, kit, input.genVersion, { flowers: plans.some((p) => p.kind === 'flowerfield') })
  phase('fill')

  // 7. 實體：告示牌、拍攝點、NPC、交通
  const ents: MapEntity[] = []
  const interiors = new Map<string, GameMap>()
  const counters = new Map<string, number>()
  const intId = (k: string) => {
    const n = counters.get(k) ?? 0
    counters.set(k, n + 1)
    return `int:${town.id}:${k}:${n}`
  }
  let npcN = 0
  const npcSeed = () => seedOf(town.id, 'npc', npcN++)
  const look = (seed: number) => (roles.folks ? roles.folks[(seed >>> 0) % roles.folks.length]! : folkOf(seed))
  const linksOf = (stop: string) => world.links.filter((l) => l.from === town.id && l.fromStop === stop)
  const travelData = (mode: TravelData['mode'], stop: string): TravelData => ({ mode, fromTown: town.id, dests: linksOf(stop).map((l) => destOf(l, mode)) })
  let inn: TownGen['inn']
  const landmarks: TownGen['landmarks'] = []
  const usedNpc = new Set<string>()

  for (const p of placed) {
    // 拍照的範圍不超出地圖
    const t = p.target
    const x0 = Math.max(0, t.x)
    const y0 = Math.max(0, t.y)
    p.target = { x: x0, y: y0, w: Math.max(1, Math.min(W, t.x + t.w) - x0), h: Math.max(1, Math.min(H, t.y + t.h) - y0) }
    const spot = p.spot
    if (spot) {
      const ja0 = spot.name?.ja ?? spot.n
      // P3：名字的消歧義括號（「小泉城 (大和国)」）不寫在告示牌上
      const title = { ja: p3pref ? stripDisambig(ja0) : ja0, zh: spot.name?.zh_tw ?? spot.z, kana: spot.name?.kana ?? spot.h, romaji: spot.name?.romaji ?? spot.r }
      const src = spot.summary?.source_url ?? spot.src ?? wikidataUrl(spot.id)
      if (p.sign && src) {
        const data: SignData = { spotId: spot.id, title, source_url: src, ...(spot.summary ? { summary: { text: spot.summary.text, lang: spot.summary.lang, source_url: spot.summary.source_url, license: spot.summary.license, ...(spot.summary.text_zh ? { text_zh: spot.summary.text_zh } : {}) } } : {}) }
        ents.push({ id: `sign:${spot.id}`, kind: 'sign', x: p.sign.x, y: p.sign.y, data: data as unknown as Record<string, unknown> })
      }
      if (p.photo) {
        const data: PhotoSpotData = { spotId: spot.id, name: title, target: p.target }
        ents.push({ id: `photo:${spot.id}`, kind: 'photoSpot', x: p.photo.x, y: p.photo.y, facing: 'up', data: data as unknown as Record<string, unknown> })
      }
      landmarks.push({ spotId: spot.id, kind: p.kind as LandmarkKind, rect: p.target, area: { x: p.x, y: p.y, w: p.w, h: p.h } })
    }
    if (p.shinise && p.sign) {
      const s = p.shinise
      const data: SignData = { shiniseId: s.id, title: { ja: s.n, kana: s.h, zh: s.z }, source_url: s.w ?? s.u, ...(s.f ? { founded: s.f } : {}) }
      ents.push({ id: `sign:${s.id}`, kind: 'sign', x: p.sign.x, y: p.sign.y, data: data as unknown as Record<string, unknown> })
    }
    if (p.kind === 'station' && p.sign) {
      const st = main.stationId ? pref.station(main.stationId) : undefined
      const romaji = stationRomaji(st?.e, sameSpot(pref, main.name)?.r)
      const data: SignData = { title: { ja: main.name, ...(romaji ? { romaji } : {}) }, source_url: osmUrl(main.stationId) }
      ents.push({ id: `sign:station:${town.id}`, kind: 'sign', x: p.sign.x, y: p.sign.y, data: data as unknown as Record<string, unknown> })
    }
    // 門 → 室內
    const out = (d: { x: number; y: number }): InteriorOut => ({ map: town.mapId, x: d.x, y: d.y + 1 })
    if (!p.doors.length) continue
    const kind = p.doors[0]!.interior
    const exits = p.doors.map(out)
    let room: Interior | null = null
    let id = ''
    if (kind === 'station') {
      const stop = p.id === 'poi:station' ? main : town.stops.find((s) => `poi:${s.id}` === p.id)
      if (!stop) continue
      id = intId('station')
      const st = stop.stationId ? pref.station(stop.stationId) : undefined
      const romaji = stationRomaji(st?.e, sameSpot(pref, stop.name)?.r)
      const sc = stationCastles.find((x) => x.stop.id === stop.id)
      room = stationHall({
        id,
        name: { ja: `${stop.name}駅`, romaji, zh: `${stop.name}站` },
        exits,
        travel: travelData(stop.kind === 'monorail' ? 'monorail' : 'rail', stop.id),
        stamp: { stampId: `station:${stop.stationId}`, stampKind: 'station', pref: pref.pref, name: stop.name, stationId: stop.stationId, ...(romaji ? { face: romaji } : {}) },
        kiosk: stop.id === 'main' ? { shopKind: 'station', name: '売店', items: [] } : null,
        npcLook: look(npcSeed()),
        npcSeed: npcSeed(),
        castle: sc ? { stamp: castleStamp(sc.castle, sc.spot.id), where: sc.castle.st![0]!, source_url: sc.castle.u } : null,
      })
      stops[stop.id] = { map: town.mapId, x: p.doors[0]!.x, y: p.doors[0]!.y + 1, dir: 'down' }
    } else if (kind === 'airport' && spot) {
      id = intId('airport')
      const stopId = main.kind === 'airport' ? 'main' : 'airport'
      room = airportHall({
        id,
        name: { ja: spot.n, romaji: (spot.r ?? '').toUpperCase(), zh: spot.z ?? spot.n },
        exits,
        travel: travelData('plane', stopId),
        kiosk: { shopKind: 'station', name: '売店', items: [] },
        npcLook: look(npcSeed()),
        npcSeed: npcSeed(),
      })
      stops[stopId] = { map: id, x: room.arrive!.x, y: room.arrive!.y, dir: room.arrive!.dir }
    } else if (kind === 'juyosho' && spot) {
      id = intId('juyosho')
      // P3：名字的消歧義括號（「慈光院 (大和郡山市)」）不寫在授与所、參拜印上
      const nm = p3pref ? stripDisambig(spot.n) : spot.n
      const stamp: StampData = { stampId: `sanpai:${spot.id}`, stampKind: 'sanpai', pref: pref.pref, name: nm, spotId: spot.id }
      room = juyosho({ id, name: { ja: `${nm}　授与所`, romaji: (spot.r ?? '').toUpperCase(), zh: `${spot.z ?? nm} 授與所` }, exits, stamp, seed: npcSeed() })
    } else if (kind === 'castle' && spot) {
      // 蓋章地點在城裡的才有這間（在車站的放在車站的大廳）
      const c = castleAtCastle(spot)
      if (!c) continue
      id = intId('castle')
      const stName = p3pref ? hutName(c.st![0]!, c.n) : c.st![0]!
      room = castleOffice({ id, name: { ja: stName, romaji: '', zh: stName }, exits, stamp: castleStamp(c, spot.id) })
    } else if (kind === 'inn') {
      id = intId('inn')
      const data: InnData = kit === 'okinawa' ? { innKind: 'minshuku', name: '民宿' } : { innKind: 'ryokan', name: '旅館' }
      const ir = innRoom({ id, name: { ja: data.name, romaji: data.innKind === 'ryokan' ? 'RYOKAN' : 'MINSHUKU', zh: data.name }, exits, inn: data, seed: npcSeed() })
      room = ir
      inn = { map: id, stairs: ir.stairs }
    } else if (kind === 'shokudo' || kind === 'shinise' || kind === 'teahouse') {
      id = intId(kind)
      const s = p.shinise
      const shop: ShopData = s ? { shopKind: kind === 'teahouse' ? 'teahouse' : 'shinise', name: s.n, shiniseId: s.id, items: [] } : { shopKind: 'shokudo', name: '食堂', items: [] }
      room = shopRoom({ id, name: { ja: shop.name, romaji: kind === 'shokudo' ? 'SHOKUDO' : '', zh: s?.z ?? shop.name }, exits, shop, seed: npcSeed() })
    }
    if (!room) continue
    room.map.setting = g.map.setting
    interiors.set(id, room.map)
    p.doors.forEach((d, i) => {
      const m = room!.mats[Math.min(i, room!.mats.length - 1)]!
      g.map.warps.push({ x: d.x, y: d.y, to: id, tx: m.x, ty: m.y, dir: 'up', on: 'step' })
    })
  }

  // 巴士站：站牌就是交通的實體
  for (const p of placed.filter((x) => x.kind === 'bus')) {
    const stopId = p.id === 'poi:station' ? 'main' : 'bus'
    const sign = { x: p.front.x, y: p.front.y - 2 }
    ents.push({ id: `travel:${town.id}:bus`, kind: 'travel', x: sign.x, y: sign.y, data: travelData('bus', stopId) as unknown as Record<string, unknown> })
    stops[stopId] = { map: town.mapId, x: sign.x, y: sign.y + 1, dir: 'down' }
  }

  // 名城的蓋章台
  for (const t of tables) ents.push({ id: `stamp:${t.stamp.stampId}`, kind: 'stamp', x: t.at.x, y: t.at.y, data: t.stamp as unknown as Record<string, unknown> })

  // NPC
  const walkable = new MapView(g.map)
  // 到站的地方：站的那一格、往前（下）3 格、左右各一格不站人（一下車不會撞到人、不會疊在一起）
  const reserved = stopLanes(stops, town.mapId)
  // 拍攝點：旁邊 2 格內不站不會走開的人，身體也不擋到地標（拍照不會被扣「路人」）
  const photoSpots = placed.filter((p) => p.photo && p.spot).map((p) => ({ photo: p.photo!, target: p.target }))
  const nearPhoto = (x: number, y: number) =>
    photoSpots.some(({ photo, target: t }) => Math.max(Math.abs(photo.x - x), Math.abs(photo.y - y)) <= 2 || [y, y - 1].some((yy) => x >= t.x && x < t.x + t.w && yy >= t.y && yy < t.y + t.h))
  const okNpc = (x: number, y: number, still = false) => {
    if (!g.inside(x, y) || usedNpc.has(key(x, y)) || reserved.has(key(x, y))) return false
    if (!passable(walkable.beh(x, y)) || g.map.warps.some((w) => Math.abs(w.x - x) + Math.abs(w.y - y) <= 1)) return false
    if (ents.some((e) => e.x === x && e.y === y)) return false
    if (still && nearPhoto(x, y)) return false
    let n = 0
    for (const [dx, dy] of DIRS) if (passable(walkable.beh(x + dx, y + dy))) n++
    return n >= 3
  }
  const npcNear = (p: Pt, radius = 5, still = false, from = 1): Pt | null => {
    for (let rr = from; rr <= radius; rr++)
      for (let dy = -rr; dy <= rr; dy++)
        for (let dx = -rr; dx <= rr; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue
          if (okNpc(p.x + dx, p.y + dy, still)) return { x: p.x + dx, y: p.y + dy }
        }
    return null
  }
  const addNpc = (p: Pt | null, data: Omit<NpcData, 'look' | 'lookSeed'>, id: string) => {
    if (!p) return
    usedNpc.add(key(p.x, p.y))
    const seed = npcSeed()
    const d: NpcData = { ...data, look: lookAround(ents, p, seed, roles.folks), lookSeed: seed, tags: { region: town.pref, kit, town: town.id } }
    ents.push({ id, kind: 'npc', x: p.x, y: p.y, facing: 'down', data: d as unknown as Record<string, unknown> })
  }
  // 一下車看到的人（到別鎮的距離、委託）：P3 的鎮在車站前 2–5 格裡照鎮的種子挑（每鎮的第一個畫面不會都一樣；京都、沖繩照舊）
  const arrivalRng = makeRng(seedOf(town.id, 'arrival'))
  const npcAround = (p: Pt, from: number, to: number): Pt | null => {
    const cands: Pt[] = []
    for (let dy = -to; dy <= to; dy++)
      for (let dx = -to; dx <= to; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        if (d >= from && d <= to && okNpc(p.x + dx, p.y + dy, true)) cands.push({ x: p.x + dx, y: p.y + dy })
      }
    return cands.length ? cands[arrivalRng.int(0, cands.length - 1)]! : null
  }
  const nearStation = (anchor: Pt, fallback: () => Pt | null) => (p3pref && station && anchor === station.front ? (npcAround(anchor, 2, 5) ?? fallback()) : fallback())
  const facts = factsOf(pref, town, world, placed)
  // 沒有綁地點的事實（櫻、距離）：分散到各個地標前面（距離的那一位在車站）
  const anchors = placed.filter((p) => p.spot && p !== station).map((p) => p.front)
  let ai = 0
  facts.forEach((f, i) => {
    const anchor = f.at ?? (f.fact.template.endsWith('.km') ? station?.front : anchors[ai++ % Math.max(1, anchors.length)]) ?? station?.front ?? { x: cx, y: cy }
    addNpc(
      nearStation(anchor, () => npcNear(anchor, 8, true, 2) ?? npcNear(anchor, 8, true)),
      { role: 'fact', fact: f.fact, move: 'look' },
      `npc:${town.id}:fact:${i}`,
    )
  })
  // 地標的 n 格：路人
  let passers = 0
  for (const p of placed)
    for (const n of p.npc) {
      if (passers >= (urban ? 7 : 5) || !okNpc(n.x, n.y, true)) continue
      addNpc(n, { role: 'passer', move: r.chance(0.5) ? 'look' : 'stand' }, `npc:${town.id}:passer:${passers++}`)
    }
  // 路上走動的路人
  const roads: Pt[] = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g.useAt(x, y) === U.road) roads.push({ x, y })
  for (let k = 0; k < 4 && roads.length; k++) {
    const p = roads[r.int(0, roads.length - 1)]!
    addNpc(okNpc(p.x, p.y) ? p : npcNear(p, 3), { role: 'passer', move: 'wander', range: 2 }, `npc:${town.id}:walker:${k}`)
  }
  const qAt = station?.front ?? { x: cx, y: cy }
  addNpc(
    nearStation(qAt, () => npcNear(qAt, 8, true, 2) ?? npcNear(qAt, 8, true)),
    { role: 'quest', move: 'look' },
    `npc:${town.id}:quest`,
  )

  g.map.entities.push(...ents)
  const ids = new Set(ents.map((e) => e.id))
  const questSpots = landmarks
    .filter((l) => l.kind !== 'airport' && ids.has(`sign:${l.spotId}`) && ids.has(`photo:${l.spotId}`))
    .map((l) => pref.spotById(l.spotId))
    .filter((s): s is PrefSpot => !!s && (!!s.c || !!s.summary))
    .map((s) => s.id)

  phase('entities')
  // 8. 可達性
  const startAt = stops.main && stops.main.map === town.mapId ? stops.main : station ? { ...station.front, map: town.mapId, dir: 'down' as Dir } : { x: cx, y: cy, map: town.mapId, dir: 'down' as Dir }
  ensureReachable(g, startAt, roles)
  g.map.start = { x: startAt.x, y: startAt.y, dir: 'down' }
  if (!stops.main) stops.main = { map: town.mapId, x: startAt.x, y: startAt.y, dir: 'down' }

  phase('reach')
  // 祭典的攤子（那個月才套上）
  const festival = festivalLayer(g, pref, town, roles, placed, station, reserved)

  // 開花的格子
  const bloom: BloomCell[] = []
  // 各 kit 登記的開花對照（關東、北海道的 kit 讀進來之後才有它們的）
  const pairs = bloomPairs() as Record<string, { flower: Flower; bloom: string }>
  for (const layer of ['lower', 'over'] as const) {
    const arr = g.map[layer]
    for (let i = 0; i < arr.length; i++) {
      const id = arr[i]!
      if (!id) continue
      const name = tileDef(id)?.name
      if (!name) continue
      const slash = name.lastIndexOf('/')
      const baseName = name.includes('@') ? null : slash > name.indexOf('/') ? name.slice(0, slash) : name
      const pair = baseName ? pairs[baseName] : undefined
      if (!pair) continue
      const bloomName = slash > name.indexOf('/') ? `${pair.bloom}${name.slice(slash)}` : pair.bloom
      bloom.push({ layer, i, base: id, bloom: tid(bloomName), flower: pair.flower })
    }
  }

  phase('bloom')
  return { map: g.map, interiors, stops, bloom, festival, landmarks, questSpots, inn, ms: now() - t0 }
}

/** 名城的蓋章地點寫的是屋外（城門下、券売所外、…付近 (屋外)）：城門邊的蓋章台，不蓋小屋（P3） */
const OUTDOOR_STAMP = /門下|屋外|券売所外|付近/

/**
 * 城的蓋章處（小屋）的名字（P3）：資料的 st，拿掉括號裡的開館時間（「(日曜日のみ開館)」）；
 * 「天守閣…」的不畫天守，名字也不寫天守閣（「天守閣1階インフォメーションカウンター」→「大阪城　インフォメーションカウンター」）。
 * 完整的原文照樣在蓋章時、事實 NPC 的台詞裡（附出處）。
 */
export function hutName(st: string, castle: string): string {
  let n = st.replace(/\s*[（(][^）)]*(開館|休館|のみ|曜日)[^）)]*[）)]/g, '').trim()
  const noKeep = n.replace(/天守閣?\s*[0-9０-９]*\s*階?/g, '').trim()
  if (noKeep !== n) n = noKeep && !noKeep.includes(castle.replace(/城$/, '')) ? `${castle}　${noKeep}` : noKeep || castle
  return n || castle
}

/** 跟車站同名的景點（那覇空港駅 ↔ 那覇空港）：站名的羅馬字用它的 */
const sameSpot = (pref: PrefData, name: string) => pref.spots.find((s) => s.n === name || s.n === `${name}駅`)

/** 鎮曲：近畿（京都、奈良、大阪、兵庫）放京都那首，關東放東京、北海道放北海道（audio/songs） */
const BGM_OF: Record<Kit, string> = { kinki: 'kyoto', okinawa: 'okinawa', kanto: 'tokyo', hokkaido: 'hokkaido' }

/**
 * 路人的外觀：4 格內已經有人穿的就換下一種（同一個畫面裡不要一堆雙胞胎；種子一樣結果一樣）。
 * folks：這一套 kit 的路人（關東多是上班族、學生；北海道多是農家、觀光客）；沒給就是全部 12 種。
 */
function lookAround(ents: readonly MapEntity[], p: Pt, seed: number, folks?: readonly string[]): string {
  const near = new Set(ents.filter((e) => e.kind === 'npc' && Math.max(Math.abs(e.x - p.x), Math.abs(e.y - p.y)) <= 4).map((e) => (e.data as { look?: string } | undefined)?.look))
  const pool: readonly string[] = folks ?? FOLK_IDS
  const at = (k: number) => (folks ? pool[((seed + k) >>> 0) % pool.length]! : folkOf(seed + k))
  for (let k = 0; k < pool.length; k++) {
    const id = at(k)
    if (!near.has(id)) return id
  }
  return at(0)
}

/** 到站的地方（同一張地圖的）：站的那一格、往前 3 格、左右各一格 → 不放 NPC、攤子 */
function stopLanes(stops: Record<string, Arrival>, mapId: string): Set<string> {
  const out = new Set<string>()
  const DV: Record<Dir, Pt> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
  for (const a of Object.values(stops)) {
    if (a.map !== mapId) continue
    const d = DV[a.dir]
    for (let k = 0; k <= 3; k++) {
      const x = a.x + d.x * k
      const y = a.y + d.y * k
      out.add(key(x, y))
      out.add(key(x + d.y, y + d.x))
      out.add(key(x - d.y, y - d.x))
    }
  }
  return out
}

const wikidataUrl = (id: string) => (/^wd-Q\d+$/.test(id) ? `https://www.wikidata.org/wiki/${id.slice(3)}` : '')
const osmUrl = (node?: string) => (node && /^node-\d+$/.test(node) ? `https://www.openstreetmap.org/node/${node.slice(5)}` : 'https://www.openstreetmap.org/')

function destOf(l: Link, mode: TravelData['mode']): TravelDest {
  const last = l.legs[l.legs.length - 1]!
  const first = l.legs[0]!
  return {
    town: l.to,
    name: l.name,
    km: last.km,
    kmKind: last.kmKind,
    ...(l.legs.length > 1 ? { via: { name: first.to, km: first.km, kmKind: first.kmKind, mode: first.mode } } : {}),
    ...(last.mode !== mode ? { mode: last.mode } : {}),
    link: l.id,
  }
}

/** 老舖在哪一鎮（舊資料沒有 m 時）：外框裡、離鎮中心最近的那一鎮 */
function nearestTownOf(world: World, pref: string, p: { lat: number; lng: number }): string | null {
  let best: string | null = null
  let bd = Infinity
  for (const t of world.towns) {
    if (t.pref !== pref || !inBbox(t.bbox, p)) continue
    const d = kmBetween(t.center, p)
    if (d < bd) {
      bd = d
      best = t.id
    }
  }
  return best
}

// ---------- 地形 ----------
/** 沖繩的海：往海邊景點的方向、離中心比那個景點遠的地方是海；淺、海、深三層 */
function paintSea(g: Grid, coast: Pt[], center: Pt, r: Rng, island: boolean): boolean {
  if (!coast.length && !island) return false
  const W = g.w
  const H = g.h
  const sx = W / 2 - 2
  const sy = H / 2 - 2
  const norm = (p: Pt) => {
    const dx = (p.x - center.x) / sx
    const dy = (p.y - center.y) / sy
    return { a: Math.atan2(dy, dx), d: Math.hypot(dx, dy) }
  }
  // 每個海邊的景點：在它外面放一個「海的圓心」，圓剛好通過景點附近（海灣是圓的）
  const seed = r.int(0, 1 << 30)
  const circles = coast.map((p) => {
    const f = norm(p)
    const d = Math.max(0.45, Math.min(0.92, f.d))
    const reach = 1.7
    return { x: center.x + Math.cos(f.a) * sx * reach, y: center.y + Math.sin(f.a) * sy * reach, r: (reach - d + 0.06) * sx }
  })
  const isSea = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const wob = (noise(x, y, seed, 6) - 0.5) * 0.3 + (noise(x, y, seed + 1, 2.5) - 0.5) * 0.12
      let sea = false
      for (const c of circles) if (Math.hypot(x - c.x, (y - c.y) * (sx / sy)) / c.r < 1 + wob) sea = true
      // 離島：地圖外圈都是海
      if (island && norm({ x, y }).d > 0.9 + wob) sea = true
      if (sea) isSea[y * W + x] = 1
    }
  // 車站附近一定是陸地
  for (let y = center.y - 6; y <= center.y + 7; y++) for (let x = center.x - 8; x <= center.x + 8; x++) if (g.inside(x, y)) isSea[y * W + x] = 0
  // 平滑兩次（多數決）
  for (let pass = 0; pass < 2; pass++) {
    const next = isSea.slice()
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        let n = 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += isSea[(y + dy) * W + x + dx]!
        next[y * W + x] = n >= 5 ? 1 : n <= 3 ? 0 : isSea[y * W + x]!
      }
    isSea.set(next)
  }
  // 離陸地的距離 → 淺、海、深
  const dist = new Int16Array(W * H).fill(99)
  const q: number[] = []
  for (let i = 0; i < W * H; i++)
    if (!isSea[i]) {
      dist[i] = 0
      q.push(i)
    }
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]!
    const x = i % W
    const y = (i - x) / W
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const j = ny * W + nx
      if (dist[j]! > dist[i]! + 1) {
        dist[j] = dist[i]! + 1
        q.push(j)
      }
    }
  }
  let any = false
  for (let i = 0; i < W * H; i++) {
    if (!isSea[i]) continue
    any = true
    const x = i % W
    const y = (i - x) / W
    const d = dist[i]!
    const name = d <= 2 ? 'okinawa/shallow' : d <= 4 ? 'okinawa/sea' : 'okinawa/deep'
    g.ground(x, y, name)
    g.setUse(x, y, U.sea)
    // 淺海偶爾有礁岩
    if (d === 2 && noise(x, y, seed + 7, 2) > 0.78) g.ground(x, y, 'okinawa/reef')
  }
  // 沙灘：陸地緊貼海的一格是沙
  for (let i = 0; i < W * H; i++) {
    if (isSea[i]) continue
    const x = i % W
    const y = (i - x) / W
    if (dist[i] === 0 && DIRS.some(([dx, dy]) => g.useAt(x + dx, y + dy) === U.sea) && g.useAt(x, y) !== U.edge) g.ground(x, y, 'okinawa/sand')
    else if (DIRS.some(([dx, dy]) => g.useAt(x + dx, y + dy) === U.sea)) g.ground(x, y, 'okinawa/sand')
  }
  return any
}

/** 近畿的河：資料有「橋」或名字是「…川」「…橋」的景點時，河從那個點穿過整張地圖（跟車站→那個點的方向垂直） */
function paintRiver(
  g: Grid,
  plans: Array<{ spot: PrefSpot; kind: LandmarkKind }>,
  project: (p: { lat: number; lng: number }) => Pt,
  center: Pt,
  r: Rng,
  roles: KitRoles,
): { vertical: boolean; at: number; cells: Set<string> } | null {
  const hit = plans.find((p) => p.kind === 'bridge' || p.kind === 'river' || /[川]$/.test(p.spot.n))
  if (!hit) return null
  const p = project(hit.spot)
  const dx = p.x - center.x
  const dy = p.y - center.y
  const vertical = Math.abs(dx) >= Math.abs(dy)
  // 河離車站至少 9 格
  let at = vertical ? p.x : p.y
  const c = vertical ? center.x : center.y
  if (Math.abs(at - c) < 9) at = c + (at >= c ? 9 : -9)
  const len = vertical ? g.h : g.w
  const amp = r.int(1, 2)
  const phase = r.range(0, Math.PI * 2)
  const cells = new Set<string>()
  for (let t = 0; t < len; t++) {
    const off = Math.round(Math.sin(t / 7 + phase) * amp)
    for (let k = -1; k <= 1; k++) {
      const x = vertical ? at + off + k : t
      const y = vertical ? t : at + off + k
      if (!g.inside(x, y)) continue
      g.ground(x, y, roles.water)
      g.setUse(x, y, U.water)
      cells.add(key(x, y))
    }
  }
  return { vertical, at, cells }
}

/**
 * 河上的橋（地標）：最靠近那個點的地方架橋，告示牌＋拍攝點在岸邊。
 * bridge = false（P3：名字是「…川」的地標本身）：不架橋，只在岸邊放告示牌與拍攝點，拍的是那一段河。
 */
function riverBridge(g: Grid, river: ReturnType<typeof paintRiver>, at: Pt, roles: KitRoles, spot: PrefSpot, bridge = true): Placed | null {
  if (!river) return null
  // 找一條橫（直）線：線上有水、東（南）岸有三格空地（拍攝點、告示牌、接路）
  const span = (t: number): { water: Pt[]; bank: Pt } | null => {
    const water: Pt[] = []
    for (let s = 2; s < (river.vertical ? g.w : g.h) - 2; s++) {
      const x = river.vertical ? s : t
      const y = river.vertical ? t : s
      if (g.useAt(x, y) === U.water) water.push({ x, y })
    }
    if (!water.length) return null
    const last = water[water.length - 1]!
    const bank = river.vertical ? { x: last.x + 1, y: last.y } : { x: last.x, y: last.y + 1 }
    const cells = river.vertical ? [bank, { x: bank.x, y: bank.y + 1 }, { x: bank.x + 1, y: bank.y }] : [bank, { x: bank.x + 1, y: bank.y }, { x: bank.x, y: bank.y + 1 }]
    return cells.every((c) => g.free(c.x, c.y) && c.x > 1 && c.y > 1 && c.x < g.w - 2 && c.y < g.h - 2) ? { water, bank } : null
  }
  const t0 = river.vertical ? Math.max(4, Math.min(g.h - 6, at.y)) : Math.max(4, Math.min(g.w - 6, at.x))
  let hit: { water: Pt[]; bank: Pt } | null = null
  for (let k = 0; k < 12 && !hit; k++) hit = span(t0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2))
  if (!hit) return null
  const water = hit.water
  const first = water[0]!
  const last = water[water.length - 1]!
  if (bridge)
    for (const w of water) {
      g.ground(w.x, w.y, river.vertical ? roles.bridgeH : roles.bridgeV)
      g.setUse(w.x, w.y, U.keep)
    }
  // 岸邊（南、東那一側）：拍攝點與告示牌
  const bank = hit.bank
  const photo = { ...bank }
  const sign = river.vertical ? { x: bank.x, y: bank.y + 1 } : { x: bank.x + 1, y: bank.y }
  for (const p of [photo, sign]) {
    if (!g.inside(p.x, p.y)) return null
    g.ground(p.x, p.y, roles.path)
    g.setUse(p.x, p.y, U.keep)
  }
  g.layer('lower', photo.x, photo.y, 'basic/photo')
  g.layer('lower', sign.x, sign.y, roles.sign)
  const front = river.vertical ? { x: bank.x + 1, y: bank.y } : { x: bank.x, y: bank.y + 1 }
  g.setUse(front.x, front.y, U.keep)
  g.ground(front.x, front.y, roles.path)
  const x0 = Math.min(first.x, last.x)
  const y0 = Math.min(first.y, last.y)
  return {
    id: `lm:${spot.id}`,
    kind: bridge ? 'bridge' : 'river',
    x: x0,
    y: y0,
    w: Math.abs(last.x - first.x) + 1,
    h: Math.abs(last.y - first.y) + 1,
    front,
    photo,
    sign,
    npc: [],
    doors: [],
    target: { x: x0 - (river.vertical ? 0 : 1), y: y0 - (river.vertical ? 1 : 0), w: Math.abs(last.x - first.x) + (river.vertical ? 1 : 3), h: Math.abs(last.y - first.y) + (river.vertical ? 3 : 1) },
    spot,
    objects: [],
  }
}

/** 海灘、岬、島、海上的橋：在海邊找位置 */
function coastFeature(g: Grid, kind: LandmarkKind, at: Pt, roles: KitRoles, r: Rng, spot: PrefSpot, kit: string): Placed | null {
  const isLand = (x: number, y: number) => {
    const u = g.useAt(x, y)
    return u === U.free
  }
  const seaNear = (x: number, y: number, d = 1) => {
    for (let yy = y - d; yy <= y + d; yy++) for (let xx = x - d; xx <= x + d; xx++) if (g.useAt(xx, yy) === U.sea) return true
    return false
  }
  // 最靠近那一點、緊鄰海的陸地
  let coast: Pt | null = null
  let bd = Infinity
  for (let y = 3; y < g.h - 3; y++)
    for (let x = 3; x < g.w - 3; x++) {
      if (!isLand(x, y) || !seaNear(x, y)) continue
      // 周圍要有一點空地（拍攝點、告示牌、路）
      let free = 0
      for (const [dx, dy] of DIRS) if (isLand(x + dx, y + dy)) free++
      if (free < 2) continue
      const d = Math.hypot(x - at.x, y - at.y)
      if (d < bd) {
        bd = d
        coast = { x, y }
      }
    }
  if (!coast) return null
  // 往海的方向；拍攝點在岸邊，告示牌在旁邊，接路的格子往陸地那邊
  // 海的方向：緊鄰是海、往那邊海最寬的（窄的海灣、入江、沿著岸邊的水道不算：看 3 格寬的一條）
  const seaRun = ([dx, dy]: [number, number]) => {
    let n = 0
    for (let k = 1; k <= 10; k++)
      for (let s = -1; s <= 1; s++) if (g.useAt(coast!.x + dx * k + dy * s, coast!.y + dy * k + dx * s) === U.sea) n++
    return n
  }
  const toSea = DIRS.filter(([dx, dy]) => g.useAt(coast!.x + dx, coast!.y + dy) === U.sea).sort((a, b) => seaRun(b) - seaRun(a))[0] ?? [0, 1]
  const photo = { ...coast }
  const side: [number, number] = toSea[0] === 0 ? [1, 0] : [0, 1]
  const around = [
    { x: coast.x - toSea[0], y: coast.y - toSea[1] },
    { x: coast.x + side[0], y: coast.y + side[1] },
    { x: coast.x - side[0], y: coast.y - side[1] },
  ].filter((p) => isLand(p.x, p.y))
  const front = around[0]
  const sign = around.find((p) => p !== front)
  if (!front || !sign) return null
  let target = { x: coast.x - 2, y: coast.y - 2, w: 5, h: 5 }
  const sand = kit === 'okinawa' ? 'okinawa/sand' : roles.sand

  if (kind === 'beach') {
    // 沙灘：附近貼海的陸地都是沙
    for (let y = coast.y - 3; y <= coast.y + 3; y++)
      for (let x = coast.x - 4; x <= coast.x + 4; x++)
        if (isLand(x, y) && seaNear(x, y, 2)) {
          g.ground(x, y, sand)
          if (!(x === front.x && y === front.y)) g.setUse(x, y, U.keep)
        }
    target = { x: coast.x - 4 + toSea[0] * 2, y: coast.y - 3 + toSea[1] * 2, w: 9, h: 7 }
  } else if (kind === 'cape') {
    // 岬：岸邊的岩石
    for (let k = -2; k <= 2; k++) {
      const x = coast.x + side[0] * k + toSea[0]
      const y = coast.y + side[1] * k + toSea[1]
      if (g.useAt(x, y) === U.sea && k !== 0) g.ground(x, y, 'okinawa/reef')
    }
  } else if (kind === 'island') {
    // 島：往海的方向找一塊夠大的海，畫一個小島（從岸邊看）
    // 離岸邊 3–10 格（從拍攝點打開取景框，鏡頭移過去看得到）
    let best: Pt | null = null
    for (let d = 3; d <= 10; d++) {
      const x = coast.x + toSea[0] * d
      const y = coast.y + toSea[1] * d
      if (!g.inside(x, y)) break
      let ok = true
      for (let yy = y - 1; yy <= y + 1 && ok; yy++) for (let xx = x - 1; xx <= x + 1 && ok; xx++) if (g.useAt(xx, yy) !== U.sea) ok = false
      if (ok) {
        best = { x, y }
        if (d >= 4) break
      }
    }
    if (!best) return null
    for (let yy = best.y - 1; yy <= best.y + 1; yy++)
      for (let xx = best.x - 1; xx <= best.x + 1; xx++) {
        g.ground(xx, yy, sand)
        g.setUse(xx, yy, U.body)
        g.behavior(xx, yy, 'block')
      }
    if (g.inside(best.x, best.y - 1)) g.object(r.chance(0.5) ? 'okinawa/palm' : 'okinawa/tree', best.x, best.y - (r.chance(0.5) ? 2 : 1), U.body)
    target = { x: best.x - 1, y: best.y - 1, w: 3, h: 3 }
  } else if (kind === 'bridge') {
    // 海上的橋：從岸邊往海裡一直到地圖邊（要坐車、走橋才到的地方不畫）
    let x = coast.x + toSea[0]
    let y = coast.y + toSea[1]
    let n = 0
    // 一直畫到地圖邊（橋不在海中間斷掉）；地圖邊兩格照樣是 edge，最後一輪會擋起來（走到那裡就停）
    const band = (px: number, py: number) => px < 2 || py < 2 || px >= g.w - 2 || py >= g.h - 2
    while (g.inside(x, y) && n < 40 && (band(x, y) ? (g.useAt(x, y) === U.edge || g.useAt(x, y) === U.sea) && isSeaTile(g.groundName(x, y)) : g.useAt(x, y) === U.sea)) {
      g.ground(x, y, toSea[0] !== 0 ? 'okinawa/bridge-h' : 'okinawa/bridge-v')
      g.setUse(x, y, band(x, y) ? U.edge : U.keep)
      x += toSea[0]
      y += toSea[1]
      n++
    }
    if (!n) return null
    // 拍照的範圍：靠岸的那一段（畫面裡放得下）
    const len = Math.min(n, toSea[0] === 0 ? TARGET_MAX_H - 1 : TARGET_MAX_W - 1)
    const ex = coast.x + toSea[0] * len
    const ey = coast.y + toSea[1] * len
    target = { x: Math.min(coast.x, ex) - (toSea[0] === 0 ? 1 : 0), y: Math.min(coast.y, ey) - (toSea[1] === 0 ? 1 : 0), w: Math.abs(ex - coast.x) + (toSea[0] === 0 ? 3 : 1), h: Math.abs(ey - coast.y) + (toSea[1] === 0 ? 3 : 1) }
  }
  for (const p of [photo, sign]) {
    if (kind !== 'beach') g.ground(p.x, p.y, roles.path)
    g.setUse(p.x, p.y, U.keep)
  }
  g.layer('lower', photo.x, photo.y, 'basic/photo')
  g.layer('lower', sign.x, sign.y, roles.sign)
  g.setUse(front.x, front.y, U.keep)
  return { id: `lm:${spot.id}`, kind, x: target.x, y: target.y, w: target.w, h: target.h, front, photo, sign, npc: [], doors: [], target, spot, objects: [] }
}

// ---------- 路 ----------
function layRoads(g: Grid, placed: Placed[], station: Placed | null, r: Rng, roles: KitRoles, tile: string, urban: boolean, trimEdges = false) {
  const nodes = placed.map((p) => p.front)
  if (!nodes.length) return
  const root = station ? placed.indexOf(station) : 0
  // Prim：曼哈頓距離的最小生成樹
  const n = nodes.length
  const inTree = new Array<boolean>(n).fill(false)
  const dist = new Array<number>(n).fill(Infinity)
  const parent = new Array<number>(n).fill(-1)
  const md = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  dist[root] = 0
  const edges: Array<[number, number]> = []
  for (let k = 0; k < n; k++) {
    let u = -1
    for (let i = 0; i < n; i++) if (!inTree[i] && (u < 0 || dist[i]! < dist[u]!)) u = i
    if (u < 0 || !Number.isFinite(dist[u]!)) break
    inTree[u] = true
    if (parent[u]! >= 0) edges.push([parent[u]!, u])
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue
      const d = md(nodes[u]!, nodes[v]!)
      if (d < dist[v]!) {
        dist[v] = d
        parent[v] = u
      }
    }
  }
  // 環線：樹上繞很遠、直線很近的兩點再連一條（最多 2 條）
  const adj = new Map<number, number[]>()
  for (const [a, b] of edges) {
    adj.set(a, [...(adj.get(a) ?? []), b])
    adj.set(b, [...(adj.get(b) ?? []), a])
  }
  const treeDist = (a: number, b: number) => {
    const seen = new Map<number, number>([[a, 0]])
    const q = [a]
    while (q.length) {
      const u = q.shift()!
      if (u === b) return seen.get(u)!
      for (const v of adj.get(u) ?? []) if (!seen.has(v)) seen.set(v, seen.get(u)! + md(nodes[u]!, nodes[v]!)), q.push(v)
    }
    return Infinity
  }
  const loops: Array<{ a: number; b: number; ratio: number }> = []
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++) {
      const d = md(nodes[a]!, nodes[b]!)
      if (d > 26 || d < 4) continue
      const ratio = treeDist(a, b) / d
      if (ratio > 2.2) loops.push({ a, b, ratio })
    }
  loops.sort((x, y) => y.ratio - x.ratio || x.a - y.a || x.b - y.b)
  for (const l of loops.slice(0, 2)) edges.push([l.a, l.b])

  const seed = r.int(0, 1 << 30)
  // 空地的代價（郊外加一點雜訊，路會彎）：先算好
  const freeCost = new Float32Array(g.w * g.h)
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) freeCost[y * g.w + x] = urban ? 3 : 2 + noise(x, y, seed, 4) * 3
  const cost = (x: number, y: number) => {
    const i = y * g.w + x
    const u = g.use[i]
    if (u === U.road) return 1
    if (u === U.free) return freeCost[i]!
    if (u === U.water) return 14
    return Infinity
  }
  for (const [a, b] of edges) {
    const path = roadPath(g, nodes[a]!, nodes[b]!, cost, urban ? 8 : 2)
    if (!path) continue
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!
      const u = g.useAt(p.x, p.y)
      const prev = path[i - 1] ?? path[i + 1] ?? p
      const horiz = prev.y === p.y
      if (u === U.water) {
        g.ground(p.x, p.y, horiz ? roles.bridgeH : roles.bridgeV)
        g.setUse(p.x, p.y, U.road)
      } else if (u === U.free || u === U.road) {
        if (u === U.free) g.ground(p.x, p.y, tile)
        g.setUse(p.x, p.y, U.road)
        // 街上：2 格寬（水平的路往下多一格、垂直的往右多一格）
        if (urban) {
          const wx = horiz ? p.x : p.x + 1
          const wy = horiz ? p.y + 1 : p.y
          if (g.useAt(wx, wy) === U.free) {
            g.ground(wx, wy, tile)
            g.setUse(wx, wy, U.road)
          }
        }
      }
    }
  }
  // 街上：棋盤狀的小路（不貼著已經有的路），接不上的接一小段，還是接不上就拿掉
  if (urban && station) {
    gridStreets(g, station.front, tile)
    if (trimEdges) trimEdgeTails(g, roles)
    pruneRoads(g, nodes[root]!, roles, tile)
  }
}

/**
 * 棋盤的小路通到地圖邊、中間沒有路口的那一段（P3）：從邊往裡收到最後一個路口（上下或左右有路的那一格）。
 * 1 格寬、兩旁都是房子、走到樹的盡頭的死巷，看起來像出城的路（京都、沖繩照舊）。
 */
function trimEdgeTails(g: Grid, roles: KitRoles) {
  const road = (x: number, y: number) => g.useAt(x, y) === U.road
  const clear = (x: number, y: number) => {
    g.setUse(x, y, U.free)
    g.ground(x, y, roles.grass)
  }
  for (let y = 2; y < g.h - 2; y++) {
    for (let x = 2; x < g.w - 2 && road(x, y) && !road(x, y - 1) && !road(x, y + 1); x++) clear(x, y)
    for (let x = g.w - 3; x >= 2 && road(x, y) && !road(x, y - 1) && !road(x, y + 1); x--) clear(x, y)
  }
  for (let x = 2; x < g.w - 2; x++) {
    for (let y = 2; y < g.h - 2 && road(x, y) && !road(x - 1, y) && !road(x + 1, y); y++) clear(x, y)
    for (let y = g.h - 3; y >= 2 && road(x, y) && !road(x - 1, y) && !road(x + 1, y); y--) clear(x, y)
  }
}

/** 棋盤狀的小路（1 格寬：橫的每 5 列、直的每 13 行）：只鋪在空地上，太短的不鋪 */
function gridStreets(g: Grid, at: Pt, tile: string) {
  const py = (((at.y + 1) % 5) + 5) % 5
  const px = (((at.x + 6) % 13) + 13) % 13
  const lay = (cells: Pt[]) => {
    for (const c of cells) {
      g.ground(c.x, c.y, tile)
      g.setUse(c.x, c.y, U.road)
    }
  }
  const run = (cells: Pt[], min: number, side: [number, number]) => {
    let cur: Pt[] = []
    for (const c of [...cells, null]) {
      // 兩旁已經是路的格子不鋪（不要變成三格寬）
      const beside = c && (g.useAt(c.x + side[0], c.y + side[1]) === U.road || g.useAt(c.x - side[0], c.y - side[1]) === U.road)
      const ok = c && ((g.free(c.x, c.y) && !beside) || g.useAt(c.x, c.y) === U.road)
      if (ok) cur.push(c!)
      else {
        if (cur.length >= min && cur.some((p) => g.free(p.x, p.y))) lay(cur)
        cur = []
      }
    }
  }
  for (let y = 2; y < g.h - 2; y++) if ((y - py) % 5 === 0) run(Array.from({ length: g.w - 4 }, (_, i) => ({ x: i + 2, y })), 5, [0, 1])
  for (let x = 2; x < g.w - 2; x++) if ((x - px) % 13 === 0) run(Array.from({ length: g.h - 4 }, (_, i) => ({ x, y: i + 2 })), 4, [1, 0])
}

/** 跟車站接不起來的小路：一塊一塊看，往外 8 格內找得到接得上的路就鋪過去，找不到就拿掉 */
function pruneRoads(g: Grid, from: Pt, roles: KitRoles, tile: string) {
  const W = g.w
  const N = W * g.h
  const isRoad = (j: number) => g.use[j] === U.road || g.use[j] === U.keep
  const seen = new Uint8Array(N)
  const spread = (start: number[], mark: Uint8Array, ok: (j: number) => boolean) => {
    const q = [...start]
    for (const i of q) mark[i] = 1
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi]!
      const x = i % W
      const y = (i - x) / W
      for (const [dx, dy] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        if (!g.inside(nx, ny)) continue
        const j = ny * W + nx
        if (mark[j] || !ok(j)) continue
        mark[j] = 1
        q.push(j)
      }
    }
    return q
  }
  spread([from.y * W + from.x], seen, isRoad)
  const done = new Uint8Array(N)
  for (let i = 0; i < N; i++) {
    if (g.use[i] !== U.road || seen[i] || done[i]) continue
    const comp = spread([i], done, (j) => g.use[j] === U.road && !seen[j])
    // 從這一塊往外（只走空地），8 步內碰到接得上的路
    const prev = new Map<number, number>()
    for (const c of comp) prev.set(c, -1)
    let frontier = comp
    let hit = -1
    for (let step = 0; step < 8 && hit < 0 && frontier.length; step++) {
      const next: number[] = []
      for (const c of frontier) {
        const x = c % W
        const y = (c - x) / W
        for (const [dx, dy] of DIRS) {
          const nx = x + dx
          const ny = y + dy
          if (!g.inside(nx, ny)) continue
          const j = ny * W + nx
          if (prev.has(j)) continue
          if (seen[j] && isRoad(j)) {
            prev.set(j, c)
            hit = j
            break
          }
          if (g.use[j] !== U.free) continue
          prev.set(j, c)
          next.push(j)
        }
        if (hit >= 0) break
      }
      frontier = next
    }
    if (hit < 0) {
      for (const c of comp) {
        g.use[c] = U.free
        g.map.ground[c] = tid(roles.grass)
      }
      continue
    }
    for (let c = prev.get(hit)!; c >= 0 && g.use[c] === U.free; c = prev.get(c)!) {
      g.use[c] = U.road
      g.map.ground[c] = tid(tile)
    }
    spread(comp, seen, isRoad)
  }
}

// ---------- 填空 ----------
function fillTown(g: Grid, r: Rng, roles: KitRoles, urban: boolean, kit: Kit, gen: number, o: { flowers: boolean } = { flowers: false }) {
  const W = g.w
  const H = g.h
  const seed = seedOf('fill', W, H, gen, r.int(0, 1 << 30))
  const free = (x: number, y: number) => g.useAt(x, y) === U.free
  const okFree = (u: number) => u === U.free
  const p3 = kit === 'kanto' || kit === 'hokkaido'
  // 關東、北海道的街上：路口的斑馬線（先換地面，房子之前）
  if (p3 && urban) crosswalks(g, roles, kit)
  // a. 路邊成排的房子：水平的路的北邊（門朝路）；放不下 4 列高的就放 3 列高的
  const houses = urban ? roles.urbanHouses : roles.ruralHouses
  for (let y = 3; y < H - 2; y++)
    for (let x = 2; x < W - 2; x++) {
      if (g.useAt(x, y) !== U.road || g.useAt(x, y - 1) !== U.free) continue
      if (!r.chance(urban ? 0.95 : 0.5)) continue
      const first = pickW(r, houses)
      let done: { name: string; hx: number; hy: number; w: number } | null = null
      for (const name of [first, r.pick(roles.smallHouses)]) {
        const info = objectInfo(name)!
        const hx = x
        const hy = y - info.h
        if (!g.rectOk(hx, hy, info.w, info.h, okFree)) continue
        // 房子的下緣要整排貼著路（不懸空）
        let along = 0
        for (let k = 0; k < info.w; k++) if (g.useAt(hx + k, y) === U.road) along++
        if (along < Math.ceil(info.w / 2)) continue
        done = { name, hx, hy, w: info.w }
        break
      }
      if (!done) continue
      const { name, hx, hy } = done
      const info = objectInfo(name)!
      g.object(name, hx, hy, U.house, { doors: false })
      if (!urban && r.chance(0.4)) {
        // 郊外：房子旁邊的灌木、圍籬
        const bx = hx + info.w
        if (free(bx, y - 1)) g.layer('lower', bx, y - 1, pickW(r, roles.bushes)), g.setUse(bx, y - 1, U.fill)
      }
    }
  // b. 街上：路的南邊也排房子（背對路）
  if (urban)
    for (let y = 3; y < H - 6; y++)
      for (let x = 2; x < W - 6; x++) {
        if (g.useAt(x, y) !== U.road || g.useAt(x, y + 1) !== U.free || g.useAt(x - 1, y) !== U.road) continue
        if (!r.chance(0.5)) continue
        const name = pickW(r, houses)
        const info = objectInfo(name)!
        if (!g.rectOk(x, y + 1, info.w, info.h, okFree) || !g.rectOk(x, y + 1 + info.h, info.w, 1, okFree)) continue
        g.object(name, x, y + 1, U.house, { doors: false })
      }
  // b2. 街上的空地：放得下 3×3 就放土藏、小房子（旁邊要有路）
  if (urban)
    for (let y = 3; y < H - 5; y++)
      for (let x = 2; x < W - 5; x++) {
        if (!free(x, y)) continue
        const name = r.pick(roles.smallHouses)
        const info = objectInfo(name)!
        if (!g.rectOk(x, y, info.w, info.h, okFree)) continue
        let touch = false
        for (let k = -1; k <= info.w && !touch; k++) touch = g.useAt(x + k, y + info.h) === U.road
        for (let k = 0; k < info.h && !touch; k++) touch = g.useAt(x - 1, y + k) === U.road || g.useAt(x + info.w, y + k) === U.road
        if (touch && r.chance(0.8)) g.object(name, x, y, U.house, { doors: false })
      }
  // b3. 郊外：直的路兩旁也零星有民家（側面貼路、前面留一列空地）
  if (!urban) {
    let extra = 0
    for (let y = 3; y < H - 6 && extra < 8; y++)
      for (let x = 2; x < W - 6 && extra < 8; x++) {
        if (!free(x, y)) continue
        const name = pickW(r, houses)
        const info = objectInfo(name)!
        if (!g.rectOk(x, y, info.w, info.h + 1, okFree)) continue
        let side = 0
        for (let k = 0; k < info.h; k++) side += Number(g.useAt(x - 1, y + k) === U.road) + Number(g.useAt(x + info.w, y + k) === U.road)
        if (side < 2 || !r.chance(0.35)) continue
        g.object(name, x, y, U.house, { doors: false })
        extra++
      }
  }
  // c. 田（郊外）：大塊的空地。北海道的田大一點、多一點，一塊一種作物（麥、馬鈴薯；有花田的鎮是薰衣草與花田）
  const big = kit === 'hokkaido'
  if (!urban)
    for (let y = 3; y < H - 5; y++)
      for (let x = 3; x < W - 6; x++) {
        if (!free(x, y) || noise(x, y, seed + 3, 9) < (big ? 0.47 : 0.55)) continue
        let w = 0
        while (w < (big ? 12 : 9) && free(x + w, y) && free(x + w, y - 1)) w++
        if (w < 4) continue
        let h = 0
        while (h < (big ? 6 : 5) && g.rectOk(x, y + h, w, 1, okFree) && g.rectOk(x, y + h + 1, w, 1, (u) => u === U.free || u === U.road)) h++
        if (h < 3) continue
        const crop = big ? cropOf(x, y, seed, o.flowers) : roles.field
        for (let yy = y; yy < y + h; yy++)
          for (let xx = x; xx < x + w; xx++) {
            g.ground(xx, yy, crop)
            g.setUse(xx, yy, U.fill)
          }
      }
  // c2. 關東、北海道：電線桿、紅綠燈、自動販賣機、矢羽根、牧場…（近畿、沖繩沒有這一步）
  if (p3) furnish(g, r, roles, kit, urban, seed)
  // d. 地圖邊一圈：樹（海、通到地圖外的橋不動）；1×2 的樹由上往下兩格兩格疊
  const edgeTrees = roles.edgeTrees
  const edgeFree = (x: number, y: number) => g.useAt(x, y) === U.edge && !g.owner[g.i(x, y)] && !isSeaTile(g.groundName(x, y)) && !/bridge/.test(g.groundName(x, y) ?? '')
  for (let y = 0; y < H - 1; y++)
    for (let x = 0; x < W; x++) {
      if (!edgeFree(x, y) || !edgeFree(x, y + 1)) continue
      g.object(edgeTrees[hash2(x, y, seed) % edgeTrees.length]!, x, y, U.edge)
      // 邊上的樹冠也擋住（樹排是實心的，不會鑽進樹裡）
      g.behavior(x, y, 'block')
    }
  // 放不下樹的邊（沙灘、零碎的格子）也擋住；海本來就走不過去
  const edgeView = new MapView(g.map)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (g.useAt(x, y) === U.edge && passable(edgeView.beh(x, y))) g.behavior(x, y, 'block')
  // e. 樹林、零散的樹、灌木
  const trees = roles.trees
  for (let y = 2; y < H - 3; y++)
    for (let x = 2; x < W - 3; x++) {
      if (!free(x, y)) continue
      const n = noise(x, y, seed + 11, 6)
      const dense = n > (urban ? 0.8 : 0.62)
      const p = dense ? 0.55 : urban ? 0.1 : 0.09
      if (!r.chance(p)) {
        if (!urban && r.chance(0.03)) {
          g.layer('lower', x, y, pickW(r, roles.bushes))
          g.setUse(x, y, U.fill)
        }
        continue
      }
      // 樹林裡：近畿多竹與杉，沖繩多フクギ，關東是公園的闊葉樹，北海道是蝦夷松與白樺
      const name = dense ? denseTree(kit, n, r) : pickW(r, trees)
      if (fits(g, name, x, y, (u) => u === U.free)) g.object(name, x, y, U.fill)
    }
  // f. 關東的街上：路邊、大樓旁剩下的空地鋪成鋪石（草地只留在比較裡面的地方，像小公園）
  if (kit === 'kanto' && urban)
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        if (!free(x, y) || g.map.ground[g.i(x, y)] !== tid(roles.grass)) continue
        const touch = DIRS.some(([dx, dy]) => {
          const u = g.useAt(x + dx, y + dy)
          return u === U.road || u === U.house
        })
        if (touch) g.ground(x, y, roles.path)
      }
}

const isSeaTile = (name?: string) => !!name && /okinawa\/(shallow|sea|deep|reef)/.test(name)

/** 地面換成別的 tile（整張地圖） */
function swapGround(g: Grid, from: string, to: string) {
  const a = tid(from)
  const b = tid(to)
  for (let i = 0; i < g.map.ground.length; i++) if (g.map.ground[i] === a) g.map.ground[i] = b
}

/** 樹林裡的樹（近畿、沖繩的抽法跟 P2 一樣：亂數用法不變） */
function denseTree(kit: Kit, n: number, r: Rng): string {
  if (kit === 'kinki') return n > 0.75 ? 'kinki/bamboo' : r.pick(['kinki/sugi', 'kinki/tree', 'kinki/kaede'])
  if (kit === 'kanto') return r.pick(['kanto/tree', 'kanto/keyaki', 'kanto/tree'])
  if (kit === 'hokkaido') return n > 0.74 ? 'hokkaido/ezomatsu' : r.pick(['hokkaido/shirakaba', 'hokkaido/ezomatsu', 'hokkaido/tree'])
  return r.pick(['okinawa/fukugi', 'okinawa/tree', 'okinawa/fukugi'])
}

/** 北海道的田一塊一種作物：麥、馬鈴薯；有花田（ファーム、ラベンダー…）的鎮多是薰衣草與花田 */
function cropOf(x: number, y: number, seed: number, flowers: boolean): string {
  const list = flowers
    ? ['hokkaido/lavender', 'hokkaido/lavender', 'hokkaido/flowers-a', 'hokkaido/flowers-b', 'hokkaido/flowers-d', 'hokkaido/potato']
    : ['hokkaido/wheat', 'hokkaido/potato', 'hokkaido/wheat', 'hokkaido/potato', 'hokkaido/wheat']
  return list[hash2(x, y, seed + 17) % list.length]!
}

// ---------- P3：關東、北海道的街景 ----------
/**
 * 路口的斑馬線：橫的路與直的路交叉的格子（兩個方向的路都連 3 格以上）是路口，
 * 路口往四個方向的下一格（還在路上、不是路口）畫斑馬線。只換街上的路（roles.street）。
 */
function crosswalks(g: Grid, roles: KitRoles, kit: Kit) {
  const W = g.w
  const H = g.h
  const isRoad = (x: number, y: number) => g.inside(x, y) && g.useAt(x, y) === U.road && g.groundName(x, y) === roles.street
  const hRun = new Uint8Array(W * H)
  const vRun = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      if (!isRoad(x, y)) {
        x++
        continue
      }
      let e = x
      while (e < W && isRoad(e, y)) e++
      for (let k = x; k < e; k++) hRun[y * W + k] = Math.min(255, e - x)
      x = e
    }
  }
  for (let x = 0; x < W; x++) {
    let y = 0
    while (y < H) {
      if (!isRoad(x, y)) {
        y++
        continue
      }
      let e = y
      while (e < H && isRoad(x, e)) e++
      for (let k = y; k < e; k++) vRun[k * W + x] = Math.min(255, e - y)
      y = e
    }
  }
  const cross = (x: number, y: number) => g.inside(x, y) && hRun[y * W + x]! >= 3 && vRun[y * W + x]! >= 3
  const marks: Array<[number, number, string]> = []
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cross(x, y)) continue
      for (const [dx, dy] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        if (!isRoad(nx, ny) || cross(nx, ny)) continue
        marks.push([nx, ny, `${kit}/zebra-${dy ? 'v' : 'h'}`])
      }
    }
  for (const [x, y, name] of marks) g.ground(x, y, name)
}

/**
 * 街上的小東西與郊外的田園：
 *  - 街上：斑馬線旁的紅綠燈（北海道是直的燈箱）、路邊的電線桿、大樓旁的自動販賣機、腳踏車、郵筒；
 *  - 郊外：路邊的電線桿；北海道再加矢羽根（路邊紅白的箭頭）、牧場（柵欄圍起來、裡面有捲好的牧草）、牧舍旁的筒倉。
 * 都放在空地（之後鑿路時可以拆）。
 */
function furnish(g: Grid, r: Rng, roles: KitRoles, kit: Kit, urban: boolean, seed: number) {
  const W = g.w
  const H = g.h
  const free = (x: number, y: number) => g.useAt(x, y) === U.free
  const nearRoad = (x: number, y: number) => DIRS.some(([dx, dy]) => g.useAt(x + dx, y + dy) === U.road)
  const placed: Pt[] = []
  const apart = (x: number, y: number, d: number) => !placed.some((p) => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < d)
  const put = (name: string, x: number, y: number) => {
    // 1×2 的物件：(x, y) 是下面那一格（貼著路）
    if (!free(x, y) || !free(x, y - 1)) return false
    g.object(name, x, y - 1, U.fill)
    placed.push({ x, y })
    return true
  }
  const zebra = (x: number, y: number) => /\/zebra-/.test(g.groundName(x, y) ?? '')
  // 紅綠燈：斑馬線旁邊的空地
  if (urban) {
    let n = 0
    for (let y = 3; y < H - 2 && n < 8; y++)
      for (let x = 2; x < W - 2 && n < 8; x++) {
        if (!free(x, y) || !DIRS.some(([dx, dy]) => zebra(x + dx, y + dy)) || !apart(x, y, 5)) continue
        if (put(`${kit}/signal`, x, y)) n++
      }
  }
  // 電線桿：路邊，隔 7 格以上
  {
    let n = 0
    const max = urban ? 10 : 12
    for (let y = 3; y < H - 2 && n < max; y++)
      for (let x = 2; x < W - 2 && n < max; x++) {
        if (!free(x, y) || !nearRoad(x, y) || !apart(x, y, 7) || hash2(x, y, seed + 23) % 5) continue
        if (put(`${kit}/pole`, x, y)) n++
      }
  }
  if (urban) {
    // 自動販賣機、腳踏車、郵筒：路邊、旁邊是大樓的空地（一格的東西）
    const small: Array<[string, number]> = kit === 'kanto' ? [['kanto/vending-a', 4], ['kanto/vending-b', 3], ['kanto/bicycle', 3], ['kanto/postbox', 1]] : [['kanto/vending-a', 3], ['kanto/vending-b', 2], ['kanto/postbox', 1]]
    let n = 0
    for (let y = 3; y < H - 2 && n < 9; y++)
      for (let x = 2; x < W - 2 && n < 9; x++) {
        if (!free(x, y) || !nearRoad(x, y) || !(g.useAt(x - 1, y) === U.house || g.useAt(x + 1, y) === U.house) || !apart(x, y, 4)) continue
        if (!r.chance(0.45)) continue
        g.layer('lower', x, y, pickW(r, small))
        g.setUse(x, y, U.fill)
        placed.push({ x, y })
        n++
      }
    return
  }
  if (kit !== 'hokkaido') return
  // 矢羽根：郊外的路邊，隔 6 格以上
  {
    let n = 0
    for (let y = 3; y < H - 2 && n < 12; y++)
      for (let x = 2; x < W - 2 && n < 12; x++) {
        if (!free(x, y) || !nearRoad(x, y) || !apart(x, y, 6) || hash2(x, y, seed + 29) % 3) continue
        if (put('hokkaido/yabane', x, y)) n++
      }
  }
  // 筒倉：牧舍的旁邊
  for (const o of g.objects) {
    if (o?.name !== 'hokkaido/barn') continue
    for (const sx of [o.x + o.w, o.x - 2]) {
      if (g.rectOk(sx, o.y, 2, 4, (u) => u === U.free)) {
        g.object('hokkaido/silo', sx, o.y, U.fill)
        break
      }
    }
  }
  // 牧場：柵欄圍起來的草地、裡面一兩捆牧草（最多 2 塊）
  let pastures = 0
  for (let y = 4; y < H - 8 && pastures < 2; y++)
    for (let x = 3; x < W - 10 && pastures < 2; x++) {
      if (noise(x, y, seed + 41, 7) < 0.6) continue
      const w = 6 + (hash2(x, y, seed) % 4)
      const h = 4 + (hash2(y, x, seed) % 2)
      if (!g.rectOk(x - 1, y - 1, w + 2, h + 2, (u) => u === U.free)) continue
      for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          const edge = yy === y || yy === y + h - 1 || xx === x || xx === x + w - 1
          if (edge) g.layer('lower', xx, yy, roles.fence)
          g.setUse(xx, yy, U.fill)
        }
      // 柵欄的入口（下緣中間空一格）
      g.layer('lower', x + Math.floor(w / 2), y + h - 1, 0)
      for (let k = 0; k < 2; k++) {
        const bx = x + 2 + k * 2 + (hash2(x, k, seed) % 2)
        const by = y + 1 + (hash2(k, y, seed) % Math.max(1, h - 2))
        if (bx < x + w - 1 && by < y + h - 1) g.layer('lower', bx, by, 'hokkaido/haybale')
      }
      pastures++
    }
}

/**
 * 高架鐵道（關東的街上、有鐵路的車站）：車站北邊 2–7 列裡挑擋到最少東西的一列，整排是橋面（上層，人從下面走過去），
 * 下一列每 5 格一根橋墩（空地上才放）、路與空地上是橋的影子。上層已經有東西（屋頂、樹冠）的格子不蓋（斷開）。
 */
function viaduct(g: Grid, y: number) {
  const W = g.w
  const blocked = (x: number, yy: number) => {
    const u = g.useAt(x, yy)
    return g.map.over[g.i(x, yy)] !== 0 || u === U.edge || u === U.shop || u === U.body || u === U.keep
  }
  for (let x = 2; x < W - 2; x++) {
    if (blocked(x, y)) continue
    g.layer('over', x, y, 'kanto/viaduct')
    if (g.useAt(x, y) === U.free) g.setUse(x, y, U.fill)
    const u = g.useAt(x, y + 1)
    if (g.map.over[g.i(x, y + 1)] !== 0) continue
    if (u === U.free && x % 5 === 2) {
      g.layer('lower', x, y + 1, 'kanto/viaduct-pillar')
      g.setUse(x, y + 1, U.fill)
    } else if (u === U.free || u === U.road) {
      g.layer('over', x, y + 1, 'kanto/viaduct-shade')
      if (u === U.free) g.setUse(x, y + 1, U.fill)
    }
  }
}

// ---------- 事實 NPC ----------
function factsOf(pref: PrefData, town: Town, world: World, placed: Placed[]): Array<{ fact: FactRef; at?: Pt }> {
  const out: Array<{ fact: FactRef; at?: Pt }> = []
  // 祭典（有位置、有月份的）
  const fest: Festival | undefined = festivalsIn(pref, town).find((f) => f.months?.length)
  if (fest) {
    const src = fest.summary?.source_url ?? fest.sources[0]?.url
    if (src)
      out.push({ fact: { template: 'festival.month', ref: { kind: 'festival', id: fest.id }, params: { name: fest.name.ja, months: fest.months!.join('、') }, source: { label: labelOf(src), url: src } } })
  }
  // 老舖（有創業年的）
  for (const p of placed) {
    const s = p.shinise
    if (!s?.f) continue
    const src = s.w ?? s.u
    out.push({ fact: { template: 'shinise.founded', ref: { kind: 'shinise', id: s.id }, params: { name: s.n, founded: s.f }, source: { label: labelOf(src), url: src } }, at: p.front })
  }
  // 城的蓋章地點
  for (const p of placed) {
    const c = p.spot && pref.castles.find((x) => x.s === p.spot!.id && x.st?.length)
    if (!c) continue
    out.push({ fact: { template: 'castle.stamp', ref: { kind: 'castle', id: c.id }, params: { name: c.n, stamp: c.st![0]!, ...(c.no ? { no: c.no } : {}) }, source: { label: labelOf(c.u), url: c.u } }, at: p.front })
  }
  // 平年的櫻花滿開（沖繩是寒緋櫻）
  const cl = climateOf(pref, town)
  const mankai = cl?.normals.sakura_mankai
  if (cl && mankai && cl.source.url)
    out.push({ fact: { template: 'sakura.normal', ref: { kind: 'season', id: cl.station }, params: { date: dateLabel(mankai), station: cl.station, flower: town.kit === 'okinawa' ? 'kanhi' : 'sakura' }, source: cl.source } })
  // 到最近的另一鎮的距離
  const links = world.links.filter((l) => l.from === town.id && l.to !== town.id).sort((a, b) => a.legs[0]!.km - b.legs[0]!.km || (a.id < b.id ? -1 : 1))
  const l = links[0]
  if (l && l.legs.length === 1) {
    const leg = l.legs[0]!
    const to = world.towns.find((t) => t.id === l.to)
    const rail = leg.kmKind === 'rail'
    out.push({
      fact: {
        template: rail ? 'rail.km' : 'straight.km',
        ref: { kind: 'town', id: l.to },
        params: { to: rail ? l.name : (to?.name.ja ?? l.name), km: leg.km },
        source: rail ? { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' } : { label: '国土数値情報（行政区域データ）', url: 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html' },
      },
    })
  }
  return out
}

function labelOf(url: string): string {
  if (url.includes('wikipedia.org')) return '維基百科'
  if (url.includes('openstreetmap.org')) return 'OpenStreetMap'
  if (url.includes('wikidata.org')) return 'Wikidata'
  if (url.includes('jma.go.jp')) return '気象庁'
  if (url.includes('maff.go.jp')) return '農林水産省'
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

// ---------- 祭典 ----------
/**
 * 祭典的攤子、提燈、人（那個月才套上）。攤子放在車站（或最近的地標）前的路邊空地：不蓋到實體（NPC、告示牌…）、
 * 門前、到站的地方；祭典的人站在攤子前面走得到的格子（套上攤子之後還走得到、不在門前、不跟別人同一格），找不到就不放。
 */
function festivalLayer(g: Grid, pref: PrefData, town: Town, roles: KitRoles, placed: Placed[], station: Placed | null, reserved: ReadonlySet<string>): FestivalLayer {
  const layer: FestivalLayer = { tiles: [], entities: [], festivalNpcs: [] }
  const fests = festivalsIn(pref, town).filter((f) => f.months?.length)
  if (!fests.length) return layer
  // 攤子擺在車站（或最近的地標）前的路邊
  const anchor = station?.front ?? placed[0]?.front
  if (!anchor) return layer
  const info = objectInfo(roles.stall)!
  const taken = new Set(g.map.entities.map((e) => key(e.x, e.y)))
  const nearWarp = (x: number, y: number) => g.map.warps.some((w) => Math.abs(w.x - x) <= 1 && Math.abs(w.y - y) <= 1)
  const clear = (x: number, y: number, w: number, h: number) => {
    for (let yy = y - 1; yy <= y + h; yy++)
      for (let xx = x - 1; xx <= x + w; xx++) {
        const inside = xx >= x && xx < x + w && yy >= y && yy < y + h
        if (inside && (taken.has(key(xx, yy)) || reserved.has(key(xx, yy)))) return false
        if (nearWarp(xx, yy)) return false
      }
    return true
  }
  const slots: Pt[] = []
  for (let rr = 1; rr < 14 && slots.length < 4; rr++)
    for (let dy = -rr; dy <= rr && slots.length < 4; dy++)
      for (let dx = -rr; dx <= rr && slots.length < 4; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== rr) continue
        const x = anchor.x + dx
        const y = anchor.y + dy
        // 攤子的下緣貼著路
        if (!g.rectOk(x, y, info.w, info.h, (u) => u === U.free)) continue
        if (g.useAt(x, y + info.h) !== U.road && g.useAt(x + 1, y + info.h) !== U.road) continue
        if (!clear(x, y, info.w, info.h)) continue
        if (slots.some((s) => Math.abs(s.x - x) < 3 && Math.abs(s.y - y) < 3)) continue
        slots.push({ x, y })
      }
  for (const s of slots) {
    for (let cy = 0; cy < info.h; cy++)
      for (let cx = 0; cx < info.w; cx++) {
        const def = tileDef(tid(`${roles.stall}/${cx},${cy}`))!
        layer.tiles.push({ layer: def.layer, i: g.i(s.x + cx, s.y + cy), id: def.id })
        g.setUse(s.x + cx, s.y + cy, U.keep)
      }
  }
  // 提燈：路上，車站前一排
  const roadCells: Pt[] = []
  for (let y = anchor.y; y < Math.min(g.h - 2, anchor.y + 6); y++) for (let x = anchor.x - 7; x <= anchor.x + 7; x++) if (g.useAt(x, y) === U.road && g.map.over[g.i(x, y)] === 0) roadCells.push({ x, y })
  const row = roadCells.length ? roadCells[0]!.y : null
  if (row !== null) for (const p of roadCells.filter((c) => c.y === row)) layer.tiles.push({ layer: 'over', i: g.i(p.x, p.y), id: tid(roles.string) })
  // 祭典的人：攤子前（套上攤子、提燈之後的地圖上找）
  const fest: GameMap = { ...g.map, lower: g.map.lower.slice(), over: g.map.over.slice() }
  for (const t of layer.tiles) fest[t.layer][t.i] = t.id
  const view = new MapView(fest)
  const used = new Set(taken)
  const ok = (x: number, y: number) => {
    if (!view.inside(x, y) || used.has(key(x, y)) || reserved.has(key(x, y)) || nearWarp(x, y)) return false
    if (!passable(view.beh(x, y))) return false
    let n = 0
    for (const [dx, dy] of DIRS) if (passable(view.beh(x + dx, y + dy))) n++
    return n >= 3
  }
  for (const s of slots.slice(0, 3)) {
    const front = [
      { x: s.x, y: s.y + info.h },
      { x: s.x + 1, y: s.y + info.h },
      { x: s.x, y: s.y + info.h + 1 },
    ]
    let at = front.find((p) => ok(p.x, p.y)) ?? null
    for (let rr = 1; rr <= 3 && !at; rr++)
      for (let dy = -rr; dy <= rr && !at; dy++)
        for (let dx = -rr; dx <= rr && !at; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === rr && ok(s.x + dx, s.y + info.h + dy)) at = { x: s.x + dx, y: s.y + info.h + dy }
    if (!at) continue
    used.add(key(at.x, at.y))
    const seed = seedOf(town.id, 'festival', s.x, s.y)
    const around = [...g.map.entities, ...layer.festivalNpcs.map((n) => ({ id: '', kind: 'npc', x: n.x, y: n.y, data: { look: n.look } }))]
    layer.festivalNpcs.push({ x: at.x, y: at.y, seed, look: lookAround(around, at, seed) })
  }
  // 攤子擺不下（鄉下的鎮，車站前是小徑）：至少一個人站在提燈旁邊，說這個祭典的名字與月份
  if (!layer.festivalNpcs.length) {
    const base = row !== null ? { x: anchor.x, y: row + 1 } : anchor
    let at: Pt | null = ok(base.x, base.y) ? base : null
    for (let rr = 1; rr <= 6 && !at; rr++)
      for (let dy = -rr; dy <= rr && !at; dy++)
        for (let dx = -rr; dx <= rr && !at; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === rr && ok(base.x + dx, base.y + dy)) at = { x: base.x + dx, y: base.y + dy }
    if (at) {
      const seed = seedOf(town.id, 'festival', at.x, at.y)
      layer.festivalNpcs.push({ x: at.x, y: at.y, seed, look: lookAround(g.map.entities, at, seed) })
    }
  }
  return layer
}

// ---------- 可達性 ----------
/** 從起點 flood fill：門、拍攝點、告示牌、NPC 旁邊都要走得到；走不到就拆掉擋路的填空（房子、樹、田）鑿一條路 */
export function ensureReachable(g: Grid, start: Pt, roles: KitRoles): { fixed: number } {
  let fixed = 0
  for (let round = 0; round < 12; round++) {
    const view = new MapView(g.map)
    const reach = flood(view, start)
    const targets = targetsOf(g, view)
    const miss = targets.find((t) => !t.cells.some((c) => reach[c.y * g.w + c.x]))
    if (!miss) return { fixed }
    // BFS：可以穿過填空的東西，找到最近一格走得到的
    const goal = miss.cells[0]!
    const W = g.w
    const prev = new Int32Array(W * g.h).fill(-2)
    const q: number[] = [goal.y * W + goal.x]
    prev[q[0]!] = -1
    let hit = -1
    for (let qi = 0; qi < q.length && hit < 0; qi++) {
      const i = q[qi]!
      const x = i % W
      const y = (i - x) / W
      if (reach[i]) {
        hit = i
        break
      }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        if (!g.inside(nx, ny)) continue
        const j = ny * W + nx
        if (prev[j] !== -2) continue
        const u = g.use[j]!
        const open = passable(view.beh(nx, ny)) || u === U.fill || u === U.house || u === U.free || (u === U.edge && nx > 1 && ny > 1 && nx < W - 2 && ny < g.h - 2)
        if (!open) continue
        prev[j] = i
        q.push(j)
      }
    }
    if (hit < 0) break
    for (let i = prev[hit]!; i >= 0; i = prev[i]!) {
      const x = i % W
      const y = (i - x) / W
      const owner = g.owner[i]!
      const u = g.use[i]!
      if (owner && (u === U.fill || u === U.house)) g.remove(owner, roles.grass)
      if (!passable(new MapView(g.map).beh(x, y))) {
        g.layer('lower', x, y, 0)
        g.layer('over', x, y, 0)
        g.behavior(x, y, null)
        if (g.use[i] !== U.keep) {
          g.ground(x, y, roles.road)
          g.setUse(x, y, U.road)
        }
      }
    }
    fixed++
  }
  return { fixed }
}

/** 走得到的格子（不看 NPC） */
export function flood(view: MapView, start: Pt): Uint8Array {
  const W = view.map.w
  const H = view.map.h
  const seen = new Uint8Array(W * H)
  if (!view.inside(start.x, start.y)) return seen
  const q = [start.y * W + start.x]
  seen[q[0]!] = 1
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi]!
    const x = i % W
    const y = (i - x) / W
    for (const [dx, dy] of DIRS) {
      const nx = x + dx
      const ny = y + dy
      if (!view.inside(nx, ny)) continue
      const j = ny * W + nx
      if (seen[j] || !passable(view.beh(nx, ny))) continue
      seen[j] = 1
      q.push(j)
    }
  }
  return seen
}

/** 要走得到的東西：門（站上去）、拍攝點（站上去）、告示牌與 NPC（旁邊一格） */
export function targetsOf(g: { w: number; h: number; map: GameMap }, view: MapView): Array<{ what: string; cells: Pt[] }> {
  const map = g.map
  const out: Array<{ what: string; cells: Pt[] }> = []
  for (const w of map.warps) out.push({ what: `warp ${w.x},${w.y}`, cells: [{ x: w.x, y: w.y }] })
  for (const e of map.entities) {
    if (e.kind === 'photoSpot') out.push({ what: `photo ${e.id}`, cells: [{ x: e.x, y: e.y }] })
    else {
      const around = DIRS.map(([dx, dy]) => ({ x: e.x + dx, y: e.y + dy })).filter((p) => view.inside(p.x, p.y) && passable(view.beh(p.x, p.y)))
      // 櫃台後面的人：隔著櫃台
      for (const [dx, dy] of DIRS) if (view.beh(e.x + dx, e.y + dy) === B.counter) around.push({ x: e.x + dx * 2, y: e.y + dy * 2 })
      out.push({ what: `${e.kind} ${e.id}`, cells: around.length ? around : [{ x: e.x, y: e.y + 1 }] })
    }
  }
  return out
}
