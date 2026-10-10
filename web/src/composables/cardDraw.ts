import { drawSeason, drawSeasonsAcross, missingSeasonCount, missingSeasons, type Variant } from '../services/cardVariants'
import { useCardsStore } from '../stores/cards'
import { cardKey, useFreshStore } from '../stores/fresh'
import { useWalletStore } from '../stores/wallet'

/**
 * 抽景點卡（DESIGN.md §7.19b）：抽獎券只抽還沒有的季節卡，抽到的存起來、標 NEW。
 * - drawFor：指定的景點抽一張（用一張抽獎券；free=true 是第一次去過的免費抽）
 * - drawAcross：收集冊的十連抽，從還缺季節的景點裡抽（依缺幾季加權，同一批不重複）
 * 抽完四季剛好收齊這個景點的全部樣式時，紀念卡（特別全景）也標 NEW。
 */
export interface DrawTarget {
  spotId: string
  /** 已經有的樣式 key */
  owned: string[]
  /** 季節以外的樣式（紀念卡除外）都有了：四季收齊就有紀念卡 */
  othersDone?: boolean
}

export function useCardDraw() {
  const cards = useCardsStore()
  const wallet = useWalletStore()
  const fresh = useFreshStore()

  function record(t: DrawTarget, list: Variant[], owned: Set<string>) {
    void cards.add(t.spotId, list)
    const keys = list.map((v) => cardKey(t.spotId, v.key))
    if (t.othersDone && !owned.has('special') && !missingSeasons(owned).length) keys.push(cardKey(t.spotId, 'special'))
    fresh.add(keys)
  }

  function drawFor(t: DrawTarget, free = false): Variant | null {
    if (!missingSeasons(t.owned).length) return null
    if (!free && !wallet.spend(1)) return null
    const v = drawSeason(t.owned)
    if (v) record(t, [v], new Set([...t.owned, v.key]))
    return v
  }

  /** 還缺季節的景點裡抽 n 張；回傳 [景點, 樣式]。抽獎券不夠或四季都收齊了回傳空陣列 */
  function drawAcross(targets: DrawTarget[], n = 10): Array<[DrawTarget, Variant]> {
    const byId = new Map(targets.map((t) => [t.spotId, t]))
    const count = Math.min(n, missingSeasonCount(targets.map((t) => t.owned)))
    if (!count || !wallet.spend(count)) return []
    const out = drawSeasonsAcross(new Map(targets.map((t) => [t.spotId, t.owned])), count).map(([id, v]): [DrawTarget, Variant] => [byId.get(id)!, v])
    const bySpot = new Map<DrawTarget, Variant[]>()
    for (const [t, v] of out) bySpot.set(t, [...(bySpot.get(t) ?? []), v])
    for (const [t, list] of bySpot) record(t, list, new Set([...t.owned, ...list.map((v) => v.key)]))
    return out
  }

  return { drawFor, drawAcross }
}
