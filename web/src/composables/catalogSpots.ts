import { computed, watch } from 'vue'

import { packOfId } from '../data/packs'
import type { MapSpot, PackItem } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'

/** 擴充包的點當成地圖上的點（行程的停留點用）：沒有分數、照片 */
export function packAsSpot(it: PackItem): MapSpot {
  return { id: it.id, n: it.n, z: it.z, lat: it.lat, lng: it.lng, k: 'major', f: 0, s: 0, h: it.h }
}

/** 依 {id, 縣} 找目錄裡的景點（載入相關縣的地圖 bundle）；擴充包的點（人孔蓋、角色商店…）載入所屬擴充包。行程的停留點用 */
export function useCatalogSpots(refs: () => Array<{ id: string; pref: string }>) {
  const catalog = useCatalogStore()
  const prefs = computed(() => [...new Set(refs().filter((r) => !packOfId(r.id)).map((r) => r.pref))].sort())
  watch(prefs, (ps) => ps.forEach((p) => void catalog.loadMap(p).catch(() => {})), { immediate: true })
  const packs = computed(() => [...new Set(refs().map((r) => packOfId(r.id)).filter((k): k is string => !!k))].sort())
  watch(packs, (ks) => ks.forEach((k) => void catalog.loadPack(k)), { immediate: true })

  const byId = computed(() => {
    const out = new Map<string, MapSpot>()
    for (const p of prefs.value) for (const s of catalog.mapSpots[p] ?? []) out.set(s.id, s)
    for (const k of packs.value) for (const it of catalog.packs[k] ?? []) out.set(it.id, packAsSpot(it))
    return out
  })
  const loading = computed(
    () =>
      prefs.value.some((p) => catalog.index?.prefectures[p] && !catalog.mapSpots[p]) ||
      packs.value.some((k) => catalog.index?.packs?.[k] && !catalog.packs[k]),
  )
  return { byId, loading }
}
