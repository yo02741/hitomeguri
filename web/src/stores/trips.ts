import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  dayCount,
  hasSpot,
  MAX_DAYS,
  resizeDays,
  type Stop,
  type Trip,
  TRIP_NAME_MAX,
  tripStatus,
} from '../services/trip'
import { ensureSignedIn, firestore, todayIso, waitFor } from '../services/userdb'
import type { SpotRef } from './marks'
import { useUserStore } from './user'

// 行程與旅行紀錄（UX-FLOW.md §3：同一個 entity，狀態依日期推算）。存在 Firestore 的 users/{uid}/trips。

export const useTripsStore = defineStore('trips', () => {
  const userStore = useUserStore()
  const trips = shallowRef<Trip[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe?.()
      unsubscribe = null
      trips.value = []
      loaded.value = false
      if (!uid) return
      const { fs, db } = await firestore()
      if (userStore.user?.uid !== uid) return
      unsubscribe = fs.onSnapshot(fs.collection(db, 'users', uid, 'trips'), (snap) => {
        const next: Trip[] = []
        snap.forEach((d) => {
          const x = d.data({ serverTimestamps: 'estimate' })
          next.push({
            id: d.id,
            name: String(x.name ?? ''),
            start_date: x.start_date,
            end_date: x.end_date,
            days: Array.isArray(x.days) ? x.days.map((day: { stops?: Stop[] }) => ({ stops: day.stops ?? [] })) : [],
            unscheduled: Array.isArray(x.unscheduled) ? x.unscheduled : [],
            created: x.created_at?.toMillis?.() ?? 0,
          })
        })
        trips.value = next
        loaded.value = true
      })
    },
    { immediate: true },
  )

  const today = ref(todayIso())
  // 跨過午夜時狀態跟著變（旅途中開著頁面）
  setInterval(() => (today.value = todayIso()), 60000)

  /** 依狀態與日期排序：進行中、規劃中（近的在前、沒日期的最後）、已結束（新的在前） */
  const sorted = computed(() => {
    const rank = { ongoing: 0, planning: 1, done: 2 } as const
    return [...trips.value].sort((a, b) => {
      const sa = tripStatus(a, today.value)
      const sb = tripStatus(b, today.value)
      if (sa !== sb) return rank[sa] - rank[sb]
      const da = a.start_date ?? '9999'
      const db = b.start_date ?? '9999'
      return sa === 'done' ? db.localeCompare(da) : da.localeCompare(db) || a.created - b.created
    })
  })

  function get(id: string): Trip | undefined {
    return trips.value.find((t) => t.id === id)
  }

  async function withUser<T>(fn: (uid: string) => Promise<T>): Promise<T | undefined> {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return undefined
    // 寫入是整份覆蓋：先等讀到現有的行程
    await waitFor(() => loaded.value)
    try {
      const out = await fn(uid)
      error.value = null
      return out
    } catch (e) {
      console.error(e)
      error.value = '沒有儲存成功'
      return undefined
    }
  }

  function payload(t: Omit<Trip, 'id' | 'created'>, fs: typeof import('firebase/firestore')) {
    return {
      name: t.name.trim().slice(0, TRIP_NAME_MAX),
      status: tripStatus(t, todayIso()),
      start_date: t.start_date || fs.deleteField(),
      end_date: t.end_date || fs.deleteField(),
      days: t.days.slice(0, MAX_DAYS).map((d) => ({ stops: d.stops })),
      unscheduled: t.unscheduled,
      updated_at: fs.serverTimestamp(),
    }
  }

  /** 新增行程；日期齊全時依日期建立天數，否則先一天 */
  function create(init: { name?: string; start_date?: string; end_date?: string }, first?: SpotRef) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const ref = fs.doc(fs.collection(db, 'users', uid, 'trips'))
      const n = dayCount(init.start_date, init.end_date) ?? 1
      const t = {
        name: init.name ?? '',
        start_date: init.start_date,
        end_date: init.end_date,
        ...resizeDays({ days: [], unscheduled: first ? [toStop(first)] : [] }, n),
      }
      await fs.setDoc(ref, { ...payload(t, fs), created_at: fs.serverTimestamp() }, { merge: true })
      return ref.id
    })
  }

  /** 整份更新（名稱、日期、天數、停留點） */
  function save(t: Trip) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      await fs.setDoc(fs.doc(db, 'users', uid, 'trips', t.id), payload(t, fs), { merge: true })
    })
  }

  function toStop(s: SpotRef): Stop {
    return { type: 'catalog', spot_id: s.id, pref: s.pref, name: s.name }
  }

  /** 加入行程：day 為 null 放「待排」；已經在這趟裡就不重複加 */
  function addStop(tripId: string, s: SpotRef, day: number | null) {
    const t = get(tripId)
    if (!t || hasSpot(t, s.id)) return Promise.resolve(undefined)
    const next: Trip = { ...t, days: t.days.map((d) => ({ stops: [...d.stops] })), unscheduled: [...t.unscheduled] }
    if (day === null || !next.days[day]) next.unscheduled.push(toStop(s))
    else next.days[day]!.stops.push(toStop(s))
    return save(next)
  }

  /** 刪除行程，連同旅前準備的練習進度 */
  function remove(id: string) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const progress = await fs.getDocs(fs.collection(db, 'users', uid, 'trips', id, 'progress'))
      // 一個 batch 最多 500 筆寫入
      const refs = [...progress.docs.map((d) => d.ref), fs.doc(db, 'users', uid, 'trips', id)]
      for (let i = 0; i < refs.length; i += 400) {
        const batch = fs.writeBatch(db)
        refs.slice(i, i + 400).forEach((r) => batch.delete(r))
        await batch.commit()
      }
    })
  }

  return { trips, sorted, loaded, error, today, get, create, save, addStop, remove, toStop }
})
