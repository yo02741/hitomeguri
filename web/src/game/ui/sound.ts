import type { BgmOptions } from '../audio/gameAudio'
import { SFX_NAMES, type SfxName } from '../audio/sfx'
import { SONG_IDS, type SongId } from '../audio/songs'
import type { TimeOfDay } from '../engine/types'

/**
 * 引擎的聲音事件（sfx、bgm 的名字）→ game/audio 的名字。
 * 引擎與地圖用的名字跟聲音那邊大多一樣；P0 的測試地圖用 town、indoor，這裡對到京都的鎮曲與室內曲。
 */
const SFX_ALIAS: Record<string, SfxName> = { ledge: 'jump', shop: 'register', photo: 'shutter' }
const SONG_ALIAS: Record<string, SongId> = { town: 'kyoto', indoor: 'interior', station: 'interior' }
const SFX_SET = new Set<string>(SFX_NAMES)
const SONG_SET = new Set<string>(SONG_IDS)

/** 效果音的名字；不認得的回 null（不響） */
export function sfxOf(name: string): SfxName | null {
  if (SFX_SET.has(name)) return name as SfxName
  return SFX_ALIAS[name] ?? null
}

/** 地圖的 bgm → 曲子；null、不認得的回 null（停） */
export function songOf(name: string | null | undefined): SongId | null {
  if (!name) return null
  if (SONG_SET.has(name)) return name as SongId
  return SONG_ALIAS[name] ?? null
}

/** 夜裡（19:00–5:59）鎮曲換慢版；祭典由 P2 的世界決定 */
export function moodOf(time: TimeOfDay, festival = false): BgmOptions {
  return { night: time === 'night', festival }
}
