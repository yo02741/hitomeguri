import { defineStore } from 'pinia'
import { shallowRef, triggerRef } from 'vue'

import {
  type BundleIndex,
  fetchDetail,
  fetchFlights,
  fetchSpecialties,
  type FlightRoute,
  type Specialty,
  fetchIndex,
  fetchMap,
  type MapSpot,
  type Spot,
} from '../services/bundles'

// 景點目錄：只讀，來自靜態 bundle。資料量大，用 shallowRef 避免深層響應。
export const useCatalogStore = defineStore('catalog', () => {
  const index = shallowRef<BundleIndex | null>(null)
  const mapSpots = shallowRef<Record<string, MapSpot[]>>({})
  const details = shallowRef<Record<string, Record<string, Spot>>>({})
  const prefOfSpot = new Map<string, string>()
  const pending = new Map<string, Promise<unknown>>()

  function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!pending.has(key)) pending.set(key, fn().finally(() => pending.delete(key)))
    return pending.get(key) as Promise<T>
  }

  async function loadIndex(): Promise<BundleIndex> {
    if (index.value) return index.value
    return once('index', async () => {
      try {
        index.value = await fetchIndex()
      } catch {
        index.value = { prefectures: {} }
      }
      return index.value
    })
  }

  function available(): string[] {
    return Object.keys(index.value?.prefectures ?? {})
  }

  async function loadMap(pref: string): Promise<MapSpot[]> {
    await loadIndex()
    const meta = index.value?.prefectures[pref]
    if (!meta) return []
    if (mapSpots.value[pref]) return mapSpots.value[pref]
    return once(`map:${pref}`, async () => {
      const spots = await fetchMap(pref, meta.version)
      for (const s of spots) prefOfSpot.set(s.id, pref)
      mapSpots.value[pref] = spots
      triggerRef(mapSpots)
      return spots
    })
  }

  async function loadAllMaps(): Promise<void> {
    await loadIndex()
    await Promise.all(available().map((p) => loadMap(p)))
  }

  async function loadDetail(pref: string): Promise<Record<string, Spot>> {
    await loadIndex()
    const meta = index.value?.prefectures[pref]
    if (!meta) return {}
    if (details.value[pref]) return details.value[pref]
    return once(`detail:${pref}`, async () => {
      const list = await fetchDetail(pref, meta.version)
      details.value[pref] = Object.fromEntries(list.map((s) => [s.id, s]))
      triggerRef(details)
      return details.value[pref]
    })
  }

  /** 依 id 取完整景點；若不知道在哪個縣，先載入全部地圖 bundle 找出來。 */
  async function getSpot(id: string): Promise<Spot | null> {
    let pref = prefOfSpot.get(id)
    if (!pref) {
      await loadAllMaps()
      pref = prefOfSpot.get(id)
    }
    if (!pref) return null
    const d = await loadDetail(pref)
    return d[id] ?? null
  }

  const specialties = shallowRef<Specialty[]>([])
  const flights = shallowRef<FlightRoute[]>([])

  async function loadExtras(): Promise<void> {
    await once('extras', async () => {
      const [s, f] = await Promise.all([fetchSpecialties(), fetchFlights()])
      specialties.value = s
      flights.value = f
    })
  }

  return { index, mapSpots, details, specialties, flights, loadExtras, loadIndex, available, loadMap, loadAllMaps, loadDetail, getSpot }
})
