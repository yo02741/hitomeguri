import { Gfx } from '../../../services/pixelwalk/gfx'
import type { Palette } from '../../../services/pixelwalk/palette'

import { TILE, type BehaviorName, type GameMap, type Season, type TileCtx, type TileDef, type TileLayer } from '../../engine/types'

/**
 * 好幾格的東西（房子、鳥居、山門、樹）：整張畫一次，切成一格一格的 tile。跟引擎的 bigTiles 不同的是
 * 每一格可以「不要」（'.'：鳥居、山門中間走得過去的那一格只留地面），每一格自己決定層與行為。
 *
 * cells 一列一個字串，一個字一格：
 *   O 上層＋擋住（屋頂）   o 上層、可以走到下面（樹冠、鳥居的橫木、山門的通道）
 *   L 下層＋擋住（牆、樹幹）  w 下層、可以走（地上的影子、門檻）  D 下層＋門  C 下層＋櫃台  S 下層＋告示牌
 *   g 地面、可以走  G 地面、擋住  ~ 地面、水  . 沒有
 * bloom：另外做一份開花的（name + '@bloom'，id 接在後面），世界依平年值換上去。
 * 整張圖照（調色盤、季節、動畫格、開花）快取一次，切格時直接複製，測試與第一次畫都快。
 */
export interface ObjectCtx extends TileCtx {
  bloom: boolean
}

export interface ObjectSpec {
  /** 第一格的 id；一份用 w×h 個 id（含 '.'），開花的再接 w×h 個 */
  id: number
  name: string
  w: number
  h: number
  cells: string[]
  frames?: number
  fps?: number
  bloom?: boolean
  draw(g: Gfx, c: ObjectCtx): void
}

export interface ObjectInfo {
  name: string
  w: number
  h: number
  cells: string[]
  /** 開花的那一份的名字（沒有就 undefined） */
  bloom?: string
}

const CODE: Record<string, { layer: TileLayer; behavior?: BehaviorName }> = {
  O: { layer: 'over', behavior: 'block' },
  o: { layer: 'over' },
  L: { layer: 'lower', behavior: 'block' },
  w: { layer: 'lower', behavior: 'walk' },
  D: { layer: 'lower', behavior: 'door' },
  C: { layer: 'lower', behavior: 'counter' },
  S: { layer: 'lower', behavior: 'sign' },
  g: { layer: 'ground', behavior: 'walk' },
  G: { layer: 'ground', behavior: 'block' },
  '~': { layer: 'ground', behavior: 'water' },
}

const infos = new Map<string, ObjectInfo>()
/** 定義（畫法）：別的 kit 可以拿來包一層（北海道冬天的厚雪版） */
const specs = new Map<string, ObjectSpec>()
export const objectSpec = (name: string) => specs.get(name)

/**
 * 開花版的對照（一般版的名字 → 哪種花、開花版的名字）：各 kit import 時登記（registerBloom），生成器用 bloomPairs() 找。
 * 關東、北海道的 kit 是另一檔、到那一縣才讀（P3），生成器不能直接 import 它們的表。
 */
const blooms: Record<string, { flower: string; bloom: string }> = {}
export function registerBloom(table: Record<string, { flower: string; bloom: string }>) {
  Object.assign(blooms, table)
}
export const bloomPairs = (): Readonly<Record<string, { flower: string; bloom: string }>> => blooms
export const objectInfo = (name: string) => infos.get(name)
export const objectNames = () => [...infos.keys()]

/** 整張圖的快取：調色盤（時段）→ 季節｜格｜開花 → 像素 */
type Memo = WeakMap<Palette, Map<string, Uint32Array>>

export function defineObject(o: ObjectSpec): TileDef[] {
  if (o.cells.length !== o.h || o.cells.some((r) => r.length !== o.w)) throw new Error(`world kit：${o.name} 的 cells 跟大小不合`)
  specs.set(o.name, o)
  const memo: Memo = new WeakMap()
  const W = o.w * TILE
  const H = o.h * TILE
  const full = (pal: Palette, c: TileCtx, bloom: boolean): Uint32Array => {
    let m = memo.get(pal)
    if (!m) {
      m = new Map()
      memo.set(pal, m)
    }
    const key = `${c.season}|${c.time}|${c.frame}|${bloom ? 1 : 0}`
    let buf = m.get(key)
    if (!buf) {
      const g = new Gfx(W, H, pal)
      o.draw(g, { ...c, x: 0, y: 0, variant: 0, mask: 0, bloom })
      buf = g.buf
      m.set(key, buf)
    }
    return buf
  }
  const out: TileDef[] = []
  const make = (name: string, base: number, bloom: boolean) => {
    infos.set(name, { name, w: o.w, h: o.h, cells: o.cells, bloom: o.bloom && !bloom ? `${o.name}@bloom` : undefined })
    for (let cy = 0; cy < o.h; cy++)
      for (let cx = 0; cx < o.w; cx++) {
        const code = CODE[o.cells[cy]![cx]!]
        if (!code) continue
        out.push({
          id: base + cy * o.w + cx,
          name: `${name}/${cx},${cy}`,
          layer: code.layer,
          behavior: code.behavior,
          frames: o.frames,
          fps: o.fps,
          draw(g, c) {
            const src = full(g.pal, c, bloom)
            const sx = cx * TILE
            const sy = cy * TILE
            for (let j = 0; j < TILE; j++) {
              const so = (sy + j) * W + sx
              for (let i = 0; i < TILE; i++) {
                const v = src[so + i]!
                if (v) g.buf[(c.y + j + g.oy) * g.w + c.x + i + g.ox] = v
              }
            }
          },
        })
      }
  }
  make(o.name, o.id, false)
  if (o.bloom) make(`${o.name}@bloom`, o.id + o.w * o.h, true)
  return out
}

/** 一格一個的 tile 也可以有開花的一份（例：紫陽花） */
export interface BloomPair {
  base: string
  bloom: string
}

/** 放一個東西到地圖：(x, y) 是左上角；'.' 的格子不動 */
export function placeObject(map: GameMap, name: string, x: number, y: number, id: (n: string) => number) {
  const info = infos.get(name)
  if (!info) throw new Error(`world kit：沒有 ${name}`)
  for (let cy = 0; cy < info.h; cy++)
    for (let cx = 0; cx < info.w; cx++) {
      const ch = info.cells[cy]![cx]!
      const code = CODE[ch]
      if (!code) continue
      const xx = x + cx
      const yy = y + cy
      if (xx < 0 || yy < 0 || xx >= map.w || yy >= map.h) continue
      map[code.layer][yy * map.w + xx] = id(`${name}/${cx},${cy}`)
    }
}

/** 這個東西的格子哪些會擋住（生成器排位置、算可達性用） */
export function objectBlocks(name: string): Array<{ cx: number; cy: number; block: boolean; layer: TileLayer }> {
  const info = infos.get(name)
  if (!info) return []
  const out: Array<{ cx: number; cy: number; block: boolean; layer: TileLayer }> = []
  for (let cy = 0; cy < info.h; cy++)
    for (let cx = 0; cx < info.w; cx++) {
      const code = CODE[info.cells[cy]![cx]!]
      if (!code) continue
      out.push({ cx, cy, layer: code.layer, block: code.behavior !== undefined && code.behavior !== 'walk' && code.behavior !== 'door' })
    }
  return out
}

/** 依序分 id（一套 kit 一個範圍；超出就丟錯） */
export function idRange(from: number, to: number) {
  let next = from
  return {
    take(n: number): number {
      const id = next
      next += n
      if (next - 1 > to) throw new Error(`world kit：id 超出 ${from}–${to}`)
      return id
    },
    get used() {
      return next - from
    },
  }
}

export type { Season }
