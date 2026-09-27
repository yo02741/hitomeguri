// 主題（PLAN.md §1、DESIGN.md §3.2）：顏色取自 theme.css 的 --color-t-*，不寫死色碼。

export interface ThemeDef {
  key: string
  label: string
  /** 24×24 線條圖示路徑（DESIGN.md §6.1：stroke 2、圓頭、不填色） */
  icon: string
}

export const THEMES: ThemeDef[] = [
  { key: 'tea', label: '茶', icon: 'M4 10h13v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z M17 11h1.5a2.5 2.5 0 0 1 0 5H16 M9 3c0 2 2 2 2 4' },
  { key: 'sake', label: '酒', icon: 'M9 3h6 M10 3v4l-2 3v10h8V10l-2-3V3 M8 13h8' },
  { key: 'incense', label: '香', icon: 'M12 21v-9 M8 21h8 M12 12c-2-2 2-4 0-6s2-3 0-4' },
  { key: 'onsen', label: '溫泉', icon: 'M4 17c0 2 3.6 3.5 8 3.5s8-1.5 8-3.5-3.6-3.5-8-3.5S4 15 4 17z M8 11c-1-1.5 1-2.5 0-4 M12 10c-1-1.5 1-2.5 0-4 M16 11c-1-1.5 1-2.5 0-4' },
  { key: 'ramen', label: '拉麵', icon: 'M3 12h18c0 4.8-4 8.5-9 8.5S3 16.8 3 12z M14.5 3 10 12 M19 4l-6 8' },
  { key: 'pokemon', label: '寶可夢', icon: 'M5 8h14l-1 12H6z M9 8V6a3 3 0 0 1 6 0v2' },
  { key: 'goshuin', label: '御朱印・御守', icon: 'M3.5 5.5H12V20H3.5z M12 5.5h8.5V20H12z M14.5 12H18v3.5h-3.5z' },
]

export const themeByKey = new Map(THEMES.map((t) => [t.key, t]))
