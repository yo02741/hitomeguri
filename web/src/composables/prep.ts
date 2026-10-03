import { computed, onMounted, watch } from 'vue'

import type { Spot } from '../services/bundles'
import { cards, selectPhrases, tripPlaces, tripThemes, tripWords } from '../services/prep'
import { allStops, tripPrefs, tripStatus } from '../services/trip'
import { useCatalogStore } from '../stores/catalog'
import { useTripsStore } from '../stores/trips'
import { useCatalogSpots } from './catalogSpots'

/** 旅前準備（/trips/:id/prep 與練習頁共用）：依行程載入相關縣的資料，組出地名、會話、特色詞 */
export function usePrep(tripId: () => string) {
  const trips = useTripsStore()
  const catalog = useCatalogStore()
  const trip = computed(() => trips.get(tripId()))
  const prefs = computed(() => (trip.value ? tripPrefs(trip.value) : []))
  const { byId } = useCatalogSpots(() => (trip.value ? allStops(trip.value).map((s) => ({ id: s.spot_id, pref: s.pref })) : []))

  onMounted(() => {
    void catalog.loadExtras()
    void catalog.loadPhrases()
  })
  watch(
    prefs,
    (ps) => {
      ps.forEach((p) => void catalog.loadDetail(p))
      void catalog.loadSpecialties(ps)
    },
    { immediate: true },
  )

  const details = computed(() => {
    const out = new Map<string, Spot>()
    for (const p of prefs.value) for (const [id, s] of Object.entries(catalog.details[p] ?? {})) out.set(id, s)
    return out
  })
  const specialties = computed(() => catalog.specialties.filter((s) => prefs.value.includes(s.prefecture)))
  const themes = computed(() => {
    const spots = trip.value ? allStops(trip.value).flatMap((s) => byId.value.get(s.spot_id) ?? []) : []
    return tripThemes(spots, specialties.value)
  })
  const places = computed(() => (trip.value ? tripPlaces(trip.value, details.value, byId.value) : []))
  const phrases = computed(() => selectPhrases(catalog.phrases ?? [], themes.value))
  const words = computed(() => tripWords(prefs.value, specialties.value))
  const deck = computed(() => cards(places.value, phrases.value, words.value))
  const loading = computed(
    () => !catalog.phrases || prefs.value.some((p) => catalog.index?.prefectures[p] && !catalog.details[p]),
  )
  const status = computed(() => (trip.value ? tripStatus(trip.value, trips.today) : 'planning'))
  /** 旅途中：今天是第幾天（0 起） */
  const todayIndex = computed(() => {
    const t = trip.value
    if (!t?.start_date || status.value !== 'ongoing') return null
    const i = Math.round((Date.parse(trips.today) - Date.parse(t.start_date)) / 86400000)
    return i >= 0 && i < t.days.length ? i : null
  })

  return { trip, prefs, details, byId, places, phrases, words, deck, themes, loading, status, todayIndex }
}
