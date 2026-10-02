import type { Rarity } from './card'

/**
 * 收集卡的樣式（DESIGN.md §7.19a）：像寶可夢卡同一隻有基本卡、全圖卡、特別插畫卡，
 * 同一個景點也有好幾種樣式。每「去過」一次（自己標的、每一趟結束的行程）抽一次：
 * - 基本：一定有
 * - 季節（春夏秋冬）：去的那天是什麼季節就拿到那一張（看日期，不是抽的）
 * - 全景：照片鋪滿整張卡，蝕刻紋光澤（12%）
 * - 夜景：夜晚的照片鋪滿整張卡，星點閃爍（8%；沒有夜景照片時把照片壓暗）
 * - 墨繪：照片變成水墨，和紙卡面、墨框（8%）
 * - 切手：郵票：白邊、齒孔、消印（8%）
 * - 銀箔：整張銀框（4%）
 * - 金箔：整張金框（3%）
 * - 特別全景：世界遺產、國寶、特別史跡、特別名勝才有，全景＋虹色亮片（8%）
 * 全景、夜景、墨繪、切手、銀箔、金箔、特別全景一次最多抽到一種。
 * 抽到什麼由「帳號＋景點＋日期」決定（雜湊），不另外存；換裝置、重新整理都一樣。
 * 測試期（UNLIMITED_DRAWS）另外可以無限抽：按去過、開卡包、收集卡的「再抽一張」都隨機抽一次，
 * 存在 Firestore users/{uid}/cards（stores/cards.ts）。正式上線前改成 false 並清空。
 * 全景、金箔、特別全景記得是在哪個季節抽到的（photo），卡面用那個季節的照片（有的話）。
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
  const extra = pick(hash01(`${uid}|${spotId}|${date ?? 'undated'}`), rarity)
  if (extra) out.push(withSeason(extra, date ? seasonOfMonth(Number(date.slice(5, 7))) : undefined))
  return out
}

/** 照片跟季節走的樣式記下抽到的季節（夜景固定是夜景照片） */
function withSeason(v: Variant, season: SeasonKey | undefined): Variant {
  return v.photo || !season ? v : { ...v, photo: season }
}

// 金箔 3%、銀箔 4%、特別全景 8%（稀有的景點才有）、全景 12%、夜景 8%、墨繪 8%、切手 8%。互斥，一次最多一種
function pick(r: number, rarity: Rarity): Variant | null {
  const rare = rareSpot(rarity)
  if (r < 0.03) return GOLD
  if (r < 0.07) return SILVER
  if (rare && r < 0.15) return SPECIAL
  const base = rare ? 0.15 : 0.07
  if (r < base + 0.12) return FULL
  if (r < base + 0.2) return NIGHT
  if (r < base + 0.28) return SUMI
  if (r < base + 0.36) return STAMP
  return null
}

/** 無限抽（UNLIMITED_DRAWS）：隨機抽一次。季節也隨機（正式規則是看去的日期；測試期照日期就只抽得到當季） */
export function randomDraw(rarity: Rarity, _date: string): Variant[] {
  const season = SEASON_ORDER[Math.floor(Math.random() * SEASON_ORDER.length)]!
  const out = [BASE, seasonVariant(season)]
  const extra = pick(Math.random(), rarity)
  if (extra) out.push(withSeason(extra, season))
  return out
}

/** 每次去過抽到的合起來（不重複，稀有的在前） */
export function ownedVariants(
  uid: string,
  spotId: string,
  dates: Array<string | null | undefined>,
  rarity: Rarity,
  extra: Variant[] = [],
): Variant[] {
  const seen = new Map<string, Variant>()
  for (const d of dates.length ? dates : [null]) for (const v of drawVariants(uid, spotId, d, rarity)) seen.set(v.key, v)
  // 無限抽抽到的（特別全景只有稀有的景點才有，舊資料或換了稀有度時略過）
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

export const BASE_VARIANT = BASE
