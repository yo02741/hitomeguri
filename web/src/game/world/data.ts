import {
  type BundleIndex,
  fetchDetail,
  fetchFestivals,
  fetchGameBundle,
  fetchIndex,
  fetchMap,
  fetchMunicipalities,
  fetchPack,
  fetchPrefSpecialties,
  fetchRail,
  fetchRailGraph,
  fetchSeasons,
  fetchSpecialties,
  type MapSpot,
  type MunicipalityBundle,
} from '../../services/bundles'
import type { RailGraphBundle } from '../../services/daytrip'

import { municipalityAt } from './geo'
import { type PrefData, type PrefMunicipality, type PrefRaw, type PrefSpot, WORLD_INDEX_VERSION, type WorldIndex, type WorldIndexLink, type WorldIndexPref, type WorldIndexTown } from './types'

/**
 * 一縣的資料（規格 §8.1、§11）：執行時從 bundles 讀，轉成跟 fixture 一樣的形狀（PrefRaw），再加查詢（PrefData）。
 * 測試直接把 fixture 交給 prefData()。讀不到的時候不丟到畫面上：loadWorldData 回傳讀到的縣與每一縣的錯誤
 * （offline：連不上；missing：索引裡沒有這一縣；failed：某個檔讀壞了），UI 依這個顯示「讀不到」與重試。
 * 不要的東西不放進來：擴充包只讀老舖（shinise）與城（castle），寶可夢人孔蓋與角色商店不讀。
 */
/** 角色主題的店（ハローキティ、スヌーピー…）：老舖・茶屋 pack 裡漏進來的也不放進遊戲（規格 §0） */
export const CHARACTER_SHOP = /キティ|きてぃ|kitty|サンリオ|sanrio|スヌーピー|snoopy|ミッフィー|miffy|リラックマ|rilakkuma|ポケモン|pokemon|ピカチュウ|ジブリ|ghibli|トトロ|totoro|ムーミン|moomin/i

export function prefData(input: PrefRaw): PrefData {
  const raw: PrefRaw = { ...input, shinise: input.shinise.filter((x) => !CHARACTER_SHOP.test(x.n)) }
  const by = <T extends { id: string }>(list: readonly T[]) => new Map(list.map((x) => [x.id, x]))
  const spots = by(raw.spots)
  const specialties = by(raw.specialties)
  const shinise = by(raw.shinise)
  const castles = by(raw.castles)
  const festivals = by(raw.festivals)
  const stations = by(raw.stations)
  const muns = new Map(raw.municipalities.map((m) => [m.m, m]))
  return {
    ...raw,
    spotById: (id) => spots.get(id),
    specialtyById: (id) => specialties.get(id),
    shiniseById: (id) => shinise.get(id),
    castleById: (id) => castles.get(id),
    festivalById: (id) => festivals.get(id),
    municipality: (code) => muns.get(code),
    station: (id) => stations.get(id),
  }
}

// ---------- 錯誤 ----------
export type WorldDataErrorKind = 'offline' | 'missing' | 'failed'

export class WorldDataError extends Error {
  readonly pref: string
  readonly part: string
  readonly kind: WorldDataErrorKind
  constructor(pref: string, part: string, kind: WorldDataErrorKind, cause?: unknown) {
    super(`${pref}：${part} 讀不到（${kind}）${cause instanceof Error ? `：${cause.message}` : ''}`)
    this.pref = pref
    this.part = part
    this.kind = kind
  }
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false
/** fetch 本身丟的錯（TypeError：連不上）是 offline，回應不是 2xx 是 failed */
const kindOf = (e: unknown): WorldDataErrorKind => (offline() || e instanceof TypeError ? 'offline' : 'failed')

// ---------- bundles → PrefRaw ----------
/** 讀 bundles 的函式（測試可以換掉） */
export interface BundleApi {
  fetchIndex: typeof fetchIndex
  fetchMap: typeof fetchMap
  fetchDetail: typeof fetchDetail
  fetchRail: typeof fetchRail
  fetchMunicipalities: typeof fetchMunicipalities
  fetchFestivals: typeof fetchFestivals
  fetchPrefSpecialties: typeof fetchPrefSpecialties
  fetchSpecialties: typeof fetchSpecialties
  fetchPack: typeof fetchPack
  fetchSeasons: typeof fetchSeasons
  fetchRailGraph: typeof fetchRailGraph
  /** 遊戲用的小 bundle（索引有 game 時；沒給就讀完整的資料） */
  fetchGame?: typeof fetchGameBundle
}

export const BUNDLES: BundleApi = {
  fetchIndex,
  fetchMap,
  fetchDetail,
  fetchRail,
  fetchMunicipalities,
  fetchFestivals,
  fetchPrefSpecialties,
  fetchSpecialties,
  fetchPack,
  fetchSeasons,
  fetchRailGraph,
  fetchGame: fetchGameBundle,
}

const slimSpot = ({ i: _i, ia: _ia, si: _si, ...rest }: MapSpot): MapSpot => rest

/** 區界的外框與相鄰（共用 2 個以上的點）；跟 fixtures/build-fixtures.mjs 同一個算法 */
export function municipalitiesOf(b: MunicipalityBundle): PrefMunicipality[] {
  const at = new Map<string, Set<string>>()
  const out: PrefMunicipality[] = []
  for (const f of b.features) {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
    for (const poly of f.geometry.coordinates)
      for (const ring of poly)
        for (const [x, y] of ring) {
          x0 = Math.min(x0, x!)
          y0 = Math.min(y0, y!)
          x1 = Math.max(x1, x!)
          y1 = Math.max(y1, y!)
          const k = `${Math.round(x! * 1e5)},${Math.round(y! * 1e5)}`
          let set = at.get(k)
          if (!set) at.set(k, (set = new Set()))
          set.add(f.properties.m)
        }
    const r = (v: number) => Math.round(v * 1e5) / 1e5
    out.push({ ...f.properties, bbox: [r(x0), r(y0), r(x1), r(y1)], touches: [] })
  }
  const pairs = new Map<string, number>()
  for (const set of at.values()) {
    if (set.size < 2) continue
    const list = [...set].sort()
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) pairs.set(`${list[i]}|${list[j]}`, (pairs.get(`${list[i]}|${list[j]}`) ?? 0) + 1)
  }
  const byCode = new Map(out.map((m) => [m.m, m]))
  for (const [k, n] of pairs) {
    if (n < 2) continue
    const [a, b2] = k.split('|') as [string, string]
    byCode.get(a)?.touches!.push(b2)
    byCode.get(b2)?.touches!.push(a)
  }
  for (const m of out) m.touches!.sort()
  return out.sort((a, b2) => (a.m < b2.m ? -1 : 1))
}

/** 共用的大檔（全國的路網、擴充包、季節）：好幾縣一起讀時只讀一次 */
interface Shared {
  index: BundleIndex
  graph: Promise<RailGraphBundle | null>
  shinise: Promise<PackItemList>
  castles: Promise<PackItemList>
  seasons: Promise<Awaited<ReturnType<typeof fetchSeasons>>>
  osaka: Promise<MapSpot[] | null>
}
type PackItemList = Awaited<ReturnType<typeof fetchPack>>

function shared(api: BundleApi, index: BundleIndex): Shared {
  const soft = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback)
  const pack = (key: string) => (index.packs?.[key] ? soft(api.fetchPack(key, index.packs[key]!.version), []) : Promise.resolve([]))
  return {
    index,
    graph: index.rail_graph ? soft(api.fetchRailGraph(index.rail_graph.version), null) : Promise.resolve(null),
    shinise: pack('shinise'),
    castles: pack('castle'),
    seasons: soft(api.fetchSeasons(index.extras?.seasons), null),
    osaka: index.prefectures.osaka ? soft(api.fetchMap('osaka', index.prefectures.osaka.version), null) : Promise.resolve(null),
  }
}

/**
 * 一縣：有遊戲用的小 bundle（game/{縣}.json，pipeline 先抽好的，gzip 約幾十 KB）就讀它；
 * 沒有或讀壞了才讀完整的資料（地圖、簡介、全國路網…，約 700 KB）。
 * 完整的那一條：景點與市区町村一定要有（沒有就丟 WorldDataError），其他讀不到就是空的（warnings 記下來）。
 */
async function loadPref(api: BundleApi, index: BundleIndex, sharedOf: () => Shared, pref: string, warnings: string[]): Promise<PrefData> {
  const meta = index.prefectures[pref]
  if (!meta) throw new WorldDataError(pref, 'index', 'missing')
  const gm = index.game?.[pref]
  if (gm && api.fetchGame) {
    try {
      const raw = (await api.fetchGame(pref, gm.version)) as PrefRaw | null
      if (raw && raw.pref === pref && Array.isArray(raw.spots) && Array.isArray(raw.municipalities)) return prefData(raw)
      warnings.push(`${pref}：game bundle 的形狀不對，改讀完整的資料`)
    } catch (e) {
      if (offline() || e instanceof TypeError) throw new WorldDataError(pref, 'game', 'offline', e)
      warnings.push(`${pref}：game bundle 讀不到，改讀完整的資料`)
    }
  }
  const sh = sharedOf()
  const must = async <T>(part: string, p: Promise<T>): Promise<T> => {
    try {
      return await p
    } catch (e) {
      throw new WorldDataError(pref, part, kindOf(e), e)
    }
  }
  const may = async <T>(part: string, p: Promise<T> | null, fallback: T): Promise<T> => {
    if (!p) return fallback
    try {
      return await p
    } catch {
      warnings.push(`${pref}：${part} 讀不到`)
      return fallback
    }
  }
  const munMeta = index.municipalities?.[pref]
  if (!munMeta) throw new WorldDataError(pref, 'municipalities', 'missing')
  const [map, detail, mun, rail, festivals, specialties] = await Promise.all([
    must('map', api.fetchMap(pref, meta.version)),
    may('detail', api.fetchDetail(pref, meta.version), []),
    must('municipalities', api.fetchMunicipalities(pref, munMeta.version)),
    may('rail', index.rail?.[pref] ? api.fetchRail(pref, index.rail[pref]!.version) : null, { lines: [], stations: [] }),
    may('festivals', index.festivals?.[pref] ? api.fetchFestivals(pref, index.festivals[pref]!.version) : null, []),
    may(
      'specialties',
      index.specialties?.[pref] ? api.fetchPrefSpecialties(pref, index.specialties[pref]!.version) : api.fetchSpecialties(index.extras?.specialties).then((l) => l.filter((s) => s.prefecture === pref)),
      [],
    ),
  ])
  const [graph, shinise, castles, seasons, osaka] = await Promise.all([sh.graph, sh.shinise, sh.castles, sh.seasons, sh.osaka])
  if (!graph) warnings.push(`${pref}：rail-graph 讀不到`)
  const details = new Map(detail.map((d) => [d.id, d]))
  const spots: PrefSpot[] = map.map((s) => {
    const d = details.get(s.id)
    const src = d?.sources?.[0]?.url
    return { ...slimSpot(s), ...(d ? { name: d.name, summary: d.summary, nearest: (d.nearest_stations ?? []).slice(0, 2), ...(src ? { src } : {}) } : {}) }
  })
  const kix = pref === 'kyoto' ? osaka?.find((s) => s.n === '関西国際空港' && s.c === '機場') : undefined
  const municipalities = municipalitiesOf(mun)
  // 祭典、老舖在哪一個市区町村：區界的 point-in-polygon（外框只是先篩）
  const boxes = new Map(municipalities.map((m) => [m.m, m.bbox] as const))
  const codeAt = (p: { lat: number; lng: number }) => municipalityAt(mun.features, boxes, p)
  const raw: PrefRaw = {
    pref,
    spots: spots.sort((a, b) => (a.id < b.id ? -1 : 1)),
    municipalities,
    lines: rail.lines.map(({ g: _g, c: _c, ...l }) => l),
    stations: [...rail.stations].sort((a, b) => (a.id < b.id ? -1 : 1)),
    festivals: festivals.map(({ images: _i, ...f }) => ({ ...f, ...(f.location ? { m: codeAt(f.location) } : {}) })),
    specialties: specialties.map(({ images: _i, ...s }) => s),
    shinise: shinise.filter((x) => x.p === pref).map((x) => ({ ...x, m: codeAt(x) })),
    castles: castles.filter((x) => x.p === pref),
    seasons: { source: seasons?.source ?? { url: '', fetched_at: '' }, stations: (seasons?.stations ?? []).filter((s) => s.prefecture === pref) },
    railGraph: graph ?? { nodes: [], edges: [] },
    ...(kix ? { kix: slimSpot(kix) } : {}),
  }
  return prefData(raw)
}

// ---------- 世界索引（P3） ----------
/** 世界索引在 game bundle 裡的名字（game/_world.json；_index.json 的 game._world 帶版本） */
export const WORLD_KEY = '_world'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const STOP_KINDS = new Set(['rail', 'monorail', 'bus', 'airport', 'pier'])
const MODES = new Set(['rail', 'monorail', 'bus', 'plane', 'ferry'])
const KITS = new Set(['kinki', 'okinawa', 'kanto', 'hokkaido'])

function townOk(t: unknown): t is WorldIndexTown {
  if (!isObj(t) || !isStr(t.id) || !isObj(t.name) || !isStr(t.name.ja)) return false
  const st = t.station
  const c = t.center
  return isObj(st) && isStr(st.id) && typeof st.name === 'string' && STOP_KINDS.has(st.kind as string) && isObj(c) && isNum(c.lat) && isNum(c.lng) && Array.isArray(t.stops)
}
function linkOk(l: unknown): l is WorldIndexLink {
  if (!isObj(l) || !isStr(l.id) || !isStr(l.from) || !isStr(l.to) || !isStr(l.fromStop) || !isStr(l.toStop) || !isStr(l.fromPref) || !isStr(l.toPref)) return false
  if (!MODES.has(l.mode as string) || typeof l.name !== 'string' || !Array.isArray(l.legs) || !l.legs.length) return false
  return l.legs.every((x) => isObj(x) && MODES.has(x.mode as string) && isNum(x.km) && (x.kmKind === 'rail' || x.kmKind === 'straight') && typeof x.to === 'string')
}

/** 世界索引的形狀檢查：版本不對、沒有縣的回 null；壞掉的鎮、交通丟掉 */
export function parseWorldIndex(raw: unknown): WorldIndex | null {
  if (!isObj(raw) || raw.v !== WORLD_INDEX_VERSION || !isStr(raw.start) || !Array.isArray(raw.prefs)) return null
  const prefs: WorldIndexPref[] = []
  for (const p of raw.prefs) {
    if (!isObj(p) || !isStr(p.pref) || !Array.isArray(p.towns)) continue
    const towns = p.towns.filter(townOk)
    if (!towns.length) continue
    prefs.push({ pref: p.pref, kit: KITS.has(p.kit as string) ? (p.kit as WorldIndexPref['kit']) : 'kinki', startStop: p.startStop === 'airport' ? 'airport' : 'main', towns })
  }
  if (!prefs.some((p) => p.pref === raw.start)) return null
  const known = new Set(prefs.flatMap((p) => p.towns.map((t) => t.id)))
  const links = (Array.isArray(raw.links) ? raw.links : []).filter(linkOk).filter((l) => known.has(l.from) && known.has(l.to))
  return { v: WORLD_INDEX_VERSION, start: raw.start, ...(isObj(raw.attribution) ? { attribution: raw.attribution as WorldIndex['attribution'] } : {}), prefs, links }
}

/** 世界索引：索引裡沒有（舊的 bundles）回 null；讀的錯丟出去（呼叫的人決定要不要退回 P2 的世界） */
export async function loadWorldIndex(api: BundleApi, index: BundleIndex): Promise<WorldIndex | null> {
  const meta = index.game?.[WORLD_KEY]
  if (!meta || !api.fetchGame) return null
  return parseWorldIndex(await api.fetchGame(WORLD_KEY, meta.version))
}

/**
 * 一縣一縣讀（延遲載入用）：同一縣只讀一次（讀到一半再叫拿同一個 promise，讀壞了的下次重讀）。
 * 共用的大檔（全國路網…）只有某一縣要讀完整資料時才抓。warnings 記下少了的檔。
 */
export function prefLoader(api: BundleApi, index: BundleIndex, warnings: string[] = []): (pref: string) => Promise<PrefData> {
  let sh: Shared | null = null
  const sharedOf = () => (sh ??= shared(api, index))
  const cache = new Map<string, Promise<PrefData>>()
  return (pref) => {
    const hit = cache.get(pref)
    if (hit) return hit
    const p = loadPref(api, index, sharedOf, pref, warnings)
    cache.set(pref, p)
    p.catch(() => cache.delete(pref))
    return p
  }
}

export interface WorldLoad {
  prefs: PrefData[]
  /** 讀不到的縣（每縣一個） */
  errors: WorldDataError[]
  /** 讀到了但少了某些檔（祭典、特色、路網…） */
  warnings: string[]
}

/**
 * 讀世界的資料（預設京都＋沖繩）。不丟錯：索引讀不到時每一縣都是 offline／failed 的錯誤，prefs 是空的。
 *   const { prefs, errors } = await loadWorldData()
 *   if (!prefs.length) 顯示「讀不到資料」＋重試
 */
export async function loadWorldData(prefs: readonly string[] = ['kyoto', 'okinawa'], api: BundleApi = BUNDLES): Promise<WorldLoad> {
  const warnings: string[] = []
  let index: BundleIndex
  try {
    index = await api.fetchIndex()
  } catch (e) {
    const kind = kindOf(e)
    return { prefs: [], errors: prefs.map((p) => new WorldDataError(p, 'index', kind, e)), warnings }
  }
  // 共用的大檔（全國路網、擴充包、季節、大阪）：有縣要讀完整的資料時才開始抓
  let sh: Shared | null = null
  const sharedOf = () => (sh ??= shared(api, index))
  const out = await Promise.allSettled(prefs.map((p) => loadPref(api, index, sharedOf, p, warnings)))
  const errors: WorldDataError[] = []
  const loaded: PrefData[] = []
  out.forEach((r, i) => {
    if (r.status === 'fulfilled') loaded.push(r.value)
    else errors.push(r.reason instanceof WorldDataError ? r.reason : new WorldDataError(prefs[i]!, 'pref', kindOf(r.reason), r.reason))
  })
  return { prefs: loaded, errors, warnings }
}
