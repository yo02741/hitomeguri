import { rng, seedOf } from '../../services/pixelwalk/rng'
import { GAME_ITEMS, PRICE } from '../content/items'
import type { CalendarDate } from '../engine/clock'
import type { Game } from '../engine/game'

import { type DataIndex, dayKey, kitOfPref } from './data'
import { addItem, itemCard, type ItemCardData, itemKey, pay, shiniseWhat, TAKEAWAY } from './inventory'
import { systemsOf } from './state'
import type { ItemRef, Kit, ShopData } from './types'

/**
 * 店（規格 §8.5）：
 * - 車站賣店：這一縣的地區特色裡帶得走的（甜點、飲料、茶、酒、工藝…）＋遊戲自己的東西；沖繩的特色沒有帶得走的，
 *   只賣遊戲自己的東西＋茶屋的「這家店的茶」。每天輪換 6–8 樣（遊戲的規則：種子＝遊戲日期＋店）。明信片每天都有。
 * - 老舖：「這家店的和菓子」「這家店的茶」（資料沒有商品清單，不編商品名）。
 * - 茶屋：坐下來喝茶（時間往前、一句閒聊）＋這家店的茶。
 * - 食堂：這一縣的郷土料理（帶不走，吃了進「吃過的」），也每天換 6–8 樣。
 * 買、吃完自動存檔（呼叫的人做）。
 */
export interface StockEntry {
  key: string
  card: ItemCardData
  price: number
}

export interface Stock {
  kind: ShopData['shopKind']
  name: string
  entries: StockEntry[]
  /** 茶屋：坐下來喝茶的價錢 */
  sit?: number
}

const shuffle = <T>(list: readonly T[], seed: number): T[] => {
  const r = rng(seed)
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i)
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** 今天的 n 樣（6–8，少於 6 樣就全部）；pinned 一定在 */
export function rotate(pool: readonly string[], seed: number, pinned: readonly string[] = []): string[] {
  const n = 6 + (seed % 3)
  const rest = shuffle(
    pool.filter((k) => !pinned.includes(k)),
    seed,
  )
  const pick = [...pinned.filter((k) => pool.includes(k)), ...rest].slice(0, Math.max(n, pinned.length))
  // 架上的順序固定（照池子的順序），每天不會亂跳
  return pool.filter((k) => pick.includes(k))
}

/** 遊戲自己的東西（這一種地方賣的） */
export function gameStock(kit: Kit): string[] {
  return GAME_ITEMS.filter((g) => !g.notForSale && (!g.kits || g.kits.includes(kit))).map((g) => itemKey({ kind: 'game', id: g.id }))
}

/** 車站賣店的池子 */
export function stationPool(pref: string, data: DataIndex): string[] {
  const p = data.pref(pref)
  const kit = kitOfPref(pref)
  const specialties = (p?.specialties ?? []).filter((s) => TAKEAWAY.has(s.category)).map((s) => itemKey({ kind: 'specialty', id: s.id }))
  // 沖繩：特色沒有帶得走的，加茶屋的茶
  const teas = specialties.length
    ? []
    : (p?.shinise ?? []).filter((s) => shiniseWhat(s) === 'tea').map((s) => itemKey({ kind: 'shinise', id: `${s.id}#tea` }))
  return [...specialties, ...gameStock(kit), ...teas]
}

/** 食堂的池子：郷土料理（料理） */
export function shokudoPool(pref: string, data: DataIndex): string[] {
  return (data.pref(pref)?.specialties ?? []).filter((s) => s.category === 'kyodo' || s.category === 'food').map((s) => itemKey({ kind: 'specialty', id: s.id }))
}

/** 這一家今天賣什麼（同一天、同一家每次一樣） */
export function stockOf(shop: ShopData & { id: string }, pref: string, date: CalendarDate, data: DataIndex): Stock {
  const seed = seedOf(dayKey(date), shop.id)
  const entry = (key: string): StockEntry | null => {
    const card = itemCard(key, data)
    return card ? { key, card, price: card.price ?? 0 } : null
  }
  const given = shop.items?.length ? shop.items.map((r: ItemRef) => itemKey(r)) : null
  let keys: string[] = []
  let sit: number | undefined
  const sh = data.shop(shop.shiniseId)
  switch (shop.shopKind) {
    case 'station':
      keys = given ?? rotate(stationPool(pref, data), seed, [itemKey({ kind: 'game', id: 'postcard' })])
      break
    case 'shokudo':
      keys = given ?? rotate(shokudoPool(pref, data), seed)
      break
    case 'shinise':
    case 'teahouse': {
      const what = sh ? shiniseWhat(sh) : null
      keys = given ?? (sh && what ? [itemKey({ kind: 'shinise', id: `${sh.id}#${what}` })] : [])
      if (shop.shopKind === 'teahouse' || sh?.g === 'teahouse') sit = PRICE.sit
      break
    }
  }
  const name = shop.name ?? sh?.n ?? ''
  return { kind: shop.shopKind, name, entries: keys.map(entry).filter((e): e is StockEntry => !!e), sit }
}

export type BuyResult = 'ok' | 'money' | 'gone'

/** 買一樣：扣旅費、進行李（明信片可以帶照片 id） */
export function buy(game: Game, e: StockEntry, photo?: string | null): BuyResult {
  if (!e.card.keep) return 'gone'
  if (!pay(game, e.price)) return 'money'
  const key = photo && e.key === 'game:postcard' ? `game:postcard@${photo}` : e.key
  addItem(game, key)
  return 'ok'
}

/** 在食堂吃一樣：扣旅費、進「吃過的」、時間往前 */
export function eat(game: Game, e: StockEntry, minutes = 40): BuyResult {
  if (!pay(game, e.price)) return 'money'
  const id = e.key.replace(/^specialty:/, '')
  const s = systemsOf(game)
  const cur = s.eaten[id]
  s.eaten[id] = { d: cur?.d ?? dayKey(game.clock.date), n: (cur?.n ?? 0) + 1 }
  game.clock.advance(minutes)
  game.changed('items')
  return 'ok'
}

/** 茶屋：坐下來喝一杯（時間往前） */
export function sit(game: Game, price: number, minutes = 30): BuyResult {
  if (!pay(game, price)) return 'money'
  game.clock.advance(minutes)
  return 'ok'
}
