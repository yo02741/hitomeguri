import { defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'

import { PACKS } from '../data/packs'
import type { SearchHit } from '../services/search'

// 關掉的擴充包（存關掉的，之後新增的擴充包預設開啟）；舊版存的是開啟清單（當時只有寶可夢）
const PACKS_OFF_KEY = 'hitomeguri:packs-off'
const LEGACY_PACKS_KEY = 'hitomeguri:packs'
const FOCUS_OFF_KEY = 'hitomeguri:focus-off'

function readList(key: string): string[] | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const list = JSON.parse(raw) as unknown
  return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : null
}

function loadEnabled(): string[] {
  const all = PACKS.map((p) => p.key)
  try {
    const off = readList(PACKS_OFF_KEY)
    if (off) return all.filter((k) => !off.includes(k))
    const legacy = readList(LEGACY_PACKS_KEY)
    if (legacy) return all.filter((k) => k !== 'pokemon' || legacy.includes(k))
  } catch {
    /* 私密模式等情況：用預設 */
  }
  return all
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
      localStorage.setItem(PACKS_OFF_KEY, JSON.stringify(PACKS.map((p) => p.key).filter((k) => !list.includes(k))))
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
  // 地圖只顯示收藏的景點（地圖上方的開關；不存）
  const onlyFavorites = ref(false)
  // 專心模式（UX-FLOW.md §1.3）：進入一縣後地圖鎖在這個縣、只畫這個縣的點。關掉時可以拖到別縣，
  // 縣跟著地圖換（看新幹線、隨意逛）。地圖上方的「只看○○」開關，存在這台瀏覽器
  const focusLock = ref(true)
  try {
    focusLock.value = localStorage.getItem(FOCUS_OFF_KEY) !== '1'
  } catch {
    /* 私密模式等情況：用預設 */
  }
  watch(focusLock, (on) => {
    try {
      if (on) localStorage.removeItem(FOCUS_OFF_KEY)
      else localStorage.setItem(FOCUS_OFF_KEY, '1')
    } catch {
      /* 略過 */
    }
  })
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
    activePref, category, pack, packGroup, enabledPacks, searchPick, collapsed, onlyFavorites, focusLock,
    setActivePref, togglePack, setPackEnabled, toggleCollapsed,
  }
})
