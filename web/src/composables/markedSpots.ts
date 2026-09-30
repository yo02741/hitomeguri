import { computed, watch } from 'vue'

import { packOfId } from '../data/packs'
import { regions } from '../data/regions'
import type { MapSpot, PackItem } from '../services/bundles'
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

  // 擴充包的點（去過的城、老舖…）：載入所屬擴充包
  const packs = computed(() => [...new Set(entries().map(([id]) => packOfId(id)).filter((k): k is string => !!k))])
  watch(packs, (ks) => ks.forEach((k) => void catalog.loadPack(k)), { immediate: true })

  const byId = computed(() => {
    const out = new Map<string, MapSpot>()
    for (const p of prefs.value) for (const s of catalog.mapSpots[p] ?? []) out.set(s.id, s)
    return out
  })
  const packById = computed(() => {
    const out = new Map<string, PackItem>()
    for (const k of packs.value) for (const it of catalog.packs[k] ?? []) out.set(it.id, it)
    return out
  })
  const loading = computed(
    () =>
      prefs.value.some((p) => catalog.index?.prefectures[p] && !catalog.mapSpots[p]) ||
      packs.value.some((k) => catalog.index?.packs?.[k] && !catalog.packs[k]),
  )

  // 依縣（JIS 順）、同縣依分數
  const rows = computed<MarkedSpot[]>(() =>
    entries()
      .map(([id, mark]) => {
        const it = packById.value.get(id)
        if (it) {
          return {
            id,
            pref: mark.pref,
            name: it.n,
            kana: it.h,
            zh: it.z,
            lat: it.lat,
            lng: it.lng,
            score: 0,
            missing: false,
            mark,
          }
        }
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
