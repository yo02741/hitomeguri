import { shallowRef } from 'vue'

import type { CardFace, Rarity } from './card'

/**
 * 新卡入手（DESIGN.md §7.19）：在景點卡片按下「去過」時，收集卡轉著飛出來、亮相，
 * 再縮小飛進「紀錄」分頁。畫面在 App.vue 的 CardReveal；「減少動態」時不播。
 */
export interface Reveal {
  face: CardFace
  rarity: Rarity
  label: string
  number: string
  key: number
}

export const reveal = shallowRef<Reveal | null>(null)
let seq = 0

export function showReveal(r: Omit<Reveal, 'key'>) {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return
  reveal.value = { ...r, key: ++seq }
}
