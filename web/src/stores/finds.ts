import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import type { PreparedImage } from '../services/image'
import { ensureSignedIn, firestore } from '../services/userdb'
import { useUserStore } from './user'

// 截圖收藏（期間限定的另一個來源）：使用者自己上傳看到的限定商品截圖，加上品牌、品項、說明。
// 本站不抓超商、麥當勞的網站（使用條款不允許），截圖只存在使用者自己的帳號裡。
// users/{uid}/finds/{id}：文字欄位＋縮圖；users/{uid}/find_images/{id}：原圖（打開大圖時才讀）。

export interface Find {
  id: string
  brand: string
  item: string
  note: string
  thumb: string
  w: number
  h: number
  trip_id?: string
  created: number
}

export type FindFields = Pick<Find, 'brand' | 'item' | 'note'> & { trip_id?: string }

// firestore.rules 的上限
export const FIND_LIMITS = { brand: 40, item: 80, note: 500 } as const

export const useFindsStore = defineStore('finds', () => {
  const userStore = useUserStore()
  const finds = shallowRef<Find[]>([])
  const loaded = ref(false)
  const error = ref<string | null>(null)
  const images = new Map<string, string>()
  let unsubscribe: (() => void) | null = null

  watch(
    () => userStore.user?.uid,
    async (uid) => {
      unsubscribe?.()
      unsubscribe = null
      finds.value = []
      loaded.value = false
      images.clear()
      if (!uid) return
      const { fs, db } = await firestore()
      if (userStore.user?.uid !== uid) return
      unsubscribe = fs.onSnapshot(fs.collection(db, 'users', uid, 'finds'), (snap) => {
        const next: Find[] = []
        snap.forEach((d) => {
          const x = d.data({ serverTimestamps: 'estimate' })
          next.push({
            id: d.id,
            brand: String(x.brand ?? ''),
            item: String(x.item ?? ''),
            note: String(x.note ?? ''),
            thumb: String(x.thumb ?? ''),
            w: Number(x.w) || 1,
            h: Number(x.h) || 1,
            trip_id: x.trip_id,
            created: x.created_at?.toMillis?.() ?? 0,
          })
        })
        finds.value = next.sort((a, b) => b.created - a.created)
        loaded.value = true
      })
    },
    { immediate: true },
  )

  async function withUser<T>(fn: (uid: string) => Promise<T>): Promise<T | undefined> {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return undefined
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

  function clean(f: FindFields): Record<string, string> {
    const out: Record<string, string> = {
      brand: f.brand.trim().slice(0, FIND_LIMITS.brand),
      item: f.item.trim().slice(0, FIND_LIMITS.item),
      note: f.note.trim().slice(0, FIND_LIMITS.note),
    }
    if (f.trip_id) out.trip_id = f.trip_id
    return out
  }

  /** 新增：原圖與清單文件一起寫入。回傳 id */
  function add(img: PreparedImage, fields: FindFields) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const ref = fs.doc(fs.collection(db, 'users', uid, 'finds'))
      const batch = fs.writeBatch(db)
      batch.set(fs.doc(db, 'users', uid, 'find_images', ref.id), { data: img.full, created_at: fs.serverTimestamp() })
      batch.set(ref, {
        ...clean(fields),
        thumb: img.thumb,
        w: img.w,
        h: img.h,
        created_at: fs.serverTimestamp(),
        updated_at: fs.serverTimestamp(),
      })
      await batch.commit()
      images.set(ref.id, img.full)
      return ref.id
    })
  }

  function update(id: string, fields: FindFields) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const data: Record<string, unknown> = { ...clean(fields), updated_at: fs.serverTimestamp() }
      if (!fields.trip_id) data.trip_id = fs.deleteField()
      await fs.updateDoc(fs.doc(db, 'users', uid, 'finds', id), data)
    })
  }

  function remove(id: string) {
    return withUser(async (uid) => {
      const { fs, db } = await firestore()
      const batch = fs.writeBatch(db)
      batch.delete(fs.doc(db, 'users', uid, 'finds', id))
      batch.delete(fs.doc(db, 'users', uid, 'find_images', id))
      await batch.commit()
      images.delete(id)
    })
  }

  /** 原圖（第一次讀取後留在記憶體） */
  async function image(id: string): Promise<string | null> {
    const hit = images.get(id)
    if (hit) return hit
    const uid = userStore.user?.uid
    if (!uid) return null
    const { fs, db } = await firestore()
    const snap = await fs.getDoc(fs.doc(db, 'users', uid, 'find_images', id))
    const data = snap.exists() ? String(snap.data().data ?? '') : ''
    if (data) images.set(id, data)
    return data || null
  }

  const brands = computed(() => [...new Set(finds.value.map((f) => f.brand).filter(Boolean))])
  function forTrip(tripId: string): Find[] {
    return finds.value.filter((f) => f.trip_id === tripId)
  }

  return { finds, loaded, error, brands, forTrip, add, update, remove, image }
})
