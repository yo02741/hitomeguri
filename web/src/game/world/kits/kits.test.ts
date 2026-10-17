import { describe, expect, it } from 'vitest'

import css from '../../../styles/theme.css?raw'
import { PX, type Tokens } from '../../../services/pixelwalk/palette'

import { allTiles, SEASONS, TileCache, TIMES } from '../../engine/tiles'
import { BEHAVIORS } from '../../engine/types'

import { KINKI_BLOOM, OKINAWA_BLOOM, objectInfo, objectNames } from '.'

// 世界的 tile kit（規格 §8.2、§8.8）：近畿、沖繩、共用的室內。每個 tile 每個季節、時段、動畫格、花樣、接邊都畫得出來；
// 地面沒有透明的洞、上兩層不是空的；id 在各自的範圍；開花的那一份都有；不寫色碼由 game/rules.test.ts 檢查

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const RANGES: Record<string, [number, number]> = { kinki: [1024, 2047], okinawa: [2048, 3071], world: [3072, 4095] }

describe('world 的 tile kit', () => {
  const tiles = allTiles().filter((t) => /^(kinki|okinawa|world)\//.test(t.name))

  it('三套都有，id 在各自的範圍、不重複，行為碼都認得', () => {
    for (const kit of Object.keys(RANGES)) expect(tiles.filter((t) => t.name.startsWith(`${kit}/`)).length, kit).toBeGreaterThan(20)
    for (const t of tiles) {
      const [a, b] = RANGES[t.name.split('/')[0]!]!
      expect(t.id, t.name).toBeGreaterThanOrEqual(a)
      expect(t.id, t.name).toBeLessThanOrEqual(b)
      if (t.behavior) expect(BEHAVIORS, t.name).toContain(t.behavior)
    }
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length)
  })

  it('開花的對照都有兩份（一般、開花），格數一樣', () => {
    for (const [base, { bloom }] of Object.entries({ ...KINKI_BLOOM, ...OKINAWA_BLOOM })) {
      const a = objectInfo(base)
      const b = objectInfo(bloom)
      if (a || b) {
        expect(a, base).toBeTruthy()
        expect(b, bloom).toBeTruthy()
        expect([b!.w, b!.h], bloom).toEqual([a!.w, a!.h])
      } else {
        expect(tiles.some((t) => t.name === base), base).toBe(true)
        expect(tiles.some((t) => t.name === bloom), bloom).toBe(true)
      }
    }
  })

  it('沒有天守、正殿、五重塔這類資料沒寫的建築', () => {
    for (const n of objectNames()) expect(n, n).not.toMatch(/tenshu|seiden|pagoda|gojuno|天守|正殿|五重塔/)
  })

  it('每個 tile 四季、三個時段、每一格動畫、花樣、接邊都畫得出來', () => {
    const cache = new TileCache(tokens)
    const warn = console.warn
    const log: unknown[] = []
    console.warn = (...a: unknown[]) => log.push(a)
    let n = 0
    try {
      for (const t of tiles) {
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
                  n++
                }
      }
    } finally {
      console.warn = warn
    }
    expect(log).toEqual([])
    expect(n).toBeGreaterThan(5000)
  })

  it('夜裡窗戶亮燈（燈的顏色不變暗）', () => {
    const cache = new TileCache(tokens)
    const t = tiles.find((x) => x.name === 'kinki/machiya-a/1,2')!
    const lamp = cache.palette('night').u32['lamp-2']
    const night = cache.draw(t, { season: 'summer', time: 'night', frame: 0, variant: 0, mask: 0, x: 0, y: 0 })
    const day = cache.draw(t, { season: 'summer', time: 'day', frame: 0, variant: 0, mask: 0, x: 0, y: 0 })
    expect(night.buf.includes(lamp)).toBe(true)
    expect(day.buf.includes(cache.palette('day').u32['lamp-2'])).toBe(false)
  })
})
