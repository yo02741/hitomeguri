import type { Festival } from '../../services/bundles'

import type { CalendarDate } from '../engine/clock'
import type { Game, MapSource } from '../engine/game'
import type { Runner, ScriptApi } from '../engine/script'
import type { Dir, GameMap, MapEntity, Script, Season } from '../engine/types'

import { isP3Pref } from './gen/classify'
import { generateTown, type Arrival, type TownGen } from './gen/town'
import { room } from './gen/interiors'
import { ARRIVE_SFX, DEPART_SFX, type RideScene, rideOverlay } from './ride'
import { bloomAt, type Climate, climateOf, type Flower, festivalsIn, seasonAt, weatherAt } from './season'
import { buildWorld, crossLinksOf, kitOf, linksFrom, orderOf, prefWorld, TOWN_RULES, type TownRule } from './towns'
import type { AtlasPref, Kit, Link, NpcData, PrefData, Town, World, WorldIndex } from './types'
import './kits/core'

/**
 * 世界（規格 §8、§11）：PrefData[] → 鎮、交通、地圖（MapSource）、起點、季節、坐車。
 *
 *   const { prefs } = await loadWorldData()
 *   const world = createWorld(prefs)
 *   const game = new Game({ tokens, maps: world.mapSource, start: world.start, genVersion: world.genVersion, seasonOf: world.seasonOf, … })
 *   offs.push(world.attach(game))          // 花況、天氣、你的房間的出口跟著遊戲走
 *   world.travel(game, linkId)              // 剪票口（systems 的 travel 互動）選好目的地之後
 *
 * 地圖第一次要的時候才生成（一鎮約幾毫秒），之後用同一份；鎮的地圖每次交出去時套上那一天的花況與祭典。
 *
 * P3（規格 §12）：多縣與延遲載入。opts.index（世界索引 game/_world.json）有給時，鎮照索引建、縣與縣之間的交通
 * 從索引來（還沒讀的縣也在剪票口的目的地裡）；prefs 只要起點的縣（京都）。坐車到還沒讀的縣時，車窗畫面一開始就
 * 叫 opts.loadPref 讀那一縣，讀好了 addPref 加進來（已經生成的鎮不重做：一鎮的生成只看自己的縣與從它出發的交通，
 * 讀的先後不影響），讀不到就回到出發的地方說「現在去不了。」。存檔在別的縣時，PlayView 先 ensurePref 那一縣再繼續。
 */
export const GEN_VERSION = 2

export interface WorldOptions {
  genVersion?: number
  rules?: Record<string, TownRule>
  /** 天氣跟著日期與鎮換（預設 true；false 就不動 game.weather） */
  weather?: boolean
  /** 世界索引（P3）：沒有就是 P2 的世界（給的縣就是全部） */
  index?: WorldIndex | null
  /** 讀一縣（坐車到還沒讀的縣、ensurePref）；讀不到回 null 或丟錯 */
  loadPref?: (pref: string) => Promise<PrefData | null>
  /** 坐車時等資料最多幾秒（超過就當作讀不到；預設 20） */
  loadWaitSeconds?: number
  /**
   * 加縣之前先準備那一縣的 kit（例：關東、北海道的 tile 拆成另外的 chunk 時，在這裡 import 註冊）；
   * 沒給就是 kit 都已經註冊好了（現在 kits/index.ts 全部靜態 import）。丟錯＝那一縣讀不到。
   */
  loadKit?: (kit: Kit) => Promise<unknown>
  /** 坐車到還沒讀的縣、讀不到時說的話（預設 CANNOT_GO；部署之後的舊分頁讀不到 kit 時 PlayView 換成要重新整理的那一句） */
  cannotGo?: () => string
}

/** 坐車到還沒讀的縣，資料讀不到時說的話（規格 §12） */
export const CANNOT_GO = '現在去不了。'
/** 部署之後還開著的舊分頁：坐車要的檔已經換了名字（重載過一次還是這樣時說） */
export const RELOAD_FIRST = '重新整理之後再去。'

export interface TravelOptions {
  /** 到了之後（PlayView 可以放 jingle('arrive')） */
  onArrive?(town: Town): void
  /** 車窗畫面每一段的秒數（預設 2.4） */
  seconds?: number
}

export interface GameWorld {
  world: World
  /** 讀進來的縣的鎮（addPref 之後會多；同一個陣列） */
  towns: Town[]
  /** 全部的交通（縣內的照讀進來的縣，縣與縣之間的一開始就全有；同一個陣列） */
  links: Link[]
  startTown: string
  genVersion: number
  /** 世界索引（沒有就是 null：P2 的世界） */
  index: WorldIndex | null
  /** 世界索引的 7 縣的鎮（還沒讀的也在）；沒有索引時是讀進來的縣 */
  atlas: AtlasPref[]
  /** 讀進來的縣（索引的順序） */
  prefs(): PrefData[]
  hasPref(pref: string): boolean
  /** 加一縣（已經有的不重做）；回傳那一縣的鎮 */
  addPref(pref: PrefData): Town[]
  /** 那一縣讀好了沒，沒有就讀（opts.loadPref）；同一縣同時只讀一次 */
  ensurePref(pref: string): Promise<boolean>
  /** 鎮（市区町村碼）是哪一縣的：讀進來的鎮、世界索引的鎮 */
  prefOfTown(town: string): string | null
  /** 加了縣之後（systems 換資料、手帳重算） */
  onPrefs(fn: (prefs: PrefData[]) => void): () => void
  /** 新遊戲的起點（京都駅的大廳；只有沖繩時是那覇空港的抵達大廳） */
  start: { map: string; x: number; y: number; dir: Dir }
  mapSource: MapSource
  /** 季節（GameOptions.seasonOf）：沒給鎮就用現在所在的鎮 */
  seasonOf(d: CalendarDate, town?: string): Season
  bloomOf(d: CalendarDate, town?: string): Set<Flower>
  /** 這一天在這一鎮的祭典（有月份、有位置的） */
  festivalsOf(d: CalendarDate, town?: string): Festival[]
  /** 現在在祭典的鎮上（戶外）：BGM 多一軌太鼓 */
  festivalNow(game: Game): boolean
  climateOf(town: string): Climate | null
  townById(id: string): Town | undefined
  /** 地圖 id → 那一鎮（town:、int: 的都認得；room 回 null） */
  townOf(mapId: string): Town | null
  prefOf(town: string): PrefData | undefined
  linkById(id: string): Link | undefined
  linksFrom(town: string, stop: string): Link[]
  /** 到了那一鎮站哪 */
  arrival(link: Link): Arrival
  /** 坐車（跑一段擋住玩家的腳本）；回傳 Runner，找不到 link 回 null */
  travel(game: Game, link: Link | string, opts?: TravelOptions): Runner | null
  /** 坐車的腳本本體：在別的腳本裡 yield* world.ride(s, link) */
  ride(s: ScriptApi, link: Link, opts?: TravelOptions): Script
  /** 接上 Game：花況、天氣、旅館的記錄；回傳拆掉的函式 */
  attach(game: Game): () => void
  /** 生成（或拿快取的）一鎮 */
  generate(town: string): TownGen | null
  /** 委託用的景點（真的放上地圖、有告示牌與拍攝點的；systems 的 townSpots） */
  questSpotsOf(town: string): string[]
  /** 閒下來時把還沒生成的鎮一個一個做好（標題畫面用）；回傳停下來的函式 */
  warm(): () => void
}

const dateKey = (d: CalendarDate) => `${d.y}-${d.m}-${d.d}`

export function createWorld(input: PrefData[], opts: WorldOptions = {}): GameWorld {
  const genVersion = opts.genVersion ?? GEN_VERSION
  const rules = opts.rules ?? TOWN_RULES
  const index = opts.index ?? null
  const world = buildWorld(input, rules, index)
  const towns = new Map(world.towns.map((t) => [t.id, t]))
  /** 讀進來、有鎮的縣 */
  const loaded = new Map<string, PrefData>()
  for (const p of input) if (world.towns.some((t) => t.pref === p.pref)) loaded.set(p.pref, p)
  const prefOf = (id: string) => {
    const t = towns.get(id)
    return t ? loaded.get(t.pref) : undefined
  }
  const links = new Map(world.links.map((l) => [l.id, l]))
  const gens = new Map<string, TownGen>()
  const climates = new Map<string, Climate | null>()
  /** 縣內的交通（每縣一份；addPref 時照縣的順序重排 world.links） */
  const intra = new Map<string, Link[]>()
  for (const l of world.links) {
    const a = towns.get(l.from)
    const b = towns.get(l.to)
    if (a && b && a.pref === b.pref) {
      const list = intra.get(a.pref) ?? []
      list.push(l)
      intra.set(a.pref, list)
    }
  }
  /** 世界索引的鎮 → 縣 */
  const indexPref = new Map<string, string>()
  for (const p of index?.prefs ?? []) for (const t of p.towns) indexPref.set(t.id, p.pref)
  const kitOfIndex = (town: string) => {
    const pref = indexPref.get(town)
    return pref ? (index?.prefs.find((p) => p.pref === pref)?.kit ?? kitOf(pref)) : null
  }
  const prefOfTown = (town: string) => towns.get(town)?.pref ?? indexPref.get(town) ?? null
  /** 縣與縣之間的交通（世界索引的；沒有索引時 addPref 重算） */
  const intraSet = new Set([...intra.values()].flat())
  let cross = world.links.filter((l) => !intraSet.has(l))
  const listeners = new Set<(prefs: PrefData[]) => void>()
  const prefsNow = () => orderOf(index, [...loaded.keys()]).map((p) => loaded.get(p)!)

  function addPref(p: PrefData): Town[] {
    const have = world.towns.filter((t) => t.pref === p.pref)
    if (loaded.has(p.pref)) return have
    const w = prefWorld(p, rules, index)
    if (!w.towns.length) return []
    loaded.set(p.pref, p)
    intra.set(p.pref, w.links)
    for (const t of w.towns) towns.set(t.id, t)
    // 同一個陣列：鎮照縣的順序；交通是「縣內（縣的順序）＋縣與縣之間」
    const order = orderOf(index, [...loaded.keys()])
    const list = order.flatMap((pref) => (pref === p.pref ? w.towns : world.towns.filter((t) => t.pref === pref)))
    world.towns.splice(0, world.towns.length, ...list)
    if (!index) cross = crossLinksOf(prefsNow(), world.towns)
    world.links.splice(0, world.links.length, ...order.flatMap((pref) => intra.get(pref) ?? []), ...cross)
    links.clear()
    for (const l of world.links) links.set(l.id, l)
    const all = prefsNow()
    for (const fn of listeners) fn(all)
    return w.towns
  }

  const pending = new Map<string, Promise<boolean>>()
  function ensurePref(pref: string): Promise<boolean> {
    if (loaded.has(pref)) return Promise.resolve(true)
    const hit = pending.get(pref)
    if (hit) return hit
    if (!opts.loadPref) return Promise.resolve(false)
    const k: Kit = index?.prefs.find((x) => x.pref === pref)?.kit ?? kitOf(pref)
    // P3 的近畿的縣（奈良、大阪、兵庫）：山、教堂、高樓、塔…用關東的零件（kits/lazy.ts 那一檔），一起讀
    const kits: Kit[] = k === 'kinki' && isP3Pref(pref) ? ['kinki', 'kanto'] : [k]
    const kit = opts.loadKit ? Promise.all(kits.map((x) => opts.loadKit!(x))) : Promise.resolve()
    const load = Promise.all([opts.loadPref(pref), kit])
      .then(([data]) => !!data && data.pref === pref && addPref(data).length > 0)
      .catch(() => false)
    // 一直沒有回應（網路卡住）：loadWaitSeconds 秒後當作讀不到，下次再要時重新讀（晚到的資料照樣加進來）
    const p = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), (opts.loadWaitSeconds ?? 20) * 1000)
      void load.then((ok) => {
        clearTimeout(timer)
        resolve(ok)
      })
    }).finally(() => {
      if (pending.get(pref) === p) pending.delete(pref)
    })
    pending.set(pref, p)
    return p
  }

  function generate(id: string): TownGen | null {
    const hit = gens.get(id)
    if (hit) return hit
    const town = towns.get(id)
    const pref = prefOf(id)
    if (!town || !pref) return null
    const gen = generateTown({ pref, town, world, genVersion })
    gens.set(id, gen)
    return gen
  }
  const climate = (id: string) => {
    if (!climates.has(id)) {
      const t = towns.get(id)
      const p = prefOf(id)
      // 還沒讀的縣的鎮：不記（讀進來之後才算得出來）
      if (!t || !p) return null
      climates.set(id, climateOf(p, t))
    }
    return climates.get(id) ?? null
  }

  // 現在在哪一鎮、哪一天（mapSource 與 seasonOf 被呼叫時記下來；attach 之後照 game）
  let here = world.startTown
  let today: CalendarDate | null = null
  let lastInn: string | null = null
  /** attach 的 Game：讀存檔（continueGame）時地圖比 mapEnter 先要，日期與最後住的旅館直接從這裡讀 */
  let attached: Game | null = null
  const dayNow = (): CalendarDate | null => (attached ? { ...attached.clock.date } : today)
  /** 最後住的旅館：接上 Game 之後以存檔（ext.world）為準，新遊戲（ext 清空）就是還沒住過 */
  const innNow = (): string | null => (attached ? (((attached.state.ext.world as { lastInn?: string } | undefined)?.lastInn ?? null)) : lastInn)
  const codeOf = (mapId: string) => (mapId.startsWith('town:') ? mapId.slice(5) : mapId.startsWith('int:') ? mapId.split(':')[1]! : null)

  const seasonCache = new Map<string, Season>()
  function seasonOf(d: CalendarDate, town?: string): Season {
    const id = town ?? here
    if (!town) today = d
    const k = `${dateKey(d)}|${id}`
    let s = seasonCache.get(k)
    if (!s) {
      const t = towns.get(id)
      s = seasonAt(d, t?.kit ?? kitOfIndex(id) ?? 'kinki', climate(id))
      if (seasonCache.size > 400) seasonCache.clear()
      if (t) seasonCache.set(k, s)
    }
    return s
  }
  const bloomOf = (d: CalendarDate, town?: string) => {
    const id = town ?? here
    return bloomAt(d, towns.get(id)?.kit ?? 'kinki', climate(id))
  }
  const festivalsOf = (d: CalendarDate, town?: string) => {
    const id = town ?? here
    const t = towns.get(id)
    const p = prefOf(id)
    return t && p ? festivalsIn(p, t, d.m) : []
  }

  /** 鎮的地圖：拷一份，套上那一天的花況與祭典 */
  function townMap(gen: TownGen, town: Town, d: CalendarDate | null): GameMap {
    const m = gen.map
    const out: GameMap = { ...m, lower: m.lower.slice(), over: m.over.slice(), entities: [...m.entities], warps: [...m.warps] }
    if (!d) return out
    const bloom = bloomOf(d, town.id)
    for (const c of gen.bloom) if (bloom.has(c.flower)) out[c.layer][c.i] = c.bloom
    const fests = festivalsOf(d, town.id)
    if (fests.length) {
      for (const t of gen.festival.tiles) out[t.layer][t.i] = t.id
      const f = fests[0]!
      const src = f.summary?.source_url ?? f.sources[0]?.url
      gen.festival.festivalNpcs.forEach((p, i) => {
        const data: NpcData = {
          role: i === 0 && src ? 'festival' : 'passer',
          look: p.look,
          lookSeed: p.seed,
          move: i === 0 ? 'look' : 'wander',
          range: 1,
          tags: { region: town.pref, kit: town.kit, town: town.id },
          ...(i === 0 && src
            ? { fact: { template: 'festival.month', ref: { kind: 'festival' as const, id: f.id }, params: { name: f.name.ja, months: (f.months ?? []).join('、') }, source: { label: src.includes('wikipedia') ? '維基百科' : 'Wikidata', url: src } } }
            : {}),
        }
        const e: MapEntity = { id: `festival:${town.id}:${i}`, kind: 'npc', x: p.x, y: p.y, facing: 'down', data: data as unknown as Record<string, unknown> }
        if (!out.entities.some((x) => x.x === e.x && x.y === e.y)) out.entities.push(e)
      })
    }
    return out
  }

  function innExit(): { map: string; x: number; y: number } {
    const fromId = (id: string | null) => {
      if (!id) return null
      const gen = generate(codeOf(id) ?? '')
      return gen?.inn && gen.inn.map === id ? { map: id, x: gen.inn.stairs.x, y: gen.inn.stairs.y + 1 } : null
    }
    const hit = fromId(innNow())
    if (hit) return hit
    for (const t of world.towns) {
      const gen = generate(t.id)
      if (gen?.inn) return { map: gen.inn.map, x: gen.inn.stairs.x, y: gen.inn.stairs.y + 1 }
    }
    return { map: world.towns[0]?.mapId ?? '', x: 1, y: 1 }
  }

  const mapSource: MapSource = (id) => {
    if (id === 'room') return room(innExit())
    const code = codeOf(id)
    if (!code) return null
    const town = towns.get(code)
    const gen = town ? generate(code) : null
    if (!town || !gen) return null
    here = code
    if (id === town.mapId) return townMap(gen, town, dayNow())
    const int = gen.interiors.get(id) ?? null
    if (int && id.includes(':inn:')) lastInn = id
    return int
  }

  // 起點
  const startTown = towns.get(world.startTown)
  const startGen = startTown ? generate(startTown.id) : null
  const startRule = startTown ? (opts.rules ?? TOWN_RULES)[startTown.pref] : undefined
  let start: GameWorld['start'] = { map: startTown?.mapId ?? '', x: 1, y: 1, dir: 'down' }
  if (startTown && startGen) {
    const hall = [...startGen.interiors.keys()].find((k) => k.includes(':station:'))
    const air = startGen.stops.airport
    if (startRule?.startStop === 'airport' && air) start = { map: air.map, x: air.x, y: air.y, dir: air.dir }
    else if (hall) {
      const m = startGen.interiors.get(hall)!
      start = { map: hall, x: m.start!.x, y: m.start!.y - 1, dir: 'up' }
    } else start = { ...startGen.stops.main! }
  }

  const arrival = (link: Link): Arrival => {
    const gen = generate(link.to)
    const a = gen?.stops[link.toStop] ?? gen?.stops.main
    return a ?? { map: towns.get(link.to)?.mapId ?? '', x: 1, y: 1, dir: 'down' }
  }

  function* ride(s: ScriptApi, link: Link, o: TravelOptions = {}): Script {
    const game = s.game
    const sec = o.seconds ?? 2.4
    const pressed = () => game.input.held('A') || game.input.held('B')
    // 目的地的縣還沒讀：車窗畫面一開始就去讀（讀好了才到站；讀不到回到這裡）
    let state: 'ready' | 'loading' | 'failed' = towns.has(link.to) ? 'ready' : 'loading'
    if (state === 'loading') {
      const pref = prefOfTown(link.to)
      if (!pref) state = 'failed'
      else
        void ensurePref(pref).then(
          (ok) => (state = ok && towns.has(link.to) ? 'ready' : 'failed'),
          () => (state = 'failed'),
        )
    }
    const destKit: Kit = towns.get(link.to)?.kit ?? kitOfIndex(link.to) ?? 'kinki'
    yield* s.sfx(DEPART_SFX[link.legs[0]!.mode])
    yield* s.fade('out')
    // 目的地第一次去要生成（幾十毫秒）：等畫面黑了再做，按下剪票口的那一格不卡
    let dest = state === 'ready' ? arrival(link) : null
    const waitFrames = (opts.loadWaitSeconds ?? 20) * 60
    for (const [i, leg] of link.legs.entries()) {
      const last = i === link.legs.length - 1
      // 窗外：最後一段是目的地的地方（kit 與季節都是目的地的：4 月的東京是春、北海道還是冬）；前一段是出發地的
      const kit = last ? destKit : (towns.get(link.from)?.kit ?? 'kinki')
      const season = last ? seasonOf(game.clock.date, link.to) : game.clock.season
      // 新幹線的那一段（leg.shinkansen：京都 ↔ 東京）：車窗畫新幹線
      const scene: RideScene = { mode: leg.mode, kit, time: game.clock.time, season, ...(leg.shinkansen ? { shinkansen: true } : {}) }
      game.setOverlay(rideOverlay(scene))
      // 目的地的縣還在讀：季節先照世界索引的 kit 算，讀好了（有那一鎮的氣象台）再算一次，不一樣就換窗外
      let exact = !last || state === 'ready'
      if (i > 0) yield* s.sfx(DEPART_SFX[leg.mode])
      yield* s.fade('in')
      // 2–3 秒，按 A／B 可以跳過（選目的地時按著的 A 要先放開）；最後一段等目的地的資料（最多 loadWaitSeconds 秒）
      let frames = 0
      let done = false
      let released = !pressed()
      yield () => {
        frames++
        if (!exact && state === 'ready') {
          exact = true
          const s2 = seasonOf(game.clock.date, link.to)
          if (s2 !== scene.season) game.setOverlay(rideOverlay({ ...scene, season: s2 }))
        }
        if (!pressed()) released = true
        if (!done) done = frames >= sec * 60 || (released && pressed())
        if (!done) return false
        if (!last || state !== 'loading') return true
        if (frames >= waitFrames) state = 'failed'
        return state !== 'loading'
      }
      yield* s.fade('out')
      if (state === 'failed') break
    }
    game.setOverlay(null)
    if (state !== 'ready') {
      // 讀不到：回到出發的地方（還在剪票口、機場櫃台前，沒有換地圖），時間不走
      yield* s.fade('in')
      yield* s.sfx('error')
      yield* s.say(opts.cannotGo?.() ?? CANNOT_GO)
      return
    }
    dest ??= arrival(link)
    const town = towns.get(link.to)
    game.clock.advance(link.minutes)
    yield* s.warp(dest.map, dest.x, dest.y, dest.dir)
    yield* s.sfx(ARRIVE_SFX[link.legs[link.legs.length - 1]!.mode])
    yield* s.fade('in')
    if (town) o.onArrive?.(town)
  }

  function travel(game: Game, l: Link | string, o: TravelOptions = {}): Runner | null {
    const link = typeof l === 'string' ? links.get(l) : l
    if (!link) return null
    return game.run((s) => ride(s, link, o))
  }

  function attach(game: Game): () => void {
    attached = game
    const ext = (game.state.ext.world ??= { v: 1 }) as { v: number; lastInn?: string }
    if (ext.lastInn) lastInn = ext.lastInn
    let lastDate = ''
    const sync = () => {
      const mapId = game.map?.id ?? ''
      const code = codeOf(mapId)
      if (code && towns.has(code)) here = code
      today = { ...game.clock.date }
      if (mapId.includes(':inn:')) {
        lastInn = mapId
        const e = (game.state.ext.world ??= { v: 1 }) as { v: number; lastInn?: string }
        e.lastInn = mapId
      }
      if (opts.weather !== false && code && towns.has(code) && game.map?.outdoor) game.setWeather(weatherAt(game.clock.date, code, towns.get(code)!.kit, seasonOf(game.clock.date, code)))
    }
    /** 換日：鎮上的花換成那一天的（view.setTile 重算接邊） */
    const rebloom = () => {
      const view = game.view
      const map = game.map
      const code = map ? codeOf(map.id) : null
      if (!view || !map || !code || map.id !== towns.get(code)?.mapId) return
      const gen = generate(code)
      if (!gen) return
      const bloom = bloomOf(game.clock.date, code)
      for (const c of gen.bloom) {
        const want = bloom.has(c.flower) ? c.bloom : c.base
        if (map[c.layer][c.i] !== want) view.setTile(c.layer, c.i % map.w, Math.floor(c.i / map.w), want)
      }
    }
    sync()
    const offs = [
      game.on('mapEnter', () => sync()),
      game.on('clock', (e) => {
        const k = dateKey(e.date)
        if (k === lastDate) return
        lastDate = k
        sync()
        rebloom()
      }),
    ]
    return () => {
      offs.forEach((f) => f())
      if (attached === game) attached = null
    }
  }

  return {
    world,
    towns: world.towns,
    links: world.links,
    startTown: world.startTown,
    genVersion,
    index,
    atlas: world.atlas ?? [],
    prefs: prefsNow,
    hasPref: (pref) => loaded.has(pref),
    addPref,
    ensurePref,
    prefOfTown,
    onPrefs: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    start,
    mapSource,
    seasonOf,
    bloomOf,
    festivalsOf,
    festivalNow: (game) => {
      const map = game.map
      const code = map ? codeOf(map.id) : null
      return !!map?.outdoor && !!code && festivalsOf(game.clock.date, code).length > 0
    },
    climateOf: climate,
    townById: (id) => towns.get(id),
    townOf: (mapId) => {
      const code = codeOf(mapId)
      return code ? (towns.get(code) ?? null) : null
    },
    prefOf,
    linkById: (id) => links.get(id),
    linksFrom: (town, stop) => linksFrom(world, town, stop),
    arrival,
    travel,
    ride,
    attach,
    generate,
    questSpotsOf: (town) => generate(town)?.questSpots ?? [],
    warm: () => {
      let stop = false
      let id = 0
      const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback : (fn: () => void) => setTimeout(fn, 200) as unknown as number
      const cancel = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : (n: number) => clearTimeout(n)
      const next = () => {
        if (stop) return
        const t = world.towns.find((x) => !gens.has(x.id))
        if (!t) return
        id = idle(() => {
          if (stop) return
          generate(t.id)
          next()
        })
      }
      next()
      return () => {
        stop = true
        if (id) cancel(id)
      }
    },
  }
}
