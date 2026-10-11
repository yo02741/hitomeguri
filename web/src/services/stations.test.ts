import { describe, expect, it } from 'vitest'

import type { MapSpot, RailBundle } from './bundles'
import { nearbySpots, osmUrl, sameStation, stationInfo } from './stations'

const rail: RailBundle = {
  lines: [
    { n: 'JR山手線', c: '#80c241', k: 'train', o: '東日本旅客鉄道', g: [] },
    { n: '東北新幹線', k: 'train', o: '東日本旅客鉄道', g: [], s: 1 },
    { n: '東京メトロ丸ノ内線', c: '#f62e36', k: 'subway', o: '東京地下鉄;東京都交通局', g: [] },
    { n: 'JR山手線', k: 'train', g: [] },
  ],
  stations: [
    { id: 'node-1', n: '東京', e: 'Tokyo', lat: 35.681, lng: 139.767, l: [0, 1], s: 1 },
    // 合併過的車站點（地下鉄の東京駅）：同一個 id
    { id: 'node-1', n: '東京', lat: 35.682, lng: 139.766, l: [2, 3] },
    { id: 'node-2', n: '有楽町', lat: 35.675, lng: 139.763, l: [0] },
  ],
}

const spot = (id: string, lat: number, lng: number, s: number, st?: string): MapSpot => ({ id, n: id, lat, lng, k: 'major', f: 0, s, st })

describe('stationInfo', () => {
  it('同一個 id 的車站點合併路線；新幹線在前，同名的路線只列一次', () => {
    const info = stationInfo(rail, 'node-1')!
    expect(info).toMatchObject({ id: 'node-1', name: '東京', en: 'Tokyo', lat: 35.681, lng: 139.767, shinkansen: true })
    expect(info.lines.map((l) => l.name)).toEqual(['東北新幹線', 'JR山手線', '東京メトロ丸ノ内線'])
    expect(info.lines[0]!.shinkansen).toBe(true)
    expect(info.lines[1]).toEqual({ name: 'JR山手線', color: '#80c241', shinkansen: false, operator: '東日本旅客鉄道' })
    expect(info.lines[2]!.operator).toBe('東京地下鉄・東京都交通局')
  })

  it('沒有這個 id、沒有資料時為 null', () => {
    expect(stationInfo(rail, 'node-9')).toBeNull()
    expect(stationInfo(null, 'node-1')).toBeNull()
    expect(stationInfo(rail, null)).toBeNull()
    expect(stationInfo(rail, 'node-2')!.shinkansen).toBe(false)
  })
})

describe('nearbySpots', () => {
  const st = { id: 'node-1', lat: 35.681, lng: 139.767 }
  it('最近車站是這一站的景點，依分數', () => {
    const spots = [spot('a', 35.684, 139.77, 50, 'node-1'), spot('b', 35.682, 139.768, 80, 'node-1'), spot('c', 35.681, 139.767, 99, 'node-2')]
    const r = nearbySpots(spots, st)
    expect(r.mode).toBe('nearest')
    expect(r.rows.map((x) => x.spot.id)).toEqual(['b', 'a'])
    expect(r.rows[0]!.d % 10).toBe(0)
  })

  it('沒有時改列 1.5 km 內最近的幾個（依距離）', () => {
    const spots = [
      spot('far', 35.8, 139.9, 99, 'node-9'),
      spot('n2', 35.69, 139.767, 10, 'node-9'),
      spot('n1', 35.682, 139.767, 5, 'node-9'),
    ]
    const r = nearbySpots(spots, st)
    expect(r.mode).toBe('near')
    expect(r.rows.map((x) => x.spot.id)).toEqual(['n1', 'n2'])
    expect(nearbySpots([], st)).toEqual({ mode: 'near', rows: [] })
  })
})

describe('sameStation、osmUrl', () => {
  it('「駅」與空白不算', () => {
    expect(sameStation('東京駅', '東京')).toBe(true)
    expect(sameStation('京都', '東京')).toBe(false)
  })
  it('OSM 的點才有網址', () => {
    expect(osmUrl('node-123')).toBe('https://www.openstreetmap.org/node/123')
    expect(osmUrl('pseudo-1')).toBeNull()
  })
})
