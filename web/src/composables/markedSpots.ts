import { computed, watch } from 'vue'

import { regions } from '../data/regions'
import type { MapSpot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import type { Mark } from '../stores/marks'

/** 收藏、清單、去過的一筆：mark 加上目錄裡的名稱與座標（載入所在縣的地圖 bundle） */
export interface MarkedSpot {
  id: string
  pref: string
  name: string
  kana?: string
  zh?: string
  romaji?: string
  lat?: number
  lng?: number
  score: number
  /** 目錄裡已經沒有這個景點（資料更新時移除）：只剩 mark 裡存的名稱 */
  missing: boolean
  mark: Mark
}

const PREF_ORDER = new Map(regions.map((r, i) => [r.prefecture, i]))

export function useMarkedSpots(entries: () => Array<[string, Mark]>) {
  const catalog = useCatalogStore()
  const prefs = computed(() => [...new Set(entries().map(([, m]) => m.pref))])
  watch(prefs, (ps) => ps.forEach((p) => void catalog.loadMap(p)), { immediate: true })

  const byId = computed(() => {
    const out = new Map<string, MapSpot>()
    for (const p of prefs.value) for (const s of catalog.mapSpots[p] ?? []) out.set(s.id, s)
    return out
  })
  const loading = computed(() =>
    prefs.value.some((p) => catalog.index?.prefectures[p] && !catalog.mapSpots[p]),
  )

  // 依縣（JIS 順）、同縣依分數
  const rows = computed<MarkedSpot[]>(() =>
    entries()
      .map(([id, mark]) => {
        const s = byId.value.get(id)
        return {
          id,
          pref: mark.pref,
          name: s?.n ?? mark.name,
          kana: s?.h,
          zh: s?.z && s.z !== s.n ? s.z : undefined,
          romaji: s?.r,
          lat: s?.lat,
          lng: s?.lng,
          score: s?.s ?? 0,
          missing: !s && !loading.value,
          mark,
        }
      })
      .sort(
        (a, b) =>
          (PREF_ORDER.get(a.pref) ?? 99) - (PREF_ORDER.get(b.pref) ?? 99) || b.score - a.score || a.name.localeCompare(b.name, 'ja'),
      ),
  )

  return { rows, loading }
}
