// 縣界（web/public/geo/prefectures.json）：判斷地圖中心落在哪個縣（UX-FLOW.md §1.3），並在地區頁畫出縣界。

import type * as GeoJSON from 'geojson'

type Ring = [number, number][]
interface Feature {
  properties: { pref: string }
  geometry: { coordinates: Ring[][] }
}

let features: Feature[] | null = null
let loading: Promise<Feature[]> | null = null

export function loadPrefectureShapes(): Promise<Feature[]> {
  if (features) return Promise.resolve(features)
  loading ??= fetch(`${import.meta.env.BASE_URL}geo/prefectures.json`)
    .then((r) => r.json())
    .then((fc: { features: Feature[] }) => (features = fc.features))
  return loading
}

/** 點在不在環裡（經緯度或墨卡托座標都可以） */
export function inRing(x: number, y: number, ring: readonly (readonly [number, number])[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function prefectureAt(lng: number, lat: number): string | null {
  for (const f of features ?? []) {
    for (const poly of f.geometry.coordinates) {
      const [outer, ...holes] = poly
      if (outer && inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h))) {
        return f.properties.pref
      }
    }
  }
  return null
}

/** 縣界的 GeoJSON（地圖上畫縣界用）；縣界尚未載入時為 null */
export function prefectureShape(pref: string): GeoJSON.Feature<GeoJSON.MultiPolygon> | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  return { type: 'Feature', properties: { pref }, geometry: { type: 'MultiPolygon', coordinates: f.geometry.coordinates } }
}

/** 縣界的外框 [west, south, east, north]；縣界尚未載入時為 null。 */
export function prefectureBounds(pref: string): [number, number, number, number] | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  let w = 180, s = 90, e = -180, n = -90
  for (const poly of f.geometry.coordinates) {
    for (const [x, y] of poly[0] ?? []) {
      w = Math.min(w, x); e = Math.max(e, x)
      s = Math.min(s, y); n = Math.max(n, y)
    }
  }
  return [w, s, e, n]
}

/**
 * 縣的主要陸地（範圍最大的一塊）的外框：進入地區時看得到整個縣的形狀，
 * 又不會因為離島（沖繩的八重山、東京的伊豆諸島）拉得太遠。縣界尚未載入時為 null。
 */
export function prefectureMainBounds(pref: string): [number, number, number, number] | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  let best: [number, number, number, number] | null = null
  let bestArea = -1
  for (const poly of f.geometry.coordinates) {
    let w = 180, s = 90, e = -180, n = -90
    for (const [x, y] of poly[0] ?? []) {
      w = Math.min(w, x); e = Math.max(e, x)
      s = Math.min(s, y); n = Math.max(n, y)
    }
    const area = (e - w) * (n - s)
    if (area > bestArea) {
      bestArea = area
      best = [w, s, e, n]
    }
  }
  return best
}

type Box = [number, number, number, number]

function ringBox(ring: Ring): Box {
  let w = 180, s = 90, e = -180, n = -90
  for (const [x, y] of ring) {
    w = Math.min(w, x); e = Math.max(e, x)
    s = Math.min(s, y); n = Math.max(n, y)
  }
  return [w, s, e, n]
}

function unionBox(a: Box, b: Box): Box {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]
}

/** 兩個外框之間的距離（度；重疊為 0） */
function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, a[0] - b[2], b[0] - a[2])
  const dy = Math.max(0, a[1] - b[3], b[1] - a[3])
  return Math.hypot(dx, dy)
}

/** 專心模式（UX-FLOW.md §1.3）：進入一縣後鏡頭能到的範圍 */
export interface FocusArea {
  /** 鏡頭（可見範圍）不能離開的範圍 [west, south, east, north]：整個縣（含離島）＋縣界外不遠的景點＋四周的海 */
  bounds: Box
  /** 拉遠的極限：這個範圍剛好放進可見的地圖。很遠的離島（東京的小笠原）不算，要平移或從清單過去 */
  frame: Box
  /** 各塊陸地（離島各自一塊）的外圈 [lng, lat][]：可見範圍中間要看得到陸地，不會拖到只剩海 */
  rings: [number, number][][]
  /** 縣界多邊形以外的景點（簡化的縣界沒畫到的小島、沖ノ島、竹島）與 extra：也算陸地 */
  points: [number, number][]
}

// 離主要陸地超過這個距離（度）的島不算進 frame：東京的小笠原（約 8 度）；沖繩的八重山、大東（約 3 度）、鹿兒島的奄美照算
const REMOTE_ISLAND = 5
// 縣界外這個距離（度）以內的景點也要到得了（沖ノ島、舳倉島、男女群島、竹島）；更遠的是座標有誤，不跟著擴大
const NEAR_SPOT = 1.5

/**
 * 專心模式的範圍。points：這個縣的景點（縣界外不遠的也納入）。
 * extra：之後的「日帰り」（鄰縣的目的地）要一起到得了時，由這裡加進範圍。縣界尚未載入時為 null。
 */
export function focusArea(
  pref: string,
  points: readonly { lng: number; lat: number }[] = [],
  extra: readonly { lng: number; lat: number }[] = [],
): FocusArea | null {
  const f = features?.find((x) => x.properties.pref === pref)
  if (!f) return null
  const boxes = f.geometry.coordinates.map((poly) => ringBox(poly[0] ?? []))
  if (!boxes.length) return null
  const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1])
  const main = boxes.reduce((a, b) => (area(b) > area(a) ? b : a))
  const frame = boxes.filter((b) => boxGap(b, main) <= REMOTE_ISLAND).reduce(unionBox)
  const rings = f.geometry.coordinates.map((poly) => poly[0] ?? []).filter((r) => r.length >= 3)
  const shape = boxes.reduce(unionBox)
  let b = shape
  const outside: [number, number][] = []
  for (const p of points) {
    if (boxGap([p.lng, p.lat, p.lng, p.lat], shape) > NEAR_SPOT || rings.some((r) => inRing(p.lng, p.lat, r))) continue
    outside.push([p.lng, p.lat])
    b = unionBox(b, [p.lng, p.lat, p.lng, p.lat])
  }
  for (const p of extra) {
    outside.push([p.lng, p.lat])
    b = unionBox(b, [p.lng, p.lat, p.lng, p.lat])
  }
  // 四周的海：長邊的 20%，至少 0.15 度、最多 1 度；經度依緯度放大，東西南北看起來一樣寬
  const k = Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180)
  const m = Math.min(1, Math.max(0.15, 0.2 * Math.max((b[2] - b[0]) * k, b[3] - b[1])))
  return { bounds: [b[0] - m / k, b[1] - m, b[2] + m / k, b[3] + m], frame, rings, points: outside }
}

/** 縣界的「外面」：一個蓋住全世界、把這個縣挖空的多邊形（專心模式把縣外變淡） */
export function outsideOf(shape: GeoJSON.Feature<GeoJSON.MultiPolygon>): GeoJSON.Feature<GeoJSON.Polygon> {
  // MapLibre 依繞行方向分外圈與洞：洞和外圈反向
  const signed = (r: GeoJSON.Position[]) => {
    let a = 0
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j]![0]! - r[i]![0]!) * (r[j]![1]! + r[i]![1]!)
    return a
  }
  const world: GeoJSON.Position[] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ]
  const dir = Math.sign(signed(world))
  const holes = shape.geometry.coordinates
    .map((poly) => poly[0])
    .filter((r): r is GeoJSON.Position[] => !!r && r.length >= 4)
    .map((r) => (Math.sign(signed(r)) === dir ? [...r].reverse() : r))
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [world, ...holes] } }
}

/** 兩點距離（公尺） */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(a))
}

/** 收集冊、經縣值、位置小框、分享圖的日本地圖（DESIGN.md §7.19、§7.21）：一縣一條 SVG path */
export interface PrefPath {
  pref: string
  d: string
}
export interface JapanOutline {
  viewBox: string
  paths: PrefPath[]
  /** 沖繩放大移到左上的框（x, y, w, h） */
  inset: [number, number, number, number]
}

// 等距圓柱投影，經度依北緯 36.5 度縮放；沖繩依日本地圖的慣例移到左上角的框裡。
const LNG0 = 128.3
const LAT0 = 45.7
const KX = Math.cos((36.5 * Math.PI) / 180) * 10

// 沖繩的框：放大 3 倍（手機上原比例的沖繩本島只有約 6×17px，點不到；手機版計畫第二階段 19）。
// 3 倍放不下整個縣，分成兩塊、縮短中間的海：沖繩本島一帶（含久米島）在框的右上，
// 先島諸島（宮古、八重山、與那國）在左下，方向和實際一樣。框在日本海（北海道以西、佐渡以北）的空白處。
export const OKINAWA_SCALE = 3
const OKI_FRAME: [number, number] = [1, 1]
const OKI_PAD = 3
/** 先島諸島：經度小於這個 */
const OKI_SAKI_LNG = 126
/** 兩塊各自的西北角（經緯度）與它在框裡的位置（SVG 單位，從框的左上角加內距起算） */
const OKI_MAIN = { lng: 126.6, lat: 27.15, x: 36, y: 0 }
const OKI_SAKI = { lng: 122.85, lat: 24.95, x: 0, y: 36 }
const OKI_SIZE: [number, number] = [36 + (128.4 - 126.6) * KX * OKINAWA_SCALE, 36 + (24.95 - 24.2) * 10 * OKINAWA_SCALE]
const OKI_RECT: [number, number, number, number] = [OKI_FRAME[0], OKI_FRAME[1], OKI_SIZE[0] + OKI_PAD * 2, OKI_SIZE[1] + OKI_PAD * 2]
// 離島：外框小於這個（度）的島不畫；東京的小笠原（北緯 32 度以南）不畫
const MIN_ISLAND = 0.06
const TOLERANCE = 0.45

let outline: JapanOutline | null = null

const px = (x: number) => (x - LNG0) * KX
const py = (y: number) => (LAT0 - y) * 10

/** 沖繩一帶（照日本地圖的慣例畫在左上框裡的範圍） */
export function inOkinawaInset(lng: number, lat: number): boolean {
  return lat < 27.05 && lng < 131.5
}

/** 沖繩框裡的座標（大東島這類框外的點貼到框的邊上） */
function okinawaXY(lng: number, lat: number): [number, number] {
  const g = lng < OKI_SAKI_LNG ? OKI_SAKI : OKI_MAIN
  const [rx, ry, rw, rh] = OKI_RECT
  const x = rx + OKI_PAD + g.x + (lng - g.lng) * KX * OKINAWA_SCALE
  const y = ry + OKI_PAD + g.y + (g.lat - lat) * 10 * OKINAWA_SCALE
  return [Math.min(Math.max(x, rx), rx + rw), Math.min(Math.max(y, ry), ry + rh)]
}

/** 經緯度 → 日本地圖 SVG 座標；沖繩一帶移到左上的框（放大 OKINAWA_SCALE 倍） */
export function japanProject(lng: number, lat: number, inset = inOkinawaInset(lng, lat)): [number, number] {
  return inset ? okinawaXY(lng, lat) : [px(lng), py(lat)]
}

/** 日本地圖 SVG 座標 → 經緯度（點在沖繩框裡時換回原本的位置） */
export function japanUnproject(x: number, y: number): [number, number] {
  const [rx, ry, rw, rh] = OKI_RECT
  if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) {
    const lx = x - rx - OKI_PAD
    const ly = y - ry - OKI_PAD
    const g = ly >= OKI_SAKI.y ? OKI_SAKI : OKI_MAIN
    return [g.lng + (lx - g.x) / (KX * OKINAWA_SCALE), g.lat - (ly - g.y) / (10 * OKINAWA_SCALE)]
  }
  return [x / KX + LNG0, LAT0 - y / 10]
}

export async function japanOutline(): Promise<JapanOutline> {
  if (outline) return outline
  const fs = await loadPrefectureShapes()
  const paths = fs.map((f) => {
    const pref = f.properties.pref
    const project = pref === 'okinawa' ? okinawaXY : (x: number, y: number): [number, number] => [px(x), py(y)]
    const polys = f.geometry.coordinates.filter((poly) => {
      const ring = poly[0] ?? []
      const xs = ring.map((p) => p[0])
      const ys = ring.map((p) => p[1])
      if (pref === 'tokyo' && Math.max(...ys) < 32) return false
      return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) >= MIN_ISLAND || f.geometry.coordinates.length === 1
    })
    let d = ''
    for (const poly of polys) {
      for (const ring of poly) {
        const pts: [number, number][] = []
        for (const [x, y] of ring) {
          const p = project(x, y)
          const l = pts[pts.length - 1]
          if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) >= TOLERANCE) pts.push(p)
        }
        if (pts.length < 3) continue
        d += 'M' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z'
      }
    }
    return { pref, d }
  })
  const w = px(148.95)
  const h = py(26.95)
  outline = { viewBox: `0 0 ${w.toFixed(1)} ${h.toFixed(1)}`, paths, inset: OKI_RECT }
  return outline
}
