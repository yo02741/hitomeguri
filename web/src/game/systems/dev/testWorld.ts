import '../../tiles/basic'

import type { MapSource } from '../../engine/game'
import { asciiMap, type CellSpec, setTile } from '../../engine/map'
import type { GameMap, MapEntity } from '../../engine/types'
import { buildShop } from '../../maps/shop'
import { buildTown } from '../../maps/town'
import type { PrefLike, TownLike, WorldLike } from '../types'

/**
 * 開發、測試用的小世界（不進正式的遊戲）：P0 的測試小鎮改成「下京区」「東山区」兩鎮、P0 的店改成車站大廳（賣店、
 * 老舖、食堂、茶屋的櫃台、站章台），再加一間你的房間。實體的形狀照規格 §11（world 之後產生的也是這個樣子），
 * 資料是 fixtures/kyoto.json（二条城、祇園祭、一保堂…），用來在瀏覽器裡、vitest 裡走過拍照、買東西、蓋章、擺設、委託。
 */
export const DEV_TOWN = '261068'
export const DEV_TOWN_2 = '261050'
export const DEV_START = { map: `int:${DEV_TOWN}:station:0`, x: 4, y: 6, dir: 'up' as const }

const NIJO = 'wd-Q1013399'

export function devWorld(prefs: readonly PrefLike[]): WorldLike {
  const kyoto = prefs.find((p) => p.pref === 'kyoto')
  const muni = (m: string) => kyoto?.municipalities?.find((x) => x.m === m)
  const town = (id: string, zh: string): TownLike => {
    const m = muni(id)
    return {
      id,
      pref: 'kyoto',
      name: { ja: m?.n ?? id, kana: m?.h, zh },
      center: m?.l ? { lng: m.l[0]!, lat: m.l[1]! } : undefined,
      mapId: `town:${id}`,
      kit: 'kinki',
      station: { id: 'node-267316272', name: '京都' },
    }
  }
  return { towns: [town(DEV_TOWN, '下京區'), town(DEV_TOWN_2, '東山區')], startTown: DEV_TOWN }
}

/** P0 的小鎮改成某一鎮：地圖 id、名字、門、加上 §11 的實體 */
function devTown(code: string, name: { ja: string; romaji: string; zh: string }, extra: MapEntity[], second = false): GameMap {
  const map = buildTown().map
  map.id = `town:${code}`
  map.name = name
  map.bgm = 'kyoto'
  for (const w of map.warps) if (w.to === 'shop') w.to = `int:${code}:station:0`
  const sign = map.entities.find((e) => e.id === 'town-sign')
  if (sign) sign.data = { spotId: NIJO, source_url: 'https://zh.wikipedia.org/wiki/%E4%BA%8C%E6%A2%9D%E5%9F%8E' }
  const photo = map.entities.find((e) => e.id === 'pond-photo')
  // 池子當作地標（評分用的範圍）
  if (photo) photo.data = { spotId: NIJO, name: { ja: '元離宮二条城', zh: '二條城' }, target: { x: 18, y: 11, w: 9, h: 7 } }
  const old = map.entities.find((e) => e.id === 'oldman')
  if (old) old.data = { ...old.data, role: 'passer', text: undefined }
  map.entities.push(...extra)
  // 站章台、名城的章（桌子）
  for (const e of extra) if (e.kind === 'stamp') setTile(map, 'lower', e.x, e.y, 'basic/table')
  if (second) map.entities = map.entities.filter((e) => e.kind !== 'stamp')
  return map
}

function devStation(code: string, name: { ja: string; romaji: string; zh: string }): GameMap {
  const map = buildShop()
  map.id = `int:${code}:station:0`
  map.name = name
  map.bgm = 'interior'
  for (const w of map.warps) if (w.to === 'town') w.to = `town:${code}`
  map.scripts = {}
  const clerk = map.entities.find((e) => e.id === 'clerk')
  if (clerk) clerk.data = { look: 'clerk', move: 'stand', role: 'clerk', shop: 'kiosk' }
  map.entities.push(
    // 賣店（車站）：架子
    { id: 'kiosk', kind: 'shop', x: 8, y: 2, data: { shopKind: 'station', name: '駅の売店', items: [] } },
    // 老舖（一保堂）：盆栽那一格當作櫃台
    { id: 'ippodo', kind: 'shop', x: 9, y: 2, data: { shopKind: 'shinise', name: '一保堂', shiniseId: 'shinise-q11352421', items: [] } },
    // 茶屋（茶寮都路里）
    { id: 'tsujiri', kind: 'shop', x: 1, y: 2, data: { shopKind: 'teahouse', name: '茶寮都路里', shiniseId: 'shinise-node-4775546783', items: [] } },
    // 食堂：桌子
    { id: 'shokudo', kind: 'shop', x: 7, y: 5, data: { shopKind: 'shokudo', name: '食堂', items: [] } },
    // 站章台
    { id: 'eki-stamp', kind: 'stamp', x: 6, y: 2, data: { stampId: `station:${code}`, stampKind: 'station', pref: 'kyoto', name: '京都', stationId: 'node-267316272', spotId: NIJO } },
    // 剪票口（目的地）
    {
      id: 'gate',
      kind: 'travel',
      x: 9,
      y: 4,
      data: {
        mode: 'rail',
        fromTown: code,
        look: 'folk-d',
        dests: [
          { town: code === DEV_TOWN ? DEV_TOWN_2 : DEV_TOWN, name: code === DEV_TOWN ? '東山区' : '下京区', km: 3.1, kmKind: 'rail', link: 'dev' },
          { town: '472018', name: '那覇市', km: 1067, kmKind: 'straight', mode: 'plane', via: { name: '関西国際空港', km: 99.6, kmKind: 'rail', mode: 'rail' }, link: 'dev-naha' },
        ],
      },
    },
  )
  setTile(map, 'lower', 6, 2, 'basic/table')
  return map
}

const ROOM_LEGEND: Record<string, CellSpec> = {
  '^': { g: 'basic/wall-in-top' },
  '|': { g: 'basic/wall-in' },
  _: {},
  B: { l: 'basic/shelf' },
  t: { l: 'basic/table', mark: 'desk' },
  X: { g: 'basic/void' },
  m: { l: 'basic/mat', mark: 'exit' },
}
const ROOM_ROWS = ['^^^^^^^^^^', '||||||||||', '_______t__', '_BBBBBB___', '__________', '_BBBBBB___', '__________', '_BBBBBB___', '__________', 'XXXXmXXXXX']

/** 你的房間：牆上 4 個相框、架子 6×3（三排，中間是走道）、桌上的印帳、門墊 */
export function devRoom(): GameMap {
  const { map, marks } = asciiMap({
    id: 'room',
    name: { ja: 'あなたの部屋', romaji: 'HEYA', zh: '你的房間' },
    outdoor: false,
    rows: ROOM_ROWS,
    legend: ROOM_LEGEND,
    ground: 'basic/floor',
    border: { ground: 'basic/void' },
    bgm: 'interior',
    start: { x: 4, y: 8, dir: 'up' },
  })
  const ents: MapEntity[] = []
  ;[2, 4, 6, 8].forEach((x, i) => ents.push({ id: `frame-${i}`, kind: 'frameSlot', x, y: 1, data: { index: i } }))
  for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) ents.push({ id: `shelf-${row}-${col}`, kind: 'shelfSlot', x: col + 1, y: 3 + row * 2, data: { index: row * 6 + col, col, row } })
  const desk = marks.desk![0]!
  ents.push({ id: 'desk', kind: 'desk', x: desk.x, y: desk.y })
  const exit = marks.exit![0]!
  ents.push({ id: 'room-door', kind: 'roomDoor', x: exit.x, y: exit.y })
  map.entities.push(...ents)
  return map
}

export function devMaps(): MapSource {
  const built = new Map<string, GameMap>()
  const make: Record<string, () => GameMap> = {
    [`town:${DEV_TOWN}`]: () =>
      devTown(DEV_TOWN, { ja: '下京区', romaji: 'SHIMOGYO', zh: '下京區' }, [
        { id: 'fact-gion', kind: 'npc', x: 5, y: 10, facing: 'down', data: { role: 'fact', look: 'folk-b', move: 'stand', fact: { template: 'festival.month', ref: { kind: 'festival', id: 'kyoto-Q979873' }, params: {} } } },
        { id: 'fact-sakura', kind: 'npc', x: 22, y: 9, facing: 'down', data: { role: 'fact', look: 'folk-a', move: 'stand', fact: { template: 'sakura.normal', ref: { kind: 'town', id: DEV_TOWN }, params: {} } } },
        { id: 'quest-1', kind: 'npc', x: 8, y: 21, facing: 'up', data: { role: 'quest', look: 'folk-c', move: 'stand' } },
        { id: 'castle-stamp', kind: 'stamp', x: 20, y: 20, data: { stampId: 'castle-053', stampKind: 'castle', pref: 'kyoto', name: '二条城', castleId: 'castle-053', spotId: NIJO } },
        { id: 'inn-desk', kind: 'npc', x: 24, y: 21, facing: 'left', data: { role: 'inn', look: 'clerk', move: 'stand' } },
        { id: 'inn', kind: 'inn', x: 26, y: 21, data: { innKind: 'ryokan', name: '旅館' } },
      ]),
    [`town:${DEV_TOWN_2}`]: () =>
      devTown(
        DEV_TOWN_2,
        { ja: '東山区', romaji: 'HIGASHIYAMA', zh: '東山區' },
        [{ id: 'quest-2', kind: 'npc', x: 8, y: 21, facing: 'up', data: { role: 'quest', look: 'folk-c', move: 'stand' } }],
        true,
      ),
    [`int:${DEV_TOWN}:station:0`]: () => devStation(DEV_TOWN, { ja: '京都駅', romaji: 'KYOTO', zh: '京都車站' }),
    [`int:${DEV_TOWN_2}:station:0`]: () => devStation(DEV_TOWN_2, { ja: '東山の駅', romaji: 'HIGASHIYAMA', zh: '東山的車站' }),
    room: devRoom,
  }
  return (id) => {
    const hit = built.get(id)
    if (hit) return hit
    const fn = make[id]
    if (!fn) return null
    const m = fn()
    built.set(id, m)
    return m
  }
}
