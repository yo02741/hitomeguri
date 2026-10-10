import type { MapSpot, Spot } from './bundles'
import type { Variant } from './cardVariants'
import { COMMONS_THUMB_PREFIX, commonsCandidates } from './commons'

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
  /** 季節照片（DESIGN.md §7.19a）：季節卡、全景、金箔、特別全景依抽到的季節換照片。
   *  沒有季節照片時是 {}；undefined 表示還不知道（資料還沒載入），這時不先拿基本卡的照片頂替 */
  seasonImages?: Partial<Record<'spring' | 'summer' | 'autumn' | 'winter' | 'night' | 'panorama', { url: string; author?: string; license?: string }>>
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
  return {
    id: s.id,
    pref: s.prefecture,
    name: { ja: s.name.ja, kana: s.name.kana, romaji: s.name.romaji, zh: s.name.zh_tw !== s.name.ja ? s.name.zh_tw : undefined },
    image: img ? { url: img.url, author: img.author, license: img.license } : undefined,
    seasonImages: s.season_images
      ? Object.fromEntries(Object.entries(s.season_images).map(([k, v]) => [k, { url: v.url, author: v.author, license: v.license }]))
      : {},
    kind: kindOf(s.tags),
    designation: designationOf(s.tags),
    summary: s.summary ? { text: s.summary.text_zh ?? s.summary.text, license: s.summary.license } : undefined,
  }
}

export function cardFromMapSpot(s: MapSpot, pref: string): CardFace {
  return {
    id: s.id,
    pref,
    name: { ja: s.n, kana: s.h, romaji: s.r, zh: s.z && s.z !== s.n ? s.z : undefined },
    image: s.i ? { url: s.i.startsWith('https://') ? s.i : COMMONS_THUMB_PREFIX + s.i } : undefined,
    seasonImages: s.si
      ? Object.fromEntries(
          Object.entries(s.si).map(([k, [path, author, license]]) => [k, { url: path.startsWith('https://') ? path : COMMONS_THUMB_PREFIX + path, author, license }]),
        )
      : {},
    kind: s.c,
    designation: s.d,
  }
}

export type CardPhoto = NonNullable<CardFace['image']>

/** 全景卡（全景、特別全景、夜景）：照片鋪滿整張卡 */
export function isFullArt(variant: Pick<Variant, 'kind'>): boolean {
  return variant.kind === 'full' || variant.kind === 'special' || variant.kind === 'night'
}

/**
 * 卡面的照片（DESIGN.md §7.19a）。基本卡用主照片；其他樣式用抽到那個季節（夜景卡是夜景）的照片，沒有就用主照片。
 * 不拿第二張或其他季節的照片補（別的季節的照片也常拍到別處）。
 * 季節照片還不知道有沒有（face.seasonImages 是 undefined）時回傳 undefined：先畫紋樣，
 * 不先放主照片、資料到了再換成季節照片（換樣式時會先閃一下別張照片）。
 */
export function cardPhoto(face: Pick<CardFace, 'image' | 'seasonImages'>, variant: Pick<Variant, 'kind' | 'photo'>): CardPhoto | undefined {
  if (variant.kind === 'base' || !variant.photo) return face.image
  if (!face.seasonImages) return undefined
  return face.seasonImages[variant.photo] ?? face.image
}

/** 卡片照片要試的網址：大卡用大一號的縮圖；縮圖取不到時改用小一號、原圖（services/commons.ts） */
export function cardPhotoSources(url: string, size: 'sm' | 'lg' | 'fluid', fullArt: boolean): string[] {
  const widths: (500 | 960 | 1280)[] = size === 'lg' ? (fullArt ? [1280, 960] : [960]) : fullArt ? [960, 500] : [500]
  return [...new Set(widths.flatMap((w) => commonsCandidates(url, w)))]
}

/**
 * 照片載入失敗後改試下一個網址：失敗的次數跟著照片記，換照片就從頭試
 * （不靠換照片後再歸零：歸零之前算出來的網址會先用到上一張照片的失敗次數）。
 */
export interface PhotoFailures {
  key: string
  n: number
}
export function photoTry(fail: PhotoFailures, key: string): number {
  return fail.key === key ? fail.n : 0
}

export { commonsThumb } from './commons'
