// 日帰り（TODO.md「縣內規劃」4，UX-FLOW.md C8）：行程裡某一天住的車站 → 沿鐵路可以單日來回的地方（可跨縣）。
// 路網是 bundles/rail-graph.json（pipeline/rail_graph.py），目的地是 bundles/daytrip.json（pipeline/daytrip.py）。
// 最短距離是 pipeline 的 Dijkstra 的移植（對照資料 fixtures/rail-graph-small.expected.json 由 pytest 產生）：
// 新幹線的邊權重乘 0.97（距離差不多時走新幹線），回報實際 km；路徑上新幹線 ≥ 20 km 才算可以搭新幹線。
// 公開資料沒有時刻表：介面只寫「鐵路約 n km」與新幹線，不寫時間。

import { distanceM } from './geo'

/** rail-graph.json：nodes [id, 站名, 緯度, 經度, 縣（縣外的停靠點為 ""）, 新幹線]，edges [a, b, km, 種類] */
export type RailNode = [id: string, name: string, lat: number, lng: number, pref: string, shinkansen: 0 | 1]
export type RailEdge = [a: number, b: number, km: number, kind: 0 | 1 | 2]
export interface RailGraphBundle {
  nodes: RailNode[]
  edges: RailEdge[]
}

/** daytrip.json 的一個景點：[id, 日文名, 最近車站的路網節點 id（對不到是 null）, 分數] */
export type DaytripSpot = [id: string, name: string, st: string | null, score: number]
/** daytrip.json 的一個市区町村：m 代碼、n 名稱、c 政令指定都市名、p 縣、lat/lng 區名的位置、s 景點、x 其餘景點的車站 */
export interface DaytripArea {
  m: string
  n: string
  c?: string
  p: string
  lat: number
  lng: number
  s: DaytripSpot[]
  x?: string[]
}
export interface DaytripBundle {
  areas: DaytripArea[]
}

export const SHINKANSEN = 1
export const SHINKANSEN_WEIGHT = 0.97
export const SHINKANSEN_MIN_KM = 20

export interface Graph {
  nodes: RailNode[]
  index: Map<string, number>
  /** 相鄰：[節點, km, 種類]，和 pipeline 一樣依 edges 的順序加（同距離時的選擇才會一樣） */
  adj: Array<Array<[number, number, number]>>
}

const graphs = new WeakMap<RailGraphBundle, Graph>()

export function buildGraph(b: RailGraphBundle): Graph {
  const cached = graphs.get(b)
  if (cached) return cached
  const adj: Graph['adj'] = b.nodes.map(() => [])
  for (const [a, c, km, kind] of b.edges) {
    adj[a]?.push([c, km, kind])
    adj[c]?.push([a, km, kind])
  }
  const g = { nodes: b.nodes, index: new Map(b.nodes.map((n, i) => [n[0], i])), adj }
  graphs.set(b, g)
  return g
}

/** 最小堆積：(權重, 節點) 依序比較，和 Python heapq 的 tuple 相同 */
class Heap {
  private w: number[] = []
  private v: number[] = []
  get size(): number {
    return this.w.length
  }
  private less(i: number, j: number): boolean {
    return this.w[i]! < this.w[j]! || (this.w[i] === this.w[j] && this.v[i]! < this.v[j]!)
  }
  private swap(i: number, j: number) {
    ;[this.w[i], this.w[j]] = [this.w[j]!, this.w[i]!]
    ;[this.v[i], this.v[j]] = [this.v[j]!, this.v[i]!]
  }
  push(w: number, v: number) {
    this.w.push(w)
    this.v.push(v)
    let i = this.w.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (!this.less(i, p)) break
      this.swap(i, p)
      i = p
    }
  }
  pop(): [number, number] {
    const top: [number, number] = [this.w[0]!, this.v[0]!]
    const lw = this.w.pop()!
    const lv = this.v.pop()!
    if (this.w.length) {
      this.w[0] = lw
      this.v[0] = lv
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < this.w.length && this.less(l, m)) m = l
        if (r < this.w.length && this.less(r, m)) m = r
        if (m === i) break
        this.swap(i, m)
        i = m
      }
    }
    return top
  }
}

/** 從 src 出發：到得了的節點 → 實際 km、新幹線 km（pipeline 的 _search；maxKm 是權重的上限） */
export interface Reach {
  km: Map<number, number>
  skm: Map<number, number>
}

export function search(g: Graph, src: number, maxKm?: number): Reach {
  const weight = new Map<number, number>([[src, 0]])
  const km = new Map<number, number>([[src, 0]])
  const skm = new Map<number, number>([[src, 0]])
  const done = new Set<number>()
  const heap = new Heap()
  heap.push(0, src)
  while (heap.size) {
    const [w, v] = heap.pop()
    if (done.has(v)) continue
    done.add(v)
    for (const [u, d, kind] of g.adj[v] ?? []) {
      const nw = w + d * (kind === SHINKANSEN ? SHINKANSEN_WEIGHT : 1)
      if (maxKm !== undefined && nw > maxKm) continue
      if (nw < (weight.get(u) ?? Infinity)) {
        weight.set(u, nw)
        km.set(u, km.get(v)! + d)
        skm.set(u, skm.get(v)! + (kind === SHINKANSEN ? d : 0))
        heap.push(nw, u)
      }
    }
  }
  const out: Reach = { km: new Map(), skm: new Map() }
  for (const v of done) {
    out.km.set(v, km.get(v)!)
    out.skm.set(v, skm.get(v)!)
  }
  return out
}

/**
 * 小數 1 位，和 Python 的 round(x, 1) 相同：看 double 的實際值（1.65 其實是 1.6499… → 1.6，
 * Math.round(16.5) 會變 1.7）；剛好一半（0.25、0.75 這種 2 的次方分之一）取偶數。
 */
export function round1(x: number): number {
  const q = x * 4
  if (Number.isInteger(q) && q % 2 !== 0) {
    const f = Math.floor(x * 10)
    return (f % 2 === 0 ? f : f + 1) / 10
  }
  return Number(x.toFixed(1))
}

/** pipeline 的 within：base 站沿鐵路 maxKm 以內的站（含 base）→ km、新幹線 km（小數 1 位） */
export function within(g: Graph, base: string, maxKm: number): Map<string, { km: number; shinkansenKm: number }> {
  const out = new Map<string, { km: number; shinkansenKm: number }>()
  const src = g.index.get(base)
  if (src === undefined) return out
  const r = search(g, src, maxKm)
  for (const [v, d] of [...r.km].sort((a, b) => a[0] - b[0])) {
    if (d <= maxKm) out.set(g.nodes[v]![0], { km: round1(d), shinkansenKm: round1(r.skm.get(v)!) })
  }
  return out
}

// ---------- 單日來回的目的地 ----------

/** 近郊、中距離、搭新幹線的遠一點的地方 */
export type Band = 0 | 1 | 2
export const NEAR_KM = 60
export const MID_KM = 150
/** 新幹線也只列到這裡（東京→金沢、名古屋還在裡面） */
export const FAR_KM = 450
export const BANDS: ReadonlyArray<{ band: Band; label: string }> = [
  { band: 0, label: '鐵路 60 km 內' },
  { band: 1, label: '60–150 km' },
  { band: 2, label: '新幹線' },
]

/** 距離 → 分段；150 km 以上只有路上能搭新幹線（≥ 20 km）才列 */
export function bandOf(km: number, shinkansen: boolean): Band | null {
  if (km <= NEAR_KM) return 0
  if (km <= MID_KM) return 1
  return shinkansen && km <= FAR_KM ? 2 : null
}

export const TOKYO_23 = '東京23区'

/** 一個市区町村屬於哪個城市：政令指定都市的區合成那個市，東京 23 區（代碼 131）合成一個，其他就是自己 */
export function cityKey(code: string, city?: string | null): string {
  if (city) return `${code.slice(0, 2)}:${city}`
  if (code.startsWith('131')) return '13:23'
  return code
}

export interface DestSpot {
  id: string
  name: string
  st: string | null
  score: number
  /** 所在的區（城市合起來時看得出在哪一區） */
  area: string
}

export interface Destination {
  key: string
  /** 川越市、名古屋市、東京23区 */
  name: string
  pref: string
  /** 包含的市区町村代碼 */
  codes: string[]
  /** 代碼 → 區名（城市合起來時，景點標在哪一區） */
  areaNames: Record<string, string>
  lat: number
  lng: number
  /** 分數最高的景點（各區合起來最多 3 個） */
  spots: DestSpot[]
  /** 到最近的那一站的鐵路距離（km，未四捨五入） */
  km: number
  shinkansen: boolean
  /** 量距離的那一站（路網節點 id） */
  station: string
  band: Band
}

/**
 * 從住的車站（reach）列出單日來回的地方：市区町村依城市合起來（cityKey），距離取各區所有車站裡最近的一站；
 * 150 km 以上要能搭新幹線，取能搭新幹線的最近一站。exclude：住的地方自己的城市（cityKey）。依距離排序。
 */
export function destinations(g: Graph, reach: Reach, areas: readonly DaytripArea[], exclude?: string | null): Destination[] {
  const groups = new Map<string, DaytripArea[]>()
  for (const a of areas) {
    const key = cityKey(a.m, a.c)
    if (key === exclude) continue
    const list = groups.get(key)
    if (list) list.push(a)
    else groups.set(key, [a])
  }
  const out: Destination[] = []
  for (const [key, list] of groups) {
    let best: { km: number; sk: boolean; st: string } | null = null
    let bestSk: { km: number; st: string } | null = null
    for (const a of list) {
      for (const st of [...a.s.map((s) => s[2]), ...(a.x ?? [])]) {
        const i = st ? g.index.get(st) : undefined
        const km = i === undefined ? undefined : reach.km.get(i)
        if (km === undefined || !st) continue
        const sk = reach.skm.get(i!)! >= SHINKANSEN_MIN_KM
        if (!best || km < best.km || (km === best.km && st < best.st)) best = { km, sk, st }
        if (sk && (!bestSk || km < bestSk.km || (km === bestSk.km && st < bestSk.st))) bestSk = { km, st }
      }
    }
    if (!best) continue
    if (best.km > MID_KM && !best.sk) best = bestSk ? { ...bestSk, sk: true } : null
    if (!best || best.km > FAR_KM) continue
    const band = bandOf(best.km, best.sk)
    if (band === null) continue
    const spots = list
      .flatMap((a) => a.s.map(([id, name, st, score]) => ({ id, name, st, score, area: a.n })))
      .sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1))
    const top = list.find((a) => a.s.some((s) => s[0] === spots[0]!.id)) ?? list[0]!
    const city = list[0]!.c
    out.push({
      key,
      name: city ?? (key === '13:23' ? TOKYO_23 : list[0]!.n),
      pref: list[0]!.p,
      codes: list.map((a) => a.m),
      areaNames: Object.fromEntries(list.map((a) => [a.m, a.n])),
      lat: top.lat,
      lng: top.lng,
      spots: spots.slice(0, 3),
      km: best.km,
      shinkansen: best.sk,
      station: best.st,
      band,
    })
  }
  return out.sort((a, b) => a.km - b.km || a.name.localeCompare(b.name, 'ja'))
}

/** 「鐵路約 37 km」的數字：10 km 以下到 0.5 km、其他取整數 */
export function kmLabel(km: number): string {
  return km < 10 ? String(Math.max(0.5, Math.round(km * 2) / 2)) : String(Math.round(km))
}

// ---------- 住的車站 ----------

export interface StationOption {
  id: string
  name: string
  pref: string
  shinkansen: boolean
  lat: number
  lng: number
}

function option(g: Graph, i: number): StationOption {
  const [id, name, lat, lng, pref, sk] = g.nodes[i]!
  return { id, name, pref, shinkansen: sk === 1, lat, lng }
}

export function stationById(g: Graph, id: string | null | undefined): StationOption | null {
  const i = id ? g.index.get(id) : undefined
  return i === undefined ? null : option(g, i)
}

// 台灣常用的繁體字 → 日本的新字體（車站名稱比對用：「金澤」「鹿兒島」「靜岡」也找得到）
const FOLD: Record<string, string> = {
  澤: '沢', 濱: '浜', 廣: '広', 驛: '駅', 關: '関', 鐵: '鉄', 橫: '横', 縣: '県', 國: '国', 區: '区',
  舊: '旧', 會: '会', 櫻: '桜', 瀧: '滝', 龍: '竜', 邊: '辺', 澀: '渋', 豐: '豊', 榮: '栄', 惠: '恵',
  圓: '円', 鹽: '塩', 應: '応', 來: '来', 氣: '気', 學: '学', 條: '条', 齋: '斎', 稻: '稲', 藥: '薬',
  輕: '軽', 黑: '黒', 德: '徳', 步: '歩', 灣: '湾', 總: '総', 帶: '帯', 歸: '帰', 嶽: '岳', 峽: '峡',
  淺: '浅', 龜: '亀', 寶: '宝', 繩: '縄', 實: '実', 壽: '寿', 戶: '戸', 萬: '万', 鄉: '郷', 莊: '荘',
  團: '団', 臺: '台', 瀨: '瀬', 對: '対', 發: '発', 廳: '庁', 舍: '舎', 驒: '騨', 經: '経', 讀: '読',
  濟: '済', 圖: '図', 傳: '伝', 檢: '検', 險: '険', 麥: '麦', 黃: '黄', 兒: '児', 兩: '両', 樂: '楽',
  藝: '芸', 禮: '礼', 雙: '双', 曉: '暁', 嚴: '厳', 靜: '静', 參: '参', 觀: '観', 戰: '戦', 獨: '独',
  遙: '遥', 隱: '隠', 溫: '温', 淨: '浄', 滿: '満', 驗: '験', 圈: '圏', 舖: '舗', 將: '将', 拔: '抜',
  髙: '高', 﨑: '崎', 變: '変', 處: '処', 號: '号', 絲: '糸', 爐: '炉', 聲: '声',
  賣: '売', 續: '続', 戀: '恋', 錢: '銭', 鑛: '鉱', 礦: '鉱', 豫: '予', 竈: '竃', 祕: '秘',
}

/** 車站名稱比對用：全形半形、繁體字、空白，去掉字尾的「駅」「站」 */
export function foldName(s: string): string {
  return [...s.normalize('NFKC')]
    .map((c) => FOLD[c] ?? c)
    .join('')
    .replace(/\s+/g, '')
    .replace(/(駅|站|車站)$/, '')
    .toLowerCase()
}

/** 有站名、有連到路網的車站（縣外沒有車站點的停靠點不算）；同縣同名的只留連最多路線的一個 */
function stations(g: Graph): number[] {
  const best = new Map<string, number>()
  g.nodes.forEach((n, i) => {
    if (!n[4] || !g.adj[i]!.length) return
    const key = `${n[4]}:${n[1]}`
    const cur = best.get(key)
    // 先看連到的路線數，再看新幹線；都一樣時留 id 小的（nodes 依 id 排序，先出現的）
    if (cur === undefined || (g.adj[i]!.length - g.adj[cur]!.length || n[5] - g.nodes[cur]![5]) > 0) best.set(key, i)
  })
  return [...best.values()]
}
const stationLists = new WeakMap<Graph, { i: number; key: string }[]>()
function stationList(g: Graph) {
  let list = stationLists.get(g)
  if (!list) {
    list = stations(g).map((i) => ({ i, key: foldName(g.nodes[i]![1]) }))
    stationLists.set(g, list)
  }
  return list
}

/** 站名搜尋：完全相同、開頭相同、包含；同一級連到的路線多的（大站）、新幹線站在前 */
export function searchStations(g: Graph, query: string, limit = 30): StationOption[] {
  const q = foldName(query)
  if (!q) return []
  const hits: { i: number; rank: number }[] = []
  for (const { i, key } of stationList(g)) {
    const rank = key === q ? 0 : key.startsWith(q) ? 1 : key.includes(q) ? 2 : -1
    if (rank >= 0) hits.push({ i, rank })
  }
  hits.sort(
    (a, b) =>
      a.rank - b.rank ||
      g.adj[b.i]!.length - g.adj[a.i]!.length ||
      g.nodes[b.i]![5] - g.nodes[a.i]![5] ||
      g.nodes[a.i]![1].localeCompare(g.nodes[b.i]![1], 'ja'),
  )
  return hits.slice(0, limit).map((h) => option(g, h.i))
}

/** 離這個位置最近的車站（直線距離；有連到路網的站） */
export function nearestStation(g: Graph, lat: number, lng: number): StationOption | null {
  let best = -1
  let bestD = Infinity
  for (const { i } of stationList(g)) {
    const n = g.nodes[i]!
    // 先用經緯度差篩掉遠的（1 度約 90–111 km）
    if (Math.abs(n[2] - lat) > 0.5 || Math.abs(n[3] - lng) > 0.6) continue
    const d = distanceM(lat, lng, n[2], n[3])
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best < 0 ? null : option(g, best)
}
