// 擴充包（PLAN.md §1 主題層、UX-FLOW.md A4）：疊在大點上的全國性小點。
// 顏色取自主題色 token（--color-t-<color>），圖示沿用主題圖示。只列已經有資料的擴充包。

import { themeByKey } from './themes'

export interface PackGroup {
  key: string
  label: string
}

export interface PackDef {
  key: string
  label: string
  /** 主題色 token 名（--color-t-*） */
  color: string
  icon: string
  groups: PackGroup[]
  /** 這個擴充包的點的 id 前綴（pipeline/packs.py）；選取時依此判斷不是景點 */
  idPrefixes: string[]
}

export const PACKS: PackDef[] = [
  {
    key: 'pokemon',
    label: '寶可夢',
    color: 'pokemon',
    icon: themeByKey.get('pokemon')!.icon,
    groups: [
      { key: 'lid', label: '人孔蓋' },
      { key: 'center', label: '寶可夢中心' },
      { key: 'store', label: '寶可夢商店' },
    ],
    idPrefixes: ['pokefuta-', 'pokecen-'],
  },
]

export const packByKey = new Map(PACKS.map((p) => [p.key, p]))

/** id 屬於哪個擴充包；景點回傳 undefined */
export function packOfId(id: string): string | undefined {
  return PACKS.find((p) => p.idPrefixes.some((prefix) => id.startsWith(prefix)))?.key
}
