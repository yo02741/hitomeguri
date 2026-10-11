import { computed, ref, shallowRef, watch } from 'vue'

import { areaAt, areaList } from '../services/areas'
import {
  buildGraph,
  cityKey,
  destinations,
  FAR_KM,
  foldName,
  type Graph,
  type Reach,
  search,
  searchStations,
  stationById,
} from '../services/daytrip'
import type { Stay } from '../services/trip'
import { useCatalogStore } from '../stores/catalog'

/**
 * 行程頁的日帰り（UX-FLOW.md C8）：載入路網與目的地（第一次用到時），從住的車站算單日來回的地方。
 * 住的城市（政令指定都市、東京 23 區合起來）不列：由車站的位置在那一縣的區界裡找。
 */
export function useDaytrip(stay: () => Stay | null | undefined) {
  const catalog = useCatalogStore()
  const state = ref<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  async function load(): Promise<void> {
    if (state.value === 'ready' || state.value === 'loading') return
    state.value = 'loading'
    const [g, d] = await Promise.all([catalog.loadRailGraph(), catalog.loadDaytrip()])
    state.value = g && d ? 'ready' : 'failed'
  }

  const graph = computed<Graph | null>(() => (catalog.railGraph ? buildGraph(catalog.railGraph) : null))
  // 路網重建後車站的 id 可能換了：找不到時用站名（完全相同的）找回來
  const base = computed(() => {
    const g = graph.value
    const s = stay()
    if (!g || !s) return null
    return stationById(g, s.st) ?? searchStations(g, s.n, 5).find((x) => foldName(x.name) === foldName(s.n)) ?? null
  })

  // 住的城市：車站所在的區（那一縣的區界）。算好之前清單先不出來（不然住的城市會先出現再消失）；
  // 只看車站 id（行程每次同步都是新的物件）
  const baseCity = ref<string | null>(null)
  const cityFor = ref<string | null>(null)
  watch(
    () => base.value?.id,
    async (id) => {
      const b = base.value
      baseCity.value = null
      cityFor.value = null
      if (!id || !b) return
      const bundle = b.pref ? await catalog.loadMunicipalities(b.pref) : null
      if (base.value?.id !== id) return
      const a = bundle ? areaAt(areaList(bundle), b.lng, b.lat) : null
      baseCity.value = a ? cityKey(a.code, a.city) : null
      cityFor.value = id
    },
    { immediate: true },
  )

  const reach = shallowRef<Reach | null>(null)
  watch(
    [graph, () => base.value?.id],
    ([g]) => {
      const i = g && base.value ? g.index.get(base.value.id) : undefined
      reach.value = g && i !== undefined ? search(g, i, FAR_KM) : null
    },
    { immediate: true },
  )

  const list = computed(() => {
    const g = graph.value
    const areas = catalog.daytrip?.areas
    return g && reach.value && areas && cityFor.value ? destinations(g, reach.value, areas, baseCity.value) : []
  })
  /** 清單的狀態：資料到了、住的城市也算好了才是 ready */
  const listState = computed(() => (state.value === 'ready' && base.value && cityFor.value !== base.value.id ? 'loading' : state.value))

  /** 一個車站（景點的 st）離住的地方幾 km；到不了是 null */
  function kmTo(st: string | null | undefined): number | null {
    const g = graph.value
    const i = st && g ? g.index.get(st) : undefined
    return i === undefined ? null : (reach.value?.km.get(i) ?? null)
  }

  return { state, listState, load, graph, base, list, kmTo }
}
