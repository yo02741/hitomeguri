import { asciiMap, type CellSpec } from '../../engine/map'
import type { Dir, GameMap, MapEntity, MapName } from '../../engine/types'
import type { InnData, ShopData, SignData, SlotData, StampData, TravelData } from '../types'

/**
 * 室內模板（規格 §8.2、§8.6）：一種一個房間，門進去。最下面一列是出口的門墊（往下走就出去，回到門前）。
 * 車站大廳（剪票口、賣店、站章台）、機場大廳（櫃台、賣店）、授与所（參拜印）、城的蓋章處（名字照資料）、
 * 老舖、茶屋、食堂（櫃台、桌子）、旅館／民宿（櫃台＋上樓進你的房間）、你的房間（room：6×3 的架子、4 個相框、書桌）。
 * 互動（買、蓋章、坐車、住）由 systems 處理：這裡只放實體（kind＋data，規格 §11）。
 * 地圖比畫面小：置中，外面鋪黑（basic/void）。
 */
export interface InteriorOut {
  /** 回到外面：地圖、格子、朝向（門前一格） */
  map: string
  x: number
  y: number
}

export interface Interior {
  map: GameMap
  /** 從門進來站的地方（門墊；一扇門一個） */
  mats: Array<{ x: number; y: number }>
  /** 坐飛機、坐車到的地方（機場大廳） */
  arrive?: { x: number; y: number; dir: Dir }
}

const WALLS: Record<string, CellSpec> = {
  '^': { g: 'world/wall-top' },
  '|': { g: 'world/wall' },
  W: { g: 'world/wall-window' },
  B: { g: 'world/wall-board' },
  S: { g: 'world/wall-shoji' },
  L: { g: 'world/wall-scroll' },
  F: { g: 'world/wall-frame', mark: 'frame' },
  X: { g: 'basic/void' },
  m: { g: 'world/mat', mark: 'mat' },
  '.': {},
  ':': { g: 'world/tatami' },
  n: { mark: 'npc' },
}

function build(o: {
  id: string
  name: MapName
  rows: string[]
  floor: string
  legend: Record<string, CellSpec>
  exits: InteriorOut[]
}): { map: GameMap; marks: Record<string, Array<{ x: number; y: number }>> } {
  const { map, marks } = asciiMap({
    id: o.id,
    name: o.name,
    outdoor: false,
    rows: o.rows,
    legend: { ...WALLS, ...o.legend },
    ground: o.floor,
    border: { ground: 'basic/void' },
    bgm: 'interior',
  })
  const mats = marks.mat ?? []
  mats.forEach((m, i) => {
    const out = o.exits[Math.min(i, o.exits.length - 1)]
    if (out) map.warps.push({ x: m.x, y: m.y, to: out.map, tx: out.x, ty: out.y, dir: 'down', on: 'push', push: 'down' })
  })
  const m0 = mats[Math.floor(mats.length / 2)] ?? { x: 1, y: o.rows.length - 2 }
  map.start = { x: m0.x, y: m0.y - 1, dir: 'up' }
  return { map, marks }
}

const at = (marks: Record<string, Array<{ x: number; y: number }>>, k: string, i = 0) => marks[k]?.[i]

function ent(id: string, kind: string, p: { x: number; y: number } | undefined, data: object, facing: Dir = 'down'): MapEntity[] {
  return p ? [{ id, kind, x: p.x, y: p.y, facing, data: data as Record<string, unknown> }] : []
}

// ---------- 車站大廳 ----------
export function stationHall(o: {
  id: string
  name: MapName
  exits: InteriorOut[]
  travel: TravelData
  stamp: StampData
  kiosk: ShopData | null
  npcLook: string
  npcSeed: number
  /**
   * 名城的章在這個車站（資料的蓋章地點寫在車站裡，例：「福知山観光案内所（JR福知山駅構内）」）：
   * 站章台旁邊多一張印台＋立牌，立牌寫資料的地點名稱（出處是名城的清單）
   */
  castle?: { stamp: StampData; where: string; source_url: string } | null
}): Interior {
  // 剪票機、賣店的櫃台一整排擋住（櫃台後面走不進去，隔著櫃台說話）；路人離起點遠一點
  const rows = [
    '^^^^^^^^^^^^', //
    '|BBBB||WW|||',
    '..2....g3g..',
    'tGGGGGtCCCgg',
    '............',
    o.castle ? '.s.ic.....hh' : '.s........hh',
    '.........n..',
    '............',
    'XXXXXmmXXXXX',
  ].map((r) => (o.kiosk ? r : r.replace('g3g', '...').replace('CCCgg', 'GGGtt')))
  const { map, marks } = build({
    id: o.id,
    name: o.name,
    rows,
    floor: 'world/tile',
    exits: o.exits,
    legend: {
      t: { l: 'world/ticket' },
      G: { l: 'world/gate' },
      C: { l: 'world/counter' },
      g: { l: 'world/goods' },
      s: { l: 'world/stamp-table', mark: 'stamp' },
      c: { l: 'world/stamp-table', mark: 'castle' },
      i: { l: 'world/info-board', mark: 'board' },
      h: { l: 'world/bench' },
      '2': { mark: 'gate' },
      '3': { mark: 'kiosk' },
    },
  })
  const castle = o.castle
  const board: SignData | null = castle ? { title: { ja: castle.where }, source_url: castle.source_url } : null
  map.entities.push(
    ...ent(`${o.id}:travel`, 'travel', at(marks, 'gate'), { ...o.travel, look: 'clerk', lookSeed: o.npcSeed + 1 }),
    ...ent(`${o.id}:stamp`, 'stamp', at(marks, 'stamp'), o.stamp),
    ...(castle ? ent(`${o.id}:castle`, 'stamp', at(marks, 'castle'), castle.stamp) : []),
    ...(board ? ent(`${o.id}:board`, 'sign', at(marks, 'board'), board) : []),
    ...(o.kiosk ? ent(`${o.id}:kiosk`, 'shop', at(marks, 'kiosk'), { ...o.kiosk, look: 'clerk', lookSeed: o.npcSeed + 2 }) : []),
    ...ent(`${o.id}:npc`, 'npc', at(marks, 'npc'), { role: 'passer', look: o.npcLook, lookSeed: o.npcSeed, move: 'look' }),
  )
  return { map, mats: marks.mat ?? [] }
}

// ---------- 機場大廳 ----------
export function airportHall(o: { id: string; name: MapName; exits: InteriorOut[]; travel: TravelData; kiosk: ShopData | null; npcLook: string; npcSeed: number }): Interior {
  const rows = [
    '^^^^^^^^^^^^^^', //
    '|GGGG|BB|GGGG|',
    '...2....g3g...',
    'CCCCCCCCCKCCCC',
    '..............',
    '.hhhh....hhhh.',
    '...........n..',
    '..............',
    'XXXXXmmmXXXXXX',
  ].map((r) => (o.kiosk ? r : r.replace('g3g', '...').replace('K', 'C')))
  const { map, marks } = build({
    id: o.id,
    name: o.name,
    rows,
    floor: 'world/tile',
    exits: o.exits,
    legend: {
      G: { g: 'world/wall-glass' },
      C: { l: 'world/counter-white' },
      K: { l: 'world/counter' },
      g: { l: 'world/goods' },
      h: { l: 'world/seat' },
      '2': { mark: 'counter' },
      '3': { mark: 'kiosk' },
    },
  })
  map.entities.push(
    ...ent(`${o.id}:travel`, 'travel', at(marks, 'counter'), { ...o.travel, look: 'clerk', lookSeed: o.npcSeed + 1 }),
    ...(o.kiosk ? ent(`${o.id}:kiosk`, 'shop', at(marks, 'kiosk'), { ...o.kiosk, look: 'clerk', lookSeed: o.npcSeed + 2 }) : []),
    ...ent(`${o.id}:npc`, 'npc', at(marks, 'npc'), { role: 'passer', look: o.npcLook, lookSeed: o.npcSeed, move: 'look' }),
  )
  return { map, mats: marks.mat ?? [], arrive: { x: 7, y: 4, dir: 'down' } }
}

// ---------- 授与所 ----------
export function juyosho(o: { id: string; name: MapName; exits: InteriorOut[]; stamp: StampData; seed: number }): Interior {
  const { map, marks } = build({
    id: o.id,
    name: o.name,
    rows: [
      '^^^^^^^^', //
      '|SS||SS|',
      '.g.2.g..',
      'gCCCCCgg',
      '........',
      '........',
      'XXXmXXXX',
    ],
    floor: 'world/floor',
    exits: o.exits,
    legend: { g: { l: 'world/goods' }, C: { l: 'world/counter' }, '2': { mark: 'stamp' } },
  })
  map.entities.push(...ent(`${o.id}:stamp`, 'stamp', at(marks, 'stamp'), { ...o.stamp, look: 'clerk', lookSeed: o.seed }))
  return { map, mats: marks.mat ?? [] }
}

// ---------- 城的蓋章處（名字照資料：大休憩所、首里杜館…） ----------
export function castleOffice(o: { id: string; name: MapName; exits: InteriorOut[]; stamp: StampData }): Interior {
  const { map, marks } = build({
    id: o.id,
    name: o.name,
    rows: [
      '^^^^^^^^^^', //
      '||W||||W||',
      '..........',
      '.s....hh..',
      '..........',
      '..........',
      'XXXXmXXXXX',
    ],
    floor: 'world/floor',
    exits: o.exits,
    legend: { s: { l: 'world/stamp-table', mark: 'stamp' }, h: { l: 'world/bench' } },
  })
  map.entities.push(...ent(`${o.id}:stamp`, 'stamp', at(marks, 'stamp'), o.stamp))
  return { map, mats: marks.mat ?? [] }
}

// ---------- 老舖、茶屋、食堂 ----------
export function shopRoom(o: { id: string; name: MapName; exits: InteriorOut[]; shop: ShopData; seed: number }): Interior {
  const kind = o.shop.shopKind
  const rows =
    kind === 'teahouse'
      ? [
          '^^^^^^^^^^', //
          '|SS||SSSS|',
          '.g2g.:::::',
          '.CCC.:z:z:',
          '.....:T:T:',
          '.....:z:z:',
          '..........',
          'XXXXmXXXXX',
        ]
      : kind === 'shokudo'
        ? [
            '^^^^^^^^^^', //
            '|W||||||W|',
            'kk2k......',
            'CCCC..t.t.',
            '..........',
            '......t.t.',
            '..........',
            'XXXXmXXXXX',
          ]
        : [
            '^^^^^^^^^^', //
            '|L||||||L|',
            '.gg.2.gg..',
            '.CCCCCCC..',
            '..........',
            '..........',
            'XXXXmXXXXX',
          ]
  const { map, marks } = build({
    id: o.id,
    name: o.name,
    rows,
    floor: kind === 'shokudo' ? 'world/floor' : 'world/floor',
    exits: o.exits,
    legend: {
      g: { l: 'world/goods' },
      C: { l: 'world/counter' },
      k: { l: 'world/kitchen' },
      t: { l: 'world/table' },
      T: { g: 'world/tatami', l: 'world/table-low' },
      z: { g: 'world/tatami', l: 'world/zabuton' },
      '2': { mark: 'clerk' },
    },
  })
  map.entities.push(...ent(`${o.id}:shop`, 'shop', at(marks, 'clerk'), { ...o.shop, look: 'clerk', lookSeed: o.seed }))
  return { map, mats: marks.mat ?? [] }
}

// ---------- 旅館、民宿 ----------
export function innRoom(o: { id: string; name: MapName; exits: InteriorOut[]; inn: InnData; seed: number }): Interior & { stairs: { x: number; y: number } } {
  const { map, marks } = build({
    id: o.id,
    name: o.name,
    rows: [
      '^^^^^^^^^^^^', //
      '|SS||||U||S|',
      '..2g........',
      'CCCC........',
      '......::::..',
      '.l....:T::..',
      '......::::..',
      'XXXXXmXXXXXX',
    ],
    floor: 'world/floor',
    exits: o.exits,
    legend: {
      C: { l: 'world/counter' },
      U: { g: 'world/wall', l: 'world/stairs', mark: 'stairs' },
      T: { g: 'world/tatami', l: 'world/table-low' },
      l: { l: 'world/lamp' },
      g: { l: 'world/goods' },
      '2': { mark: 'clerk' },
    },
  })
  const stairs = at(marks, 'stairs')!
  // 樓梯：走上去就到你的房間（門墊前一格）
  map.warps.push({ x: stairs.x, y: stairs.y, to: 'room', tx: ROOM_MAT.x, ty: ROOM_MAT.y - 1, dir: 'up', sfx: 'stairs' })
  map.entities.push(...ent(`${o.id}:inn`, 'inn', at(marks, 'clerk'), { ...o.inn, look: 'clerk', lookSeed: o.seed }))
  return { map, mats: marks.mat ?? [], stairs }
}

// ---------- 你的房間（全遊戲一個） ----------
const ROOM_ROWS = [
  '^^^^^^^^^^^^', //
  '|F|F|||F|F||',
  '............',
  '..DDDDDD....',
  '............',
  '..DDDDDD..d.',
  '............',
  '..DDDDDD..f.',
  '............',
  'XXXXXmXXXXXX',
]
export const ROOM_MAT = { x: 5, y: 9 }

/** 你的房間：exit 是上次進來的那間旅館（民宿）的樓梯前 */
export function room(exit: InteriorOut): GameMap {
  const { map, marks } = build({
    id: 'room',
    name: { ja: '部屋', romaji: 'HEYA', zh: '你的房間' },
    rows: ROOM_ROWS,
    floor: 'world/floor',
    exits: [exit],
    legend: { D: { l: 'world/display', mark: 'shelf' }, d: { l: 'world/desk', mark: 'desk' }, f: { l: 'world/futon' } },
  })
  ;(marks.shelf ?? []).forEach((p, i) => {
    const data: SlotData = { index: i, col: i % 6, row: Math.floor(i / 6) }
    map.entities.push({ id: `room:shelf:${i}`, kind: 'shelfSlot', x: p.x, y: p.y, data: data as unknown as Record<string, unknown> })
  })
  ;(marks.frame ?? []).forEach((p, i) => map.entities.push({ id: `room:frame:${i}`, kind: 'frameSlot', x: p.x, y: p.y, data: { index: i } }))
  const desk = at(marks, 'desk')
  if (desk) map.entities.push({ id: 'room:desk', kind: 'desk', x: desk.x, y: desk.y, data: { index: 0 } })
  return map
}
