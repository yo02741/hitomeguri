import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import { useVisitedEntries } from '../composables/visited'
import { ACHV_AREAS, type AchvDef, type AchvDep, byRank } from '../data/achievements'
import { areaPrefs, type Region, regionOf } from '../data/regions'
import {
  type AchvInput,
  type AchvState,
  type Contrib,
  dataBaseline,
  derive,
  type Derived,
  diffKnown,
  evaluate,
  inputSig,
  inTrip as tripSeals,
  itemsOf,
  type Known,
  paidCount as countPaid,
  prefStamps,
  stampItems,
} from '../services/achievements'
import type { AchvData } from '../services/bundles'
import type { Trip } from '../services/trip'
import { useCatalogStore } from './catalog'
import { useExploreStore } from './explore'
import { achvKey, useFreshStore } from './fresh'
import { useMarksStore } from './marks'
import { useTripsStore } from './trips'
import { useUserStore } from './user'

/**
 * 成就（DESIGN.md §7.25）：由去過的地方、已結束的旅行與 achievements.json 算出來，不另外存。
 * NEW：每台裝置記得看過哪些（localStorage `hitomeguri:achv-known:<uid>`），和現在達成的比對；
 * 第一次 ready 時靜靜建基準，不會在新裝置冒出一大片 NEW。
 * 只 import 去過的紀錄、marks、trips、catalog、explore、fresh、user：
 * 錢包（wallet）會 import 這個 store，這裡絕不 import wallet、avatar、keiken，免得循環。
 */
const LOCAL = 'hitomeguri:achv-known'
const EMPTY: Known = { v: 1, deps: [], ids: [] }
/** 新達成的記多久（新卡入手的章用） */
const RECENT_MS = 10000

function idle(fn: () => void) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 4000 })
  else setTimeout(fn, 2000)
}

export const useAchievementsStore = defineStore('achievements', () => {
  const userStore = useUserStore()
  const marks = useMarksStore()
  const trips = useTripsStore()
  const catalog = useCatalogStore()
  const explore = useExploreStore()
  const fresh = useFreshStore()
  const { entries, datesById, doneTrips } = useVisitedEntries()

  const input = (): AchvInput => ({ entries: entries.value, datesById: datesById.value, doneTrips: doneTrips.value, data: catalog.achv })
  // marks、trips 每次 snapshot 都給新的陣列（收藏、清單、改還沒結束的行程也是）：
  // 去過的紀錄的指紋沒變就沿用上次的結果，下游（states、stamps、錢包、旅人）都不重算
  let lastSig = ''
  let lastData: AchvData | null = null
  const derived = computed<Derived>((prev) => {
    const i = input()
    const sig = inputSig(i)
    if (prev && sig === lastSig && i.data === lastData) return prev
    lastSig = sig
    lastData = i.data
    return derive(i)
  })
  const states = computed(() => evaluate(derived.value))
  const stamps = computed(() => prefStamps(derived.value))
  const byId = computed(() => new Map(states.value.map((s) => [s.def.id, s])))
  const stampByPref = computed(() => new Map(stamps.value.map((s) => [s.pref, s])))

  /** 達成的 id（含初訪 `pref-<縣>`） */
  const doneIds = computed(() => {
    const out = new Set<string>()
    for (const s of stamps.value) if (s.done) out.add(`pref-${s.pref}`)
    for (const s of states.value) if (s.status === 'done') out.add(s.def.id)
    return out
  })
  /** 給券的成就數（地方、旅行、時節） */
  const paidCount = computed(() => countPaid(states.value))

  /** 畫面上列的：關掉的擴充包，還沒達成的不列；bundle 沒有 achievements.json 時拿掉 data 的兩組 */
  const visible = computed(() =>
    states.value.filter((s) => {
      if (s.def.dep === 'data' && catalog.achvState === 'absent') return false
      if (s.def.pack && !explore.enabledPacks.includes(s.def.pack) && s.status !== 'done') return false
      return true
    }),
  )
  const counts = computed(() => ({
    n: visible.value.filter((s) => s.status === 'done').length,
    N: visible.value.length,
  }))

  const ready = computed<Record<AchvDep, boolean>>(() => {
    const core = Boolean(userStore.user) && marks.loaded && trips.loaded && marks.synced && trips.synced
    return { core, data: core && catalog.achv !== null }
  })

  // ---- 看過的（每台裝置） ----
  const known = shallowRef<Known>(EMPTY)
  const storageKey = (uid: string) => `${LOCAL}:${uid}`
  function readKnown(uid: string): Known {
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey(uid)) ?? 'null') as Partial<Known> | null
      if (!raw || raw.v !== 1 || !Array.isArray(raw.ids) || !Array.isArray(raw.deps)) return EMPTY
      return { v: 1, deps: raw.deps, ids: raw.ids, ...(raw.opened ? { opened: true as const } : {}) }
    } catch {
      return EMPTY
    }
  }
  function writeKnown(uid: string, k: Known) {
    known.value = k
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(k))
    } catch {
      // 存不了就只在這次
    }
  }

  /** 剛達成的（新卡入手時蓋章用），只在記憶體 */
  const recent = shallowRef<Array<{ id: string; t: number }>>([])

  let knownUid: string | null = null
  /** 這次登入、core 第一次 ready 時去過的 id：data（achievements.json）晚到時，基準只算這些 */
  let coreIds: Set<string> | null = null
  function sync() {
    const uid = userStore.user?.uid ?? null
    if (uid !== knownUid) {
      knownUid = uid
      recent.value = []
      coreIds = null
      known.value = uid ? readKnown(uid) : EMPTY
    }
    if (!uid) return
    if (ready.value.core && !coreIds) coreIds = new Set(derived.value.ids)
    const doneByDep: Record<AchvDep, string[]> = { core: [], data: [] }
    for (const s of stamps.value) if (s.done) doneByDep.core.push(`pref-${s.pref}`)
    for (const s of states.value) if (s.status === 'done') doneByDep[s.def.dep].push(s.def.id)
    // 第一次載到 achievements.json：這次登入之後才去的地方（例：第一個「去過」就是東寺）達成的照樣標 NEW
    const base = ready.value.data && coreIds && !known.value.deps.includes('data') ? { data: dataBaseline(input(), coreIds) } : {}
    const { known: next, fresh: newIds } = diffKnown(known.value, doneByDep, ready.value, base)
    if (next.ids.length !== known.value.ids.length || next.deps.length !== known.value.deps.length) writeKnown(uid, next)
    if (!newIds.length) return
    fresh.add(newIds.map(achvKey))
    const now = Date.now()
    recent.value = [...recent.value.filter((r) => now - r.t < RECENT_MS), ...newIds.map((id) => ({ id, t: now }))]
  }
  const doneKey = computed(() => [...doneIds.value].sort().join(','))
  watch([doneKey, () => ready.value.core, () => ready.value.data, () => userStore.user?.uid], sync, { immediate: true })

  // achievements.json：登入、讀到去過的紀錄之後，閒下來再載入（約 4 KB gz）。
  // 還沒有去過的地方也先載：基準要在第一個「去過」之前建好
  watch(
    () => Boolean(userStore.user) && marks.loaded,
    (on) => {
      if (on) idle(() => void catalog.loadAchievements())
    },
    { immediate: true },
  )

  /** 有沒看過的成就：只算現在還達成的（失去的成就殘留的 key 不算） */
  const hasNew = computed(() => [...fresh.keys].some((k) => k.startsWith('a:') && doneIds.value.has(k.slice(2))))
  const isNew = (id: string) => fresh.has(achvKey(id))

  /** 最近達成的：日期新到舊，沒有日期的排在後面並依 rank */
  const latest = computed<AchvState[]>(() =>
    visible.value
      .filter((s) => s.status === 'done')
      .sort((a, b) => {
        if (a.at && b.at) return b.at.localeCompare(a.at) || byRank(a.def, b.def)
        if (a.at || b.at) return a.at ? -1 : 1
        return byRank(a.def, b.def)
      }),
  )

  /** 只差 1–2 縣、至少去過 1 縣的地方：差最少的，同樣多時依 regions 順序 */
  const nearestArea = computed<{ area: string; missing: Region[] } | null>(() => {
    let best: { area: string; missing: Region[] } | null = null
    for (const area of ACHV_AREAS) {
      const ps = areaPrefs(area)
      const missing = ps.filter((p) => !derived.value.prefs.has(p))
      if (missing.length < 1 || missing.length > 2 || missing.length === ps.length) continue
      if (!best || missing.length < best.missing.length) best = { area, missing: missing.map((p) => regionOf(p)!) }
    }
    return best
  })

  /** 這台裝置第一次打開成就頁 */
  const firstOpen = computed(() => ready.value.core && !known.value.opened)
  function markOpened() {
    const uid = userStore.user?.uid
    if (!uid || known.value.opened) return
    writeKnown(uid, { ...known.value, opened: true })
  }

  /** 拿走 since 之後新達成的成就（不含初訪章），依 rank 排 */
  function takeRecent(since: number): AchvDef[] {
    const hit = recent.value.filter((r) => r.t >= since && !r.id.startsWith('pref-'))
    if (!hit.length) return []
    const ids = new Set(hit.map((r) => r.id))
    recent.value = recent.value.filter((r) => !ids.has(r.id))
    return hit
      .map((r) => byId.value.get(r.id)?.def)
      .filter((d): d is AchvDef => Boolean(d))
      .sort(byRank)
  }

  /** 詳細對話框的「有關的」（打開時才算） */
  const items = (def: AchvDef): Contrib[] => itemsOf(derived.value, def)
  const prefItems = (pref: string): Contrib[] => stampItems(derived.value, pref)

  function inTrip(t: Trip) {
    return tripSeals(visible.value, stamps.value, t)
  }

  async function loadData(): Promise<void> {
    await catalog.loadAchievements()
  }

  return {
    derived, states, stamps, byId, stampByPref, doneIds, paidCount, visible, counts, ready,
    hasNew, isNew, latest, nearestArea, firstOpen, markOpened, takeRecent, inTrip, loadData, items, prefItems,
  }
})
