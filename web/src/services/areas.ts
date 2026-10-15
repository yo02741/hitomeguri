// 縣內的小區塊（docs/PROGRESS.md「縣內規劃」2）：市区町村界（国土数値情報 N03，bundles/municipalities）。
// 政令指定都市用「區」（横浜市鶴見区），東京 23 區是特別區本身。
// 清單的「地區」選單、地圖上點區塊選取、網址的 ?area=代碼 都用這裡的函式（UX-FLOW.md A2b）。

import type { MapSpot, MunicipalityBundle, MunicipalityProps } from './bundles'
import { inRing } from './geo'
import { regions } from '../data/regions'

type Box = [number, number, number, number]

export interface Area {
  /** 全国地方公共団体コード 6 碼 */
  code: string
  name: string
  kana?: string
  /** 政令指定都市的區：所屬的市 */
  city?: string
  /** 外框 [west, south, east, north]（所有島） */
  bbox: Box
  /** 名稱的位置 [經度, 緯度] */
  label: [number, number]
  /** MultiPolygon 的座標（點在哪一區） */
  polygons: number[][][][]
}

export const UNASSIGNED = '所属未定地'

/** 所属未定地（埋立地など）：代碼是縣本身（第 3–5 碼 000），不是一個區 */
export function isUnassigned(code: string, name?: string): boolean {
  return name === UNASSIGNED || code.slice(2, 5) === '000'
}

/** 縣的 JIS 代碼（01 北海道 … 47 沖縄）；regions.json 依 JIS 順序排列 */
export function prefCode(pref: string): string | null {
  const i = regions.findIndex((r) => r.prefecture === pref)
  return i < 0 ? null : String(i + 1).padStart(2, '0')
}

/** 網址的 ?area=：6 碼、屬於這個縣、不是所属未定地；不合就當作沒有 */
export function parseArea(q: unknown, pref: string | null | undefined): string | null {
  if (typeof q !== 'string' || !/^\d{6}$/.test(q) || !pref) return null
  return q.slice(0, 2) === prefCode(pref) && !isUnassigned(q) ? q : null
}

function boxOf(polygons: number[][][][]): Box {
  let w = 180, s = 90, e = -180, n = -90
  for (const poly of polygons) {
    for (const [x, y] of poly[0] ?? []) {
      w = Math.min(w, x!); e = Math.max(e, x!)
      s = Math.min(s, y!); n = Math.max(n, y!)
    }
  }
  return [w, s, e, n]
}

/** bundle → 區的清單（依代碼，所属未定地不算） */
export function areaList(bundle: MunicipalityBundle | null | undefined): Area[] {
  if (!bundle) return []
  return bundle.features
    .filter((f) => !isUnassigned(f.properties.m, f.properties.n))
    .map((f) => {
      const p: MunicipalityProps = f.properties
      const bbox = boxOf(f.geometry.coordinates)
      return {
        code: p.m,
        name: p.n,
        kana: p.h,
        city: p.c,
        bbox,
        label: p.l ?? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2],
        polygons: f.geometry.coordinates,
      }
    })
    .sort((a, b) => a.code.localeCompare(b.code))
}

/** 點在哪一區（外框先篩，再看多邊形；洞裡的不算） */
export function areaAt(areas: readonly Area[], lng: number, lat: number): Area | null {
  for (const a of areas) {
    const [w, s, e, n] = a.bbox
    if (lng < w || lng > e || lat < s || lat > n) continue
    for (const poly of a.polygons) {
      const [outer, ...holes] = poly
      if (outer && inRing(lng, lat, outer as [number, number][]) && !holes.some((h) => inRing(lng, lat, h as [number, number][]))) return a
    }
  }
  return null
}

export interface AreaOption {
  code: string
  name: string
  kana?: string
  /** 這一區的景點數 */
  count: number
}
export interface AreaGroup {
  /** 政令指定都市名（底下是它的區）；一般的市町村沒有 */
  city?: string
  areas: AreaOption[]
}

/**
 * 「地區」選單：有景點的區，依代碼（JIS 順序，北到南、市在町村前）；政令指定都市的區排在市名底下。
 * keep：目前選的區即使沒有景點也列出來（從地圖上點的）。
 */
export function areaGroups(areas: readonly Area[], spots: readonly MapSpot[], keep?: string | null): AreaGroup[] {
  const counts = new Map<string, number>()
  for (const s of spots) if (s.m) counts.set(s.m, (counts.get(s.m) ?? 0) + 1)
  const groups: AreaGroup[] = []
  for (const a of areas) {
    const count = counts.get(a.code) ?? 0
    if (!count && a.code !== keep) continue
    const opt: AreaOption = { code: a.code, name: a.name, kana: a.kana, count }
    const last = groups[groups.length - 1]
    if (a.city && last?.city === a.city) last.areas.push(opt)
    else groups.push({ city: a.city, areas: [opt] })
  }
  return groups
}

/** 外框四周留一點（度；經度依緯度放大），小的區（中央区）不會貼著畫面邊緣 */
export function paddedBox(b: Box, ratio = 0.08): Box {
  const k = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180)
  const m = Math.max(0.004, ratio * Math.max((b[2] - b[0]) * k, b[3] - b[1]))
  return [b[0] - m / k, b[1] - m, b[2] + m / k, b[3] + m]
}
