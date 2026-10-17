import type { Kit } from '../systems/types'

/**
 * 遊戲自己的東西（規格 §8.5、§11 的 ItemRef kind 'game'）：明信片、手ぬぐい、鑰匙圈、小置物、房間鑰匙。
 * 圖案是遊戲自己畫的，名字是一般的東西的名字；說明不帶任何事實（沒有出處、沒有產地、沒有由來）。
 * 價錢是遊戲的規則（文）。kits：哪一種地方的賣店會賣（沒寫就是都賣）。
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

export interface GameItem {
  id: string
  name: { ja: string; zh: string }
  /** 品項卡的類別 */
  kind: string
  icon: IconId
  price: number
  kits?: readonly Kit[]
  /** 不在賣店賣（房間鑰匙） */
  notForSale?: boolean
}

export const GAME_ITEMS: readonly GameItem[] = [
  { id: 'postcard', name: { ja: 'ポストカード', zh: '明信片' }, kind: '明信片', icon: 'postcard', price: 150 },
  { id: 'tenugui', name: { ja: '手ぬぐい', zh: '手巾' }, kind: '布小物', icon: 'tenugui', price: 800 },
  { id: 'keyholder', name: { ja: 'キーホルダー', zh: '鑰匙圈' }, kind: '小物', icon: 'keyholder', price: 500 },
  { id: 'okimono-neko', name: { ja: 'ねこの置物', zh: '貓的擺飾' }, kind: '擺飾', icon: 'neko', price: 1200 },
  { id: 'okimono-tori', name: { ja: 'ことりの置物', zh: '小鳥的擺飾' }, kind: '擺飾', icon: 'tori', price: 1000, kits: ['kinki'] },
  { id: 'okimono-shisa', name: { ja: 'シーサーの置物', zh: '風獅爺擺飾' }, kind: '擺飾', icon: 'shisa', price: 1200, kits: ['okinawa'] },
  { id: 'room-key', name: { ja: '部屋の鍵', zh: '房間鑰匙' }, kind: '鑰匙', icon: 'key', price: 0, notForSale: true },
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

/** 價錢（文，遊戲的規則）：地區特色依類別，老舖依賣什麼 */
export const PRICE: Record<string, number> = {
  sweets: 700,
  drink: 800,
  tea: 900,
  sake: 1500,
  ramen: 900,
  craft: 1400,
  food: 900,
  kyodo: 900,
  produce: 800,
  fruit: 800,
  wagashi: 700,
  incense: 1000,
  teahouse: 600,
  sit: 400,
}
