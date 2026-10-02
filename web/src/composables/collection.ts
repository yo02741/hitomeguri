import { computed, watch } from 'vue'

import { packByKey } from '../data/packs'
import type { MapSpot } from '../services/bundles'
import { type CardFace, type CastleInfo, cardFromMapSpot, cardNumberFor, rarityLabel, rarityOf, type Rarity } from '../services/card'
import { allVariants, ownedVariants, type Variant } from '../services/cardVariants'
import { useCardsStore } from '../stores/cards'
import { useCatalogStore } from '../stores/catalog'
import type { Mark } from '../stores/marks'
import { useUserStore } from '../stores/user'

/** 收集冊的一張卡（DESIGN.md §7.19） */
export interface CollectionCard {
  face: CardFace
  rarity: Rarity
  label: string
  number: string
  castle: boolean
  score: number
  visitedOn: string | null
  /** 收集到的樣式（稀有的在前）與全部樣式的數量 */
  variants: Variant[]
  variantTotal: number
}

/**
 * 去過的景點 → 收集卡。卡面只用地圖 bundle（名稱、小圖、類型、文化指定），
 * 名城看擴充包「城」。擴充包的點（人孔蓋、老舖…）不做成卡。
 */
export function useCollection(entries: () => Array<[string, Mark]>, datesOf?: (id: string) => Array<string | null> | undefined) {
  const catalog = useCatalogStore()
  const userStore = useUserStore()
  const cardsStore = useCardsStore()
  const prefs = computed(() => [...new Set(entries().map(([, m]) => m.pref))])
  watch(prefs, (ps) => ps.forEach((p) => void catalog.loadMap(p)), { immediate: true })
  void catalog.loadPack('castle')

  const castleLabel = new Map(packByKey.get('castle')?.groups.map((g) => [g.key, g.label]))
  const castleBySpot = computed(() => {
    const out = new Map<string, CastleInfo>()
    for (const it of catalog.packs.castle ?? []) if (it.s && it.no) out.set(it.s, { no: it.no, label: castleLabel.get(it.g) ?? '' })
    return out
  })

  const spotsById = computed(() => {
    const out = new Map<string, MapSpot>()
    for (const p of prefs.value) for (const s of catalog.mapSpots[p] ?? []) out.set(s.id, s)
    return out
  })
  const cards = computed<CollectionCard[]>(() =>
    entries().flatMap(([id, mark]) => {
      const s = spotsById.value.get(id)
      if (!s) return []
      const castle = castleBySpot.value.get(id)
      const rarity = rarityOf(s.d, Boolean(castle))
      const dates = datesOf?.(id) ?? [mark.visited_on ?? null]
      return [
        {
          face: cardFromMapSpot(s, mark.pref),
          rarity,
          variants: ownedVariants(userStore.user?.uid ?? '', id, dates, rarity, cardsStore.extraOf(id)),
          variantTotal: allVariants(rarity).length,
          label: rarityLabel(s.d, castle),
          number: cardNumberFor(id, catalog.mapSpots[mark.pref], castle, s.d),
          castle: Boolean(castle),
          score: s.s,
          visitedOn: mark.visited_on ?? null,
        },
      ]
    }),
  )
  /** 地圖 bundle 還沒載入的縣：縣 → 還在等的張數 */
  const pendingByPref = computed(() => {
    const out = new Map<string, number>()
    for (const [, m] of entries()) {
      if (catalog.index?.prefectures[m.pref] && !catalog.mapSpots[m.pref]) out.set(m.pref, (out.get(m.pref) ?? 0) + 1)
    }
    return out
  })

  // 名城進度：擴充包「城」的點，景點或名城本身標了去過都算
  const visitedIds = computed(() => new Set(entries().map(([id]) => id)))
  const castleTotal = computed(() => catalog.index?.packs?.castle?.count ?? catalog.packs.castle?.length ?? 0)
  const castleDone = computed(
    () => (catalog.packs.castle ?? []).filter((it) => visitedIds.value.has(it.id) || (it.s && visitedIds.value.has(it.s))).length,
  )
  const prefDone = computed(() => new Set(prefs.value))

  return { cards, pendingByPref, castleTotal, castleDone, prefDone }
}
