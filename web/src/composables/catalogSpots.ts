import { computed, watch } from 'vue'

import type { MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'

/** 依 {id, 縣} 找目錄裡的景點（載入相關縣的地圖 bundle）：行程的停留點用 */
export function useCatalogSpots(refs: () => Array<{ id: string; pref: string }>) {
  const catalog = useCatalogStore()
  const prefs = computed(() => [...new Set(refs().map((r) => r.pref))].sort())
  watch(prefs, (ps) => ps.forEach((p) => void catalog.loadMap(p)), { immediate: true })

  const byId = computed(() => {
    const out = new Map<string, MapSpot>()
    for (const p of prefs.value) for (const s of catalog.mapSpots[p] ?? []) out.set(s.id, s)
    return out
  })
  const loading = computed(() => prefs.value.some((p) => catalog.index?.prefectures[p] && !catalog.mapSpots[p]))
  return { byId, loading }
}
