import type { Game } from '../engine/game'

import type { ShopKind } from './types'

/**
 * 旅費（規格 §13 第 3 點，使用者選了「円＋現金＋信用卡」）：
 * - 單位是「円」。現金是引擎的 state.money；刷卡沒有額度上限（遊戲規則），只記累計（手帳「行李」寫「刷卡 n 円」）。
 * - 新遊戲現金 50,000 円（NEW_GAME_YEN）。舊存檔（旅費是「文」）第一次讀進來時 ×10，並且至少 50,000 円；
 *   進行中的委託的報酬換成円的報酬表（quests.ts 的 REWARD）。
 * - 能刷卡的店：車站賣店與機場的賣店（shopKind 'station'）。老舖、茶屋、食堂（還有祭典的攤子）只收現金。
 *
 * 換算的記號與刷卡累計放在 state.flags（不放 ext.systems）：部署之後還開著的舊分頁讀寫存檔時，
 * 引擎的 flags 原樣留著，記號不會掉（掉了就會再 ×10 一次）。
 */
export const CURRENCY = '円'
export const NEW_GAME_YEN = 50_000
/** 舊存檔「文」→ 円 */
export const MON_TO_YEN = 10

/** flags 的 key：已經換成円了（1）、刷卡累計（円） */
export const YEN_FLAG = 'wallet:yen'
export const CARD_FLAG = 'wallet:card'

export type PayMethod = 'cash' | 'card'

/** 現金不夠（只收現金的店、茶屋坐下來、食堂） */
export const CASH_SHORT = '現金不夠。'
/** 店裡的牌子 */
export const CASH_ONLY = '只收現金'

/** 金額 → 「1,500 円」 */
export const yenText = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString('ja-JP')} ${CURRENCY}`

/** 這種店能不能刷卡（車站、機場的賣店可以；老舖、茶屋、食堂只收現金） */
export const acceptsCard = (kind: ShopKind | undefined) => kind === 'station'

/** 刷卡累計（円） */
export function cardTotal(game: Game): number {
  const v = game.state.flags[CARD_FLAG]
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0
}

export interface Wallet {
  /** 現金（円） */
  cash: number
  /** 刷卡累計（円） */
  card: number
}
export const walletOf = (game: Game): Wallet => ({ cash: Math.max(0, Math.round(game.state.money)), card: cardTotal(game) })

/**
 * 付錢：現金不夠就不扣（回傳 false）；刷卡沒有上限，記進累計。
 */
export function payWith(game: Game, price: number, method: PayMethod): boolean {
  const p = Math.max(0, Math.round(price))
  const s = game.state
  if (method === 'card') {
    s.flags[CARD_FLAG] = cardTotal(game) + p
    game.changed('money')
    return true
  }
  if (s.money < p) return false
  s.money -= p
  game.changed('money')
  return true
}

/** 現金夠不夠 */
export const canPayCash = (game: Game, price: number) => game.state.money >= Math.max(0, Math.round(price))

/**
 * 換成円（每次進一張地圖時看一次；已經換過就不動）：
 * - 新遊戲（還沒有任何紀錄：沒有 systems 的存檔、行李、印、照片）：現金至少 NEW_GAME_YEN
 *   （引擎的 NEW_GAME_MONEY 也是 50,000）。
 * - 舊存檔：現金 ×10，至少 NEW_GAME_YEN。
 * 回傳有沒有換（換了的話呼叫的人把進行中的委託的報酬也換掉）。
 */
export function ensureYen(game: Game): 'fresh' | 'migrated' | null {
  const s = game.state
  if (s.flags[YEN_FLAG]) return null
  const fresh = s.ext.systems === undefined && !Object.keys(s.items).length && !s.stamps.length && !s.album.length
  const cash = Math.max(0, Math.round(s.money))
  s.money = Math.max(fresh ? cash : cash * MON_TO_YEN, NEW_GAME_YEN)
  s.flags[YEN_FLAG] = 1
  game.changed('money')
  return fresh ? 'fresh' : 'migrated'
}
