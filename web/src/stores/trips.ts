import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  dayCount,
  hasSpot,
  MAX_DAYS,
  type Member,
  resizeDays,
  type Stop,
  type Trip,
  type TripContent,
  TRIP_NAME_MAX,
  tripStatus,
} from '../services/trip'
import { ensureSignedIn, firestore, todayIso, waitFor } from '../services/userdb'
import type { SpotRef } from './marks'
import { useUserStore } from './user'

// 行程與旅行紀錄（UX-FLOW.md §3：同一個 entity，狀態依日期推算）。
// 共編（UX-FLOW.md C7）：行程存在最上層的 trips/{id}，members 裡的人都能讀寫；用邀請連結（invites/{code}）加入。
// 以前存在 users/{uid}/trips 的行程，登入時搬到 trips/（同一個 id，練習進度與截圖的 trip_id 不必改）。
// 練習進度仍是個人的：users/{uid}/trips/{tripId}/progress。

type Fs = typeof import('firebase/firestore')

export interface InviteInfo {
  code: string
  trip_id: string
  trip_name: string
  inviter: string
}

function parse(id: string, x: Record<string, any>): Trip {
  return {
    id,
    name: String(x.name ?? ''),
    start_date: x.start_date,
    end_date: x.end_date,
    days: Array.isArray(x.days) ? x.days.map((day: { stops?: Stop[] }) => ({ stops: day.stops ?? [] })) : [],
    unscheduled: Array.isArray(x.unscheduled) ? x.unscheduled : [],
    owner: String(x.owner ?? ''),
    members: Array.isArray(x.members) ? x.members : [],
    member_info: x.member_info ?? {},
    invite: x.invite,
    created: x.created_at?.toMillis?.() ?? 0,
  }
}

/** 邀請碼：24 字的隨機字串（URL 安全） */
function newCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_')
}

export const useTripsStore = defineStore('trips', () => {
  const userStore = useUserStore()
  const trips = shallowRef<Trip[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  let unsubscribe: (() => void) | null = null

  /** 自己在成員名單上的顯示資料 */
  function me(): Member {
    const u = userStore.user
    const out: Member = { name: (u?.displayName || u?.email?.split('@')[0] || '').slice(0, 80) }
    if (u?.photoURL && u.photoURL.length <= 500) out.photo = u.photoURL
    return out
  }

  /** 舊的 users/{uid}/trips → trips/{id}（同一個 id），一次搬完 */
  async function migrate(uid: string, fs: Fs, db: import('firebase/firestore').Firestore) {
    const old = await fs.getDocs(fs.collection(db, 'users', uid, 'trips'))
    if (old.empty) return
    const batch = fs.writeBatch(db)
    old.forEach((d) => {
      const x = d.data()
      batch.set(fs.doc(db, 'trips', d.id), {
        ...x,
        owner: uid,
        members: [uid],
        member_info: { [uid]: me() },
        created_at: x.created_at ?? fs.serverTimestamp(),
        updated_at: fs.serverTimestamp(),
      })
      batch.delete(d.ref)
    })
    await batch.commit()
  }

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
      try {
        await migrate(uid, fs, db)
      } catch (e) {
        console.error('trips migrate', e)
      }
      if (userStore.user?.uid !== uid) return
      const q = fs.query(fs.collection(db, 'trips'), fs.where('members', 'array-contains', uid))
      unsubscribe = fs.onSnapshot(
        q,
        (snap) => {
          const next: Trip[] = []
          snap.forEach((d) => next.push(parse(d.id, d.data({ serverTimestamps: 'estimate' }))))
          trips.value = next
          loaded.value = true
        },
        (e) => {
          console.error('trips', e)
          loaded.value = true
        },
      )
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

  function content(t: TripContent, fs: Fs) {
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
      const ref = fs.doc(fs.collection(db, 'trips'))
      const n = dayCount(init.start_date, init.end_date) ?? 1
      const t = {
        name: init.name ?? '',
        start_date: init.start_date,
        end_date: init.end_date,
        ...resizeDays({ days: [], unscheduled: first ? [toStop(first)] : [] }, n),
      }
      const data: Record<string, unknown> = {
        ...content(t, fs),
        owner: uid,
        members: [uid],
        member_info: { [uid]: me() },
        created_at: fs.serverTimestamp(),
      }
      // 新文件不能寫 deleteField
      if (!t.start_date) delete data.start_date
      if (!t.end_date) delete data.end_date
      await fs.setDoc(ref, data)
      return ref.id
    })
  }

  /**
   * 修改行程內容：在交易裡讀最新的一份、套用 fn、寫回。共編時對方剛改過也不會被整份蓋掉；
   * fn 回傳 null 表示不用改（例：要移動的景點已被對方移除）。
   */
  function mutate(id: string, fn: (t: Trip) => Partial<TripContent> | null) {
    return withUser(async () => {
      const { fs, db } = await firestore()
      const ref = fs.doc(db, 'trips', id)
      await fs.runTransaction(db, async (tx) => {
        const snap = await tx.get(ref)
        if (!snap.exists()) return
        const t = parse(id, snap.data())
        const patch = fn(t)
        if (!patch) return
        tx.update(ref, content({ ...t, ...patch }, fs))
      })
    })
  }

  function toStop(s: SpotRef): Stop {
    return { type: 'catalog', spot_id: s.id, pref: s.pref, name: s.name }
  }

  /** 加入行程：day 為 null 放「待排」；已經在這趟裡就不重複加 */
  function addStop(tripId: string, s: SpotRef, day: number | null) {
    return mutate(tripId, (t) => {
      if (hasSpot(t, s.id)) return null
      const days = t.days.map((d) => ({ stops: [...d.stops] }))
      const unscheduled = [...t.unscheduled]
      if (day === null || !days[day]) unscheduled.push(toStop(s))
      else days[day]!.stops.push(toStop(s))
      return { days, unscheduled }
    })
  }

  /** 自己的練習進度 */
  async function deleteProgress(uid: string, id: string, fs: Fs, db: import('firebase/firestore').Firestore) {
    const progress = await fs.getDocs(fs.collection(db, 'users', uid, 'trips', id, 'progress'))
    const refs = progress.docs.map((d) => d.ref)
    // 一個 batch 最多 500 筆寫入
    for (let i = 0; i < refs.length; i += 400) {
      const batch = fs.writeBatch(db)
      refs.slice(i, i + 400).forEach((r) => batch.delete(r))
      await batch.commit()
    }
  }

  /** 刪除行程（建立者）：連同邀請連結與自己的練習進度 */
  function remove(id: string) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const t = get(id)
      const batch = fs.writeBatch(db)
      if (t?.invite) batch.delete(fs.doc(db, 'invites', t.invite))
      batch.delete(fs.doc(db, 'trips', id))
      await batch.commit()
      await deleteProgress(uid, id, fs, db)
    })
  }

  /** 移除成員（建立者），或自己離開（成員） */
  function removeMember(id: string, member: string) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      await fs.updateDoc(fs.doc(db, 'trips', id), {
        members: fs.arrayRemove(member),
        [`member_info.${member}`]: fs.deleteField(),
        updated_at: fs.serverTimestamp(),
      })
      if (member === uid) await deleteProgress(uid, id, fs, db)
    })
  }

  /** 邀請連結的邀請碼；還沒有或 fresh 時產生新的（舊的連結失效） */
  function invite(id: string, fresh = false) {
    return withUser(async () => {
      const t = get(id)
      if (!t) return undefined
      if (t.invite && !fresh) return t.invite
      const { fs, db } = await firestore()
      const code = newCode()
      const batch = fs.writeBatch(db)
      if (t.invite) batch.delete(fs.doc(db, 'invites', t.invite))
      batch.set(fs.doc(db, 'invites', code), {
        trip_id: id,
        trip_name: t.name.slice(0, TRIP_NAME_MAX),
        inviter: me().name,
        created_by: userStore.user!.uid,
        created_at: fs.serverTimestamp(),
      })
      batch.update(fs.doc(db, 'trips', id), { invite: code, updated_at: fs.serverTimestamp() })
      await batch.commit()
      return code
    })
  }

  /** 讀邀請（加入前顯示行程名稱與邀請人）；連結失效時為 null */
  async function readInvite(code: string): Promise<InviteInfo | null> {
    const { fs, db } = await firestore()
    try {
      const snap = await fs.getDoc(fs.doc(db, 'invites', code))
      if (!snap.exists()) return null
      const x = snap.data()
      return { code, trip_id: String(x.trip_id), trip_name: String(x.trip_name ?? ''), inviter: String(x.inviter ?? '') }
    } catch {
      return null
    }
  }

  /** 用邀請加入：把自己加進成員名單。回傳行程 id */
  function join(inv: InviteInfo) {
    return withUser(async (uid) => {
      if (get(inv.trip_id)) return inv.trip_id
      const { fs, db } = await firestore()
      // 邀請碼放在自己的成員資料裡（firestore.rules 用它確認是從有效的連結加入）
      await fs.updateDoc(fs.doc(db, 'trips', inv.trip_id), {
        members: fs.arrayUnion(uid),
        [`member_info.${uid}`]: { ...me(), via: inv.code },
        updated_at: fs.serverTimestamp(),
      })
      await waitFor(() => Boolean(get(inv.trip_id)), 5000)
      return inv.trip_id
    })
  }

  return {
    trips, sorted, loaded, error, today, get, create, mutate, addStop, remove, removeMember, invite, readInvite, join, toStop,
  }
})
