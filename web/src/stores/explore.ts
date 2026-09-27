import { defineStore } from 'pinia'
import { ref } from 'vue'

// 探索頁狀態（UX-FLOW.md §5.3）。themes 與 URL query `?themes=` 同步（A4）。
export const useExploreStore = defineStore('explore', () => {
  const activePref = ref<string | null>(null)
  const featuredOnly = ref(true)
  const showMajor = ref(true)
  const themes = ref<string[]>([])

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

  function toggleTheme(key: string) {
    themes.value = themes.value.includes(key)
      ? themes.value.filter((t) => t !== key)
      : [...themes.value, key]
  }

  return { activePref, featuredOnly, showMajor, themes, setActivePref, toggleTheme }
})
