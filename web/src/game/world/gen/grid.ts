import { emptyMap } from '../../engine/map'
import { tileDef, tileId } from '../../engine/tiles'
import { B, type BorderTiles, type GameMap, type MapName, type TileLayer } from '../../engine/types'
import { objectInfo } from '../kits/objects'

/**
 * 生成器的格子：一張 GameMap＋每一格「拿來做什麼」（use）＋每一格屬於哪個物件（拆掉一整個房子用）。
 * use：free 空地、road 路、body 地標的範圍、keep 不能放東西（門前、參道、拍攝點）、water 河、sea 海、
 * house 填空的房子、fill 填空的樹與田、edge 地圖邊的一圈、shop 店與車站。
 */
export const U = { free: 0, road: 1, body: 2, keep: 3, water: 4, sea: 5, house: 6, fill: 7, edge: 8, shop: 9 } as const
export type Use = (typeof U)[keyof typeof U]

const ids = new Map<string, number>()
/** tile 名字 → id（快取） */
export function tid(name: string): number {
  let id = ids.get(name)
  if (id === undefined) {
    id = tileId(name)
    ids.set(name, id)
  }
  return id
}

export interface ObjectHit {
  name: string
  x: number
  y: number
  w: number
  h: number
}

export class Grid {
  readonly w: number
  readonly h: number
  readonly map: GameMap
  readonly use: Uint8Array
  /** 每一格屬於第幾個物件（0 = 沒有） */
  readonly owner: Uint16Array
  readonly objects: Array<ObjectHit | null> = [null]

  constructor(o: { id: string; name: MapName; w: number; h: number; outdoor: boolean; border: BorderTiles; ground: string }) {
    this.w = o.w
    this.h = o.h
    this.map = emptyMap({ id: o.id, name: o.name, w: o.w, h: o.h, outdoor: o.outdoor, border: o.border, ground: tid(o.ground) })
    this.use = new Uint8Array(o.w * o.h)
    this.owner = new Uint16Array(o.w * o.h)
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h
  }
  i(x: number, y: number) {
    return y * this.w + x
  }
  useAt(x: number, y: number): number {
    return this.inside(x, y) ? this.use[this.i(x, y)]! : U.edge
  }
  setUse(x: number, y: number, u: Use) {
    if (this.inside(x, y)) this.use[this.i(x, y)] = u
  }
  free(x: number, y: number) {
    return this.useAt(x, y) === U.free
  }

  /** 地面 */
  ground(x: number, y: number, name: string) {
    if (this.inside(x, y)) this.map.ground[this.i(x, y)] = tid(name)
  }
  groundName(x: number, y: number): string | undefined {
    return this.inside(x, y) ? tileDef(this.map.ground[this.i(x, y)]!)?.name : undefined
  }
  layer(layer: TileLayer, x: number, y: number, name: string | 0) {
    if (this.inside(x, y)) this.map[layer][this.i(x, y)] = name === 0 ? 0 : tid(name)
  }
  /** 行為覆寫（null = 照 tile） */
  behavior(x: number, y: number, b: keyof typeof B | null) {
    if (this.inside(x, y)) this.map.beh[this.i(x, y)] = b === null ? 0 : B[b] + 1
  }

  /** 一塊方形的格子都符合 ok 嗎（出界算不符合） */
  rectOk(x: number, y: number, w: number, h: number, ok: (u: number, x: number, y: number) => boolean): boolean {
    if (x < 0 || y < 0 || x + w > this.w || y + h > this.h) return false
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (!ok(this.use[this.i(xx, yy)]!, xx, yy)) return false
    return true
  }
  fillUse(x: number, y: number, w: number, h: number, u: Use) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.setUse(xx, yy, u)
  }

  /**
   * 放一個物件（kits/objects 的 defineObject）：每一格寫到它的那一層、記下屬於誰；
   * doors = false 時門的格子改成擋住（不是每間房子都進得去）。回傳物件的編號。
   */
  object(name: string, x: number, y: number, u: Use, o: { doors?: boolean } = {}): number {
    const info = objectInfo(name)
    if (!info) throw new Error(`world gen：沒有物件 ${name}`)
    const n = this.objects.length
    this.objects.push({ name, x, y, w: info.w, h: info.h })
    for (let cy = 0; cy < info.h; cy++)
      for (let cx = 0; cx < info.w; cx++) {
        const ch = info.cells[cy]![cx]!
        if (ch === '.') continue
        const xx = x + cx
        const yy = y + cy
        if (!this.inside(xx, yy)) continue
        const t = `${name}/${cx},${cy}`
        const def = tileDef(tid(t))!
        const i = this.i(xx, yy)
        this.map[def.layer][i] = def.id
        this.owner[i] = n
        this.use[i] = u
        if (ch === 'D' && o.doors === false) this.map.beh[i] = B.block + 1
      }
    return n
  }

  /** 物件的門（'D' 的格子） */
  doorsOf(n: number): Array<{ x: number; y: number }> {
    const hit = this.objects[n]
    const info = hit && objectInfo(hit.name)
    if (!hit || !info) return []
    const out: Array<{ x: number; y: number }> = []
    info.cells.forEach((row, cy) => [...row].forEach((ch, cx) => ch === 'D' && out.push({ x: hit.x + cx, y: hit.y + cy })))
    return out
  }

  /** 拆掉一個填空的物件（鑿路時）：那些格子變回草地 */
  remove(n: number, grass: string) {
    const hit = this.objects[n]
    if (!hit) return
    for (let yy = hit.y; yy < hit.y + hit.h; yy++)
      for (let xx = hit.x; xx < hit.x + hit.w; xx++) {
        if (!this.inside(xx, yy)) continue
        const i = this.i(xx, yy)
        if (this.owner[i] !== n) continue
        this.owner[i] = 0
        this.map.lower[i] = 0
        this.map.over[i] = 0
        this.map.beh[i] = 0
        this.map.ground[i] = tid(grass)
        this.use[i] = U.free
      }
    this.objects[n] = null
  }
}
