import { defineStore } from 'pinia'
import { ref } from 'vue'

// 探索頁狀態（UX-FLOW.md §5.3）。Phase 0 只用到 activePref 決定整頁地區色。
export const useExploreStore = defineStore('explore', () => {
  const activePref = ref<string | null>(null)

  function setActivePref(pref: string | null) {
    activePref.value = pref
  }

  return { activePref, setActivePref }
})
