import { asciiMap, type CellSpec } from '../../engine/map'
import type { Dir, GameMap, MapEntity, MapName } from '../../engine/types'
import type { NpcData, ShopData, TravelData } from '../types'

/**
 * 機場的大廳（P4，規格 §13 第 4 點）：不在任何鎮上的室內，一張一間。
 * - 台灣的出發大廳（tw:<城市>）：報到櫃台、出發看板（裡面的牆上）、登機門。台灣這邊只做機場、不做城市：沒有出口。
 * - 日本的機場大廳（air:<IATA>，関西国際空港這種不是哪一鎮的機場）：國際線櫃台（回台灣）、賣店、剪票口（坐電車到鎮上）。
 *   出口就是剪票口，沒有門。
 * 互動（目的地、看板、買東西）由 systems 處理；這裡只放實體（travel 的 data.abroad 寫是哪一種，目的地打開時才算）。
 * tile 都用室內共用的（world/…），不加新的 tile；畫面是示意，不畫資料沒寫的東西（沒有航空公司的標誌、沒有字）。
 */
export interface AbroadHallMap {
  map: GameMap
  /** 飛機到了站的地方 */
  arrive: { x: number; y: number; dir: Dir }
}

const LEGEND: Record<string, CellSpec> = {
  '^': { g: 'world/wall-top' },
  '|': { g: 'world/wall' },
  W: { g: 'world/wall-window' },
  G: { g: 'world/wall-glass' },
  B: { g: 'world/wall-board' },
  X: { g: 'basic/void' },
  '.': {},
  C: { l: 'world/counter-white' },
  K: { l: 'world/counter' },
  g: { l: 'world/goods' },
  p: { l: 'world/plant' },
  h: { l: 'world/seat' },
  t: { l: 'world/ticket' },
  T: { l: 'world/gate' },
  // 牆上的出發看板：走到看板下面（前面那一格是空的）面向它查看
  v: { g: 'world/wall-board', mark: 'board' },
  // 登機門：櫃台後面鋪地毯（往窗外的通道）
  r: { g: 'world/carpet' },
  '4': { g: 'world/carpet', mark: 'gate' },
  '1': { mark: 'counter' },
  '2': { mark: 'counter2' },
  '3': { mark: 'kiosk' },
  // 日本的機場大廳的剪票口（鐵路、巴士的櫃台）
  '5': { mark: 'gate' },
  n: { mark: 'npc' },
}

function build(id: string, name: MapName, rows: string[]) {
  return asciiMap({ id, name, outdoor: false, rows, legend: LEGEND, ground: 'world/tile', border: { ground: 'basic/void' }, bgm: 'interior' })
}

const at = (marks: Record<string, Array<{ x: number; y: number }>>, k: string, i = 0) => marks[k]?.[i]

function ent(id: string, kind: string, p: { x: number; y: number } | undefined, data: object, facing: Dir = 'down'): MapEntity[] {
  return p ? [{ id, kind, x: p.x, y: p.y, facing, data: data as Record<string, unknown> }] : []
}

/** 機場的路人：說機場的閒聊（content/flavour 的 airport） */
function passers(id: string, marks: Record<string, Array<{ x: number; y: number }>>, seed: number, looks: readonly string[]): MapEntity[] {
  return (marks.npc ?? []).map((p, i) => {
    const data: Partial<NpcData> = { role: 'passer', chat: 'airport', look: looks[(seed + i) % looks.length]!, lookSeed: seed + 11 * i, move: 'look' }
    return { id: `${id}:npc:${i}`, kind: 'npc', x: p.x, y: p.y, facing: 'down' as Dir, data: data as Record<string, unknown> }
  })
}

/** 字串的種子（同一個大廳每次一樣） */
function seedOf(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0) % 100000
}

const FOLK = ['folk-a', 'folk-b', 'folk-c', 'folk-d'] as const

// ---------- 台灣的出發大廳 ----------
// 左：報到櫃台（兩個人）；中：裡面的牆上的出發看板（前面留兩格走得到看板下面，兩旁的盆栽擋住櫃台後面）；
// 右：登機門（一個人站的小櫃台，後面是往窗外的地毯）。不用電車的售票機、剪票口（那是日本那一邊的鐵路）
const TW_ROWS = [
  '^^^^^^^^^^^^^^^^', //
  '|GGGG|BvvB|GGGG|',
  '..1..2p..p.rr4r.',
  'CCCCCCp..pppCCpp',
  '................',
  '................',
  '................',
  '.hhhh......hhhh.',
  '...n.......n....',
  'XXXXXXXXXXXXXXXX',
]

/**
 * 台灣的出發大廳：左邊報到櫃台（兩個人）、裡面的牆上的出發看板、右邊登機門。都打開同一個出發看板
 * （出發看板＋想去的地方）。name 是城市（台北；資料的寫法，不寫機場名）。
 */
export function taiwanHall(o: { id: string; city: string }): AbroadHallMap {
  const { map, marks } = build(o.id, { ja: o.city, romaji: '', zh: o.city }, TW_ROWS)
  const seed = seedOf(o.id)
  const board = (look?: string, lookSeed?: number): TravelData => ({ mode: 'plane', fromTown: o.id, dests: [], abroad: { kind: 'board', place: o.id }, ...(look ? { look, lookSeed } : {}) })
  map.entities.push(
    ...ent(`${o.id}:counter`, 'travel', at(marks, 'counter'), board('clerk', seed + 1)),
    ...ent(`${o.id}:counter2`, 'travel', at(marks, 'counter2'), board('clerk', seed + 2)),
    // 看板下面兩格：哪一格都查看得到
    ...ent(`${o.id}:board`, 'travel', at(marks, 'board'), board()),
    ...ent(`${o.id}:board2`, 'travel', at(marks, 'board', 1), board()),
    ...ent(`${o.id}:gate`, 'travel', at(marks, 'gate'), board('clerk', seed + 3)),
    ...passers(o.id, marks, seed, FOLK),
  )
  const arrive = { x: 9, y: 6, dir: 'down' as Dir }
  map.start = { x: 3, y: 4, dir: 'up' }
  return { map, arrive }
}

// ---------- 日本的機場大廳（不是哪一鎮的機場） ----------
const JP_ROWS = [
  '^^^^^^^^^^^^^^^^', //
  '|GGGG|BBBB|GGGG|',
  '..1.....g3g..5..',
  'CCCCCppCCKCCtTTt',
  '................',
  '.hhhh......hhhh.',
  '................',
  '.p....n.......p.',
  '................',
  'XXXXXXXXXXXXXXXX',
]

/**
 * 日本的機場大廳：國際線櫃台（回台灣）、賣店（能刷卡；賣機場所在的縣的東西）、剪票口或巴士的櫃台（坐到鎮上）。
 * gate：剪票口坐什麼（関西、羽田是電車；函館是巴士）。
 */
export function airportHallAbroad(o: { id: string; name: string; pref: string; gate: 'rail' | 'bus' }): AbroadHallMap {
  const { map, marks } = build(o.id, { ja: o.name, romaji: '', zh: o.name }, JP_ROWS)
  const seed = seedOf(o.id)
  const kiosk: ShopData = { shopKind: 'station', name: '売店', items: [], pref: o.pref, look: 'clerk', lookSeed: seed + 2 }
  map.entities.push(
    ...ent(`${o.id}:intl`, 'travel', at(marks, 'counter'), { mode: 'plane', fromTown: o.id, dests: [], abroad: { kind: 'intl', place: o.id }, look: 'clerk', lookSeed: seed + 1 } satisfies TravelData),
    ...ent(`${o.id}:kiosk`, 'shop', at(marks, 'kiosk'), kiosk),
    ...ent(`${o.id}:gate`, 'travel', at(marks, 'gate'), { mode: o.gate, fromTown: o.id, dests: [], abroad: { kind: 'gate', place: o.id }, look: 'clerk', lookSeed: seed + 3 } satisfies TravelData),
    ...passers(o.id, marks, seed, FOLK),
  )
  const arrive = { x: 7, y: 4, dir: 'down' as Dir }
  map.start = { ...arrive }
  return { map, arrive }
}
