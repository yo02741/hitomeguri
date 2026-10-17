import { seedOf } from '../../services/pixelwalk/rng'
import { gameItem, type IconId, postcardOf, PRICE, PRICE_OTHER, type PriceRange } from '../content/items'
import type { Game } from '../engine/game'
import type { SourceRef } from '../engine/types'

import { type DataIndex, nameOf, type PlaceName } from './data'
import { systemsOf } from './state'
import { licenseOf, sourceOf, type SummaryLine, summaryLine } from './summary'
import { payWith } from './wallet'
import type { ItemRef, PackLike, SpecialtyLike } from './types'

/**
 * 行李（規格 §8.5、§11）：引擎的 state.items 存「key → 數量」，key 是 ItemRef 的 kind:id：
 *   specialty:<地區特色 id>、shinise:<老舖 id>#wagashi|tea|incense、game:<遊戲的東西 id>（明信片用照片：game:postcard@<照片 id>）、
 *   quest:<委託 id>（委託要送的東西，送到就沒了）。
 * 品項卡的資料（真名、類別、簡介第一句、出處、授權、像素小圖的模板）都從這裡算；遊戲自己的東西不寫任何事實。
 */
export const itemKey = (r: ItemRef) => `${r.kind}:${r.id}`

export function parseKey(key: string): ItemRef | { kind: 'quest'; id: string } | null {
  const i = key.indexOf(':')
  if (i < 0) return null
  const kind = key.slice(0, i)
  const id = key.slice(i + 1)
  if (!id) return null
  if (kind === 'specialty' || kind === 'shinise' || kind === 'game' || kind === 'quest') return { kind, id }
  return null
}

/** 地區特色的類別 → 品項卡上的字 */
export const CATEGORY_LABEL: Record<string, string> = {
  kyodo: '郷土料理',
  food: '料理',
  ramen: '拉麵',
  sweets: '甜點',
  drink: '飲料',
  tea: '茶',
  sake: '酒',
  craft: '工藝',
  fruit: '水果',
  produce: '農產',
}

/** 帶得走的（車站賣店賣、可以放架子）：郷土料理、料理在食堂吃 */
export const TAKEAWAY = new Set(['sweets', 'drink', 'tea', 'sake', 'ramen', 'craft', 'fruit', 'produce'])
export const isTakeaway = (s: SpecialtyLike) => TAKEAWAY.has(s.category)

const CATEGORY_ICON: Record<string, IconId> = {
  sweets: 'box',
  craft: 'box',
  drink: 'bottle',
  sake: 'bottle',
  tea: 'tea-can',
  ramen: 'bag',
  fruit: 'bag',
  produce: 'bag',
  kyodo: 'bowl',
  food: 'bowl',
}

/** 老舖・茶屋賣的東西：資料沒有商品清單，只有「這家店的和菓子」「這家店的茶」（香舖是「這家店的香」） */
export type ShiniseWhat = 'wagashi' | 'tea' | 'incense'
export function shiniseWhat(s: PackLike): ShiniseWhat | null {
  if (s.g === 'wagashi') return 'wagashi'
  if (s.g === 'tea' || s.g === 'teahouse') return 'tea'
  if (s.g === 'incense') return 'incense'
  return null
}
const WHAT: Record<ShiniseWhat, { ja: string; zh: string; kind: string; icon: IconId }> = {
  wagashi: { ja: 'の和菓子', zh: '的和菓子', kind: '和菓子', icon: 'box' },
  tea: { ja: 'のお茶', zh: '的茶', kind: '茶', icon: 'tea-can' },
  incense: { ja: 'のお香', zh: '的香', kind: '香', icon: 'box' },
}

export interface ItemCardData {
  key: string
  name: PlaceName
  /** 類別 */
  kind: string
  icon: IconId
  summary?: SummaryLine
  /** 出處（特色的簡介、老舖的頁面） */
  source?: SourceRef
  license?: string
  /** 老舖：店名、創業（有 f 才寫，附出處） */
  shop?: { name: string; kana?: string; founded?: string; source?: SourceRef }
  /** 明信片：用的照片 */
  photo?: string
  price?: number
  /** 帶得走（可以放在架子上） */
  keep: boolean
}

/** 價錢（円）：類別的範圍裡，同一樣東西固定的一個價（遊戲的規則：照品項的 key 算，每天一樣） */
export function priceOf(range: PriceRange, key: string): number {
  if (range.max <= 0) return 0
  const step = Math.max(1, range.step)
  const n = Math.max(0, Math.floor((range.max - range.min) / step))
  return range.min + (seedOf(key) % (n + 1)) * step
}

/** 特色的小圖：照類別；名字有「茶」的（宇治茶、抹茶…類別是飲料的也一樣）是茶筒 */
export function specialtyIcon(s: { category: string; name: { ja: string; zh_tw?: string } }): IconId {
  if (/茶/.test(s.name.ja) || /茶/.test(s.name.zh_tw ?? '')) return 'tea-can'
  return CATEGORY_ICON[s.category] ?? 'box'
}

/** 行李的 key → 品項卡；資料裡找不到（另一縣的資料還沒讀到）回 null */
export function itemCard(key: string, data: DataIndex): ItemCardData | null {
  const r = parseKey(key)
  if (!r) return null
  if (r.kind === 'specialty') {
    const s = data.specialty(r.id)
    if (!s) return null
    const sum = summaryLine(s.summary)
    return {
      key,
      name: nameOf(s.name),
      kind: CATEGORY_LABEL[s.category] ?? s.category,
      icon: specialtyIcon(s),
      summary: sum ?? undefined,
      source: sum?.source,
      license: sum ? licenseOf(sum.source.url, sum.license) : undefined,
      price: priceOf(PRICE[s.category] ?? PRICE_OTHER, key),
      keep: isTakeaway(s),
    }
  }
  if (r.kind === 'shinise') {
    const [id, w] = r.id.split('#') as [string, string | undefined]
    const s = data.shop(id)
    if (!s) return null
    const what = (w as ShiniseWhat | undefined) ?? shiniseWhat(s)
    const t = what ? WHAT[what] : null
    if (!t || !what) return null
    const src = sourceOf(s.u)
    const foundedSrc = s.f ? sourceOf(s.w ?? (/wikipedia\.org/.test(s.u) ? s.u : null)) : null
    return {
      key,
      name: { ja: `${s.n}${t.ja}`, zh: `${s.z ?? s.n}${t.zh}` },
      kind: t.kind,
      icon: t.icon,
      source: src ?? undefined,
      license: licenseOf(s.u),
      shop: { name: s.n, kana: s.h, founded: foundedSrc ? s.f : undefined, source: foundedSrc ?? undefined },
      price: priceOf(PRICE[what] ?? PRICE_OTHER, key),
      keep: true,
    }
  }
  if (r.kind === 'game') {
    const { base, photo } = postcardOf(r.id)
    const g = gameItem(base)
    if (!g) return null
    return { key, name: { ja: g.name.ja, zh: g.name.zh }, kind: g.kind, icon: g.icon, photo: photo ?? undefined, price: priceOf(g.price, `game:${base}`), keep: true }
  }
  return null
}

/** 委託要送的東西：顯示成「委託的東西」＋那樣東西的名字 */
export function questItemCard(key: string, data: DataIndex, game: Game): ItemCardData | null {
  const r = parseKey(key)
  if (r?.kind !== 'quest') return itemCard(key, data)
  const q = systemsOf(game).quests.active.find((x) => x.id === r.id)
  const inner = q?.item ? itemCard(q.item, data) : null
  if (!inner) return null
  return { ...inner, key, kind: '委託的東西', icon: 'parcel', price: undefined, keep: false }
}

export function addItem(game: Game, key: string, n = 1) {
  const s = game.state
  s.items[key] = (s.items[key] ?? 0) + Math.max(1, Math.round(n))
  game.changed('items')
}

export function removeItem(game: Game, key: string, n = 1): boolean {
  const s = game.state
  const have = s.items[key] ?? 0
  const k = Math.max(1, Math.round(n))
  if (have < k) return false
  if (have === k) delete s.items[key]
  else s.items[key] = have - k
  game.changed('items')
  return true
}

/** 付現金（円）：不夠就不扣，回傳 false（刷卡用 wallet.ts 的 payWith） */
export function pay(game: Game, price: number): boolean {
  return payWith(game, price, 'cash')
}

export function earn(game: Game, amount: number) {
  game.state.money += Math.max(0, Math.round(amount))
  game.changed('money')
}
