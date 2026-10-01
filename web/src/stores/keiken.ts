import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useVisitedEntries } from '../composables/visited'
import { firestore } from '../services/userdb'
import { useUserStore } from './user'

/**
 * 經縣值（DESIGN.md §7.21）：每個都道府縣自己選 0–5 級，加起來最高 235。
 * 級數是日本流行的「経県値」玩法：住過 5、過夜 4、玩過 3、踏上 2、路過 1、未踏 0。
 * 沒自己選的縣，有去過的景點就當「玩過」（3）。存在 users/{uid}/meta/keiken，只有本人讀寫。
 * Firestore 規則還沒更新（或離線）寫不進去時，先存在這台裝置。
 */
export const KEIKEN_LEVELS = [
  { level: 5, label: '住過' },
  { level: 4, label: '過夜' },
  { level: 3, label: '玩過' },
  { level: 2, label: '踏上' },
  { level: 1, label: '路過' },
  { level: 0, label: '未踏' },
] as const
export type KeikenLevel = 0 | 1 | 2 | 3 | 4 | 5
export const KEIKEN_MAX = 47 * 5
export const AUTO_LEVEL: KeikenLevel = 3

const LOCAL_KEY = 'hm-keiken'

export const useKeikenStore = defineStore('keiken', () => {
  const userStore = useUserStore()
  const levels = shallowRef<Record<string, KeikenLevel>>({})
  const loaded = ref(false)
  /** 寫不進 Firestore，暫存在這台裝置 */
  const localOnly = ref(false)
  let unsubscribe: (() => void) | null = null

  function readLocal(uid: string): Record<string, KeikenLevel> {
    try {
      return (JSON.parse(localStorage.getItem(`${LOCAL_KEY}:${uid}`) ?? '{}') as Record<string, KeikenLevel>) ?? {}
    } catch {
      return {}
    }
  }
  function writeLocal(uid: string, v: Record<string, KeikenLevel>) {
    try {
      localStorage.setItem(`${LOCAL_KEY}:${uid}`, JSON.stringify(v))
    } catch {
      // 存不了就只留在這次的畫面
    }
  }

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe?.()
      unsubscribe = null
      levels.value = {}
      loaded.value = false
      localOnly.value = false
      if (!uid) return
      const local = readLocal(uid)
      if (Object.keys(local).length) {
        levels.value = local
        localOnly.value = true
      }
      try {
        const { fs, db } = await firestore()
        unsubscribe = fs.onSnapshot(
          fs.doc(db, 'users', uid, 'meta', 'keiken'),
          (snap) => {
            const remote = (snap.data()?.levels ?? {}) as Record<string, KeikenLevel>
            // 本機暫存的（規則更新前選的）優先，下一次成功寫入時合併上去
            levels.value = { ...remote, ...readLocal(uid) }
            loaded.value = true
          },
          () => {
            loaded.value = true
            localOnly.value = true
          },
        )
      } catch {
        loaded.value = true
        localOnly.value = true
      }
    },
    { immediate: true },
  )

  // 有去過的景點的縣（含已結束行程的停留點）
  const { entries } = useVisitedEntries()
  const visitedPrefs = computed(() => new Set(entries.value.map(([, m]) => m.pref)))

  /** 實際的級數：自己選的優先，沒選的有去過景點就是「玩過」 */
  function levelOf(pref: string): KeikenLevel {
    const own = levels.value[pref]
    if (own !== undefined) return own
    return visitedPrefs.value.has(pref) ? AUTO_LEVEL : 0
  }
  function isAuto(pref: string): boolean {
    return levels.value[pref] === undefined && visitedPrefs.value.has(pref)
  }

  async function setLevel(pref: string, level: KeikenLevel | null) {
    const uid = userStore.user?.uid
    if (!uid) return
    const next = { ...levels.value }
    if (level === null) delete next[pref]
    else next[pref] = level
    levels.value = next
    try {
      const { fs, db } = await firestore()
      await fs.setDoc(fs.doc(db, 'users', uid, 'meta', 'keiken'), { levels: next, updated_at: fs.serverTimestamp() })
      localStorage.removeItem(`${LOCAL_KEY}:${uid}`)
      localOnly.value = false
    } catch {
      writeLocal(uid, next)
      localOnly.value = true
    }
  }

  return { levels, loaded, localOnly, levelOf, isAuto, setLevel }
})
