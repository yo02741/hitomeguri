import type { Rarity } from '../services/card'
import { drawOne, missingVariants, type Variant } from '../services/cardVariants'
import { useCardsStore } from '../stores/cards'
import { cardKey, useFreshStore } from '../stores/fresh'
import { useWalletStore } from '../stores/wallet'

/**
 * 抽景點卡（DESIGN.md §7.19b）：只抽還沒有的樣式，抽到的存起來、標 NEW。
 * - drawFor：指定的景點抽一張（用一張抽獎券；free=true 是第一次去過的免費抽）
 * - drawAcross：收集冊的十連抽，從還沒收齊的景點裡抽（同一批不重複）
 */
export interface DrawTarget {
  spotId: string
  rarity: Rarity
  /** 有沒有真的夜景照片（沒有就沒有夜景卡） */
  night: boolean
  /** 已經有的樣式 key */
  owned: string[]
}

export function useCardDraw() {
  const cards = useCardsStore()
  const wallet = useWalletStore()
  const fresh = useFreshStore()

  function record(spotId: string, list: Variant[]) {
    void cards.add(spotId, list)
    fresh.add(list.map((v) => cardKey(spotId, v.key)))
  }

  function drawFor(t: DrawTarget, free = false): Variant | null {
    if (!missingVariants(t.rarity, t.night, t.owned).length) return null
    if (!free && !wallet.spend(1)) return null
    const v = drawOne(t.rarity, t.night, t.owned)
    if (v) record(t.spotId, [v])
    return v
  }

  /** 還沒收齊的景點裡抽 n 張；回傳 [景點 id, 樣式]。抽獎券不夠或都收齊了回傳空陣列 */
  function drawAcross(targets: DrawTarget[], n = 10): Array<[DrawTarget, Variant]> {
    const owned = new Map(targets.map((t) => [t.spotId, new Set(t.owned)]))
    const remaining = () => targets.map((t) => [t, missingVariants(t.rarity, t.night, owned.get(t.spotId)!).length] as const).filter(([, k]) => k > 0)
    const count = Math.min(n, remaining().reduce((s, [, k]) => s + k, 0))
    if (!count || !wallet.spend(count)) return []
    const out: Array<[DrawTarget, Variant]> = []
    for (let i = 0; i < count; i++) {
      // 景點依還缺幾種加權
      const rem = remaining()
      let r = Math.random() * rem.reduce((s, [, k]) => s + k, 0)
      let t = rem[rem.length - 1]![0]
      for (const [x, k] of rem) {
        r -= k
        if (r < 0) {
          t = x
          break
        }
      }
      const have = owned.get(t.spotId)!
      const v = drawOne(t.rarity, t.night, have)
      if (!v) continue
      have.add(v.key)
      out.push([t, v])
    }
    const bySpot = new Map<string, Variant[]>()
    for (const [t, v] of out) bySpot.set(t.spotId, [...(bySpot.get(t.spotId) ?? []), v])
    for (const [id, list] of bySpot) record(id, list)
    return out
  }

  return { drawFor, drawAcross }
}
