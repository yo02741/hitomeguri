import { defineStore } from 'pinia'
import { computed, ref, shallowRef, triggerRef } from 'vue'

import {
  type AchvData,
  type BundleIndex,
  fetchAchievements,
  type Festival,
  fetchDetail,
  fetchFeatured,
  fetchFestivals,
  fetchFlights,
  fetchPhrases,
  fetchTimed,
  fetchSeasons,
  fetchPrefSpecialties,
  fetchSpecialties,
  type FlightRoute,
  type Specialty,
  fetchIndex,
  fetchMap,
  fetchPack,
  fetchRail,
  fetchSearch,
  type MapSpot,
  type PackItem,
  type RailBundle,
  type SeasonData,
  type TimedItem,
  type Spot,
} from '../services/bundles'

// 景點目錄：只讀，來自靜態 bundle。資料量大，用 shallowRef 避免深層響應。
export const useCatalogStore = defineStore('catalog', () => {
  const index = shallowRef<BundleIndex | null>(null)
  const mapSpots = shallowRef<Record<string, MapSpot[]>>({})
  const details = shallowRef<Record<string, Record<string, Spot>>>({})
  /** 地圖 bundle 讀取失敗的縣（清單顯示「讀不到」與重試；重試成功就拿掉） */
  const mapFailed = shallowRef(new Set<string>())
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
      let spots: MapSpot[]
      try {
        spots = await fetchMap(pref, meta.version)
      } catch (e) {
        mapFailed.value.add(pref)
        triggerRef(mapFailed)
        throw e
      }
      if (mapFailed.value.delete(pref)) triggerRef(mapFailed)
      for (const s of spots) prefOfSpot.set(s.id, pref)
      mapSpots.value[pref] = spots
      triggerRef(mapSpots)
      return spots
    })
  }

  /** 一個縣的景點清單：讀取中、讀取失敗（可重試）、讀好了（可能沒有景點） */
  function mapState(pref: string): 'loading' | 'failed' | 'ready' {
    if (mapSpots.value[pref]) return 'ready'
    if (mapFailed.value.has(pref)) return 'failed'
    if (index.value && !index.value.prefectures[pref]) return 'ready'
    return 'loading'
  }

  /** 各縣精選：首頁與還沒載入完整地圖 bundle 的縣用這份 */
  const featured = shallowRef<Record<string, MapSpot[]>>({})
  async function loadFeatured(): Promise<void> {
    await loadIndex()
    if (Object.keys(featured.value).length) return
    await once('featured', async () => {
      const v = Object.values(index.value?.prefectures ?? {})
        .map((m) => m.version.slice(0, 4))
        .join('')
      try {
        featured.value = await fetchFeatured(v)
      } catch {
        featured.value = {}
      }
      for (const [pref, spots] of Object.entries(featured.value)) {
        for (const s of spots) if (!prefOfSpot.has(s.id)) prefOfSpot.set(s.id, pref)
      }
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
    await loadFeatured()
    let pref = prefOfSpot.get(id)
    if (!pref) {
      await loadAllMaps()
      pref = prefOfSpot.get(id)
    }
    if (!pref) return null
    const d = await loadDetail(pref)
    return d[id] ?? null
  }

  /** 地區特色：一縣一檔，用到哪幾縣才載入哪幾縣（深度探索、旅前準備）。specialties 是已載入的全部 */
  const specialtiesByPref = shallowRef<Record<string, Specialty[]>>({})
  const specialties = computed(() => Object.values(specialtiesByPref.value).flat())
  async function loadSpecialties(prefs: string[]): Promise<void> {
    await loadIndex()
    const per = index.value?.specialties
    if (!per) {
      // 舊的索引（部署交替時）：讀全國一個檔
      await once('specialties:all', async () => {
        const by: Record<string, Specialty[]> = {}
        for (const s of await fetchSpecialties(index.value?.extras?.specialties)) (by[s.prefecture] ??= []).push(s)
        specialtiesByPref.value = by
      })
      return
    }
    await Promise.all(
      prefs.map((p) => {
        const meta = per[p]
        if (!meta || specialtiesByPref.value[p]) return undefined
        return once(`specialties:${p}`, async () => {
          try {
            specialtiesByPref.value[p] = await fetchPrefSpecialties(p, meta.version)
            triggerRef(specialtiesByPref)
          } catch {
            // 讀不到（離線、沒有快取）：不記下來，下次打開再試
          }
        })
      }),
    )
  }
  const flights = shallowRef<FlightRoute[]>([])

  const seasons = shallowRef<SeasonData | null>(null)
  // 載過就不再抓（once 只合併同時進行的請求，結束後就忘了）
  let extrasLoaded = false
  let flightsLoaded = false
  /** 航線、季節：深度探索與旅前準備用（地區特色另外依縣載入，loadSpecialties） */
  async function loadExtras(): Promise<void> {
    if (extrasLoaded) return
    await loadIndex()
    const v = index.value?.extras ?? {}
    await once('extras', async () => {
      const [f, se] = await Promise.all([flightsLoaded ? flights.value : fetchFlights(v.flights), fetchSeasons(v.seasons)])
      flights.value = f
      seasons.value = se
      extrasLoaded = flightsLoaded = true
    })
  }
  /** 只要航線（地區標籤的直飛航線） */
  async function loadFlights(): Promise<void> {
    if (flightsLoaded) return
    await loadIndex()
    await once('flights', async () => {
      flights.value = await fetchFlights(index.value?.extras?.flights)
      flightsLoaded = true
    })
  }

  /** 鐵路路線圖層：一縣一檔，打開鐵路開關時才載入 */
  const rail = shallowRef<Record<string, RailBundle | null>>({})
  async function loadRail(pref: string): Promise<RailBundle | null> {
    await loadIndex()
    const meta = index.value?.rail?.[pref]
    if (!meta) return null
    if (pref in rail.value) return rail.value[pref] ?? null
    return once(`rail:${pref}`, async () => {
      try {
        rail.value[pref] = await fetchRail(pref, meta.version)
      } catch {
        rail.value[pref] = null
      }
      triggerRef(rail)
      return rail.value[pref] ?? null
    })
  }

  /** 深度探索「祭典」：一縣一檔，開深度探索頁時載入 */
  const festivals = shallowRef<Record<string, Festival[]>>({})
  async function loadFestivals(pref: string): Promise<Festival[]> {
    await loadIndex()
    const meta = index.value?.festivals?.[pref]
    if (!meta) return []
    if (festivals.value[pref]) return festivals.value[pref]
    return once(`festivals:${pref}`, async () => {
      try {
        festivals.value[pref] = await fetchFestivals(pref, meta.version)
      } catch {
        festivals.value[pref] = []
      }
      triggerRef(festivals)
      return festivals.value[pref]
    })
  }

  /** 擴充包：全國一個檔，第一次開啟（或設定中啟用）時才載入 */
  const packs = shallowRef<Record<string, PackItem[]>>({})
  async function loadPack(key: string): Promise<PackItem[]> {
    await loadIndex()
    const meta = index.value?.packs?.[key]
    if (!meta) return []
    if (packs.value[key]) return packs.value[key]
    return once(`pack:${key}`, async () => {
      try {
        packs.value[key] = await fetchPack(key, meta.version)
      } catch {
        packs.value[key] = []
      }
      triggerRef(packs)
      return packs.value[key]
    })
  }

  /** 期間限定：全國一個檔 */
  const timed = shallowRef<TimedItem[] | null>(null)
  async function loadTimed(): Promise<TimedItem[]> {
    if (timed.value) return timed.value
    await loadIndex()
    return once('timed', async () => (timed.value = index.value?.timed ? await fetchTimed(index.value.timed.version) : []))
  }

  /** 旅前準備的會話：開旅前準備頁時才載入 */
  const phrases = shallowRef<import('../services/prep').Phrase[] | null>(null)
  async function loadPhrases() {
    if (phrases.value) return phrases.value
    await loadIndex()
    return once('phrases', async () => (phrases.value = await fetchPhrases(index.value?.extras?.phrases)))
  }

  /**
   * 成就用的小索引（achievements.json）：index 沒有這個檔時是 absent；
   * 載入失敗時是 failed、不寫成空資料（下次呼叫再試）。
   */
  const achv = shallowRef<AchvData | null>(null)
  const achvState = ref<'idle' | 'loading' | 'ready' | 'failed' | 'absent'>('idle')
  async function loadAchievements(): Promise<AchvData | null> {
    if (achv.value) return achv.value
    return once('achievements', async () => {
      await loadIndex()
      const meta = index.value?.achievements
      if (!meta) {
        achvState.value = 'absent'
        return null
      }
      achvState.value = 'loading'
      try {
        achv.value = await fetchAchievements(meta.version)
        achvState.value = 'ready'
      } catch {
        achvState.value = 'failed'
      }
      return achv.value
    })
  }

  /** 全國搜尋索引：第一次搜尋時才載入 */
  let searchLoaded = false
  async function loadSearch(): Promise<void> {
    if (searchLoaded) return
    await loadIndex()
    await once('search', async () => {
      searchLoaded = true
      const { setIndex } = await import('../services/search')
      try {
        setIndex(await fetchSearch(index.value?.search ?? ''))
      } catch {
        setIndex([])
      }
    })
  }

  return {
    loadSearch,
    index, mapSpots, featured, loadFeatured, details, specialties, loadSpecialties, flights, seasons, festivals, loadFestivals, rail, loadRail, loadExtras, loadFlights, loadIndex, available,
    loadMap, mapState, loadAllMaps, loadDetail, getSpot, packs, loadPack, phrases, loadPhrases, timed, loadTimed,
    achv, achvState, loadAchievements,
  }
})
