import type { Rarity } from './card'

/**
 * 收集卡的樣式（DESIGN.md §7.19a）：像寶可夢卡同一隻有基本卡、全圖卡、特別插畫卡，
 * 同一個景點也有好幾種樣式。每「去過」一次（自己標的、每一趟結束的行程）抽一次：
 * - 基本：一定有
 * - 季節（春夏秋冬）：去的那天是什麼季節就拿到那一張（看日期，不是抽的）
 * - 全景：照片鋪滿整張卡，蝕刻紋光澤（20%）
 * - 金箔：整張金框（4%）
 * - 特別全景：世界遺產、國寶、特別史跡、特別名勝才有，全景＋虹色亮片（10%）
 * 金箔、特別全景、全景一次最多抽到一種。
 * 抽到什麼由「帳號＋景點＋日期」決定（雜湊），不另外存；換裝置、重新整理都一樣。
 */
export type VariantKind = 'base' | 'season' | 'full' | 'gold' | 'special'
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'

export interface Variant {
  kind: VariantKind
  season?: SeasonKey
  /** base、full、gold、special、season-spring… */
  key: string
  label: string
  /** 越大越稀有：收集冊顯示最稀有的那張 */
  rank: number
}

export const SEASON_LABEL: Record<SeasonKey, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
const SEASON_ORDER: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter']

const BASE: Variant = { kind: 'base', key: 'base', label: '基本', rank: 0 }
const FULL: Variant = { kind: 'full', key: 'full', label: '全景', rank: 2 }
const GOLD: Variant = { kind: 'gold', key: 'gold', label: '金箔', rank: 3 }
const SPECIAL: Variant = { kind: 'special', key: 'special', label: '特別全景', rank: 4 }
export function seasonVariant(s: SeasonKey): Variant {
  return { kind: 'season', season: s, key: `season-${s}`, label: `${SEASON_LABEL[s]}景`, rank: 1 }
}

export function seasonOfMonth(month: number): SeasonKey {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/** FNV-1a 32 位元 → [0, 1) */
export function hash01(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

const rareSpot = (r: Rarity) => r === 'rainbow' || r === 'gold'

/** 一次「去過」抽到的樣式（基本一定有；有日期就有那個季節的） */
export function drawVariants(uid: string, spotId: string, date: string | null | undefined, rarity: Rarity): Variant[] {
  const out = [BASE]
  if (date) out.push(seasonVariant(seasonOfMonth(Number(date.slice(5, 7)))))
  const r = hash01(`${uid}|${spotId}|${date ?? 'undated'}`)
  const rare = rareSpot(rarity)
  // 金箔 4%；特別全景 10%（稀有的景點才有）；全景 20%。三種互斥，一次最多一種
  if (r < 0.04) out.push(GOLD)
  else if (rare && r < 0.14) out.push(SPECIAL)
  else if (r < (rare ? 0.34 : 0.24)) out.push(FULL)
  return out
}

/** 每次去過抽到的合起來（不重複，稀有的在前） */
export function ownedVariants(uid: string, spotId: string, dates: Array<string | null | undefined>, rarity: Rarity): Variant[] {
  const seen = new Map<string, Variant>()
  for (const d of dates.length ? dates : [null]) for (const v of drawVariants(uid, spotId, d, rarity)) seen.set(v.key, v)
  return [...seen.values()].sort((a, b) => b.rank - a.rank || seasonIndex(a) - seasonIndex(b))
}

function seasonIndex(v: Variant): number {
  return v.season ? SEASON_ORDER.indexOf(v.season) : -1
}

/** 這個景點全部的樣式（收集冊顯示「3 / 7 種」） */
export function allVariants(rarity: Rarity): Variant[] {
  return [BASE, ...SEASON_ORDER.map(seasonVariant), FULL, GOLD, ...(rareSpot(rarity) ? [SPECIAL] : [])]
}

export const BASE_VARIANT = BASE
