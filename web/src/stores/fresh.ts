import { defineStore } from 'pinia'
import { shallowRef, watch } from 'vue'

import { useUserStore } from './user'

/**
 * NEW 標記（DESIGN.md §7.19b）：新拿到、還沒看過的卡片樣式、服裝與成就。
 * key：卡片 `c:<景點 id>:<樣式 key>`、服裝 `o:<服裝 id>`、成就 `a:<成就 id>`（初訪 `a:pref-<縣>`）。
 * 看過（放大檢視那一種、點了那件、打開那個成就）就拿掉；離開成就頁時清掉全部 `a:`。
 * 只存在這台裝置（localStorage）。
 */
const LOCAL = 'hitomeguri:fresh'

export const cardKey = (spotId: string, variantKey: string) => `c:${spotId}:${variantKey}`
export const outfitKey = (id: string) => `o:${id}`
export const achvKey = (id: string) => `a:${id}`

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
  /** 這個景點有沒看過的樣式：只算現在還有的樣式（拿掉的樣式、以前的銀箔金箔留下的標記不算） */
  const spotHasNew = (spotId: string, variants: readonly { key: string }[]) => variants.some((v) => keys.value.has(cardKey(spotId, v.key)))

  return { keys, add, seen, has, spotHasNew }
})
