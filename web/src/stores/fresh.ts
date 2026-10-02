import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { useUserStore } from './user'

/**
 * NEW 標記（DESIGN.md §7.19b）：新拿到、還沒看過的卡片樣式與服裝。
 * key：卡片 `c:<景點 id>:<樣式 key>`、服裝 `o:<服裝 id>`。看過（放大檢視那一種、點了那件）就拿掉。
 * 只存在這台裝置（localStorage）。
 */
const LOCAL = 'hitomeguri:fresh'

export const cardKey = (spotId: string, variantKey: string) => `c:${spotId}:${variantKey}`
export const outfitKey = (id: string) => `o:${id}`

export const useFreshStore = defineStore('fresh', () => {
  const userStore = useUserStore()
  const keys = shallowRef<Set<string>>(new Set())

  const storageKey = () => `${LOCAL}:${userStore.user?.uid ?? ''}`
  watch(
    () => userStore.user?.uid,
    () => {
      try {
        keys.value = new Set(JSON.parse(localStorage.getItem(storageKey()) ?? '[]') as string[])
      } catch {
        keys.value = new Set()
      }
    },
    { immediate: true },
  )
  function persist() {
    try {
      localStorage.setItem(storageKey(), JSON.stringify([...keys.value].slice(-2000)))
    } catch {
      // 存不了就只在這次
    }
  }

  function add(list: string[]) {
    if (!list.length) return
    keys.value = new Set([...keys.value, ...list])
    persist()
  }
  function seen(list: string[]) {
    if (!list.some((k) => keys.value.has(k))) return
    const next = new Set(keys.value)
    for (const k of list) next.delete(k)
    keys.value = next
    persist()
  }
  const has = (k: string) => keys.value.has(k)
  /** 這個景點有沒看過的樣式 */
  const spotHasNew = (spotId: string) => [...keys.value].some((k) => k.startsWith(`c:${spotId}:`))

  return { keys, add, seen, has, spotHasNew }
})
