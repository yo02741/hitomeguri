import { describe, expect, it } from 'vitest'

import { emptyMap } from '../engine/map'
import { nearestPlace, type Place, placeDistance, placesOf, placeSub, rectDistance } from '../engine/places'
import type { MapEntity } from '../engine/types'

import { ENTER_EXTRA, NOTICE_COOLDOWN_MS, NOTICE_REACH, PlaceNotice } from './nearby'

// 走近地標時浮出的地名（P4，規格 §13 的 2）：哪裡算「附近」、同一個地方多久不重複、進地圖時不浮出。
const place = (id: string, x: number, y: number, w = 1, h = 1): Place => ({
  id,
  kind: 'landmark',
  name: { ja: id },
  rect: { x, y, w, h },
  at: { x: x + Math.floor(w / 2), y: y + Math.floor(h / 2) },
  near: { x: x + Math.floor(w / 2), y: y + h },
})

describe('附近：距離', () => {
  it('範圍裡是 0，斜角也算一格（Chebyshev）', () => {
    const r = { x: 10, y: 10, w: 3, h: 2 }
    expect(rectDistance(r, 11, 11)).toBe(0)
    expect(rectDistance(r, 9, 9)).toBe(1)
    expect(rectDistance(r, 13, 12)).toBe(1)
    expect(rectDistance(r, 15, 10)).toBe(3)
  })
  it('告示牌那一格也算（本體在後面的大寺，走到告示牌旁就到了）', () => {
    const p = place('寺', 10, 2, 6, 5)
    expect(p.near).toEqual({ x: 13, y: 7 })
    expect(placeDistance(p, 13, 9)).toBe(2)
  })
  it('最近的那一個；一樣近時範圍小的優先；太遠就沒有', () => {
    const big = place('大寺', 0, 0, 10, 10)
    const shop = place('老舖', 10, 4)
    expect(nearestPlace([big, shop], 11, 4)?.id).toBe('老舖')
    expect(nearestPlace([big, shop], 10, 5)?.id).toBe('老舖')
    expect(nearestPlace([big, shop], 30, 30)).toBeNull()
    expect(nearestPlace([shop], 10 + NOTICE_REACH, 4)?.id).toBe('老舖')
    expect(nearestPlace([shop], 10 + NOTICE_REACH + 1, 4)).toBeNull()
  })
})

describe('浮出與冷卻', () => {
  const A = place('A', 10, 10, 3, 3)
  const B = place('B', 30, 10, 3, 3)
  it('走進附近浮出一次；待在附近不再浮出', () => {
    const n = new PlaceNotice()
    n.enter('town:1', [A, B], 0, 0, 0)
    expect(n.step(5, 11, 100)).toBeNull()
    expect(n.step(8, 11, 200)?.id).toBe('A')
    expect(n.step(9, 11, 300)).toBeNull()
    expect(n.step(11, 11, 400)).toBeNull()
    expect(n.current).toBe('A')
  })
  it('走開再回來：冷卻沒過不浮出，過了再浮出', () => {
    const n = new PlaceNotice()
    n.enter('town:1', [A, B], 0, 0, 0)
    expect(n.step(8, 11, 1000)?.id).toBe('A')
    expect(n.step(20, 11, 2000)).toBeNull()
    expect(n.step(8, 11, 3000)).toBeNull()
    expect(n.step(20, 11, 4000)).toBeNull()
    expect(n.step(8, 11, 1000 + NOTICE_COOLDOWN_MS)?.id).toBe('A')
  })
  it('從一個地方走到另一個：各浮出一次', () => {
    const n = new PlaceNotice()
    n.enter('town:1', [A, B], 0, 0, 0)
    expect(n.step(12, 11, 10)?.id).toBe('A')
    expect(n.step(29, 11, 20)?.id).toBe('B')
    expect(n.step(12, 11, 30)).toBeNull()
  })
  it('進地圖時腳下附近的地方不浮出（到站、出門時不跟地名牌一起出來）', () => {
    const n = new PlaceNotice()
    n.enter('town:1', [A, B], 11, 11, 0)
    expect(n.current).toBe('A')
    expect(n.step(12, 11, 100)).toBeNull()
    expect(n.step(20, 11, 200)).toBeNull()
    expect(n.step(12, 11, 300)).toBeNull()
    expect(n.step(29, 11, 400)?.id).toBe('B')
  })
  it('進地圖時再遠幾格的地方也當作剛看過（下車走出站前廣場，不馬上浮出車站名）；冷卻過了照常', () => {
    const n = new PlaceNotice()
    const far = 12 + NOTICE_REACH + ENTER_EXTRA
    n.enter('town:1', [A, B], far, 11, 0)
    expect(n.current).toBeNull()
    expect(n.step(12, 11, 100)).toBeNull()
    expect(n.step(20, 11, 200)).toBeNull()
    expect(n.step(12, 11, NOTICE_COOLDOWN_MS + 1)?.id).toBe('A')
    // 再遠一格就不算
    const m = new PlaceNotice()
    m.enter('town:1', [A, B], far + 1, 11, 0)
    expect(m.step(12, 11, 100)?.id).toBe('A')
  })
  it('不同地圖的同一個 id 各算各的；reset 全部忘掉', () => {
    const n = new PlaceNotice()
    n.enter('town:1', [A], 0, 0, 0)
    expect(n.step(11, 11, 10)?.id).toBe('A')
    n.enter('town:2', [A], 0, 0, 20)
    expect(n.step(11, 11, 30)?.id).toBe('A')
    n.enter('town:1', [A], 0, 0, 40)
    expect(n.step(11, 11, 50)).toBeNull()
    n.reset()
    n.enter('town:1', [A], 0, 0, 60)
    expect(n.step(11, 11, 70)?.id).toBe('A')
  })
})

describe('地圖上有名字的地方（只讀地圖的資料）', () => {
  const map = emptyMap({ id: 'town:9', name: { ja: '下京区', romaji: 'SHIMOGYO-KU', zh: '下京區' }, w: 40, h: 30, outdoor: true, border: { ground: 1 } })
  const ents: MapEntity[] = [
    { id: 'sign:wd-1', kind: 'sign', x: 12, y: 9, data: { spotId: 'wd-1', title: { ja: '西本願寺', zh: '西本願寺', kana: 'にしほんがんじ' }, source_url: 'https://example.org/a' } },
    { id: 'photo:wd-1', kind: 'photoSpot', x: 13, y: 9, data: { spotId: 'wd-1', name: { ja: '西本願寺' }, target: { x: 10, y: 3, w: 5, h: 4 } } },
    { id: 'sign:station:9', kind: 'sign', x: 20, y: 20, data: { title: { ja: '京都', romaji: 'KYOTO' }, source_url: 'https://example.org/b' } },
    { id: 'sign:shinise-1', kind: 'sign', x: 30, y: 5, data: { shiniseId: 'shinise-1', title: { ja: '鳩居堂' }, source_url: 'https://example.org/c' } },
    { id: 'sign:empty', kind: 'sign', x: 1, y: 1, data: { text: '告示' } },
    { id: 'npc:1', kind: 'npc', x: 5, y: 5 },
  ]
  map.entities.push(...ents)
  map.warps.push(
    { x: 21, y: 18, to: 'int:9:station:0', tx: 1, ty: 1 },
    { x: 31, y: 4, to: 'int:9:shinise:0', tx: 1, ty: 1 },
    { x: 8, y: 25, to: 'int:9:teahouse:0', tx: 1, ty: 1 },
    { x: 9, y: 25, to: 'int:9:teahouse:0', tx: 1, ty: 1 },
    { x: 12, y: 6, to: 'int:9:juyosho:0', tx: 1, ty: 1 },
  )
  const names: Record<string, { ja: string; romaji: string; zh: string }> = {
    'int:9:station:0': { ja: '京都駅', romaji: 'KYOTO', zh: '京都站' },
    'int:9:shinise:0': { ja: '鳩居堂', romaji: '', zh: '鳩居堂' },
    'int:9:teahouse:0': { ja: '茶寮都路里', romaji: '', zh: '茶寮都路里' },
    'int:9:juyosho:0': { ja: '西本願寺　授与所', romaji: '', zh: '西本願寺 授與所' },
  }
  const ps = placesOf(map, (id) => names[id])

  it('告示牌的名字：地標（範圍＝拍攝點的 target）、車站、老舖；沒有名字的告示牌不算', () => {
    const byId = Object.fromEntries(ps.map((p) => [p.id, p]))
    expect(byId['sign:wd-1']).toMatchObject({ kind: 'landmark', rect: { x: 10, y: 3, w: 5, h: 4 }, at: { x: 12, y: 5 }, near: { x: 12, y: 9 } })
    expect(byId['sign:station:9']).toMatchObject({ kind: 'station', name: { ja: '京都', romaji: 'KYOTO' } })
    expect(byId['sign:shinise-1']).toMatchObject({ kind: 'shop', name: { ja: '鳩居堂' } })
    expect(byId['sign:empty']).toBeUndefined()
  })
  it('門：室內的名字（茶屋），同一個室內只算一次；車站、授与所、跟告示牌同名的老舖不重複', () => {
    const doors = ps.filter((p) => p.kind === 'door')
    expect(doors.map((p) => p.name.ja)).toEqual(['茶寮都路里'])
    expect(doors[0]!.name.zh).toBeUndefined()
  })
  it('小字：中文跟日文一樣時用念法，再沒有用羅馬字', () => {
    expect(placeSub({ ja: '西本願寺', zh: '西本願寺', kana: 'にしほんがんじ' })).toBe('にしほんがんじ')
    expect(placeSub({ ja: '京都タワー', zh: '京都塔', kana: 'きょうとたわー' })).toBe('京都塔')
    expect(placeSub({ ja: '京都', romaji: 'KYOTO' })).toBe('KYOTO')
    expect(placeSub({ ja: '鳩居堂' })).toBeNull()
  })
})
