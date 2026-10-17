import { parseSong, type ParsedSong, type SongDef } from '../tracker'
import { interior } from './interior'
import { arrive, bought, stamp } from './jingles'
import { kyoto } from './kyoto'
import { okinawa } from './okinawa'

/**
 * 曲子的名單。加新曲子：在 songs/ 寫一個 SongDef（id 要跟這裡的鍵一樣、寫 scale），加進 SONGS；
 * 測試會檢查解析、每小節格數、音階、loop 長度。jingle 加進 JINGLES（不 loop、不檢查音階）。
 */
export const SONGS = { kyoto, okinawa, interior } satisfies Record<string, SongDef>
export type SongId = keyof typeof SONGS
export const SONG_IDS = Object.keys(SONGS) as SongId[]

export const JINGLES = { arrive, stamp, bought } satisfies Record<string, SongDef>
export type JingleId = keyof typeof JINGLES
export const JINGLE_IDS = Object.keys(JINGLES) as JingleId[]

const cache = new Map<SongDef, ParsedSong>()

/** 解析過的曲子（第一次用到才解析） */
export function parsed(def: SongDef): ParsedSong {
  let p = cache.get(def)
  if (!p) {
    p = parseSong(def)
    cache.set(def, p)
  }
  return p
}
