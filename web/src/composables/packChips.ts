import { computed } from 'vue'

import { PACKS } from '../data/packs'
import { useCatalogStore } from '../stores/catalog'
import { useExploreStore } from '../stores/explore'

/**
 * 擴充包的開關鈕（桌機的擴充包列 PackBar、手機的 chip 軌道 ChipRail 共用）：
 * 設定裡勾選、而且已經有 bundle 的擴充包；件數跟著目前的縣，首頁為全國，還沒載入時是 null。
 */
export function usePackChips(pref: () => string | null | undefined) {
  const catalog = useCatalogStore()
  const explore = useExploreStore()
  const shown = computed(() => PACKS.filter((p) => explore.enabledPacks.includes(p.key) && catalog.index?.packs?.[p.key]))
  function count(key: string): number | null {
    const items = catalog.packs[key]
    if (!items) return null
    const p = pref()
    return p ? items.filter((it) => it.p === p).length : items.length
  }
  /** 這個縣沒有這個擴充包的點，而且沒開著：不能點 */
  function empty(key: string): boolean {
    return count(key) === 0 && explore.pack !== key
  }
  return { shown, count, empty }
}
