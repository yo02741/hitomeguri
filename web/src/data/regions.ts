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

/** 地方的繁中名稱（regions.json 的 area_name 是日文，「中国」在台灣會讀成 China） */
export const AREA_ZH: Record<string, string> = {
  hokkaido: '北海道',
  tohoku: '東北',
  kanto: '關東',
  chubu: '中部',
  kinki: '近畿',
  chugoku: '中國地方',
  shikoku: '四國',
  kyushu: '九州・沖繩',
}

/** 這個地方的縣（regions.json 的順序） */
export function areaPrefs(area: string): string[] {
  return regions.filter((r) => r.area === area).map((r) => r.prefecture)
}

/** 地方的都道府縣數，字尾照 prefectureFullName 的規則：關東「1 都 6 縣」、近畿「2 府 5 縣」、其他「n 縣」 */
export function areaCountLabel(area: string): string {
  const count = { 都: 0, 道: 0, 府: 0, 縣: 0 }
  for (const p of areaPrefs(area)) {
    const suffix = prefectureFullName(p).slice(-1)
    if (suffix === '都' || suffix === '府') count[suffix] += 1
    else if (suffix === '県') count['縣'] += 1
    else count['道'] += 1
  }
  return Object.entries(count)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(' ')
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
