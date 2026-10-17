import type { Festival } from '../../services/bundles'

import type { CalendarDate } from '../engine/clock'
import type { Game, MapSource } from '../engine/game'
import type { Runner, ScriptApi } from '../engine/script'
import type { Dir, GameMap, MapEntity, Script, Season } from '../engine/types'

import { generateTown, type Arrival, type TownGen } from './gen/town'
import { room } from './gen/interiors'
import { ARRIVE_SFX, DEPART_SFX, rideOverlay } from './ride'
import { bloomAt, type Climate, climateOf, type Flower, festivalsIn, seasonAt, weatherAt } from './season'
import { buildWorld, linksFrom, TOWN_RULES, type TownRule } from './towns'
import type { Link, NpcData, PrefData, Town, World } from './types'
import './kits'

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
 */
export const GEN_VERSION = 2

export interface WorldOptions {
  genVersion?: number
  rules?: Record<string, TownRule>
  /** 天氣跟著日期與鎮換（預設 true；false 就不動 game.weather） */
  weather?: boolean
}

export interface TravelOptions {
  /** 到了之後（PlayView 可以放 jingle('arrive')） */
  onArrive?(town: Town): void
  /** 車窗畫面每一段的秒數（預設 2.4） */
  seconds?: number
}

export interface GameWorld {
  world: World
  towns: Town[]
  links: Link[]
  startTown: string
  genVersion: number
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

export function createWorld(prefs: PrefData[], opts: WorldOptions = {}): GameWorld {
  const genVersion = opts.genVersion ?? GEN_VERSION
  const world = buildWorld(prefs, opts.rules ?? TOWN_RULES)
  const towns = new Map(world.towns.map((t) => [t.id, t]))
  const prefOf = (id: string) => {
    const t = towns.get(id)
    return t ? prefs.find((p) => p.pref === t.pref) : undefined
  }
  const links = new Map(world.links.map((l) => [l.id, l]))
  const gens = new Map<string, TownGen>()
  const climates = new Map<string, Climate | null>()

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
      climates.set(id, t && p ? climateOf(p, t) : null)
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
      s = seasonAt(d, t?.kit ?? 'kinki', climate(id))
      if (seasonCache.size > 400) seasonCache.clear()
      seasonCache.set(k, s)
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
    const town = towns.get(link.to)
    const sec = o.seconds ?? 2.4
    const pressed = () => game.input.held('A') || game.input.held('B')
    yield* s.sfx(DEPART_SFX[link.legs[0]!.mode])
    yield* s.fade('out')
    // 目的地第一次去要生成（幾十毫秒）：等畫面黑了再做，按下剪票口的那一格不卡
    const dest = arrival(link)
    for (const [i, leg] of link.legs.entries()) {
      // 窗外：最後一段是目的地的地方；前一段是出發地的
      const kit = i === link.legs.length - 1 ? (town?.kit ?? 'kinki') : (towns.get(link.from)?.kit ?? 'kinki')
      game.setOverlay(rideOverlay({ mode: leg.mode, kit, time: game.clock.time, season: game.clock.season }))
      if (i > 0) yield* s.sfx(DEPART_SFX[leg.mode])
      yield* s.fade('in')
      // 2–3 秒，按 A／B 可以跳過（選目的地時按著的 A 要先放開）
      let frames = 0
      let released = !pressed()
      yield () => {
        frames++
        if (!pressed()) released = true
        return frames >= sec * 60 || (released && pressed())
      }
      yield* s.fade('out')
    }
    game.setOverlay(null)
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
