// 和風紋樣（DESIGN.md §3.6）：依地方（data/regions.json 的 area）分配，畫在海報區的裝飾圓裡。
// 圖塊定義在 theme.css 的 wa-* utility。

export interface Pattern {
  key: string
  label: string
}

export const PATTERN_BY_AREA: Record<string, Pattern> = {
  hokkaido: { key: 'kikko', label: '亀甲' },
  tohoku: { key: 'asanoha', label: '麻の葉' },
  kanto: { key: 'ichimatsu', label: '市松' },
  chubu: { key: 'uroko', label: '鱗' },
  kinki: { key: 'shippo', label: '七宝' },
  chugoku: { key: 'yagasuri', label: '矢絣' },
  shikoku: { key: 'hishi', label: '菱' },
  kyushu: { key: 'seigaiha', label: '青海波' },
}

/** 沒有地區語境（全國）時用青海波 */
export const NATIONAL_PATTERN: Pattern = { key: 'seigaiha', label: '青海波' }
