import type { Gfx } from '../../services/pixelwalk/gfx'
import type { Px } from '../../services/pixelwalk/palette'

import { MapView } from './map'
import type { Place, PlaceKind } from './places'
import { tileDef } from './tiles'
import { B, type Dir, type GameMap, passable } from './types'

/**
 * 小地圖（P4，像《楓之谷》的小地圖）：一格 tile 一個點，畫這張地圖的簡化樣子——路、建築、水、樹、田、牆，
 * 地標的點、門、自己的位置與面向。顏色只用 --color-px-*（MINI_INK）。
 * 分類只看 tile 的名字（kit/名字/格）與碰撞：站得上去的格子看地面（路、草、沙），站不上去的看最上面那個
 * 不是小東西（長椅、燈、告示牌…）的 tile。資料沒有的東西不畫，地圖上有什麼就簡化什麼。
 *
 *   const mini = buildMinimap(map, placesOf(map))      // 進一張地圖時一次（64×48 約 3000 格）
 *   drawMinimap(g, mini, miniWindow(mini, x, y, 48, 32), { player: { x, y, dir } })
 */
export const MINI_KINDS = ['out', 'green', 'road', 'plaza', 'sand', 'field', 'water', 'deep', 'tree', 'wall', 'building', 'mount', 'rail'] as const
export type MiniKind = (typeof MINI_KINDS)[number]
const K = Object.fromEntries(MINI_KINDS.map((k, i) => [k, i])) as Record<MiniKind, number>

/** 每一類的顏色（像旅遊書的街道圖：路白、廣場與境內米色、草淺綠、樹深綠、建築灰、水藍） */
export const MINI_INK: Record<MiniKind, Px> = {
  out: 'ink',
  green: 'leaf-1',
  road: 'white',
  plaza: 'paper',
  sand: 'sand-1',
  field: 'tatami-1',
  water: 'sea-1',
  deep: 'sea-2',
  tree: 'leaf-3',
  wall: 'stone-3',
  building: 'stone-2',
  mount: 'dirt-2',
  rail: 'ink-2',
}
/** 記號的顏色：地標朱、車站墨、店金；門是小小的金點 */
export const MARK_INK: Record<PlaceKind, Px> = { landmark: 'shu-1', station: 'ink', shop: 'gold-2', door: 'gold-1' }
const DOOR_INK: Px = 'gold-1'

/** tile 的名字 → 類（null：小東西，看下面那一層） */
const FAMILY: Array<[RegExp, MiniKind | null]> = [
  [/^(road|street|sando|stone|path|trail|stepstone|zebra-[hv]|bridge-[hv]|deck|pier|floor|mat|tile|carpet|tatami)$/, 'road'],
  // 站前廣場、鋪石的廣場、寺社的砂利（境內）
  [/^(plaza|paving|gravel)$/, 'plaza'],
  [/^(grass|moss|flowers|tallgrass)$/, 'green'],
  [/^sand$/, 'sand'],
  [/^(field|cane|wheat|potato|lavender|flowers-[a-z])$/, 'field'],
  [/^(water|lake|shallow|reef|falls)$/, 'water'],
  [/^(sea|deep)$/, 'deep'],
  [/^(tree|pine|sakura|kaede|ichou|ume|willow|sugi|bamboo|fukugi|gajumaru|palm|kanhi|shirakaba|ezomatsu|poplar|keyaki|street-tree|bush|hedge|ajisai|hibiscus|bougain|utaki)$/, 'tree'],
  [/^(fence|wall|dobe|ishigaki|coralwall|blockwall|gusuku|railing|hinpun)$/, 'wall'],
  [/^(peak)$/, 'mount'],
  [/^(viaduct|viaduct-pillar)$/, 'rail'],
  [/^void$/, 'out'],
  // 小東西：長椅、燈、號誌、自動販賣機、郵筒、腳踏車、石燈籠、狛犬、シーサー、告示牌、攤子、提燈、拱廊的屋頂、鳥居…
  [
    /^(bench|bench-red|lamp|pole|signal|vending-[ab]|postbox|bicycle|planter|toro|komainu-[lr]|rock|shisa|monument|telescope|umbrella|sign|chochin|arcade|ema|stall|haybale|yabane|busstop|photo|pot|shelf|table|counter|door|ledge-[a-z]+|torii|viaduct-shade|tallgrass-top|info-board|goods|display|plant|seat|zabuton|futon|desk|kitchen|ticket|stamp-table|table-low|tokonoma|stairs|gate|noren-door)$/,
    null,
  ],
]

/** 'hokkaido/kinki-hondo/1,0'、'kinki/sakura@bloom/0,1' → 'hondo'、'sakura' */
export function tileFamily(name: string): string {
  const base = name.replace(/\/\d+,\d+$/, '').replace(/@[a-z]+$/, '')
  const i = base.indexOf('/')
  return (i >= 0 ? base.slice(i + 1) : base).replace(/^kinki-/, '')
}

/** 一個 tile 名字的類；小東西 null；沒列到的、站不上去的大東西當作建築 */
export function kindOfTile(name: string): MiniKind | null {
  const f = tileFamily(name)
  for (const [re, k] of FAMILY) if (re.test(f)) return k
  return 'building'
}

const kindCache = new Map<number, MiniKind | null>()
function kindOfId(id: number): MiniKind | null | undefined {
  if (!id) return undefined
  let k = kindCache.get(id)
  if (k === undefined && !kindCache.has(id)) {
    const name = tileDef(id)?.name
    k = name ? kindOfTile(name) : null
    kindCache.set(id, k)
  }
  return k
}

export interface MiniMark {
  id: string
  kind: PlaceKind
  x: number
  y: number
}

export interface Minimap {
  id: string
  w: number
  h: number
  /** 每格的類（MINI_KINDS 的索引），索引 y×w + x */
  cells: Uint8Array
  /** 門（往室內的傳送點） */
  doors: Array<{ x: number; y: number }>
  /** 地標、車站、店的記號 */
  marks: MiniMark[]
}

/** 一格的類 */
function cellKind(map: GameMap, view: MapView, x: number, y: number): MiniKind {
  const i = y * map.w + x
  const ground = map.ground[i]!
  if (!ground) return 'out'
  const beh = view.coll[i]!
  const gk = kindOfId(ground) ?? 'green'
  if (beh === B.door) return 'building'
  // 高架鐵道：橋面在上層，下面走得過去；地圖上畫成一條鐵道
  if (kindOfId(map.over[i]!) === 'rail') return 'rail'
  if (passable(beh)) {
    // 站得上去：看地面（拍攝點、草叢、門墊這些小東西不算）；橋面在地面
    return gk === 'building' || gk === 'tree' || gk === 'wall' || gk === 'rail' ? 'road' : gk
  }
  for (const id of [map.over[i]!, map.lower[i]!]) {
    const k = kindOfId(id)
    if (k) return k
  }
  if (beh === B.water) return gk === 'deep' ? 'deep' : 'water'
  return gk
}

/** 這張地圖的小地圖（places：地標、車站、店的記號；不給就沒有記號） */
export function buildMinimap(map: GameMap, places: readonly Place[] = [], view: MapView = new MapView(map)): Minimap {
  const cells = new Uint8Array(map.w * map.h)
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) cells[y * map.w + x] = K[cellKind(map, view, x, y)]
  const doors: Minimap['doors'] = []
  const seen = new Set<string>()
  for (const w of map.warps) {
    if (!w.to.startsWith('int:') && !w.to.startsWith('room')) continue
    const key = `${w.x},${w.y}`
    if (seen.has(key)) continue
    seen.add(key)
    doors.push({ x: w.x, y: w.y })
  }
  const marks = places.filter((p) => p.kind !== 'door').map((p) => ({ id: p.id, kind: p.kind, x: p.at.x, y: p.at.y }))
  return { id: map.id, w: map.w, h: map.h, cells, doors, marks }
}

/** 一類有幾格（測試、除錯） */
export function miniCounts(m: Minimap): Record<MiniKind, number> {
  const out = Object.fromEntries(MINI_KINDS.map((k) => [k, 0])) as Record<MiniKind, number>
  for (const c of m.cells) out[MINI_KINDS[c]!]++
  return out
}

export interface MiniWindow {
  x: number
  y: number
  w: number
  h: number
}

/** 看得到的那一塊：最多 vw×vh 格，自己在中間，到地圖邊停（地圖比較小就整張） */
export function miniWindow(m: Pick<Minimap, 'w' | 'h'>, px: number, py: number, vw: number, vh: number): MiniWindow {
  const w = Math.min(m.w, Math.max(1, vw))
  const h = Math.min(m.h, Math.max(1, vh))
  const x = Math.max(0, Math.min(m.w - w, Math.round(px - w / 2)))
  const y = Math.max(0, Math.min(m.h - h, Math.round(py - h / 2)))
  return { x, y, w, h }
}

/** 自己的記號：朝向那一邊的三角形（5×3，朝上下；朝左右 3×5），墨色＋白邊 */
const ARROW: Record<Dir, string[]> = {
  down: ['#####', '.###.', '..#..'],
  up: ['..#..', '.###.', '#####'],
  left: ['..#', '.##', '###', '.##', '..#'],
  right: ['#..', '##.', '###', '##.', '#..'],
}

function drawArrow(g: Gfx, cx: number, cy: number, dir: Dir) {
  const rows = ARROW[dir]
  const h = rows.length
  const w = rows[0]!.length
  const x0 = cx - Math.floor(w / 2)
  const y0 = cy - Math.floor(h / 2)
  const on = (i: number, j: number) => rows[j]?.[i] === '#'
  // 白邊：本體旁邊一圈（不蓋本體）
  for (let j = -1; j <= h; j++)
    for (let i = -1; i <= w; i++) {
      if (on(i, j)) continue
      if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) g.px(x0 + i, y0 + j, 'white')
    }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (on(i, j)) g.px(x0 + i, y0 + j, 'ink')
}

export interface DrawMiniOpts {
  player?: { x: number; y: number; dir: Dir } | null
  /** 強調這一格（手帳的地圖：列表裡選著的那一個地方）：白底、外面一圈墨色 */
  focus?: { x: number; y: number } | null
  /** 不畫門 */
  noDoors?: boolean
}

/** 把 win 那一塊畫在 g 的 (0, 0)（g 的大小通常就是 win.w×win.h） */
export function drawMinimap(g: Gfx, m: Minimap, win: MiniWindow, opts: DrawMiniOpts = {}) {
  g.clear('ink')
  for (let y = 0; y < win.h; y++)
    for (let x = 0; x < win.w; x++) {
      const mx = win.x + x
      const my = win.y + y
      if (mx < 0 || my < 0 || mx >= m.w || my >= m.h) continue
      g.px(x, y, MINI_INK[MINI_KINDS[m.cells[my * m.w + mx]!]!])
    }
  const inWin = (x: number, y: number) => x >= win.x && y >= win.y && x < win.x + win.w && y < win.y + win.h
  if (!opts.noDoors) for (const d of m.doors) if (inWin(d.x, d.y)) g.px(d.x - win.x, d.y - win.y, DOOR_INK)
  const f = opts.focus
  if (f && inWin(f.x, f.y)) {
    const x = f.x - win.x
    const y = f.y - win.y
    g.rect(x - 2, y - 2, 6, 6, 'ink')
    g.rect(x - 1, y - 1, 4, 4, 'white')
  }
  for (const k of m.marks) {
    if (!inWin(k.x, k.y)) continue
    g.rect(k.x - win.x, k.y - win.y, 2, 2, MARK_INK[k.kind])
  }
  if (f && inWin(f.x, f.y) && !m.marks.some((k) => k.x === f.x && k.y === f.y)) g.rect(f.x - win.x, f.y - win.y, 2, 2, DOOR_INK)
  const p = opts.player
  if (p && inWin(p.x, p.y)) drawArrow(g, p.x - win.x, p.y - win.y, p.dir)
}
