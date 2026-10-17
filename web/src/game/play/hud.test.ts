import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { Gfx } from '../../services/pixelwalk/gfx'
import { makePalette, PX, type Tokens } from '../../services/pixelwalk/palette'

import worldRaw from '../fixtures/_world.json'
import hokkaidoRaw from '../fixtures/hokkaido.json'
import hyogoRaw from '../fixtures/hyogo.json'
import kyotoRaw from '../fixtures/kyoto.json'
import naraRaw from '../fixtures/nara.json'
import okinawaRaw from '../fixtures/okinawa.json'
import osakaRaw from '../fixtures/osaka.json'
import tokyoRaw from '../fixtures/tokyo.json'
import { buildMinimap, drawMinimap, kindOfTile, MINI_INK, MINI_KINDS, miniCounts, miniWindow } from '../engine/minimap'
import { nearestPlace, placesOf } from '../engine/places'
import { allTiles } from '../engine/tiles'
import { parseWorldIndex, prefData } from '../world/data'
import type { PrefRaw } from '../world/types'
import { createWorld } from '../world/world'
import '../world/kits'
import '../world/kits/lazy'

/**
 * P4 的地名與小地圖（規格 §13 的 2）：P2、P3 的每一鎮（fixture 的 7 縣）都畫得出小地圖——路、建築、門、
 * 地標與車站的記號都有，記號在地圖裡；每個地標走到告示牌旁邊就算「到了」（地名浮得出來）。
 */
const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const index = parseWorldIndex(worldRaw)!
const RAWS = [kyotoRaw, okinawaRaw, naraRaw, osakaRaw, hyogoRaw, tokyoRaw, hokkaidoRaw]
const world = createWorld(
  RAWS.map((r) => prefData(r as unknown as PrefRaw)),
  { index },
)
const towns = world.towns
const interiorName = (id: string) => {
  const t = world.townOf(id)
  return t ? world.generate(t.id)?.interiors.get(id)?.name : null
}

describe('小地圖：tile 的分類', () => {
  it('有戶外鎮的 kit：站得上去的地面一律是路、廣場、草、沙（加了地面要補 minimap.ts 的 FAMILY，不然會當成建築）', () => {
    const OUTDOOR = /^(basic|kinki|okinawa|kanto|hokkaido)\//
    const bad = allTiles().filter((t) => OUTDOOR.test(t.name) && t.layer === 'ground' && (t.behavior ?? 'walk') === 'walk' && !['road', 'plaza', 'green', 'sand'].includes(kindOfTile(t.name) ?? ''))
    expect(bad.map((t) => t.name)).toEqual([])
  })
  it('水是水、海是深海；樹、牆、田照名字', () => {
    expect(kindOfTile('kinki/water')).toBe('water')
    expect(kindOfTile('okinawa/deep')).toBe('deep')
    expect(kindOfTile('okinawa/sea')).toBe('deep')
    expect(kindOfTile('kinki/sakura@bloom/1,0')).toBe('tree')
    expect(kindOfTile('hokkaido/kinki-hondo/2,1')).toBe('building')
    expect(kindOfTile('kinki/ishigaki')).toBe('wall')
    expect(kindOfTile('hokkaido/wheat')).toBe('field')
    expect(kindOfTile('kanto/viaduct/0,0')).toBe('rail')
    // 小東西看下面那一層
    expect(kindOfTile('kanto/vending-a')).toBeNull()
    expect(kindOfTile('kinki/torii/1,0')).toBeNull()
  })
  it('每一類都有 px token 的顏色', () => {
    for (const k of MINI_KINDS) expect(PX as readonly string[]).toContain(MINI_INK[k])
  })
})

describe('小地圖：每一鎮都畫得出來（fixture 的 7 縣）', () => {
  it(`7 縣 ${towns.length} 鎮`, () => {
    expect(new Set(towns.map((t) => t.pref)).size).toBe(7)
    expect(towns.length).toBeGreaterThanOrEqual(60)
  })
  for (const t of towns) {
    it(`${t.pref} ${t.name.ja}`, () => {
      const gen = world.generate(t.id)!
      const map = gen.map
      const places = placesOf(map, interiorName)
      const mini = buildMinimap(map, places)
      expect([mini.w, mini.h]).toEqual([map.w, map.h])
      const n = miniCounts(mini)
      const cells = map.w * map.h
      // 路、建築一定有；整張不是同一種；地圖裡沒有空格
      expect(n.road + n.plaza, 'road').toBeGreaterThan(20)
      expect(n.building, 'building').toBeGreaterThan(0)
      expect(n.out, 'out').toBe(0)
      expect(Math.max(...Object.values(n)), 'mixed').toBeLessThan(cells * 0.8)
      // 門（往室內）：每鎮至少有食堂
      expect(mini.doors.length, 'doors').toBeGreaterThan(0)
      for (const d of mini.doors) expect(mini.cells[d.y * map.w + d.x], 'door cell').toBe(MINI_KINDS.indexOf('building'))
      // 記號：有拍攝點的地標都有一個；有車站的鎮有車站
      const spots = map.entities.filter((e) => e.kind === 'photoSpot').length
      expect(mini.marks.filter((m) => m.kind === 'landmark').length, 'landmarks').toBeGreaterThanOrEqual(Math.min(1, spots))
      if (map.entities.some((e) => e.id.startsWith('sign:station:'))) expect(mini.marks.some((m) => m.kind === 'station'), 'station').toBe(true)
      for (const m of mini.marks) {
        expect(m.x >= 0 && m.y >= 0 && m.x < map.w && m.y < map.h, m.id).toBe(true)
      }
      // 每個地方：名字是資料的（告示牌的 title、室內的名字），走到告示牌旁邊算到了
      for (const p of places) {
        expect(p.name.ja.trim().length, p.id).toBeGreaterThan(0)
        expect(nearestPlace(places, p.near.x, p.near.y), p.id).not.toBeNull()
      }
      // 畫：車站附近的一塊（48×32），自己的記號在裡面
      const at = gen.stops.main ?? Object.values(gen.stops)[0]
      const px = at?.map === map.id ? at.x : Math.floor(map.w / 2)
      const py = at?.map === map.id ? at.y : Math.floor(map.h / 2)
      const win = miniWindow(mini, px, py, 48, 32)
      expect(win.w).toBeLessThanOrEqual(48)
      expect(win.h).toBeLessThanOrEqual(32)
      expect(px >= win.x && px < win.x + win.w && py >= win.y && py < win.y + win.h).toBe(true)
      const g = new Gfx(win.w, win.h, makePalette(tokens, 'day'))
      drawMinimap(g, mini, win, { player: { x: px, y: py, dir: 'up' } })
      expect(new Set(g.buf).size).toBeGreaterThan(3)
      expect(g.buf[(py - win.y) * win.w + (px - win.x)]).toBe(g.pal.u32.ink)
    })
  }
})

describe('小地圖：視窗', () => {
  it('自己在中間，到地圖邊停；地圖比較小就整張', () => {
    expect(miniWindow({ w: 64, h: 48 }, 32, 24, 48, 32)).toEqual({ x: 8, y: 8, w: 48, h: 32 })
    expect(miniWindow({ w: 64, h: 48 }, 1, 1, 48, 32)).toEqual({ x: 0, y: 0, w: 48, h: 32 })
    expect(miniWindow({ w: 64, h: 48 }, 63, 47, 48, 32)).toEqual({ x: 16, y: 16, w: 48, h: 32 })
    expect(miniWindow({ w: 30, h: 20 }, 10, 10, 48, 32)).toEqual({ x: 0, y: 0, w: 30, h: 20 })
  })
})
