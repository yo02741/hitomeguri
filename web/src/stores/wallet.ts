import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useVisitedEntries } from '../composables/visited'
import { regionOf } from '../data/regions'
import { UNLIMITED_DRAWS } from '../services/cardVariants'
import { ensureSignedIn, firestore } from '../services/userdb'
import { useAchievementsStore } from './achievements'
import { useUserStore } from './user'

/**
 * 抽獎券（DESIGN.md §7.19b）：旅人扭蛋與景點卡共用。
 * 拿到的張數全部由「現在去過的地方」算出來，取消去過再勾回去不會多拿，也不用重複去同一個地方：
 * - 每個去過的景點 1 張
 * - 每個去過的縣 3 張
 * - 每個去過的地方（北海道、東北、關東…8 個）5 張
 * - 景點每累積 10 個 5 張
 * - 地方、旅行、時節的成就每個 5 張，也由現在的紀錄算出來（stores/achievements.ts 的 paidCount）
 * 用掉的張數（used）與「第一次去過的免費抽」用過的景點（free）存在 users/{uid}/meta/wallet；
 * 規則還沒發布或離線時先存在這台裝置，之後合併（used 取大的、free 取聯集）。
 * 測試期（UNLIMITED_DRAWS）不扣也能抽，張數照算。
 */
interface Saved {
  used: number
  free: string[]
}
const LOCAL = 'hitomeguri:wallet'

export const TICKET_RULES = { spot: 1, pref: 3, area: 5, every10: 5, achv: 5 } as const

export const useWalletStore = defineStore('wallet', () => {
  const userStore = useUserStore()
  const { entries } = useVisitedEntries()
  const achv = useAchievementsStore()
  const used = ref(0)
  const free = shallowRef<Set<string>>(new Set())
  let unsubscribe: (() => void) | null = null

  const key = (uid: string) => `${LOCAL}:${uid}`
  function readLocal(uid: string): Partial<Saved> {
    try {
      return JSON.parse(localStorage.getItem(key(uid)) ?? '{}') as Partial<Saved>
    } catch {
      return {}
    }
  }
  function apply(d: Partial<Saved>) {
    used.value = Math.max(0, d.used ?? 0)
    free.value = new Set(d.free ?? [])
  }

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe?.()
      unsubscribe = null
      apply(uid ? readLocal(uid) : {})
      if (!uid) return
      try {
        const { fs, db } = await firestore()
        if (userStore.user?.uid !== uid) return
        unsubscribe = fs.onSnapshot(
          fs.doc(db, 'users', uid, 'meta', 'wallet'),
          (snap) => {
            const remote = (snap.data() ?? {}) as Partial<Saved>
            const local = readLocal(uid)
            apply({
              used: Math.max(remote.used ?? 0, local.used ?? 0),
              free: [...new Set([...(remote.free ?? []), ...(local.free ?? [])])],
            })
          },
          () => {
            // 規則還沒發布：只用這台裝置的
          },
        )
      } catch {
        // 離線
      }
    },
    { immediate: true },
  )

  async function save() {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return
    const data: Saved = { used: used.value, free: [...free.value].slice(-5000) }
    try {
      localStorage.setItem(key(uid), JSON.stringify(data))
    } catch {
      // 存不了就只留在這次
    }
    try {
      const { fs, db } = await firestore()
      await fs.setDoc(fs.doc(db, 'users', uid, 'meta', 'wallet'), { ...data, updated_at: fs.serverTimestamp() })
    } catch {
      // 規則還沒發布：留在這台裝置
    }
  }

  /** 拿到的張數與來源 */
  const breakdown = computed(() => {
    const spots = entries.value.length
    const prefs = new Set(entries.value.map(([, m]) => m.pref))
    const areas = new Set([...prefs].map((p) => regionOf(p)?.area).filter(Boolean))
    return {
      spots,
      prefs: prefs.size,
      areas: areas.size,
      bonus: Math.floor(spots / 10),
      achv: achv.paidCount,
    }
  })
  const earned = computed(() => {
    const b = breakdown.value
    return (
      b.spots * TICKET_RULES.spot +
      b.prefs * TICKET_RULES.pref +
      b.areas * TICKET_RULES.area +
      b.bonus * TICKET_RULES.every10 +
      b.achv * TICKET_RULES.achv
    )
  })
  const left = computed(() => Math.max(0, earned.value - used.value))
  const canSpend = (n = 1) => UNLIMITED_DRAWS || left.value >= n

  /** 用掉 n 張；不夠時回傳 false（測試期不限） */
  function spend(n = 1): boolean {
    if (!canSpend(n)) return false
    used.value += n
    void save()
    return true
  }
  /** 這個景點第一次去過的免費抽：還沒用過就記下來並回傳 true */
  function claimFree(spotId: string): boolean {
    if (free.value.has(spotId)) return false
    free.value = new Set([...free.value, spotId])
    void save()
    return true
  }

  return { used, free, breakdown, earned, left, canSpend, spend, claimFree }
})
