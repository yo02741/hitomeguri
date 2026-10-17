import type { MapSource } from '../engine/game'
import type { GameMap } from '../engine/types'

import { buildShop } from './shop'
import { buildTown } from './town'

/**
 * P0 的地圖：測試小鎮（town）與店（shop）。地圖第一次要的時候才做，之後用同一份（NPC 的位置每次進地圖都重來）。
 * P2 的鎮由生成器做，接在同一個 MapSource 後面。
 */
const builders: Record<string, () => GameMap> = {
  town: () => buildTown().map,
  shop: buildShop,
}
const built = new Map<string, GameMap>()

export const testMaps: MapSource = (id) => {
  const hit = built.get(id)
  if (hit) return hit
  const make = builders[id]
  if (!make) return null
  const map = make()
  built.set(id, map)
  return map
}

export const TEST_START = { map: 'town', x: 14, y: 20, dir: 'up' as const }
export const testMapIds = () => Object.keys(builders)
