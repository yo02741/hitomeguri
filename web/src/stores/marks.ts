import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { ensureSignedIn, firestore, waitFor } from '../services/userdb'
import { useUserStore } from './user'

// 收藏、去過、清單（UX-FLOW.md §3）。存在 Firestore 的 users/{uid}/marks、users/{uid}/lists，只有本人讀寫。
// 一個景點一份 mark：收藏、去過、屬於哪些清單都記在這裡；三者都沒有時刪掉文件。
// 另存景點的縣與日文名：列表、匯出時只需載入相關縣的地圖 bundle；景點日後從目錄移除時仍認得出是哪裡。

export interface Mark {
  pref: string
  name: string
  favorite?: boolean
  visited?: boolean
  /** 去過的日期 YYYY-MM-DD；不記得可以留空 */
  visited_on?: string
  /** 所屬清單 id */
  lists?: string[]
}

export interface UserList {
  id: string
  name: string
  created: number
}

/** 景點最少要知道的資料 */
export interface SpotRef {
  id: string
  pref: string
  name: string
}

// firestore.rules 的上限
export const LIST_NAME_MAX = 80
const LISTS_PER_SPOT_MAX = 50

export const useMarksStore = defineStore('marks', () => {
  const userStore = useUserStore()
  const marks = shallowRef<Record<string, Mark>>({})
  const lists = shallowRef<UserList[]>([])
  // 收藏與清單都第一次讀到後為 true（未登入時為 false）
  const marksLoaded = ref(false)
  const listsLoaded = ref(false)
  const loaded = computed(() => marksLoaded.value && listsLoaded.value)
  /** 最近一次寫入失敗；下次成功時清掉 */
  const error = ref<string | null>(null)
  let unsubscribe: Array<() => void> = []

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe.forEach((f) => f())
      unsubscribe = []
      marks.value = {}
      lists.value = []
      marksLoaded.value = false
      listsLoaded.value = false
      if (!uid) return
      const { fs, db } = await firestore()
      if (userStore.user?.uid !== uid) return
      const opts = { serverTimestamps: 'estimate' } as const
      unsubscribe.push(
        fs.onSnapshot(fs.collection(db, 'users', uid, 'marks'), (snap) => {
          const next: Record<string, Mark> = {}
          snap.forEach((d) => {
            const { updated_at: _updated, ...rest } = d.data(opts)
            next[d.id] = rest as Mark
          })
          marks.value = next
          marksLoaded.value = true
        }),
        fs.onSnapshot(fs.collection(db, 'users', uid, 'lists'), (snap) => {
          const next: UserList[] = []
          snap.forEach((d) => {
            const data = d.data(opts)
            next.push({ id: d.id, name: String(data.name ?? ''), created: data.created_at?.toMillis?.() ?? 0 })
          })
          lists.value = next.sort((a, b) => a.created - b.created)
          listsLoaded.value = true
        }),
      )
    },
    { immediate: true },
  )

  /** 未登入時先登入，登入後完成原本的動作（UX-FLOW.md B4）；取消登入就什麼都不做 */
  async function withUser<T>(fn: (uid: string) => Promise<T>): Promise<T | undefined> {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return undefined
    // 寫入是整份覆蓋：先等讀到這個帳號現有的資料，免得剛登入時蓋掉原本的收藏與清單
    await waitFor(() => marksLoaded.value)
    if (!marksLoaded.value) {
      error.value = '沒有儲存成功'
      return undefined
    }
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

  function empty(m: Mark): boolean {
    return !m.favorite && !m.visited && !m.lists?.length
  }

  async function writeMark(uid: string, id: string, m: Mark): Promise<void> {
    const { fs, db } = await firestore()
    const ref = fs.doc(db, 'users', uid, 'marks', id)
    if (empty(m)) {
      await fs.deleteDoc(ref)
      return
    }
    const data: Record<string, unknown> = { pref: m.pref, name: m.name, updated_at: fs.serverTimestamp() }
    if (m.favorite) data.favorite = true
    if (m.visited) data.visited = true
    if (m.visited && m.visited_on) data.visited_on = m.visited_on
    if (m.lists?.length) data.lists = m.lists
    await fs.setDoc(ref, data)
  }

  function current(s: SpotRef): Mark {
    const m = marks.value[s.id]
    // 縣、名稱用目錄的最新值
    return { ...(m ?? {}), pref: s.pref, name: s.name }
  }

  function toggleFavorite(s: SpotRef) {
    return withUser((uid) => {
      const m = current(s)
      return writeMark(uid, s.id, { ...m, favorite: !m.favorite })
    })
  }

  function toggleVisited(s: SpotRef) {
    return withUser((uid) => {
      const m = current(s)
      return writeMark(uid, s.id, { ...m, visited: !m.visited, visited_on: m.visited ? undefined : m.visited_on })
    })
  }

  function setVisitedOn(s: SpotRef, date: string) {
    return withUser((uid) => {
      const m = current(s)
      return writeMark(uid, s.id, { ...m, visited: true, visited_on: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined })
    })
  }

  function toggleInList(s: SpotRef, listId: string) {
    return withUser((uid) => {
      const m = current(s)
      const now = m.lists ?? []
      const next = now.includes(listId) ? now.filter((x) => x !== listId) : [...now, listId].slice(-LISTS_PER_SPOT_MAX)
      return writeMark(uid, s.id, { ...m, lists: next })
    })
  }

  /** 新增清單；給 spot 時一併把它加進去。回傳清單 id */
  function createList(name: string, s?: SpotRef) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const ref = fs.doc(fs.collection(db, 'users', uid, 'lists'))
      await fs.setDoc(ref, {
        name: name.trim().slice(0, LIST_NAME_MAX),
        created_at: fs.serverTimestamp(),
        updated_at: fs.serverTimestamp(),
      })
      if (s) {
        const m = current(s)
        await writeMark(uid, s.id, { ...m, lists: [...(m.lists ?? []), ref.id].slice(-LISTS_PER_SPOT_MAX) })
      }
      return ref.id
    })
  }

  function renameList(id: string, name: string) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      await fs.updateDoc(fs.doc(db, 'users', uid, 'lists', id), {
        name: name.trim().slice(0, LIST_NAME_MAX),
        updated_at: fs.serverTimestamp(),
      })
    })
  }

  /** 刪除清單：景點本身的收藏、去過不受影響 */
  function deleteList(id: string) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const batch = fs.writeBatch(db)
      batch.delete(fs.doc(db, 'users', uid, 'lists', id))
      for (const [spotId, m] of Object.entries(marks.value)) {
        if (!m.lists?.includes(id)) continue
        const next = { ...m, lists: m.lists.filter((x) => x !== id) }
        const ref = fs.doc(db, 'users', uid, 'marks', spotId)
        if (empty(next)) batch.delete(ref)
        else batch.update(ref, { lists: next.lists, updated_at: fs.serverTimestamp() })
      }
      await batch.commit()
    })
  }

  function markOf(id: string | null | undefined): Mark | undefined {
    return id ? marks.value[id] : undefined
  }

  const favorites = computed(() => Object.entries(marks.value).filter(([, m]) => m.favorite))
  const visited = computed(() => Object.entries(marks.value).filter(([, m]) => m.visited))
  function listEntries(listId: string): Array<[string, Mark]> {
    return Object.entries(marks.value).filter(([, m]) => m.lists?.includes(listId))
  }

  return {
    marks, lists, loaded, error, markOf, favorites, visited, listEntries,
    toggleFavorite, toggleVisited, setVisitedOn, toggleInList, createList, renameList, deleteList,
  }
})
