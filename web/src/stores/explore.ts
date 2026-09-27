import { defineStore } from 'pinia'
import { ref } from 'vue'

// 探索頁狀態（UX-FLOW.md §5.3）。
export const useExploreStore = defineStore('explore', () => {
  const activePref = ref<string | null>(null)
  const featuredOnly = ref(true)

  function setActivePref(pref: string | null) {
    activePref.value = pref
    if (pref) {
      try {
        localStorage.setItem('hitomeguri:lastPref', pref)
      } catch {
        /* 私密模式等情況：略過 */
      }
    }
  }

  return { activePref, featuredOnly, setActivePref }
})
