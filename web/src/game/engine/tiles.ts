import { Gfx } from '../../services/pixelwalk/gfx'
import { makePalette, type Palette, type Season, type TimeOfDay, type Tokens } from '../../services/pixelwalk/palette'

import { B, type BehaviorName, TILE, type TileCtx, type TileDef, type TileLayer } from './types'

/**
 * tile 的註冊與快取。每套 kit（basic、P2 的近畿、沖繩）用 registerTileset 註冊，id 是全域的。
 * 畫面上每一格只 blit 快取好的 16×16（Uint32，跟畫面同一個調色盤）：第一次用到才畫，
 * key 是 id×季節×時段×動畫格×花樣×接邊。
 */
export const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter']
export const TIMES: readonly TimeOfDay[] = ['day', 'dusk', 'night']

const byId = new Map<number, TileDef>()
const byName = new Map<string, TileDef>()
const sets = new Map<string, TileDef[]>()
const bigs = new Map<string, { w: number; h: number }>()
/** 行為碼查表（id → 行為碼；-1 = 照下面那層） */
let behLut = new Int16Array(0)

export function registerTileset(name: string, tiles: TileDef[]) {
  if (sets.has(name)) return
  for (const t of tiles) {
    if (!Number.isInteger(t.id) || t.id < 1 || t.id > 65535) throw new Error(`game tile：${t.name} 的 id（${t.id}）要在 1–65535`)
    if (byId.has(t.id)) throw new Error(`game tile：id ${t.id} 重複（${byId.get(t.id)!.name}、${t.name}）`)
    if (byName.has(t.name)) throw new Error(`game tile：名字 ${t.name} 重複`)
    if (t.layer === 'ground' && !t.behavior) throw new Error(`game tile：地面 ${t.name} 要寫行為`)
    if ((t.frames ?? 1) > 8) throw new Error(`game tile：${t.name} 的動畫最多 8 格`)
    if ((t.variants ?? 1) > 4) throw new Error(`game tile：${t.name} 的花樣最多 4 種`)
    byId.set(t.id, t)
    byName.set(t.name, t)
  }
  sets.set(name, tiles)
  const max = Math.max(behLut.length - 1, ...tiles.map((t) => t.id))
  const lut = new Int16Array(max + 1).fill(-1)
  for (const [id, t] of byId) lut[id] = t.behavior ? B[t.behavior] : -1
  behLut = lut
}

export const tileDef = (id: number): TileDef | undefined => (id ? byId.get(id) : undefined)
export function tileId(name: string): number {
  const t = byName.get(name)
  if (!t) throw new Error(`game tile：沒有 ${name}`)
  return t.id
}
export const hasTile = (name: string) => byName.has(name)
export const allTiles = (): TileDef[] => [...byId.values()]
export const tilesetNames = (): string[] => [...sets.keys()]
/** tile 的行為碼（-1 = 沒寫，照下面那層） */
export const behaviorOf = (id: number): number => (id > 0 && id < behLut.length ? behLut[id]! : -1)

/**
 * 好幾格的大東西（房子、大樹、鳥居）：整張畫一次（左上是 0, 0，寬 w×16、高 h×16），切成 w×h 個 tile。
 * id 從 id 起連號（id + cy×w + cx），名字是「name/cx,cy」。layer、behavior 決定每一格在哪一層、什麼行為。
 */
export function bigTiles(o: {
  id: number
  name: string
  w: number
  h: number
  layer(cx: number, cy: number): TileLayer
  behavior?(cx: number, cy: number): BehaviorName | undefined
  frames?: number
  fps?: number
  draw(g: Gfx, c: TileCtx): void
}): TileDef[] {
  bigs.set(o.name, { w: o.w, h: o.h })
  const out: TileDef[] = []
  for (let cy = 0; cy < o.h; cy++)
    for (let cx = 0; cx < o.w; cx++) {
      const layer = o.layer(cx, cy)
      out.push({
        id: o.id + cy * o.w + cx,
        name: `${o.name}/${cx},${cy}`,
        layer,
        behavior: o.behavior?.(cx, cy) ?? (layer === 'ground' ? 'walk' : undefined),
        frames: o.frames,
        fps: o.fps,
        draw: (g, c) => g.at(-cx * TILE, -cy * TILE, () => o.draw(g, c)),
      })
    }
  return out
}

/** 大東西的格數（placeBig 用） */
export const bigSize = (name: string) => bigs.get(name)

export interface TileImage {
  buf: Uint32Array
  /** 每個像素都有顏色（地面一定是）：可以整列複製 */
  opaque: boolean
}

const SEASON_I: Record<Season, number> = { spring: 0, summer: 1, autumn: 2, winter: 3 }
const TIME_I: Record<TimeOfDay, number> = { day: 0, dusk: 1, night: 2 }

export class TileCache {
  private readonly tokens: Tokens
  private readonly pals = new Map<TimeOfDay, Palette>()
  private readonly cache = new Map<number, TileImage | null>()
  private readonly scratch: Gfx
  /** 畫壞的 tile（只警告一次） */
  private readonly broken = new Set<number>()

  constructor(tokens: Tokens) {
    this.tokens = tokens
    this.scratch = new Gfx(TILE, TILE, this.palette('day'))
  }

  palette(time: TimeOfDay): Palette {
    let p = this.pals.get(time)
    if (!p) {
      p = makePalette(this.tokens, time)
      this.pals.set(time, p)
    }
    return p
  }

  /** 動畫：秒數 → 第幾格 */
  static frameOf(def: TileDef, t: number): number {
    const n = def.frames ?? 1
    return n > 1 ? Math.floor(t * (def.fps ?? 3)) % n : 0
  }

  static key(id: number, season: Season, time: TimeOfDay, frame: number, variant: number, mask: number): number {
    return ((((id * 4 + SEASON_I[season]) * 3 + TIME_I[time]) * 8 + frame) * 4 + variant) * 16 + mask
  }

  get(id: number, season: Season, time: TimeOfDay, frame: number, variant: number, mask: number): TileImage | null {
    const key = TileCache.key(id, season, time, frame, variant, mask)
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const def = tileDef(id)
    const img = def ? this.draw(def, { season, time, frame, variant, mask, x: 0, y: 0 }) : null
    // 換了好幾個鎮、時段、季節之後：整個清掉重來（一格 1 KB，兩萬格約 20 MB）
    if (this.cache.size > 20000) this.cache.clear()
    this.cache.set(key, img)
    return img
  }

  /** 畫一格（測試也用：每個 tile 每個季節時段都畫得出） */
  draw(def: TileDef, c: TileCtx): TileImage {
    const g = this.scratch
    g.pal = this.palette(c.time)
    g.ox = 0
    g.oy = 0
    g.clear(null)
    try {
      def.draw(g, c)
    } catch (e) {
      if (!this.broken.has(def.id) && import.meta.env?.DEV) console.warn(`game：tile ${def.name} 畫不出來`, e)
      this.broken.add(def.id)
      // 畫壞了：墨色的格子，看得出來
      g.clear(null)
      g.dither(0, 0, TILE, TILE, 'ink', 8)
    }
    g.ox = 0
    g.oy = 0
    const buf = new Uint32Array(g.buf)
    return { buf, opaque: !buf.includes(0) }
  }

  clear() {
    this.cache.clear()
  }
}
