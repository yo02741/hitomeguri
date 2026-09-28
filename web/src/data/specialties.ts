// 地區特色的分組（深度探索頁）：pipeline 的 Specialty.category → 組別。
// 順序即頁面上的順序；沒有資料的組別不顯示。

export interface SpecialtyGroup {
  key: string
  label: string
  categories: string[]
}

export const SPECIALTY_GROUPS: SpecialtyGroup[] = [
  { key: 'food', label: '料理・小吃', categories: ['food', 'kyodo'] },
  { key: 'ramen', label: '拉麵', categories: ['ramen'] },
  { key: 'sweets', label: '甜點', categories: ['sweets'] },
  { key: 'drink', label: '茶・酒', categories: ['drink', 'tea', 'sake'] },
  { key: 'produce', label: '農產', categories: ['fruit', 'produce'] },
  { key: 'craft', label: '工藝', categories: ['craft'] },
]

const groupOf = new Map(SPECIALTY_GROUPS.flatMap((g) => g.categories.map((c) => [c, g.key] as const)))

export function specialtyGroup(category: string): string {
  return groupOf.get(category) ?? 'food'
}
