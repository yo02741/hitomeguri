import { computed } from 'vue'

import { ownedVariants, type SpotRecord, type Variant } from '../services/cardVariants'
import { dayDate } from '../services/trip'
import { useCardsStore } from '../stores/cards'
import { useVisitedEntries } from './visited'

/**
 * 一個景點收集到的樣式（DESIGN.md §7.19a）：去過的日期、抽到的季節、勾了的任務、已結束的行程，
 * 都從現在的紀錄算出來（services/cardVariants.ts 的 ownedVariants）。
 */
export function useSpotVariants() {
  const cards = useCardsStore()
  const { doneTrips, datesById } = useVisitedEntries()

  /** 景點 → 第一趟包含它、已結束的行程（名稱與那天的日期） */
  const tripBySpot = computed(() => {
    const out = new Map<string, { name: string; date: string | null }>()
    const trips = [...doneTrips.value].sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    for (const t of trips) {
      t.days.forEach((d, i) => {
        for (const s of d.stops) if (!out.has(s.spot_id)) out.set(s.spot_id, { name: t.name || '未命名行程', date: dayDate(t, i) ?? null })
      })
    }
    return out
  })

  /** dates 沒給時用全部去過的日期 */
  function recordOf(spotId: string, night: boolean, dates?: ReadonlyArray<string | null | undefined>): SpotRecord {
    return {
      dates: dates ?? datesById.value.get(spotId) ?? [],
      night,
      tasks: cards.tasksOf(spotId),
      trip: tripBySpot.value.get(spotId) ?? null,
      drawn: cards.codesOf(spotId),
    }
  }
  function variantsOf(spotId: string, night: boolean, dates?: ReadonlyArray<string | null | undefined>): Variant[] {
    return ownedVariants(recordOf(spotId, night, dates))
  }

  return { tripBySpot, datesById, recordOf, variantsOf }
}
