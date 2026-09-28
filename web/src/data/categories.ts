// 景點類型分組：map bundle 的 `c`（由 pipeline 的類型標籤而來）歸到較粗的組別，
// 讓清單可以依類型篩選。文化指定（世界遺產等）是屬性，不在這裡。

export interface CategoryGroup {
  key: string
  label: string
  tags: string[]
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: 'shrine', label: '寺社', tags: ['寺院', '神社'] },
  { key: 'castle', label: '城・史跡', tags: ['城', '遺跡', '史跡'] },
  { key: 'museum', label: '博物館', tags: ['博物館', '美術館'] },
  { key: 'nature', label: '自然', tags: ['公園', '庭園', '展望', '名勝', '橋'] },
  { key: 'coast', label: '島・海岸', tags: ['島', '海灘', '岬'] },
  { key: 'shop', label: '購物・市場', tags: ['購物', '市場', '街區'] },
  { key: 'fun', label: '娛樂', tags: ['主題樂園', '動物園', '水族館'] },
  { key: 'other', label: '其他', tags: [] },
]

const groupOfTag = new Map(CATEGORY_GROUPS.flatMap((g) => g.tags.map((t) => [t, g.key] as const)))

export function categoryGroup(c: string | undefined): string {
  return (c && groupOfTag.get(c)) || 'other'
}
