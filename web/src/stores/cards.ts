import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { decodeVariant, encodeVariant, type Variant } from '../services/cardVariants'
import { ensureSignedIn, firestore } from '../services/userdb'
import { useUserStore } from './user'

// 收集卡無限抽抽到的樣式（DESIGN.md §7.19a，測試期）：Firestore users/{uid}/cards/{景點 id}，v 是樣式代號。
// Firestore 規則還沒發布、或寫不進去時，先記在這台裝置（localStorage），下次寫得進去時一起補上。
const LOCAL = 'hitomeguri:cards'
const MAX = 40

export const useCardsStore = defineStore('cards', () => {
  const userStore = useUserStore()
  /** 景點 id → 樣式代號 */
  const codes = shallowRef<Record<string, string[]>>({})
  let unsubscribe: (() => void) | null = null

  function localKey(uid: string) {
    return `${LOCAL}:${uid}`
  }
  function readLocal(uid: string): Record<string, string[]> {
    try {
      return JSON.parse(localStorage.getItem(localKey(uid)) ?? '{}') as Record<string, string[]>
    } catch {
      return {}
    }
  }
  function writeLocal(uid: string, v: Record<string, string[]>) {
    try {
      localStorage.setItem(localKey(uid), JSON.stringify(v))
    } catch {
      // 存不了就只在這次有效
    }
  }
  function merge(a: Record<string, string[]>, b: Record<string, string[]>): Record<string, string[]> {
    const out = { ...a }
    for (const [id, list] of Object.entries(b)) out[id] = [...new Set([...(out[id] ?? []), ...list])].slice(0, MAX)
    return out
  }

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe?.()
      unsubscribe = null
      codes.value = uid ? readLocal(uid) : {}
      if (!uid) return
      const { fs, db } = await firestore()
      if (userStore.user?.uid !== uid) return
      unsubscribe = fs.onSnapshot(
        fs.collection(db, 'users', uid, 'cards'),
        (snap) => {
          const remote: Record<string, string[]> = {}
          snap.forEach((d) => {
            const v = d.data().v
            if (Array.isArray(v)) remote[d.id] = v.filter((x): x is string => typeof x === 'string')
          })
          codes.value = merge(remote, readLocal(uid))
        },
        () => {
          // 規則還沒發布（permission-denied）：只用這台裝置的
        },
      )
    },
    { immediate: true },
  )

  /** 這個景點無限抽抽到的樣式 */
  function extraOf(spotId: string): Variant[] {
    return (codes.value[spotId] ?? []).map(decodeVariant).filter((v): v is Variant => Boolean(v))
  }

  /** 記下抽到的樣式（基本卡不必記） */
  async function add(spotId: string, variants: Variant[]) {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return
    const fresh = variants.filter((v) => v.kind !== 'base').map(encodeVariant)
    if (!fresh.length) return
    const next = merge(codes.value, { [spotId]: fresh })
    codes.value = next
    writeLocal(uid, merge(readLocal(uid), { [spotId]: fresh }))
    try {
      const { fs, db } = await firestore()
      await fs.setDoc(fs.doc(db, 'users', uid, 'cards', spotId), { v: next[spotId], updated_at: fs.serverTimestamp() })
    } catch {
      // 寫不進去：留在這台裝置
    }
  }

  return { codes, extraOf, add }
})
