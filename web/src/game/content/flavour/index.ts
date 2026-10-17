import { seedOf } from '../../../services/pixelwalk/rng'
import type { Weather } from '../../engine/render'
import type { Season, TimeOfDay } from '../../engine/types'

import { COMMON } from './common'
import { KINKI } from './kinki'
import { OKINAWA } from './okinawa'
import type { FlavourBloom, FlavourLine, FlavourRegion, FlavourWho } from './types'

export { QUEST_LINES, QUEST_MISC, type QuestLines } from './quests'
export type { FlavourBloom, FlavourLine, FlavourRegion, FlavourWhen, FlavourWho } from './types'

/** 全部的虛構台詞 */
export const FLAVOUR: readonly FlavourLine[] = [...COMMON, ...KINKI, ...OKINAWA]

export interface FlavourCtx {
  who: FlavourWho
  region: 'kinki' | 'okinawa'
  season: Season
  time: TimeOfDay
  weather: Weather
  /** 現在開著的花（平年值）；沒給就當作都沒開 */
  bloom?: ReadonlySet<FlavourBloom>
}

/** 這個時候說得出口的台詞（有寫 when 的，季節、時段、天氣、花況都要對） */
export function flavourFor(c: FlavourCtx): FlavourLine[] {
  return FLAVOUR.filter((l) => {
    if (l.who !== c.who) return false
    if (l.region !== 'any' && l.region !== (c.region satisfies FlavourRegion)) return false
    const w = l.when
    if (w?.season && !w.season.includes(c.season)) return false
    if (w?.time && !w.time.includes(c.time)) return false
    if (w?.weather && !w.weather.includes(c.weather)) return false
    if (w?.bloom && !w.bloom.some((f) => c.bloom?.has(f))) return false
    return true
  })
}

/**
 * 挑一句：同一個人、同一天、同一個時段先說同一句，再搭話就換下一句（n 是搭話的次數）。
 * 有寫季節、時段、天氣的台詞比一般的優先一點（放在前面輪）。
 */
export function pickFlavour(c: FlavourCtx, key: string, n = 0): FlavourLine | null {
  const all = flavourFor(c)
  if (!all.length) return null
  const special = all.filter((l) => l.when)
  const plain = all.filter((l) => !l.when)
  // FNV 的低位只看字的低位：「passer:0」「walker:0」會落在同一句。再混一次（murmur3 的 fmix32）再取餘數
  const seed = mix(seedOf(key, c.season, c.time, c.weather))
  const order = [...rotate(special, seed), ...rotate(plain, mix(seed ^ 0x9e3779b9))]
  return order[n % order.length]!
}

function mix(h: number): number {
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function rotate<T>(list: readonly T[], seed: number): T[] {
  if (!list.length) return []
  const k = seed % list.length
  return [...list.slice(k), ...list.slice(0, k)]
}
