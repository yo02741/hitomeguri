// 浮世繪裡的景點（DESIGN.md §7.19c）：bundle 的整理與圖片網址。畫面在 views/UkiyoeView.vue。
import type { Region } from '../data/regions'
import { COMMONS_THUMB_PREFIX, type UkiyoeSpot, type UkiyoeWork } from './bundles'

/** Commons 的標準縮圖寬度（其他寬度會被拒絕）：格子用 500，放大用 960 */
export type PrintWidth = 500 | 960

/** 作品圖的網址：縮圖路徑換成要的寬度；完整網址（原圖比縮圖小）照原樣 */
export function printUrl(f: string, w: PrintWidth): string {
  if (/^https?:\/\//.test(f)) return f
  return COMMONS_THUMB_PREFIX + f.replace(/\/\d+px-(?=[^/]*$)/, `/${w}px-`)
}

/** 系列・年份（有的才寫） */
export function workMeta(w: UkiyoeWork): string {
  return [w.se, w.y != null ? `${w.y}年` : ''].filter(Boolean).join('・')
}

/** 圖的出處：作者・授權（作者不明時只寫授權） */
export function workCredit(w: UkiyoeWork): string {
  const author = w.a && w.a !== '不明' ? w.a : ''
  return [author, w.l].filter(Boolean).join('・')
}

export interface UkiyoeGroup {
  region: Region
  spots: UkiyoeSpot[]
}

/** 依縣分組（regions 的順序，北到南），縣內依分數高到低 */
export function groupUkiyoe(spots: UkiyoeSpot[], regions: Region[]): UkiyoeGroup[] {
  const by = new Map<string, UkiyoeSpot[]>()
  for (const s of spots) {
    const list = by.get(s.p) ?? []
    list.push(s)
    by.set(s.p, list)
  }
  return regions.flatMap((r) => {
    const list = by.get(r.prefecture)
    if (!list?.length) return []
    return [{ region: r, spots: [...list].sort((a, b) => b.sc - a.sc || a.s.localeCompare(b.s)) }]
  })
}

/** 放大檢視依頁面順序左右切換：每幅作品和它的景點 */
export interface PrintRef {
  spot: UkiyoeSpot
  work: UkiyoeWork
}
export function flattenPrints(groups: UkiyoeGroup[]): PrintRef[] {
  return groups.flatMap((g) => g.spots.flatMap((spot) => spot.w.map((work) => ({ spot, work }))))
}
