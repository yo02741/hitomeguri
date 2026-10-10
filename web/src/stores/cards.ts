import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { cleanTasks, drawnSeasons, encodeVariant, type TaskKey, type Variant } from '../services/cardVariants'
import { ensureSignedIn, firestore } from '../services/userdb'
import { useUserStore } from './user'

// 收集卡（DESIGN.md §7.19a）：Firestore users/{uid}/cards/{景點 id}。
// v 是抽到的季節（樣式代號 season-spring…；以前的全景、銀箔、金箔等代號讀到時略過，下次寫入時拿掉），
// t 是這個景點勾了的任務（night、stamp、ink；只存勾選，不存文字），
// c 是收集冊的封面（樣式的 key：base、full、season-spring…），沒選就是基本卡。
// Firestore 規則還沒發布、或寫不進去時，先記在這台裝置（localStorage），下次寫得進去時一起補上。
const LOCAL = 'hitomeguri:cards'
const LOCAL_COVER = 'hitomeguri:covers'
const LOCAL_TASKS = 'hitomeguri:card-tasks'
const MAX = 40

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null
  } catch {
    return null
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // 存不了就只在這次有效
  }
}

export const useCardsStore = defineStore('cards', () => {
  const userStore = useUserStore()
  /** 景點 id → 樣式代號（抽到的季節） */
  const codes = shallowRef<Record<string, string[]>>({})
  /** 景點 id → 封面（樣式的 key） */
  const covers = shallowRef<Record<string, string>>({})
  /** 景點 id → 勾了的任務 */
  const tasks = shallowRef<Record<string, TaskKey[]>>({})
  let unsubscribe: (() => void) | null = null

  const readLocal = (uid: string) => readJson<Record<string, string[]>>(`${LOCAL}:${uid}`) ?? {}
  const readCovers = (uid: string) => readJson<Record<string, string>>(`${LOCAL_COVER}:${uid}`) ?? {}
  /** 還沒寫進 Firestore 的任務（寫進去了就拿掉，之後以 Firestore 為準：別台裝置取消勾選才不會被這台勾回來） */
  const readTasks = (uid: string) => readJson<Record<string, TaskKey[]>>(`${LOCAL_TASKS}:${uid}`) ?? {}
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
      covers.value = uid ? readCovers(uid) : {}
      tasks.value = uid ? readTasks(uid) : {}
      if (!uid) return
      let flushed = false
      const { fs, db } = await firestore()
      if (userStore.user?.uid !== uid) return
      unsubscribe = fs.onSnapshot(
        fs.collection(db, 'users', uid, 'cards'),
        (snap) => {
          const remote: Record<string, string[]> = {}
          const remoteCovers: Record<string, string> = {}
          const remoteTasks: Record<string, TaskKey[]> = {}
          snap.forEach((d) => {
            const { v, c, t } = d.data()
            if (Array.isArray(v)) remote[d.id] = v.filter((x): x is string => typeof x === 'string')
            if (typeof c === 'string') remoteCovers[d.id] = c
            if (Array.isArray(t)) remoteTasks[d.id] = cleanTasks(t)
          })
          codes.value = merge(remote, readLocal(uid))
          // 封面：這台裝置上改過的為準
          covers.value = { ...remoteCovers, ...readCovers(uid) }
          const pending = readTasks(uid)
          tasks.value = { ...remoteTasks, ...pending }
          // 這台裝置記著、還沒寫進去的任務：第一次讀得到 Firestore 時補寫
          if (!flushed) {
            flushed = true
            for (const id of Object.keys(pending)) void write(id)
          }
        },
        () => {
          // 規則還沒發布（permission-denied）：只用這台裝置的
        },
      )
    },
    { immediate: true },
  )

  /** 這個景點存著的代號（抽到的季節） */
  function codesOf(spotId: string): string[] {
    return codes.value[spotId] ?? []
  }
  /** 這個景點勾了的任務 */
  function tasksOf(spotId: string): TaskKey[] {
    return tasks.value[spotId] ?? []
  }

  /** 記下抽到的季節卡（其他樣式由紀錄算出來，不記） */
  async function add(spotId: string, variants: Variant[]) {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return
    const fresh = variants.filter((v) => v.kind === 'season').map(encodeVariant)
    if (!fresh.length) return
    codes.value = merge(codes.value, { [spotId]: fresh })
    writeJson(`${LOCAL}:${uid}`, merge(readLocal(uid), { [spotId]: fresh }))
    await write(spotId)
  }

  /** 勾選、取消一個任務 */
  async function setTask(spotId: string, task: TaskKey, on: boolean) {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return
    const cur = new Set(tasksOf(spotId))
    if (on) cur.add(task)
    else cur.delete(task)
    const next = cleanTasks(cur)
    tasks.value = { ...tasks.value, [spotId]: next }
    writeJson(`${LOCAL_TASKS}:${uid}`, { ...readTasks(uid), [spotId]: next })
    await write(spotId)
  }

  /** 收集冊的封面：沒選就是基本卡 */
  function coverOf(spotId: string): string {
    return covers.value[spotId] ?? 'base'
  }
  async function setCover(spotId: string, key: string) {
    const uid = await ensureSignedIn(userStore)
    if (!uid) return
    covers.value = { ...covers.value, [spotId]: key }
    writeJson(`${LOCAL_COVER}:${uid}`, { ...readCovers(uid), [spotId]: key })
    await write(spotId)
  }

  /** 寫進 Firestore；寫進去了回傳 true */
  async function write(spotId: string): Promise<boolean> {
    const uid = userStore.user?.uid
    if (!uid) return false
    // 只存抽到的季節：以前的銀箔、金箔、抽到的全景等代號在這裡拿掉。
    // 沒勾任務就不寫 t（setDoc 整份取代，沒有 t 就是都沒勾）
    const data: Record<string, unknown> = { v: drawnSeasons(codesOf(spotId)).map((s) => `season-${s}`) }
    const t = tasksOf(spotId)
    if (t.length) data.t = t
    const c = covers.value[spotId]
    if (c) data.c = c
    try {
      const { fs, db } = await firestore()
      await fs.setDoc(fs.doc(db, 'users', uid, 'cards', spotId), { ...data, updated_at: fs.serverTimestamp() })
      // 寫進去了：這個景點的任務以 Firestore 為準，這台裝置記著的拿掉
      const pending = readTasks(uid)
      if (spotId in pending) {
        delete pending[spotId]
        writeJson(`${LOCAL_TASKS}:${uid}`, pending)
      }
      return true
    } catch {
      // 寫不進去：留在這台裝置
      return false
    }
  }

  return { codes, covers, tasks, codesOf, tasksOf, add, setTask, coverOf, setCover }
})
