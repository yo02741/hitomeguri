import type { Kit } from '../systems/types'

/**
 * 遊戲自己的東西（規格 §8.5、§11 的 ItemRef kind 'game'）：明信片、手ぬぐい、鑰匙圈、小置物、房間鑰匙。
 * 圖案是遊戲自己畫的，名字是一般的東西的名字；說明不帶任何事實（沒有出處、沒有產地、沒有由來）。
 * 價錢是遊戲的規則（円，不代表實際的價錢；P4 從「文」改成「円」）。kits：哪一種地方的賣店會賣（沒寫就是都賣）。
 */
export type IconId =
  | 'box'
  | 'bowl'
  | 'bottle'
  | 'tea-can'
  | 'bag'
  | 'postcard'
  | 'tenugui'
  | 'keyholder'
  | 'neko'
  | 'shisa'
  | 'tori'
  | 'key'
  | 'parcel'

/**
 * 價錢的範圍（円，遊戲的規則）：同一樣東西固定是 min + step 的某個倍數（inventory.ts 的 priceOf 照品項的 key 算），
 * 不同的東西在範圍裡散開。min＝max 就是固定價。
 */
export interface PriceRange {
  min: number
  max: number
  step: number
}
const yen = (min: number, max = min, step = 100): PriceRange => ({ min, max, step })

export interface GameItem {
  id: string
  name: { ja: string; zh: string }
  /** 品項卡的類別 */
  kind: string
  icon: IconId
  price: PriceRange
  kits?: readonly Kit[]
  /** 不在賣店賣（房間鑰匙） */
  notForSale?: boolean
}

export const GAME_ITEMS: readonly GameItem[] = [
  { id: 'postcard', name: { ja: 'ポストカード', zh: '明信片' }, kind: '明信片', icon: 'postcard', price: yen(150) },
  { id: 'tenugui', name: { ja: '手ぬぐい', zh: '手巾' }, kind: '布小物', icon: 'tenugui', price: yen(800, 1200) },
  { id: 'keyholder', name: { ja: 'キーホルダー', zh: '鑰匙圈' }, kind: '小物', icon: 'keyholder', price: yen(500, 800) },
  { id: 'okimono-neko', name: { ja: 'ねこの置物', zh: '貓的擺飾' }, kind: '擺飾', icon: 'neko', price: yen(1500, 2500) },
  { id: 'okimono-tori', name: { ja: 'ことりの置物', zh: '小鳥的擺飾' }, kind: '擺飾', icon: 'tori', price: yen(1200, 2000), kits: ['kinki'] },
  { id: 'okimono-shisa', name: { ja: 'シーサーの置物', zh: '風獅爺擺飾' }, kind: '擺飾', icon: 'shisa', price: yen(1500, 2500), kits: ['okinawa'] },
  { id: 'room-key', name: { ja: '部屋の鍵', zh: '房間鑰匙' }, kind: '鑰匙', icon: 'key', price: yen(0), notForSale: true },
]

const byId = new Map(GAME_ITEMS.map((x) => [x.id, x]))
export const gameItem = (id: string) => byId.get(id)

/** 明信片可以用自己拍的照片：行李的 id 是 postcard@<照片 id> */
export const POSTCARD_PHOTO = '@'
export function postcardOf(id: string): { base: string; photo: string | null } {
  const i = id.indexOf(POSTCARD_PHOTO)
  return i < 0 ? { base: id, photo: null } : { base: id.slice(0, i), photo: id.slice(i + 1) }
}

/** 掉的東西（委託「找回掉的東西」）：一般的小東西，名字不是資料 */
export const LOST_THINGS: readonly { id: string; zh: string }[] = [
  { id: 'lost-tenugui', zh: '手巾' },
  { id: 'lost-key', zh: '鑰匙' },
  { id: 'lost-purse', zh: '零錢包' },
  { id: 'lost-glove', zh: '手套' },
  { id: 'lost-fan', zh: '扇子' },
  { id: 'lost-hat', zh: '帽子' },
]

/**
 * 價錢（円，遊戲的規則，不代表實際的價錢）：地區特色依類別，老舖依賣什麼（wagashi、tea、incense）。
 * 規格 §13 的參考：明信片 150、鑰匙圈 500–800、和菓子 800–2,000、郷土料理 900–2,500、茶屋坐下來 600。
 */
export const PRICE: Record<string, PriceRange> = {
  sweets: yen(800, 1600),
  drink: yen(500, 900, 50),
  tea: yen(800, 1500),
  sake: yen(1500, 3000),
  ramen: yen(600, 1200),
  craft: yen(1500, 4000),
  food: yen(900, 2500),
  kyodo: yen(900, 2500),
  produce: yen(500, 1200),
  fruit: yen(800, 2000),
  wagashi: yen(800, 2000),
  incense: yen(1000, 2500),
}
/** 類別不在 PRICE 裡的東西 */
export const PRICE_OTHER = yen(800, 1500)
/** 茶屋：坐下來喝一杯（円） */
export const SIT_PRICE = 600
