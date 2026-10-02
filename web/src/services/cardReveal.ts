import { shallowRef } from 'vue'

import type { CardFace, Rarity } from './card'
import type { Variant } from './cardVariants'

/**
 * 新卡入手（DESIGN.md §7.19）：在景點卡片按下「去過」時，收集卡轉著飛出來、亮相，
 * 再縮小飛進「紀錄」分頁。畫面在 App.vue 的 CardReveal；「減少動態」時只淡入淡出（讀屏一樣會唸出拿到哪一張）。
 */
export interface Reveal {
  face: CardFace
  rarity: Rarity
  label: string
  number: string
  /** 這個縣第一個去過的景點：蓋上縣的紀念章 */
  firstInPref?: boolean
  /** 這次抽到的樣式（最稀有的那張） */
  variant?: Variant
  key: number
  /** 開始的時間（Date.now()）：落定時拿這之後新達成的成就（stores/achievements.ts 的 takeRecent） */
  at: number
}

export const reveal = shallowRef<Reveal | null>(null)
let seq = 0

export function showReveal(r: Omit<Reveal, 'key' | 'at'>) {
  reveal.value = { ...r, key: ++seq, at: Date.now() }
}
