import { shallowRef } from 'vue'

import type { Outfit } from '../data/outfits'

/**
 * 地區背景的畫（DESIGN.md §7.24b）：服裝清單裡的背景只有目錄（backgrounds/meta.ts），svg 是空的；
 * 141 張的畫（原始碼約 600 KB）等第一次要畫背景時才下載。散步的旅人、頭像不畫背景，所以全站不用載入。
 */
const art = shallowRef<ReadonlyMap<string, string> | null>(null)
let loading: Promise<void> | null = null

function load() {
  loading ??= import('../data/backgrounds')
    .then(({ BG_OUTFITS }) => {
      art.value = new Map(BG_OUTFITS.map((o) => [o.id, o.svg]))
    })
    .catch(() => {
      // 離線載不到：之後再試
      loading = null
    })
}

/** 單品的 SVG：背景從載入的畫裡拿（還沒載好是空的，載好會重畫），其他照舊 */
export function artOf(o: Pick<Outfit, 'id' | 'slot' | 'svg'>): string {
  if (o.slot !== 'bg') return o.svg
  const map = art.value
  if (!map) {
    load()
    return ''
  }
  return map.get(o.id) ?? ''
}
