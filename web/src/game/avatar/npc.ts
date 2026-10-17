import { EYE_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, SKINS } from '../../data/outfits'
import { rng } from '../../services/pixelwalk/rng'
import type { ActorLook } from '../engine/types'

import { travellerLook } from './looks'
import type { TravellerLook } from './types'

/**
 * 路人（規格 §4、§7：NPC 也可以用同一個產生器隨機組）：種子 → 髮型、髮色、膚色、眼睛、一件衣服、偶爾一頂帽子。
 * 只挑不限縣、不是成就的單品（各縣的特色單品留給玩家自己）。生成不做 3D（側面用範本），一個約幾十毫秒。
 */
const BODIES = OUTFITS.filter((o) => o.slot === 'body' && !o.pref && !o.achv).map((o) => o.id)
const HATS = OUTFITS.filter((o) => o.slot === 'head' && !o.pref && !o.achv).map((o) => o.id)

export function randomLook(seed: number): TravellerLook {
  const r = rng(seed)
  const equipped: TravellerLook['equipped'] = { body: r.pick(BODIES) }
  if (r.chance(0.3)) equipped.head = r.pick(HATS)
  return {
    parts: { skin: r.pick(SKINS), hair: r.pick(HAIR_STYLES).key, hairColor: r.pick(HAIR_COLORS), eyes: r.pick(EYE_STYLES).key },
    equipped,
  }
}

/** 路人的 ActorLook（生成失敗回 null，用手畫的路人） */
export async function npcLook(seed: number): Promise<ActorLook | null> {
  const look = randomLook(seed)
  try {
    const { generateTraveller } = await import('./generate')
    const out = await generateTraveller(look, { keys: { game: `npc:${seed}`, about: '' }, side3d: false })
    return out ? travellerLook(out.game) : null
  } catch {
    return null
  }
}
