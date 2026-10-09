import { computed, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { scrolledAreas, tabAction, tabOf } from '../services/tabNav'

// 手機的分頁（底部分頁列；打橫時在 header 裡，決定事項 N2）：探索／行程／紀錄。
// 各分頁記住上次的位置（決定事項 E2）；記錄由一直掛著的 TabBar 負責（打橫時它只是不顯示），header 共用同一份。
export const TABS = [
  { to: '/', label: '探索', match: ['home', 'explore', 'map', 'region', 'limited'], icon: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z' },
  { to: '/trips', label: '行程', match: ['trips', 'trip', 'prep', 'practice', 'book'], icon: 'M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4' },
  { to: '/log', label: '紀錄', match: ['log', 'cards', 'keiken', 'avatar', 'achievements'], icon: 'M5 4h11l3 3v13H5z M9 11h7 M9 15h7' },
] as const
export type Tab = (typeof TABS)[number]

/** 各分頁上次停留的頁面（fullPath） */
export const lastOfTab = reactive<Record<string, string>>({})

export function useTabNav() {
  const route = useRoute()
  const router = useRouter()
  const current = computed(() => tabOf(TABS, route.name))

  function href(tab: Tab): string {
    return router.resolve(current.value?.to === tab.to ? tab.to : (lastOfTab[tab.to] ?? tab.to)).href
  }

  function onTap(e: MouseEvent, tab: Tab) {
    // 新分頁、新視窗開啟交給瀏覽器
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    const areas = scrolledAreas(document.getElementById('app-main'))
    const action = tabAction(tab, current.value, route.path, lastOfTab[tab.to], areas.length > 0)
    if (action.kind === 'go') void router.push(action.to)
    else if (action.kind === 'top') {
      const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      for (const el of areas) el.scrollTo({ top: 0, behavior })
    }
  }

  return { current, href, onTap }
}
