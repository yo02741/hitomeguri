// 擴充包（PLAN.md §1 主題層、UX-FLOW.md A4）：疊在大點上的全國性小點（pipeline/packs.py、pack_*.py）。
// 顏色取自主題色 token（--color-t-<color>）。圖示是 24×24 線條路徑（DESIGN.md §6.1：stroke 2、圓頭、不填色）。
// 只列已經有資料的擴充包。

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
    icon: 'M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2',
    groups: [
      { key: 'lid', label: '人孔蓋' },
      { key: 'center', label: '寶可夢中心' },
      { key: 'store', label: '寶可夢商店' },
    ],
    idPrefixes: ['pokefuta-', 'pokecen-'],
  },
  {
    key: 'castle',
    label: '城',
    color: 'castle',
    icon: 'M4 21h16 M6 21v-6h12v6 M8 15v-4h8v4 M10 11V8h4v3 M4 15h16 M6 11h12 M8.5 8h7 M10.5 21v-3h3v3',
    groups: [
      { key: '100', label: '日本100名城' },
      { key: 'zoku', label: '続日本100名城' },
    ],
    idPrefixes: ['castle-'],
  },
  {
    key: 'shinise',
    label: '老舖・茶屋',
    color: 'shinise',
    icon: 'M3 4h18 M5 4v11h14V4 M9.7 4v11 M14.3 4v11 M7 19h10',
    groups: [
      { key: 'incense', label: '香舖' },
      { key: 'wagashi', label: '和菓子' },
      { key: 'tea', label: '茶舖' },
      { key: 'teahouse', label: '茶屋・甘味處' },
    ],
    idPrefixes: ['shinise-'],
  },
  {
    key: 'chara',
    label: '角色商店',
    color: 'chara',
    icon: 'M12 20.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z M6.5 7.5 5 3.5l4 2 M17.5 7.5 19 3.5l-4 2 M9.5 12v.5 M14.5 12v.5 M10 15.5c1.2.8 2.8.8 4 0',
    groups: [
      { key: 'nintendo', label: '任天堂' },
      { key: 'ghibli', label: '吉卜力' },
      { key: 'sanrio', label: '三麗鷗' },
      { key: 'chiikawa', label: '吉伊卡哇' },
      { key: 'kirby', label: '星之卡比' },
      { key: 'onepiece', label: '航海王' },
      { key: 'jump', label: 'Jump Shop' },
      { key: 'snoopy', label: '史努比' },
      { key: 'disney', label: '迪士尼' },
    ],
    idPrefixes: ['chara-'],
  },
]

export const packByKey = new Map(PACKS.map((p) => [p.key, p]))

/** id 屬於哪個擴充包；景點回傳 undefined */
export function packOfId(id: string): string | undefined {
  return PACKS.find((p) => p.idPrefixes.some((prefix) => id.startsWith(prefix)))?.key
}
