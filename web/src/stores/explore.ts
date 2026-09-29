import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

import { PACKS } from '../data/packs'
import type { SearchHit } from '../services/search'

const PACKS_KEY = 'hitomeguri:packs'
const RAIL_KEY = 'hitomeguri:rail'

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
function saveFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* 略過 */
  }
}

function loadEnabled(): string[] {
  try {
    const raw = localStorage.getItem(PACKS_KEY)
    if (raw) {
      const list = JSON.parse(raw) as unknown
      if (Array.isArray(list)) return list.filter((k): k is string => typeof k === 'string')
    }
  } catch {
    /* 私密模式等情況：用預設 */
  }
  return PACKS.map((p) => p.key)
}

// 探索頁狀態（UX-FLOW.md §5.3）。pack 與 URL query `?pack=` 同步（A4）。
export const useExploreStore = defineStore('explore', () => {
  const activePref = ref<string | null>(null)
  // 景點類型篩選（data/categories.ts 的組別 key）；null 為不限
  const category = ref<string | null>(null)
  // 目前開啟的擴充包（一次一個）；null 為景點清單
  const pack = ref<string | null>(null)
  // 擴充包清單的組別篩選
  const packGroup = ref<string | null>(null)
  // 使用者選擇顯示的擴充包（設定選單）；存在這台瀏覽器
  const enabledPacks = ref<string[]>(loadEnabled())
  watch(enabledPacks, (list) => {
    try {
      localStorage.setItem(PACKS_KEY, JSON.stringify(list))
    } catch {
      /* 略過 */
    }
    if (pack.value && !list.includes(pack.value)) pack.value = null
  })
  watch(pack, () => (packGroup.value = null))
  // 收合的清單分段（首頁的地方 `area:*`、景點類型 `cat:*`、擴充包組別或縣 `pack:*`）
  const collapsed = ref<string[]>([])
  function toggleCollapsed(key: string) {
    collapsed.value = collapsed.value.includes(key)
      ? collapsed.value.filter((k) => k !== key)
      : [...collapsed.value, key]
  }
  // 鐵路圖層（地圖上方的開關）；存在這台瀏覽器
  const rail = ref(loadFlag(RAIL_KEY))
  watch(rail, (on) => saveFlag(RAIL_KEY, on))
  // header 搜尋選到的結果，由探索頁接手（進入該縣、選取景點）
  const searchPick = shallowRef<SearchHit | null>(null)

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

  function togglePack(key: string) {
    pack.value = pack.value === key ? null : key
  }

  function setPackEnabled(key: string, on: boolean) {
    const rest = enabledPacks.value.filter((k) => k !== key)
    enabledPacks.value = on ? PACKS.map((p) => p.key).filter((k) => k === key || rest.includes(k)) : rest
  }

  return {
    activePref, category, pack, packGroup, enabledPacks, searchPick, collapsed, rail,
    setActivePref, togglePack, setPackEnabled, toggleCollapsed,
  }
})
