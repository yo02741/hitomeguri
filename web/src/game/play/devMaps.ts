import type { MapSource } from '../engine/game'
import type { GameMap } from '../engine/types'
import { testMaps } from '../maps'

/**
 * DEV 用：P0 的測試小鎮（town）與店（shop），id 前面加 p0:，跟世界的地圖分開（舊存檔的 'town' 不會讀進這裡）。
 * PlayView 只在 import.meta.env.DEV 時動態 import 這一檔，正式版不會帶進來。
 *   __game.warp('p0:town', 14, 20, 'up')
 */
export const P0_PREFIX = 'p0:'

const tagged = new Map<string, GameMap>()

export const p0Maps: MapSource = (id) => {
  if (!id.startsWith(P0_PREFIX)) return null
  const hit = tagged.get(id)
  if (hit) return hit
  const m = testMaps(id.slice(P0_PREFIX.length))
  if (!m) return null
  const out: GameMap = { ...m, id, warps: m.warps.map((w) => ({ ...w, to: w.to.startsWith(P0_PREFIX) ? w.to : `${P0_PREFIX}${w.to}` })) }
  tagged.set(id, out)
  return out
}
