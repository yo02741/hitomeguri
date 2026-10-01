import raw from '../../../data/regions.json'

export interface RegionName {
  ja: string
  kana: string
  romaji: string
  zh_tw: string
}

export interface Region {
  prefecture: string
  name: RegionName
  area: string
  area_name: string
  motif_zh: string
  /** 地區色（regions.json 產生的 token 值）：canvas 畫分享圖時用，CSS 一律用 regions.css 的變數 */
  color: Record<string, string>
}

export const regions: Region[] = raw.regions
export const national = raw.national

const byPref = new Map(regions.map((r) => [r.prefecture, r]))

export function regionOf(pref: string | null | undefined): Region | undefined {
  return pref ? byPref.get(pref) : undefined
}

/** 含「都道府縣」字尾的正式名稱，例：奈良 → 奈良県、京都 → 京都府 */
export function prefectureFullName(pref: string): string {
  const ja = regionOf(pref)?.name.ja ?? ''
  if (pref === 'hokkaido') return ja
  if (pref === 'tokyo') return `${ja}都`
  if (pref === 'kyoto' || pref === 'osaka') return `${ja}府`
  return `${ja}県`
}

/** 依地方分組，保留 regions.json 的順序（JIS 順）。 */
export function groupByArea(prefs: string[]): { area: string; areaName: string; items: Region[] }[] {
  const groups: { area: string; areaName: string; items: Region[] }[] = []
  for (const r of regions) {
    if (!prefs.includes(r.prefecture)) continue
    let g = groups.find((x) => x.area === r.area)
    if (!g) {
      g = { area: r.area, areaName: r.area_name, items: [] }
      groups.push(g)
    }
    g.items.push(r)
  }
  return groups
}
