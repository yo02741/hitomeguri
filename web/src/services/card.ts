import type { Spot } from './bundles'

/**
 * 景點收集卡的稀有度（DESIGN.md §7.19）：只看景點既有的資料，不自己編。
 * - rainbow：世界遺產
 * - castle：日本100名城・続日本100名城（擴充包「城」對到的景點）
 * - gold：特別史跡、特別名勝
 * - normal：其他（只有傾斜與反光，沒有箔片）
 */
export type Rarity = 'rainbow' | 'castle' | 'gold' | 'normal'

export const RARITY_LABEL: Record<Rarity, string> = {
  rainbow: '世界遺產',
  castle: '名城',
  gold: '特別指定',
  normal: '',
}

export function rarityOf(spot: Pick<Spot, 'tags'>, isCastle: boolean): Rarity {
  if (spot.tags.includes('世界遺產')) return 'rainbow'
  if (isCastle) return 'castle'
  if (spot.tags.some((t) => t === '特別史跡' || t === '特別名勝')) return 'gold'
  return 'normal'
}

/** 卡號：縣內依分數排第幾（例：No.004 / 312） */
export function cardNumber(rank: number, total: number): string {
  const w = Math.max(3, String(total).length)
  return `No.${String(rank).padStart(w, '0')}`
}

/** 卡號：縣內依分數排第幾；地圖 bundle 還沒載入時沒有卡號 */
export function cardNumberOf(id: string, prefSpots: { id: string; s: number }[] | undefined): string {
  if (!prefSpots?.length) return ''
  const sorted = [...prefSpots].sort((a, b) => b.s - a.s)
  const i = sorted.findIndex((x) => x.id === id)
  return i < 0 ? '' : cardNumber(i + 1, sorted.length)
}
