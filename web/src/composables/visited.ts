import { computed } from 'vue'

import { dayDate, tripStatus } from '../services/trip'
import { type Mark, useMarksStore } from '../stores/marks'
import { useTripsStore } from '../stores/trips'

/**
 * 去過的景點（UX-FLOW.md §3）：已結束的行程裡的停留點 ∪ 標了去過的景點。
 * 同一個景點以自己標的為準（日期以自己填的優先，沒填再用行程那天）。
 */
export function useVisitedEntries() {
  const marks = useMarksStore()
  const trips = useTripsStore()
  const doneTrips = computed(() => trips.sorted.filter((t) => tripStatus(t, trips.today) === 'done'))
  const entries = computed<Array<[string, Mark]>>(() => {
    const out = new Map<string, Mark>()
    for (const t of doneTrips.value) {
      t.days.forEach((d, i) => {
        for (const s of d.stops) {
          if (!out.has(s.spot_id)) out.set(s.spot_id, { pref: s.pref, name: s.name, visited: true, visited_on: dayDate(t, i) })
        }
      })
    }
    for (const [id, m] of marks.visited) out.set(id, { ...m, visited_on: m.visited_on ?? out.get(id)?.visited_on })
    return [...out.entries()]
  })
  return { doneTrips, entries }
}
