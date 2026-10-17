import type { Game } from '../engine/game'

import { FRAME_SLOTS, type RoomLayout, roomOf, SHELF_COLS, SHELF_SLOTS } from './state'
import type { SlotData } from './types'

/**
 * 你的房間（規格 §8.6）：架子 6×3、牆上 4 個相框、桌上的印帳。京都的旅館與沖繩的民宿進來都是同一間（擺設共用）。
 * 擺設的介面（RoomPanel）：游標在格子上移動，A 拿起、十字鍵移、A 放下（放到有東西的格子就交換），B 放回原處。
 * 架子放行李裡帶得走的東西（放上去的那一個從行李扣掉，收回再加回去）；相框放自己拍的照片（照片不會用掉）。
 */
export type SlotRef = { area: 'shelf'; i: number } | { area: 'frame'; i: number }

export const slotCount = (area: SlotRef['area']) => (area === 'shelf' ? SHELF_SLOTS : FRAME_SLOTS)

/** 實體的 data → 第幾格（slot，或 col＋row） */
export function slotIndex(d: SlotData | undefined, area: SlotRef['area']): number | null {
  if (!d) return null
  let i: number | null = null
  if (typeof d.index === 'number') i = d.index
  else if (typeof d.slot === 'number') i = d.slot
  else if (area === 'shelf' && typeof d.col === 'number' && typeof d.row === 'number') i = d.row * SHELF_COLS + d.col
  else if (area === 'frame' && typeof d.col === 'number') i = d.col
  if (i === null || !Number.isInteger(i) || i < 0 || i >= slotCount(area)) return null
  return i
}

export const get = (r: RoomLayout, s: SlotRef) => (s.area === 'shelf' ? r.shelf[s.i] : r.frames[s.i]) ?? null
function set(r: RoomLayout, s: SlotRef, v: string | null) {
  if (s.area === 'shelf') r.shelf[s.i] = v
  else r.frames[s.i] = v
}

/** 從行李放一樣到架子的空格 */
export function placeFromBag(game: Game, s: SlotRef, key: string): boolean {
  const r = roomOf(game)
  if (s.area !== 'shelf' || get(r, s)) return false
  const have = game.state.items[key] ?? 0
  if (have < 1) return false
  if (have === 1) delete game.state.items[key]
  else game.state.items[key] = have - 1
  set(r, s, key)
  game.changed('items')
  return true
}

/** 放一張照片到相框（原本有的就換掉） */
export function placePhoto(game: Game, s: SlotRef, photo: string): boolean {
  if (s.area !== 'frame') return false
  set(roomOf(game), s, photo)
  game.changed('items')
  return true
}

/** 收回：架子的東西回到行李；相框拿下照片 */
export function takeBack(game: Game, s: SlotRef): boolean {
  const r = roomOf(game)
  const v = get(r, s)
  if (!v) return false
  set(r, s, null)
  if (s.area === 'shelf') game.state.items[v] = (game.state.items[v] ?? 0) + 1
  game.changed('items')
  return true
}

/** 拿起來的東西放到另一格（同一區；那一格有東西就交換） */
export function moveSlot(game: Game, from: SlotRef, to: SlotRef): boolean {
  if (from.area !== to.area || from.i === to.i) return false
  const r = roomOf(game)
  const a = get(r, from)
  if (!a) return false
  const b = get(r, to)
  set(r, to, a)
  set(r, from, b)
  game.changed('items')
  return true
}

/** 擺了幾樣、一共幾格 */
export function roomCount(game: Game): { placed: number; slots: number } {
  const r = roomOf(game)
  return { placed: [...r.shelf, ...r.frames].filter(Boolean).length, slots: SHELF_SLOTS + FRAME_SLOTS }
}

/** 照片被相框用著（換掉相簿裡那一格的照片時不要刪） */
export const photoInFrame = (game: Game, id: string) => roomOf(game).frames.includes(id)
