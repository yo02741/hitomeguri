import { behaviorOf, bigSize, tileDef, tileId } from './tiles'
import { B, type BehaviorName, type BorderTiles, type Dir, type GameMap, type MapEntity, type MapName, type ScriptFn, type TileLayer, type Warp } from './types'

/**
 * 地圖的工具：做一張空地圖、放 tile、放大東西（房子）、用 ASCII 寫地圖；
 * MapView 是載入後的樣子：每格的行為碼（覆寫 > over > lower > ground）、花樣與接邊。
 */

export function emptyMap(o: { id: string; name: MapName; w: number; h: number; outdoor: boolean; border: BorderTiles; ground?: number }): GameMap {
  const n = o.w * o.h
  const ground = new Uint16Array(n)
  if (o.ground) ground.fill(o.ground)
  return {
    id: o.id,
    name: o.name,
    w: o.w,
    h: o.h,
    ground,
    lower: new Uint16Array(n),
    over: new Uint16Array(n),
    beh: new Uint8Array(n),
    border: o.border,
    warps: [],
    entities: [],
    outdoor: o.outdoor,
  }
}

const idOf = (t: string | number) => (typeof t === 'number' ? t : tileId(t))

export function setTile(map: GameMap, layer: TileLayer, x: number, y: number, tile: string | number) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return
  map[layer][y * map.w + x] = idOf(tile)
}

/** 覆寫一格的行為（null = 照 tile） */
export function setBehavior(map: GameMap, x: number, y: number, b: BehaviorName | null) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return
  map.beh[y * map.w + x] = b === null ? 0 : B[b] + 1
}

/** 放一個大東西（bigTiles 註冊的，例：basic/house）：(x, y) 是左上角，每一格寫到它自己的那一層 */
export function placeBig(map: GameMap, name: string, x: number, y: number) {
  const size = bigSize(name)
  if (!size) throw new Error(`game map：${name} 不是大東西`)
  for (let cy = 0; cy < size.h; cy++)
    for (let cx = 0; cx < size.w; cx++) {
      const id = tileId(`${name}/${cx},${cy}`)
      const def = tileDef(id)!
      setTile(map, def.layer, x + cx, y + cy, id)
    }
}

/**
 * ASCII 地圖的一個字：地面、下層、上層的 tile 名字，行為覆寫，大東西，記號（給實體、傳送點找位置）。
 * big 預設這一格是大東西的左上角；bigAt 指定這一格是大東西的哪一格（例：樹寫在樹幹那一格 → [0, 1]）。
 */
export interface CellSpec {
  g?: string
  l?: string
  o?: string
  b?: BehaviorName
  big?: string
  bigAt?: [number, number]
  mark?: string
}

export interface AsciiMapDef {
  id: string
  name: MapName
  outdoor: boolean
  /** 每一列一樣長；前後的空白會拿掉 */
  rows: string[]
  legend: Record<string, CellSpec>
  /** 沒有寫 g 的字用這個地面 */
  ground: string
  border: { ground: string; lower?: string; over?: string }
  bgm?: string
  start?: { x: number; y: number; dir?: Dir }
  scripts?: Record<string, ScriptFn>
}

/** 用 ASCII 寫的地圖（比較好讀）：回傳地圖與每個記號的位置（依出現順序） */
export function asciiMap(def: AsciiMapDef): { map: GameMap; marks: Record<string, Array<{ x: number; y: number }>> } {
  const rows = def.rows.map((r) => r.trim()).filter((r) => r.length)
  const h = rows.length
  const w = Math.max(...rows.map((r) => [...r].length))
  if (rows.some((r) => [...r].length !== w)) throw new Error(`game map ${def.id}：每一列要一樣長`)
  const map = emptyMap({
    id: def.id,
    name: def.name,
    w,
    h,
    outdoor: def.outdoor,
    ground: tileId(def.ground),
    border: {
      ground: tileId(def.border.ground),
      lower: def.border.lower ? tileId(def.border.lower) : undefined,
      over: def.border.over ? tileId(def.border.over) : undefined,
    },
  })
  map.bgm = def.bgm
  map.start = def.start
  map.scripts = def.scripts
  const marks: Record<string, Array<{ x: number; y: number }>> = {}
  const bigs: Array<{ name: string; x: number; y: number }> = []
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = def.legend[ch]
      if (!c) throw new Error(`game map ${def.id}：「${ch}」（${x}, ${y}）沒有在 legend 裡`)
      if (c.g) setTile(map, 'ground', x, y, c.g)
      if (c.l) setTile(map, 'lower', x, y, c.l)
      if (c.o) setTile(map, 'over', x, y, c.o)
      if (c.b) setBehavior(map, x, y, c.b)
      if (c.big) bigs.push({ name: c.big, x: x - (c.bigAt?.[0] ?? 0), y: y - (c.bigAt?.[1] ?? 0) })
      if (c.mark) (marks[c.mark] ??= []).push({ x, y })
    }),
  )
  // 大東西最後放：蓋在 legend 的 lower、over 上面
  for (const b of bigs) placeBig(map, b.name, b.x, b.y)
  return { map, marks }
}

/** 格子的雜湊（挑花樣：同一張地圖每次一樣） */
export const cellHash = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return (h ^ (h >>> 16)) >>> 0
}

const LAYERS: TileLayer[] = ['ground', 'lower', 'over']

/** 載入後的地圖：查行為、傳送點、實體；畫的時候要的花樣與接邊（每層每格一個 byte：花樣 << 4 | 接邊） */
export class MapView {
  readonly map: GameMap
  readonly coll: Uint8Array
  readonly info: Record<TileLayer, Uint8Array>

  constructor(map: GameMap) {
    this.map = map
    const n = map.w * map.h
    this.coll = new Uint8Array(n)
    this.info = { ground: new Uint8Array(n), lower: new Uint8Array(n), over: new Uint8Array(n) }
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) this.refresh(x, y)
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.map.w && y < this.map.h
  }

  /** 行為碼：地圖外面一律擋住 */
  beh(x: number, y: number): number {
    return this.inside(x, y) ? this.coll[y * this.map.w + x]! : B.block
  }

  warpAt(x: number, y: number): Warp | undefined {
    return this.map.warps.find((w) => w.x === x && w.y === y)
  }

  entitiesAt(x: number, y: number): MapEntity[] {
    return this.map.entities.filter((e) => e.x === x && e.y === y)
  }

  /** 改了一格的 tile 之後：重算它與四周（接邊會變） */
  setTile(layer: TileLayer, x: number, y: number, id: number) {
    if (!this.inside(x, y)) return
    this.map[layer][y * this.map.w + x] = id
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (this.inside(x + dx, y + dy)) this.refresh(x + dx, y + dy)
  }

  private refresh(x: number, y: number) {
    const m = this.map
    const i = y * m.w + x
    const o = m.beh[i]!
    if (o) this.coll[i] = o - 1
    else {
      let b = -1
      for (const layer of ['over', 'lower', 'ground'] as const) {
        const id = m[layer][i]!
        if (!id) continue
        b = behaviorOf(id)
        if (b >= 0) break
      }
      // 地面是 0（沒有鋪）也算擋住
      this.coll[i] = b >= 0 ? b : m.ground[i] ? B.walk : B.block
    }
    for (const layer of LAYERS) {
      const id = m[layer][i]!
      const def = tileDef(id)
      if (!def) {
        this.info[layer][i] = 0
        continue
      }
      const variant = def.variants && def.variants > 1 ? cellHash(x, y) % def.variants : 0
      let mask = 0
      if (def.connect) {
        const same = (xx: number, yy: number) => !this.inside(xx, yy) || def.connect!(tileDef(m[layer][yy * m.w + xx]!))
        if (same(x, y - 1)) mask |= 1
        if (same(x + 1, y)) mask |= 2
        if (same(x, y + 1)) mask |= 4
        if (same(x - 1, y)) mask |= 8
      }
      this.info[layer][i] = (variant << 4) | mask
    }
  }
}
