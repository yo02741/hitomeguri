import type { MapSpot, Spot } from './bundles'

/**
 * 景點收集卡（DESIGN.md §7.19）。卡面內容只用景點既有的資料，不自己編。
 *
 * 稀有度：
 * - rainbow：世界遺產
 * - castle：日本100名城・続日本100名城（擴充包「城」對到的景點）
 * - gold：國寶、特別史跡、特別名勝
 * - normal：其他（只有傾斜與反光，沒有箔片）
 */
export type Rarity = 'rainbow' | 'castle' | 'gold' | 'normal'

/** 卡片看的文化指定，由高到低；與 pipeline/build_bundles.py 的 CARD_DESIGNATIONS 相同 */
export const CARD_DESIGNATIONS = ['世界遺產', '國寶', '特別史跡', '特別名勝'] as const

export function designationOf(tags: string[]): string | undefined {
  return CARD_DESIGNATIONS.find((d) => tags.includes(d))
}

/** 名城：番號與「日本100名城」「続日本100名城」 */
export interface CastleInfo {
  no: number
  label: string
}

export function rarityOf(designation: string | undefined, castle: boolean): Rarity {
  if (designation === '世界遺產') return 'rainbow'
  if (castle) return 'castle'
  if (designation) return 'gold'
  return 'normal'
}

/** 卡片右上的標示：世界遺產以外的名城寫「100名城」「続100名城」，其他寫指定名稱 */
export function rarityLabel(designation: string | undefined, castle: CastleInfo | undefined): string {
  if (designation === '世界遺產' || !castle) return designation ?? ''
  return castle.label.replace('日本', '')
}

/** 卡號：縣內依分數排第幾（例：No.004） */
export function cardNumber(rank: number, total: number): string {
  const w = Math.max(3, String(total).length)
  return `No.${String(rank).padStart(w, '0')}`
}

/** 各景點在縣內的卡號；地圖 bundle 載入後算一次 */
const numberCache = new WeakMap<object, Map<string, string>>()
export function cardNumberOf(id: string, prefSpots: { id: string; s: number }[] | undefined): string {
  if (!prefSpots?.length) return ''
  let m = numberCache.get(prefSpots)
  if (!m) {
    const sorted = [...prefSpots].sort((a, b) => b.s - a.s || a.id.localeCompare(b.id))
    m = new Map(sorted.map((x, i) => [x.id, cardNumber(i + 1, sorted.length)]))
    numberCache.set(prefSpots, m)
  }
  return m.get(id) ?? ''
}

/** 卡號：標示是名城時用名城番號（例：100名城 No.53），其他用縣內排名 */
export function cardNumberFor(
  id: string,
  prefSpots: { id: string; s: number }[] | undefined,
  castle: CastleInfo | undefined,
  designation: string | undefined,
): string {
  return castle && designation !== '世界遺產' ? `No.${castle.no}` : cardNumberOf(id, prefSpots)
}

/** 卡面資料：完整景點（放大檢視）與地圖 bundle 的一筆（收集冊）都轉成這個形狀 */
export interface CardFace {
  id: string
  pref: string
  name: { ja: string; kana?: string; romaji?: string; zh?: string }
  image?: { url: string; author?: string; license?: string }
  /** 第二張照片（全景卡用；沒有就用第一張） */
  altImage?: { url: string; author?: string; license?: string }
  /** 類型（寺院、城…） */
  kind?: string
  designation?: string
  summary?: { text: string; license: string }
}

// 文化指定是屬性不是類型；只有指定沒有類型時退回史跡／名勝（同 pipeline 的 spot_type）
const DESIGNATION_TAGS = new Set(['世界遺產', '國寶', '特別名勝', '特別史跡', '重要文化財', '名勝', '史跡'])
const DESIGNATION_FALLBACK: Record<string, string> = { 特別史跡: '史跡', 史跡: '史跡', 特別名勝: '名勝', 名勝: '名勝' }

export function kindOf(tags: string[]): string | undefined {
  const t = tags.filter((x) => !x.startsWith('guide-'))
  return t.find((x) => !DESIGNATION_TAGS.has(x)) ?? t.map((x) => DESIGNATION_FALLBACK[x]).find(Boolean)
}

export function cardFromSpot(s: Spot): CardFace {
  const img = s.images[0]
  const alt = s.images[1]
  return {
    id: s.id,
    pref: s.prefecture,
    name: { ja: s.name.ja, kana: s.name.kana, romaji: s.name.romaji, zh: s.name.zh_tw !== s.name.ja ? s.name.zh_tw : undefined },
    image: img ? { url: img.url, author: img.author, license: img.license } : undefined,
    altImage: alt ? { url: alt.url, author: alt.author, license: alt.license } : undefined,
    kind: kindOf(s.tags),
    designation: designationOf(s.tags),
    summary: s.summary ? { text: s.summary.text_zh ?? s.summary.text, license: s.summary.license } : undefined,
  }
}

const COMMONS_THUMB_PREFIX = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/'

export function cardFromMapSpot(s: MapSpot, pref: string): CardFace {
  return {
    id: s.id,
    pref,
    name: { ja: s.n, kana: s.h, romaji: s.r, zh: s.z && s.z !== s.n ? s.z : undefined },
    image: s.i ? { url: s.i.startsWith('https://') ? s.i : COMMONS_THUMB_PREFIX + s.i } : undefined,
    kind: s.c,
    designation: s.d,
  }
}

/**
 * Commons 縮圖換成指定寬度（Commons 的標準寬度：250、330、500、960）。
 * 不是縮圖網址（原圖本來就小）時原樣回傳。
 */
export function commonsThumb(url: string, width: 250 | 330 | 500 | 960): string {
  const base = url.split('?', 1)[0]
  if (!base.startsWith(COMMONS_THUMB_PREFIX) || !/\/\d+px-[^/]+$/.test(base)) return url
  return base.replace(/\/\d+px-([^/]+)$/, `/${width}px-$1`)
}
