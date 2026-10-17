// 番外篇遊戲的測試資料：本機 build 過的 web/public/bundles/game/{縣}.json（pipeline/game_bundle.py 抽好的、
// 遊戲執行時讀的同一份）排成好讀的縮排存進來。CI 沒有 bundles（gitignore、不跑 build-bundles），所以 vitest 只讀這裡
// commit 進去的 JSON。
// 重做：（repo 根目錄）.venv/bin/python -m pipeline.cli build-bundles，然後 node web/src/game/fixtures/build-fixtures.mjs
// 內容（以前在這支腳本算，2026-10-17 搬到 pipeline）：分數前 12 個市区町村＋有名城蓋章地點的市区町村，每區分數前 16 個景點
// ＋機場；簡介只留前 160 字；市区町村的外框與相鄰（touches）；祭典、老舖的 m（位置落在哪一個市区町村，point-in-polygon）；
// 縣內的路網（京都另外加到関西国際空港的路徑）；角色主題的店不放。
//
// P3（2026-10-17）：
// - kyoto、okinawa：整份拷過來（P2 的鎮的生成結果用這兩份鎖住，不能變）。
// - nara、osaka、hyogo、tokyo、hokkaido：每縣 ≤ 120 KB 的子集（只放世界索引選到的鎮）：每鎮分數前 FIX_TOP 個景點＋機場＋名城，
//   簡介前 FIX_SUMMARY 字；那幾鎮的市区町村、祭典（每鎮最多 3 個）、老舖；地區特色前 FIX_SPECIALTIES 個；
//   路網只留選到的鎮的代表站兩兩之間的最短路徑（鐵路 km 跟整份一樣）。
// - _world.json：世界索引整份拷過來（7 縣的鎮、縣之間的交通）。
import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const bundles = join(here, '../../../public/bundles')
const read = (name) => JSON.parse(readFileSync(join(bundles, 'game', name), 'utf8'))
/** 縮排一格；只有數字、字串的陣列（路網的點與邊、外框）寫在同一行 */
function pretty(v, pad = '') {
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    if (v.every((x) => x === null || typeof x !== 'object')) return JSON.stringify(v)
    const inner = pad + ' '
    return `[\n${v.map((x) => inner + pretty(x, inner)).join(',\n')}\n${pad}]`
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter((k) => v[k] !== undefined)
    if (!keys.length) return '{}'
    const inner = pad + ' '
    return `{\n${keys.map((k) => `${inner}${JSON.stringify(k)}: ${pretty(v[k], inner)}`).join(',\n')}\n${pad}}`
  }
  return JSON.stringify(v)
}
const write = (name, data, compact = false) => {
  const path = join(here, name)
  writeFileSync(path, (compact ? pretty(data) : JSON.stringify(data, null, 1)) + '\n')
  return statSync(path).size
}

const FULL = ['kyoto', 'okinawa']
const SMALL = ['nara', 'osaka', 'hyogo', 'tokyo', 'hokkaido']
const FIX_TOP = 7
const FIX_SUMMARY = 80
const FIX_SPECIALTIES = 8
const FIX_FESTIVALS = 3
const LIMIT = 120 * 1024

/** 新幹線的權重（services/daytrip.ts 的 SHINKANSEN_WEIGHT）：最短路徑跟遊戲算的一樣 */
const SHINKANSEN = 1
const SHINKANSEN_WEIGHT = 0.97

/** 路網上 src 出發的最短路徑樹（前一站） */
function tree(graph, src) {
  const adj = graph.nodes.map(() => [])
  for (const [a, b, km, k] of graph.edges) {
    adj[a].push([b, km, k])
    adj[b].push([a, km, k])
  }
  const dist = new Map([[src, 0]])
  const prev = new Map()
  const done = new Set()
  // 點不多（幾百個）：線性找最小就好
  const open = new Set([src])
  while (open.size) {
    let v = -1
    let best = Infinity
    for (const u of open) {
      const d = dist.get(u)
      if (d < best || (d === best && u < v)) {
        best = d
        v = u
      }
    }
    open.delete(v)
    done.add(v)
    for (const [u, km, k] of adj[v]) {
      if (done.has(u)) continue
      const w = best + km * (k === SHINKANSEN ? SHINKANSEN_WEIGHT : 1)
      if (w < (dist.get(u) ?? Infinity)) {
        dist.set(u, w)
        prev.set(u, v)
        open.add(u)
      }
    }
  }
  return prev
}

function pathNodes(prev, src, dst) {
  if (src !== dst && !prev.has(dst)) return []
  const out = [dst]
  let v = dst
  while (v !== src) {
    v = prev.get(v)
    out.push(v)
  }
  return out
}

const cut = (s) => (s && s.length > FIX_SUMMARY ? s.slice(0, FIX_SUMMARY) : s)
const slimSummary = (sum) => {
  if (!sum) return sum
  const { fetched_at: _f, ...rest } = sum
  return { ...rest, text: cut(sum.text), ...(sum.text_zh ? { text_zh: cut(sum.text_zh) } : {}) }
}
/** 景點：遊戲沒用到的最近車站清單（nearest）、英文名不放 */
function slimSpot(s) {
  const { nearest: _n, ...rest } = s
  if (rest.name) {
    const { en: _e, ...name } = rest.name
    rest.name = name
  }
  if (rest.summary) rest.summary = slimSummary(rest.summary)
  return rest
}
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function small(raw, towns) {
  const codes = new Set(towns.map((t) => t.id))
  const castleSpots = new Set(raw.castles.filter((c) => c.s && c.st?.length).map((c) => c.s))
  const spots = []
  for (const code of codes) {
    const inTown = raw.spots.filter((s) => s.m === code).sort((a, b) => b.s - a.s || byId(a, b))
    const keep = inTown.filter((s, i) => i < FIX_TOP || s.c === '機場' || castleSpots.has(s.id))
    for (const s of keep) spots.push(slimSpot(s))
  }
  spots.sort(byId)

  // 路網：選到的鎮的代表站（與其他鐵路的站）兩兩之間的最短路徑
  const g = raw.railGraph
  const idx = new Map(g.nodes.map((n, i) => [n[0], i]))
  const ends = new Set()
  for (const t of towns) for (const s of t.stops) if (s.stationId && idx.has(s.stationId)) ends.add(idx.get(s.stationId))
  const keepNodes = new Set(ends)
  for (const a of ends) {
    const prev = tree(g, a)
    for (const b of ends) for (const v of pathNodes(prev, a, b)) keepNodes.add(v)
  }
  const order = [...keepNodes].sort((a, b) => a - b)
  const remap = new Map(order.map((old, i) => [old, i]))
  const railGraph = {
    ...(g.attribution ? { attribution: g.attribution } : {}),
    nodes: order.map((i) => g.nodes[i]),
    edges: g.edges.filter(([a, b]) => remap.has(a) && remap.has(b)).map(([a, b, km, k]) => [remap.get(a), remap.get(b), km, k]),
  }
  const nodeIds = new Set(railGraph.nodes.map((n) => n[0]))
  // 車站：鎮的進出站、景點的最近車站（路網上有的）；路線只留用得到的（車站的 l 是路線的位置，跟著換）
  const used = new Set([...towns.flatMap((t) => t.stops.map((s) => s.stationId)), ...spots.map((s) => s.st)].filter(Boolean))
  const stations0 = raw.stations.filter((s) => nodeIds.has(s.id) && used.has(s.id))
  const usedLines = [...new Set(stations0.flatMap((s) => s.l ?? []))].sort((a, b) => a - b)
  const lineMap = new Map(usedLines.map((old, i) => [old, i]))
  const stations = stations0.map((s) => ({ ...s, ...(s.l ? { l: s.l.filter((i) => lineMap.has(i)).map((i) => lineMap.get(i)) } : {}) }))
  const lines = usedLines.map((i) => raw.lines[i])

  const perTown = new Map()
  const festivals = raw.festivals
    .filter((f) => f.m && codes.has(f.m))
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || byId(a, b))
    .filter((f) => {
      const n = perTown.get(f.m) ?? 0
      perTown.set(f.m, n + 1)
      return n < FIX_FESTIVALS
    })
    .map((f) => ({ ...f, ...(f.summary ? { summary: slimSummary(f.summary) } : {}) }))
    .sort(byId)
  return {
    pref: raw.pref,
    spots,
    municipalities: raw.municipalities.filter((m) => codes.has(m.m)),
    lines,
    stations,
    festivals,
    specialties: raw.specialties.slice(0, FIX_SPECIALTIES).map((s) => ({ ...s, ...(s.summary ? { summary: slimSummary(s.summary) } : {}) })),
    shinise: raw.shinise.filter((x) => x.m && codes.has(x.m)),
    castles: raw.castles,
    seasons: raw.seasons,
    railGraph,
  }
}

const world = read('_world.json')
const sizes = { _world: write('_world.json', world, true) }
for (const pref of FULL) sizes[pref] = write(`${pref}.json`, read(`${pref}.json`))
for (const pref of SMALL) {
  const towns = world.prefs.find((p) => p.pref === pref)?.towns ?? []
  const size = write(`${pref}.json`, small(read(`${pref}.json`), towns), true)
  sizes[pref] = size
  if (size > LIMIT) console.warn(`${pref}.json：${size} bytes，超過 ${LIMIT}`)
}
console.log('寫好 fixtures：', Object.entries(sizes).map(([k, v]) => `${k} ${Math.round(v / 1024)} KB`).join('、'))
