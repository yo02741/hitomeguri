/**
 * 底部分頁（TabBar，<1024）記住各分頁上次的位置（UX-FLOW.md §1.1、決定事項 E2）：
 * - 點別的分頁：回到那個分頁上次停留的頁面（含 query 與 #hash），沒去過就是分頁的根；
 * - 點目前的分頁：頁面捲過了先捲回頂端，已經在頂端才回到分頁的根。
 * 位置只記在記憶體裡（重新整理就從各分頁的根開始），換帳號時清掉。
 */

export interface TabDef {
  /** 分頁的根 */
  to: string
  /** 屬於這個分頁的路由名稱 */
  match: readonly string[]
}

export type TabAction = { kind: 'go'; to: string } | { kind: 'top' } | { kind: 'none' }

export function tabOf<T extends TabDef>(tabs: readonly T[], routeName: unknown): T | undefined {
  return tabs.find((t) => t.match.includes(String(routeName)))
}

/** 分頁的根：探索的根是首頁，/explore 也算 */
export function atRoot(tab: TabDef, path: string): boolean {
  return path === tab.to || (tab.to === '/' && path === '/explore')
}

/**
 * 點了分頁之後要做什麼。
 * current：目前的路由屬於哪個分頁；last：那個分頁記住的位置；scrolled：目前頁面有沒有捲離頂端。
 */
export function tabAction(tab: TabDef, current: TabDef | undefined, path: string, last: string | undefined, scrolled: boolean): TabAction {
  if (current?.to !== tab.to) return { kind: 'go', to: last ?? tab.to }
  if (scrolled) return { kind: 'top' }
  if (atRoot(tab, path)) return { kind: 'none' }
  return { kind: 'go', to: tab.to }
}

/** 畫面上捲離頂端的捲動區：共用的 <main> 與頁面自己的內層捲動區（深度探索、行程清單、景點卡片…） */
export function scrolledAreas(main: HTMLElement | null): HTMLElement[] {
  if (!main) return []
  const out: HTMLElement[] = []
  if (main.scrollTop > 0) out.push(main)
  for (const el of main.querySelectorAll<HTMLElement>('[class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-y-scroll"]')) {
    if (el.scrollTop > 0 && el.getClientRects().length > 0) out.push(el)
  }
  return out
}
