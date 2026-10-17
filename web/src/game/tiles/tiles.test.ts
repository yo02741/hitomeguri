import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'

import { allTiles, SEASONS, TileCache, TIMES } from '../engine/tiles'
import { B, BEHAVIORS } from '../engine/types'
import './basic'

// tile（規格 §2）：每個 tile 每個季節、時段、動畫格、花樣、接邊都畫得出來；地面不透明（沒有洞）、上兩層不是空的

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens

describe('tile', () => {
  const tiles = allTiles()
  it('有基本的一套，id、名字不重複，行為碼都認得', () => {
    expect(tiles.length).toBeGreaterThan(40)
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length)
    expect(new Set(tiles.map((t) => t.name)).size).toBe(tiles.length)
    for (const t of tiles) if (t.behavior) expect(BEHAVIORS, t.name).toContain(t.behavior)
    expect(B.walk).toBe(0)
  })

  for (const t of tiles)
    it(`${t.name}：四季、三個時段都畫得出來`, () => {
      const cache = new TileCache(tokens)
      const warn = console.warn
      const log: unknown[] = []
      console.warn = (...a: unknown[]) => log.push(a)
      try {
        const masks = t.connect ? Array.from({ length: 16 }, (_, i) => i) : [0]
        for (const season of SEASONS)
          for (const time of TIMES)
            for (let frame = 0; frame < (t.frames ?? 1); frame++)
              for (let variant = 0; variant < (t.variants ?? 1); variant++)
                for (const mask of masks) {
                  const img = cache.draw(t, { season, time, frame, variant, mask, x: 0, y: 0 })
                  const label = `${t.name} ${season} ${time} 格${frame} 花樣${variant} 接邊${mask}`
                  if (t.layer === 'ground') expect(img.opaque, label).toBe(true)
                  else expect(img.buf.some((v) => v !== 0), label).toBe(true)
                }
      } finally {
        console.warn = warn
      }
      expect(log).toEqual([])
    })

  it('夜裡房子的窗戶亮燈（燈的顏色不跟著變暗）', () => {
    const cache = new TileCache(tokens)
    const t = tiles.find((x) => x.name === 'basic/house/0,2')!
    const day = cache.draw(t, { season: 'summer', time: 'day', frame: 0, variant: 0, mask: 0, x: 0, y: 0 })
    const night = cache.draw(t, { season: 'summer', time: 'night', frame: 0, variant: 0, mask: 0, x: 0, y: 0 })
    const lamp = cache.palette('night').u32['lamp-1']
    expect(night.buf.includes(lamp)).toBe(true)
    expect(day.buf.includes(lamp)).toBe(false)
  })
})
