import { afterEach, describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { PX, type Tokens } from '../../services/pixelwalk/palette'
import { buddyFlip, HeroState } from '../../services/pixelwalk/hero'
import { Gfx } from '../../services/pixelwalk/gfx'
import { makePalette } from '../../services/pixelwalk/palette'
import * as reader from '../../services/pixelwalk/traveller'
import { PixelWalkEngine } from '../../services/pixelwalk/engine'
import { AREAS, EVENTS, TRANSITIONS } from '../../services/pixelwalk/catalog'

import * as cache from './cache'
import { ABOUT_SIZE, GAME_SIZE } from './geometry'
import { toFrame } from './pixelize'
import type { GameRecord, Rgb, TravellerLook, WalkerRecord } from './types'

// 快取：key、記憶體＋KV 兩層、讀回來的檢查；/about 的讀法（services/pixelwalk/traveller.ts）跟這裡寫的格式對得起來

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
const look: TravellerLook = { parts: { skin: 1, hair: 'bob', hairColor: 1, eyes: 'round' }, equipped: { body: 'tee' } }
const PAL: Rgb[] = [
  [210, 74, 60],
  [77, 125, 181],
  [31, 29, 43],
]
const cell = (w: number, h: number, v = 1) => toFrame(w, h, Int16Array.from({ length: w * h }, (_, i) => (i % w > 1 && i % w < w - 2 && i > w * 2 ? v : -1)), PAL)

function walker(key: string): WalkerRecord {
  const { cw, ch } = ABOUT_SIZE
  const s = cell(cw, ch, 0)
  return {
    fmt: 1,
    kind: 'walk',
    key,
    at: 1,
    w: cw,
    h: ch,
    box: [4, 10, 16, 24],
    walk: [s, cell(cw, ch, 1), s, cell(cw, ch, 1)],
    stand: [s, cell(cw, ch, 2)],
    jump: cell(cw, ch, 1),
    camera: [15, 16],
    overhead: { sprite: cell(23, 9, 0), x: 0, dy: -8 },
    buddy: { sprite: cell(12, 11, 1), facing: 'left' },
  }
}
function game(key: string): GameRecord {
  const { cw, ch } = GAME_SIZE
  const t = [cell(cw, ch), cell(cw, ch), cell(cw, ch)] as GameRecord['down']
  return { fmt: 1, kind: 'game', key, at: 2, w: cw, h: ch, box: [6, 12, 20, 28], down: t, up: t, left: t, overhead: null, buddy: null, side: '3d', ms: 10 }
}

/** node 沒有 localStorage：測試用的 */
function fakeStorage() {
  const m = new Map<string, string>()
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
  }
  return m
}
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage
})

describe('快取的 key', () => {
  it('同一個外觀同一個 key；尺寸、版本、指紋、任一部位不同就不同', () => {
    const k = cache.cacheKey(GAME_SIZE, look, 'fp')
    expect(k).toMatch(/^v1:20x28:[0-9a-z]+$/)
    expect(cache.cacheKey(GAME_SIZE, { parts: { ...look.parts }, equipped: { ...look.equipped } }, 'fp')).toBe(k)
    expect(cache.cacheKey(ABOUT_SIZE, look, 'fp')).toMatch(/^v1:16x24:/)
    expect(cache.cacheKey(GAME_SIZE, look, 'fp', 2)).toMatch(/^v2:/)
    expect(cache.cacheKey(GAME_SIZE, look, 'other')).not.toBe(k)
    const variants: TravellerLook[] = [
      { ...look, parts: { ...look.parts, skin: 2 } },
      { ...look, parts: { ...look.parts, hair: 'long' } },
      { ...look, parts: { ...look.parts, hairColor: 2 } },
      { ...look, parts: { ...look.parts, eyes: 'dot' } },
      { ...look, equipped: { ...look.equipped, head: 'cap' } },
      { ...look, equipped: { ...look.equipped, face: 'glasses' } },
      { ...look, equipped: { body: 'hoodie' } },
      { ...look, equipped: { ...look.equipped, hand: 'camera' } },
      { ...look, equipped: { ...look.equipped, buddy: 'shiba' } },
    ]
    const keys = new Set([k, ...variants.map((v) => cache.cacheKey(GAME_SIZE, v, 'fp'))])
    expect(keys.size).toBe(variants.length + 1)
  })
  it('外觀的簽名跟物件的鍵順序無關', () => {
    const a = cache.lookSignature({ parts: look.parts, equipped: { body: 'tee', head: 'cap' } })
    const b = cache.lookSignature({ parts: { eyes: 'round', hairColor: 1, hair: 'bob', skin: 1 }, equipped: { head: 'cap', body: 'tee' } })
    expect(a).toBe(b)
  })
})

describe('兩層快取', () => {
  it('寫了讀得回來；先讀記憶體；壞掉、key 對不上的當沒有；只留最新 8 筆', async () => {
    const kv = cache.memoryKV()
    const c = new cache.SpriteCache(kv)
    const g = game('k1')
    await c.put(g)
    expect((await c.get('k1'))?.from).toBe('memory')
    const c2 = new cache.SpriteCache(kv)
    expect((await c2.get('k1'))?.from).toBe('idb')
    expect((await c2.get('k1'))?.rec).toEqual(g)
    kv.map.set('bad', { fmt: 1, kind: 'game', key: 'bad', down: [], up: [], left: [] })
    kv.map.set('moved', { ...game('elsewhere') })
    expect(await c2.get('bad')).toBeNull()
    expect(await c2.get('moved')).toBeNull()
    expect(await c2.get('none')).toBeNull()
    for (let i = 0; i < 12; i++) await c.put({ ...game(`n${i}`), at: 100 + i })
    expect(kv.map.size).toBe(8)
    expect(kv.map.has('n11')).toBe(true)
  })
  it('檢查：索引超出調色盤、大小不合、舊格式都不收', () => {
    expect(cache.validRecord(game('a'))).toBe(true)
    expect(cache.validRecord(walker('b'))).toBe(true)
    const bad = game('c')
    bad.down = [{ ...bad.down[0], idx: new Uint8Array(3) }, bad.down[1], bad.down[2]]
    expect(cache.validRecord(bad)).toBe(false)
    const over = game('d')
    over.up = [{ ...over.up[0], idx: new Uint8Array(over.w * over.h).fill(9) }, over.up[1], over.up[2]]
    expect(cache.validRecord(over)).toBe(false)
    expect(cache.validRecord({ ...walker('e'), fmt: 2 })).toBe(false)
    expect(cache.validRecord(null)).toBe(false)
  })
})

describe('/about 讀得懂這裡寫的格式', () => {
  it('資料庫、指標的名字兩邊一樣', () => {
    expect(reader.TRAVELLER_DB).toBe(cache.DB_NAME)
    expect(reader.TRAVELLER_STORE).toBe(cache.DB_STORE)
    expect(reader.TRAVELLER_DB_VERSION).toBe(cache.DB_VERSION)
    expect(reader.TRAVELLER_POINTER).toBe(cache.POINTER_PREFIX)
  })
  it('指標：寫了讀得到 /about 的 key；壞掉的、沒有的是 null', () => {
    const m = fakeStorage()
    cache.writePointer('u1', { game: 'v1:20x28:a', about: 'v1:16x24:a' })
    expect(reader.pointerKey('u1')).toBe('v1:16x24:a')
    expect(cache.readPointer('u1')?.game).toBe('v1:20x28:a')
    expect(reader.pointerKey('u2')).toBeNull()
    m.set(cache.POINTER_PREFIX + 'u3', '{not json')
    expect(reader.pointerKey('u3')).toBeNull()
  })
  it('散步用的一組 → HeroSkin：三個時段的顏色、頭頂、夥伴、傘；格式不對就 null', () => {
    const skin = reader.skinFromRecord(walker('w'), tokens)!
    expect(skin).not.toBeNull()
    expect(skin.walk.length).toBe(4)
    expect(skin.stand.length).toBe(2)
    expect(skin.walk[0]!.top).toBe(2)
    expect(skin.buddy?.facing).toBe('left')
    const day = skin.walk[0]!.lut.day
    const night = skin.walk[0]!.lut.night
    expect(day[1]).not.toBe(night[1])
    expect(reader.skinFromRecord({ ...walker('x'), walk: [] }, tokens)).toBeNull()
    expect(reader.skinFromRecord(game('g'), tokens)).toBeNull()
    expect(reader.skinFromRecord(null, tokens)).toBeNull()
  })
  it('讀不到 IndexedDB（node）時回 null，不丟錯', async () => {
    fakeStorage()
    cache.writePointer('u1', { game: 'g', about: 'a' })
    expect(await reader.readTravellerSkin('u1', tokens)).toBeNull()
  })
})

describe('散步的旅人換成你的旅人', () => {
  const skin = () => reader.skinFromRecord(walker('w'), tokens)!
  it('畫的是旅人自己的顏色；夥伴在後面（朝右時在左邊），走路時跳 1px', () => {
    const h = new HeroState()
    h.skin = skin()
    h.x = 60
    h.y = 100
    const pal = makePalette(tokens, 'day')
    const g = new Gfx(120, 120, pal)
    h.draw(g)
    const lut = h.skin.walk[0]!.lut.day
    const used = new Set(g.buf)
    expect(used.has(lut[1]!)).toBe(true)
    // 夥伴在旅人左邊
    let leftmost = 120
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) if (g.buf[y * 120 + x]) leftmost = Math.min(leftmost, x)
    expect(leftmost).toBeLessThan(60 - 12)
    // 夜裡換色
    const gn = new Gfx(120, 120, makePalette(tokens, 'night'))
    h.draw(gn)
    expect(new Set(gn.buf).has(h.skin.walk[0]!.lut.night[1]!)).toBe(true)
  })
  it('朝左的夥伴往右走時翻、往左不翻；正面的往左翻', () => {
    expect(buddyFlip('left', false)).toBe(true)
    expect(buddyFlip('left', true)).toBe(false)
    expect(buddyFlip('front', true)).toBe(true)
    expect(buddyFlip('right', false)).toBe(false)
  })
  it('引擎照常跑：換了旅人走 60 秒、拿相機、撐傘、跳都不丟錯', () => {
    const warn = console.warn
    const log: string[] = []
    console.warn = (...a: unknown[]) => log.push(a.map(String).join(' '))
    try {
      const e = new PixelWalkEngine({ tokens, areas: AREAS, events: EVENTS, transitions: TRANSITIONS, seed: 5 }, 300)
      e.hero.skin = skin()
      for (let i = 0; i < 60 * 60; i++) {
        e.update(1 / 60)
        if (i === 600) e.hero.hold = 'camera'
        if (i === 900) e.hero.hold = 'umbrella'
        if (i === 1200) e.poke()
        if (i % 6 === 0) e.render()
      }
      e.hero.skin = { ...skin(), overhead: null }
      e.hero.hold = 'umbrella'
      e.render()
    } finally {
      console.warn = warn
    }
    expect(log).toEqual([])
  })
})
