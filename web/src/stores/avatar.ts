import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import { useVisitedEntries } from '../composables/visited'
import { DEFAULT_EQUIPPED, type EyeStyle, type HairStyle, OUTFITS, outfitById, type Outfit, type Slot, STARTER_IDS } from '../data/outfits'
import { UNLIMITED_DRAWS } from '../services/cardVariants'
import { ensureSignedIn, firestore } from '../services/userdb'
import { useUserStore } from './user'

/**
 * 旅人（紙娃娃，DESIGN.md §7.24）：外觀、穿著、有的服裝、抽過幾次。存在 users/{uid}/meta/avatar，
 * 只有本人讀寫；規則還沒發布或離線寫不進去時先存在這台裝置。
 * 各縣的特色單品去過那個縣就有（不用存）；其他服裝用旅行得到的抽獎機會抽：
 * 去過一個景點 1 次、結束一趟旅行 3 次。測試期（UNLIMITED_DRAWS）不限。
 */
export interface AvatarParts {
  skin: 1 | 2 | 3
  hair: HairStyle
  hairColor: 1 | 2 | 3 | 4 | 5
  eyes: EyeStyle
  /** 舞台的背景：去過的縣（沒選就是最近去的縣） */
  stage?: string
}
interface Saved {
  parts: AvatarParts
  equipped: Partial<Record<Slot, string>>
  owned: string[]
  used: number
}
const DEFAULT_PARTS: AvatarParts = { skin: 1, hair: 'bob', hairColor: 1, eyes: 'round' }
const LOCAL = 'hitomeguri:avatar'
const WEIGHT: Record<Outfit['rarity'], number> = { 1: 6, 2: 3, 3: 1 }

export const useAvatarStore = defineStore('avatar', () => {
  const userStore = useUserStore()
  const { entries, doneTrips } = useVisitedEntries()
  const parts = shallowRef<AvatarParts>(DEFAULT_PARTS)
  const equipped = shallowRef<Partial<Record<Slot, string>>>(DEFAULT_EQUIPPED)
  const owned = shallowRef<string[]>(STARTER_IDS)
  const used = ref(0)
  const loaded = ref(false)
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
    parts.value = { ...DEFAULT_PARTS, ...(d.parts ?? {}) }
    equipped.value = d.equipped ?? DEFAULT_EQUIPPED
    owned.value = [...new Set([...STARTER_IDS, ...(d.owned ?? [])])].filter((id) => outfitById.has(id))
    used.value = d.used ?? 0
  }

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe?.()
      unsubscribe = null
      loaded.value = false
      apply(uid ? readLocal(uid) : {})
      if (!uid) return
      try {
        const { fs, db } = await firestore()
        if (userStore.user?.uid !== uid) return
        unsubscribe = fs.onSnapshot(
          fs.doc(db, 'users', uid, 'meta', 'avatar'),
          (snap) => {
            const remote = (snap.data() ?? {}) as Partial<Saved>
            const local = readLocal(uid)
            // 兩邊合併：有的服裝取聯集，抽過的次數取大的，外觀以本機最後改的為準
            apply({
              parts: local.parts ?? remote.parts,
              equipped: local.equipped ?? remote.equipped,
              owned: [...(remote.owned ?? []), ...(local.owned ?? [])],
              used: Math.max(remote.used ?? 0, local.used ?? 0),
            })
            loaded.value = true
          },
          () => (loaded.value = true),
        )
      } catch {
        loaded.value = true
      }
    },
    { immediate: true },
  )

  async function save() {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return
    const data: Saved = { parts: parts.value, equipped: equipped.value, owned: owned.value, used: used.value }
    try {
      localStorage.setItem(key(uid), JSON.stringify(data))
    } catch {
      // 存不了就只留在這次
    }
    try {
      const { fs, db } = await firestore()
      await fs.setDoc(fs.doc(db, 'users', uid, 'meta', 'avatar'), { ...data, updated_at: fs.serverTimestamp() })
    } catch {
      // 規則還沒發布：留在這台裝置
    }
  }

  /** 去過的縣 */
  const visitedPrefs = computed(() => new Set(entries.value.map(([, m]) => m.pref)))
  /** 有的服裝：抽到的＋去過的縣的特色單品 */
  const ownedIds = computed(() => new Set([...owned.value, ...OUTFITS.filter((o) => o.pref && visitedPrefs.value.has(o.pref)).map((o) => o.id)]))
  const has = (id: string) => ownedIds.value.has(id)
  /** 抽獎機會：去過一個景點 1 次、結束一趟旅行 3 次，扣掉抽過的 */
  const earned = computed(() => entries.value.length + doneTrips.value.length * 3)
  const ticketsLeft = computed(() => Math.max(0, earned.value - used.value))
  const canDraw = computed(() => UNLIMITED_DRAWS || ticketsLeft.value > 0)
  /** 抽得到的：不是各縣限定的，加上去過的縣的 */
  const pool = computed(() => OUTFITS.filter((o) => !o.pref || visitedPrefs.value.has(o.pref)))

  function setParts(p: Partial<AvatarParts>) {
    parts.value = { ...parts.value, ...p }
    void save()
  }
  function equip(slot: Slot, id: string | null) {
    const next = { ...equipped.value }
    if (id && has(id)) next[slot] = id
    else delete next[slot]
    equipped.value = next
    void save()
  }
  /** 抽一件：還沒有的優先（都有了就隨便抽，當作重複） */
  function draw(): { outfit: Outfit; duplicate: boolean } | null {
    if (!canDraw.value) return null
    const fresh = pool.value.filter((o) => !ownedIds.value.has(o.id))
    const from = fresh.length ? fresh : pool.value
    const total = from.reduce((s, o) => s + WEIGHT[o.rarity], 0)
    let r = Math.random() * total
    let picked = from[from.length - 1]!
    for (const o of from) {
      r -= WEIGHT[o.rarity]
      if (r < 0) {
        picked = o
        break
      }
    }
    const duplicate = ownedIds.value.has(picked.id)
    if (!duplicate) owned.value = [...owned.value, picked.id]
    used.value += 1
    void save()
    return { outfit: picked, duplicate }
  }

  return { parts, equipped, owned, used, loaded, visitedPrefs, ownedIds, has, earned, ticketsLeft, canDraw, pool, setParts, equip, draw }
})
