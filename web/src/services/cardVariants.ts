import type { Rarity } from './card'

/**
 * 收集卡的樣式（DESIGN.md §7.19a）：像寶可夢卡同一隻有基本卡、全圖卡、特別插畫卡，
 * 同一個景點也有好幾種樣式：
 * - 基本：去過就有
 * - 季節（春夏秋冬）：去的那天是什麼季節就有那一張（看日期）；也抽得到
 * - 全景：照片鋪滿整張卡，蝕刻紋光澤
 * - 夜景：夜晚的照片鋪滿整張卡，星點閃爍（沒有夜景照片時把照片壓暗）
 * - 墨繪：照片變成水墨，和紙卡面、墨框
 * - 切手：郵票：白邊、齒孔、消印
 * - 銀箔、金箔：整張銀框、金框
 * - 特別全景：世界遺產、國寶、特別史跡、特別名勝才有，全景＋虹色亮片
 * 抽（drawOne）：只從這個景點還沒有的樣式裡抽，不會重複；稀有的權重低。都有了就不能抽。
 * 抽一次用一張抽獎券（stores/wallet.ts）；每個景點第一次去過時送一次免費抽。
 * 抽到的存在 Firestore users/{uid}/cards（stores/cards.ts）。
 * 全景、金箔等記得是在哪個季節抽到的（photo），卡面用那個季節的照片（有的話）。
 * 測試期（UNLIMITED_DRAWS）不扣抽獎券；正式上線前改成 false 並清空所有人的 users/{uid}/cards。
 */
export const UNLIMITED_DRAWS = true

export type VariantKind = 'base' | 'season' | 'full' | 'night' | 'sumi' | 'stamp' | 'silver' | 'gold' | 'special'
export type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter'
/** 照片的種類：四季或夜景（data/spots 的 season_images） */
export type PhotoKey = SeasonKey | 'night'

export interface Variant {
  kind: VariantKind
  season?: SeasonKey
  /** base、full、gold、special、season-spring… */
  key: string
  label: string
  /** 越大越稀有：收集冊顯示最稀有的那張 */
  rank: number
  /** 卡面照片：季節卡是自己的季節；全景、金箔等是抽到那天的季節；夜景卡固定是夜景 */
  photo?: PhotoKey
}

export const SEASON_LABEL: Record<SeasonKey, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' }
const SEASON_ORDER: SeasonKey[] = ['spring', 'summer', 'autumn', 'winter']

const BASE: Variant = { kind: 'base', key: 'base', label: '基本', rank: 0 }
const FULL: Variant = { kind: 'full', key: 'full', label: '全景', rank: 2 }
const NIGHT: Variant = { kind: 'night', key: 'night', label: '夜景', rank: 2, photo: 'night' }
const SUMI: Variant = { kind: 'sumi', key: 'sumi', label: '墨繪', rank: 2 }
const STAMP: Variant = { kind: 'stamp', key: 'stamp', label: '切手', rank: 2 }
const SILVER: Variant = { kind: 'silver', key: 'silver', label: '銀箔', rank: 3 }
const GOLD: Variant = { kind: 'gold', key: 'gold', label: '金箔', rank: 3 }
const SPECIAL: Variant = { kind: 'special', key: 'special', label: '特別全景', rank: 4 }
export function seasonVariant(s: SeasonKey): Variant {
  return { kind: 'season', season: s, key: `season-${s}`, label: `${SEASON_LABEL[s]}景`, rank: 1, photo: s }
}
const BY_KEY = new Map<string, Variant>([BASE, FULL, NIGHT, SUMI, STAMP, SILVER, GOLD, SPECIAL].map((v) => [v.key, v]))
const PHOTO_KEYS: PhotoKey[] = [...SEASON_ORDER, 'night']

/** 存檔用的代號：full@autumn、season-spring、base */
export function encodeVariant(v: Variant): string {
  return v.photo && v.kind !== 'season' ? `${v.key}@${v.photo}` : v.key
}
export function decodeVariant(code: string): Variant | undefined {
  const [key, photo] = code.split('@') as [string, PhotoKey | undefined]
  if (key.startsWith('season-')) {
    const s = key.slice(7) as SeasonKey
    return SEASON_ORDER.includes(s) ? seasonVariant(s) : undefined
  }
  const v = BY_KEY.get(key)
  if (!v) return undefined
  return photo && PHOTO_KEYS.includes(photo) ? { ...v, photo } : v
}

export function seasonOfMonth(month: number): SeasonKey {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

const rareSpot = (r: Rarity) => r === 'rainbow' || r === 'gold'

/** 照片跟季節走的樣式記下抽到的季節（夜景固定是夜景照片） */
function withSeason(v: Variant, season: SeasonKey | undefined): Variant {
  return v.photo || !season ? v : { ...v, photo: season }
}

/** 一次「去過」拿到的樣式：基本卡，有日期就加那個季節的卡 */
export function drawVariants(date: string | null | undefined): Variant[] {
  const out = [BASE]
  if (date) out.push(seasonVariant(seasonOfMonth(Number(date.slice(5, 7)))))
  return out
}

/** 去過的每一天拿到的（基本、季節）加上抽到的（不重複，稀有的在前） */
export function ownedVariants(dates: Array<string | null | undefined>, rarity: Rarity, extra: Variant[] = []): Variant[] {
  const seen = new Map<string, Variant>()
  for (const d of dates.length ? dates : [null]) for (const v of drawVariants(d)) seen.set(v.key, v)
  // 特別全景只有稀有的景點才有，舊資料或換了稀有度時略過
  for (const v of extra) if (!seen.has(v.key) && (v.kind !== 'special' || rareSpot(rarity))) seen.set(v.key, v)
  return [...seen.values()].sort((a, b) => b.rank - a.rank || seasonIndex(a) - seasonIndex(b))
}

function seasonIndex(v: Variant): number {
  return v.season ? SEASON_ORDER.indexOf(v.season) : -1
}

/** 這個景點全部的樣式（收集冊顯示「3 / 11 種」；稀有的景點 12 種） */
export function allVariants(rarity: Rarity): Variant[] {
  return [BASE, ...SEASON_ORDER.map(seasonVariant), FULL, NIGHT, SUMI, STAMP, SILVER, GOLD, ...(rareSpot(rarity) ? [SPECIAL] : [])]
}

// 抽的權重：季節 5、全景・夜景・墨繪・切手 3、銀箔・金箔 1.2、特別全景 0.8
const WEIGHT: Record<VariantKind, number> = { base: 0, season: 5, full: 3, night: 3, sumi: 3, stamp: 3, silver: 1.2, gold: 1.2, special: 0.8 }

/** 這個景點還沒有的樣式 */
export function missingVariants(rarity: Rarity, owned: Iterable<string>): Variant[] {
  const have = new Set(owned)
  return allVariants(rarity).filter((v) => !have.has(v.key))
}

/** 從還沒有的樣式裡抽一種（不會重複）；都有了回傳 null。全景、金箔等的照片季節隨機 */
export function drawOne(rarity: Rarity, owned: Iterable<string>, rand: () => number = Math.random): Variant | null {
  const pool = missingVariants(rarity, owned)
  const total = pool.reduce((s, v) => s + WEIGHT[v.kind], 0)
  if (!total) return null
  let r = rand() * total
  let picked = pool[pool.length - 1]!
  for (const v of pool) {
    r -= WEIGHT[v.kind]
    if (r < 0) {
      picked = v
      break
    }
  }
  return withSeason(picked, SEASON_ORDER[Math.floor(rand() * SEASON_ORDER.length)])
}

export const BASE_VARIANT = BASE
