import { describe, expect, it } from 'vitest'

import { OUTFITS } from '../../data/outfits'

import { IndexCanvas } from './canvas'
import { deltaE, shade } from './color'
import { ABOUT_SIZE, buddyFrame, frame, GAME_SIZE, legTop } from './geometry'
import { BUDDY_FACING, HELD } from './held'
import { kmeans, samplePixels } from './kmeans'
import { buddyLook, travellerLook } from './looks'
import {
  cleanOrphans,
  cleanSeams,
  decodeLayer,
  edgeShade,
  layerCode,
  layerMap,
  majority,
  mirror,
  ORDER_FRONT,
  outline,
  stampEyes,
  toFrame,
  topRow,
} from './pixelize'
import { sideTemplate } from './template'
import type { GameRecord, Img, Raster, Rgb } from './types'
import { umbrellaSprite } from './umbrella'
import { walkFrontBack, walkSide } from './walk'
import { composeBack, composeFront, layerFilters } from './compose'
import { randomLook } from './npc'

// 你的旅人變像素人（規格 §7）的純函式：k-means、多數決縮小、外框、清孤立像素、ΔE 與交界加深、走路格、範本、傘、外觀

/** w×h 的假圖，fill(x, y) 回傳 [r, g, b, a] */
function img(w: number, h: number, fill: (x: number, y: number) => [number, number, number, number]): Img {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fill(x, y)
      data.set([r, g, b, a], (y * w + x) * 4)
    }
  return { width: w, height: h, data }
}
const R: Rgb = [210, 74, 60]
const B: Rgb = [77, 125, 181]
const K: Rgb = [31, 29, 43]
const Wt: Rgb = [251, 243, 227]
const ras = (w: number, h: number, rows: string, map: Record<string, number>): Raster => {
  const raw = new Int16Array(w * h).fill(-1)
  rows
    .trim()
    .split('\n')
    .map((r) => r.trim())
    .forEach((row, y) => [...row].forEach((ch, x) => (raw[y * w + x] = ch === '.' ? -1 : map[ch]!)))
  return { w, h, raw }
}
const show = (r: Raster, chars = 'abcdefghijk') => {
  const out: string[] = []
  for (let y = 0; y < r.h; y++) {
    let s = ''
    for (let x = 0; x < r.w; x++) {
      const v = r.raw[y * r.w + x]!
      s += v < 0 ? '.' : chars[v]
    }
    out.push(s)
  }
  return out.join('\n')
}

describe('k-means', () => {
  const pix: Rgb[] = []
  for (let i = 0; i < 600; i++) pix.push(R)
  for (let i = 0; i < 300; i++) pix.push(B)
  for (let i = 0; i < 100; i++) pix.push(K)
  for (let i = 0; i < 40; i++) pix.push([R[0] - 4, R[1] + 3, R[2]])
  it('顏色比 k 少：每種都留下，依大小排', () => {
    const c = kmeans(pix, 10)
    expect(c.length).toBe(4)
    expect(c[0]).toEqual(R)
    expect(c[1]).toEqual(B)
  })
  it('分 3 群：相近的兩個紅併成一群（RGB 平均）', () => {
    const c = kmeans(pix, 3)
    expect(c.length).toBe(3)
    expect(deltaE(c[0]!, R)).toBeLessThan(0.02)
    expect(c).toContainEqual(B)
    expect(c).toContainEqual(K)
  })
  it('決定性：同一組像素（順序打亂也一樣）結果相同', () => {
    const a = kmeans(pix, 3)
    const shuffled = [...pix].reverse()
    expect(kmeans(shuffled, 3)).toEqual(a)
    expect(kmeans(pix, 3)).toEqual(a)
  })
  it('抽樣：固定種子抽到的一樣、只抽不透明的、最多 cap 個', () => {
    const im = img(50, 50, (x, y) => (x < 10 ? [0, 0, 0, 0] : [x * 4, y * 4, 0, 255]))
    const a = samplePixels(im, 500, 7)
    expect(a.length).toBe(500)
    expect(samplePixels(im, 500, 7)).toEqual(a)
    expect(samplePixels(im, 500, 8)).not.toEqual(a)
    expect(a.every((c) => c[0] >= 40)).toBe(true)
    expect(samplePixels(im, 5000, 7).length).toBe(40 * 50)
  })
})

describe('多數決縮小', () => {
  const pal = [Wt, R, K]
  it('每格取多數；深色加權（細線、眼睛不會被淺色吃掉）；不到一半不透明的格子透明', () => {
    // 4×4 細格一格，2×1 格：左格 10/16 紅、6/16 白；右格 5/16 墨、11/16 白（墨 ×2.5 勝）
    const F = 4
    const im = img(8, 4, (x, y) => {
      const i = y * 4 + (x % 4)
      if (x < 4) return i < 10 ? [...R, 255] : [...Wt, 255]
      return i < 5 ? [...K, 255] : [...Wt, 255]
    })
    const r = majority(im, 2, 1, F, pal)
    expect([...r.raw]).toEqual([1, 2])
    const holes = img(8, 4, (x, y) => (x < 4 ? [...R, (y * 4 + x) < 7 ? 255 : 0] : [...R, 255]))
    expect([...majority(holes, 2, 1, F, pal).raw]).toEqual([-1, 1])
  })
})

describe('外框、眼睛、清孤立像素', () => {
  it('透明格旁邊有東西就描墨色', () => {
    const r = ras(3, 3, '...\n.a.\n...', { a: 0 })
    expect(show({ w: 3, h: 3, raw: outline(r, 1) })).toBe('.b.\nbab\n.b.')
  })
  it('眼睛：左右兩半各蓋覆蓋 ≥ 0.22 的格子；一格都沒有就取最多的（> 0.06）', () => {
    const r = ras(6, 2, 'aaaaaa\naaaaaa', { a: 0 })
    const cov = new Float32Array(12)
    cov[1] = 0.3
    cov[2] = 0.25
    cov[4] = 0.1
    cov[10] = 0.05
    const { raster, fixed } = stampEyes(r, cov, 9)
    expect([...raster.raw.slice(0, 6)]).toEqual([0, 9, 9, 0, 9, 0])
    expect(fixed[1]).toBe(1)
    const none = stampEyes(r, new Float32Array(12).fill(0.05), 9)
    expect([...none.raster.raw].includes(9)).toBe(false)
  })
  it('孤立的像素換成鄰居的顏色；有同色鄰居、墨色、蓋過的眼睛不動', () => {
    const r = ras(5, 3, 'aaaaa\nabaca\naaaaa', { a: 0, b: 1, c: 2 })
    const fixed = new Uint8Array(15)
    fixed[8] = 1
    expect(show(cleanOrphans(r, 2, fixed))).toBe('aaaaa\naaaca\naaaaa')
    const pair = ras(5, 3, 'aaaaa\nabbaa\naaaaa', { a: 0, b: 1 })
    expect(show(cleanOrphans(pair, 9))).toBe('aaaaa\nabbaa\naaaaa')
  })
})

describe('側面（3D）身體的縫', () => {
  // 預設外觀（白 T 恤）從側面看：袖子的灰、一條往下的中灰縫、手被縫切成兩半（審查 #38）
  const pal: Rgb[] = [[251, 243, 227], [218, 209, 196], [199, 184, 172], [246, 219, 198], [60, 60, 80], [200, 40, 40]]
  const map = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 }
  it('1 格寬、連 3 格以上的雜色直線換成衣服佔大宗的顏色；左右都是皮膚的換成皮膚', () => {
    const r = ras(8, 7, 'aabbbcbb\naabbbcbb\naabbbcbb\naabbdcdb\naabbdcdb\naabbdcdb\naabbbcbb', map)
    const out = cleanSeams(r, 0, 7, new Set([0, 3, 4]), pal, 3)
    expect(show(out)).toBe('aabbbbbb\naabbbbbb\naabbbbbb\naabbdddb\naabbdddb\naabbdddb\naabbbbbb')
    // 身體那幾列：衣服的顏色（白＋袖子的灰）≥ 80%，沒有別的顏色的直線
    const body = [...out.raw].filter((v) => v !== 3)
    expect(body.filter((v) => v === 0 || v === 1).length / body.length).toBeGreaterThanOrEqual(0.8)
  })
  it('腰帶（橫的）、2 格寬的直條、keep 的顏色、範圍外的列不動', () => {
    const r = ras(8, 6, 'aaaaffaa\naaaaffaa\nfffffffa\naaaaffaa\naacaaaaa\naacaaaaa', map)
    expect(show(cleanSeams(r, 0, 4, new Set([0]), pal, 3))).toBe(show(r))
    const k = ras(4, 4, 'aaea\naaea\naaea\naaea', map)
    expect(show(cleanSeams(k, 0, 4, new Set([0, 4]), pal, 3))).toBe(show(k))
  })
})

describe('圖層與交界加深', () => {
  it('代碼色解得回來；相鄰兩層的反鋸齒混色不算', () => {
    for (let k = 1; k <= 9; k++) expect(decodeLayer(...layerCode(k))).toBe(k)
    const mix = (a: number, b: number) => layerCode(a).map((v, i) => Math.round((v + layerCode(b)[i]!) / 2)) as Rgb
    expect(decodeLayer(...mix(2, 4))).toBe(0)
    expect(decodeLayer(...mix(1, 3))).toBe(0)
    expect(decodeLayer(...mix(5, 6))).toBe(0)
  })
  it('每格取多數的圖層；眼睛的覆蓋比例另外算（算在臉那一層）', () => {
    const F = 4
    const im = img(8, 4, (x, y) => {
      if (x < 4) return [...layerCode(y < 3 ? 6 : 3), 255]
      return [...layerCode(y < 1 ? 9 : 3), 255]
    })
    const { ids, eyes } = layerMap(im, 2, 1, F)
    expect([...ids]).toEqual([6, 3])
    expect(eyes[1]).toBeCloseTo(0.25)
  })
  it('ΔE：一樣是 0、黑白很遠；加深一階比較暗', () => {
    expect(deltaE(R, R)).toBe(0)
    expect(deltaE([0, 0, 0], [255, 255, 255])).toBeGreaterThan(0.9)
    const d = shade(Wt)
    expect(d[0] + d[1] + d[2]).toBeLessThan(Wt[0] + Wt[1] + Wt[2])
  })
  it('不同圖層相鄰、顏色很像：後面那格（帽子下的臉）加深；顏色差很多或同一組不動', () => {
    const near: Rgb = [214, 78, 62]
    const pal: Rgb[] = [R, near, B, K]
    // 上面一列是帽子（6），下面是臉（3）；帽子 R、臉 near（很像）
    const r = ras(3, 2, 'aaa\nbbb', { a: 0, b: 1 })
    const ids = Int8Array.from([6, 6, 6, 3, 3, 3])
    const out = edgeShade(r, ids, pal, ORDER_FRONT, 3)
    expect([...out.raw.slice(0, 3)]).toEqual([0, 0, 0])
    expect(out.raw[3]).toBeGreaterThanOrEqual(4)
    expect(pal.length).toBe(5)
    const far = edgeShade(ras(3, 2, 'aaa\nccc', { a: 0, c: 2 }), ids, [R, near, B, K], ORDER_FRONT, 3)
    expect([...far.raw]).toEqual([0, 0, 0, 2, 2, 2])
    const same = edgeShade(r, Int8Array.from([1, 1, 1, 4, 4, 4]), [R, near, B, K], ORDER_FRONT, 3)
    expect([...same.raw]).toEqual([0, 0, 0, 1, 1, 1])
  })
})

describe('走路的格子', () => {
  // 6×6：頭 a（第 0–2 列）、腿 b（第 3–4 列），第 5 列空（外框）
  const body = ras(6, 6, '.aaaa.\n.aaaa.\n.aaaa.\n.b..b.\n.b..b.\n......', { a: 0, b: 1 })
  it('正面：站、左步、右步；邁步時身體上移 1px，著地那一半的腳留在原地', () => {
    const [st, l, r] = walkFrontBack(body, 3)
    expect(st).toBe(body)
    expect(show(l)).toBe('.aaaa.\n.aaaa.\n.b..b.\n.b..b.\n....b.\n......')
    expect(show(r)).toBe('.aaaa.\n.aaaa.\n.b..b.\n.b..b.\n.b....\n......')
  })
  it('側面：腿以上上移 1px、最下面 3 列前後張開 1px', () => {
    const side = ras(6, 6, '..aa..\n..aa..\n..aa..\n..bb..\n..bb..\n......', { a: 0, b: 1 })
    const [, step] = walkSide(side, 3)
    expect(show(step)).toBe('..aa..\n..aa..\n..bb..\n.b..b.\n.b..b.\n......')
  })
  it('左右翻、最上面一列', () => {
    expect(show(mirror(ras(3, 1, 'ab.', { a: 0, b: 1 })))).toBe('.ba')
    expect(topRow(body.raw, 6, 6)).toBe(0)
    expect(topRow(Uint8Array.from([0, 0, 0, 1]), 2, 2, 0)).toBe(1)
  })
})

describe('尺寸、範本、傘', () => {
  it('遊戲 20×28 在 32×40、/about 16×24；腳底在倒數第 2 列，頭頂在本體上緣', () => {
    for (const size of [GAME_SIZE, ABOUT_SIZE]) {
      const fr = frame(size)
      const feet = (280 - fr.y0) * fr.s
      expect(feet).toBeCloseTo(size.ch - 1, 5)
      expect((fr.g.top - fr.y0) * fr.s).toBeCloseTo(size.ch - size.h + 1, 5)
      expect(legTop(fr)).toBeGreaterThan(size.ch - size.h / 2)
      expect(legTop(fr)).toBeLessThan(size.ch - 2)
    }
  })
  it('夥伴：旅人比例的 1.5 倍，最大 16px（含外框）', () => {
    const s = frame(GAME_SIZE).s
    for (const o of OUTFITS.filter((x) => x.slot === 'buddy')) {
      const b = buddyFrame(o.icon, s)
      expect(Math.max(b.w, b.h), o.id).toBeLessThanOrEqual(16)
      expect(Math.max(b.w, b.h), o.id).toBeGreaterThanOrEqual(10)
    }
  })
  it('側面範本：兩個尺寸都畫得出來，腳在倒數第 2 列，有眼睛', () => {
    for (const size of [GAME_SIZE, ABOUT_SIZE]) {
      const t = sideTemplate(size, { hair: 0, skin: 1, top: 2, topShade: 3, bottom: 4, shoes: 5, hat: 6, hand: 7, ink: 8 })
      expect(t.eyes.length).toBeGreaterThan(0)
      for (const e of t.eyes) expect(t.raster.raw[e]).toBe(8)
      expect(topRow(t.raster.raw, size.cw, size.ch)).toBeLessThanOrEqual(size.ch - size.h + 1)
      const feet = [...t.raster.raw.slice((size.ch - 2) * size.cw, (size.ch - 1) * size.cw)]
      expect(feet).toContain(5)
      expect([...t.raster.raw.slice((size.ch - 1) * size.cw)].every((v) => v === -1)).toBe(true)
    }
  })
  it('傘：左右對稱、傘柄在中間、傘柄下面不描外框', () => {
    const u = umbrellaSprite(28, { canopy: 0, accent: 1, shaft: 2, ink: 3 })
    const { w, raw } = u.raster
    expect(w % 2).toBe(1)
    const cx = (w - 1) / 2
    expect(raw[u.stubBottom * w + cx]).toBe(2)
    expect(raw[(u.stubBottom + 1) * w + cx]).toBe(-1)
    for (let y = 0; y < u.raster.h; y++) for (let x = 0; x < w; x++) expect(raw[y * w + x] === -1, `${x},${y}`).toBe(raw[y * w + (w - 1 - x)] === -1)
  })
  it('索引畫布：橢圓上半', () => {
    const g = new IndexCanvas(9, 9)
    g.ellipse(4, 4, 3, 3, 0, true)
    expect(g.at(4, 1)).toBe(0)
    expect(g.at(4, 5)).toBe(-1)
  })
})

describe('組成 SVG', () => {
  const look = { parts: { skin: 1, hair: 'bob', hairColor: 1, eyes: 'round' }, equipped: { body: 'tee', head: 'cap', hand: 'camera' } } as const
  const g = frame(GAME_SIZE).g
  it('正面九層、圖層那一趟每層一個濾鏡；手上的可以拿掉、可以放到頭後面', () => {
    const plain = composeFront(look, g)
    expect(plain).not.toContain('filter=')
    const ids = composeFront(look, g, { ids: true })
    expect(ids.match(/filter="url\(#hm-px-lid\d\)"/g)?.length).toBe(9)
    expect(layerFilters().match(/<filter /g)?.length).toBe(9)
    const order = (s: string) => [...s.matchAll(/hm-px-lid(\d)/g)].map((m) => Number(m[1]))
    expect(order(ids)).toEqual([1, 2, 3, 9, 4, 5, 6, 7, 8])
    expect(order(composeFront(look, g, { ids: true, handBehind: true }))).toEqual([1, 2, 8, 3, 9, 4, 5, 6, 7])
    const cam = OUTFITS.find((o) => o.id === 'camera')!.svg
    expect(plain).toContain(cam)
    expect(composeFront(look, g, { hand: false })).not.toContain(cam)
  })
  it('背面：左右翻、頭整顆填髮色', () => {
    const b = composeBack(look, g)
    expect(b.startsWith('<g transform="matrix(-1 0 0 1 240 0)">')).toBe(true)
    expect(b).toContain('fill="var(--hair)" stroke')
  })
  it('路人：同一個種子同一個人，只用不限縣的單品', () => {
    expect(randomLook(3)).toEqual(randomLook(3))
    const ids = new Set(OUTFITS.filter((o) => o.pref || o.achv).map((o) => o.id))
    for (let s = 0; s < 40; s++) for (const id of Object.values(randomLook(s).equipped)) expect(ids.has(id!)).toBe(false)
  })
})

describe('單品規則表', () => {
  const hand = OUTFITS.filter((o) => o.slot === 'hand')
  it('表裡的 id 都存在，而且是手上的', () => {
    for (const id of Object.keys(HELD)) expect(hand.some((o) => o.id === id), id).toBe(true)
  })
  it('夥伴朝向表的 id 都存在，而且是夥伴', () => {
    for (const id of Object.keys(BUDDY_FACING)) expect(OUTFITS.find((o) => o.id === id)?.slot, id).toBe('buddy')
  })
  it('名字有「傘」的都是頭頂的傘', () => {
    for (const o of hand.filter((x) => x.name.includes('傘'))) expect(HELD[o.id], o.id).toBe('overhead')
  })
  it('舉過肩膀的（圖示上緣 y < 150）都寫在表裡', () => {
    for (const o of hand) {
      const y = Number(o.icon.split(/\s+/)[1])
      if (y < 150) expect(HELD[o.id], `${o.id} ${o.name}`).toBeDefined()
    }
  })
})

describe('ActorLook', () => {
  const cell = (v: number) => toFrame(4, 4, Int16Array.from({ length: 16 }, (_, i) => (i >= 4 ? v : -1)), [R, B, K])
  const rec: GameRecord = {
    fmt: 1,
    kind: 'game',
    key: 't',
    at: 0,
    w: 4,
    h: 4,
    box: [0, 0, 4, 4],
    down: [cell(0), cell(1), cell(2)],
    up: [cell(0), cell(1), cell(2)],
    left: [cell(0), cell(1), cell(2)],
    overhead: { sprite: toFrame(3, 2, Int16Array.from([0, 0, 0, -1, 1, -1]), [R, B]), x: 0, dy: -2 },
    buddy: { sprite: cell(0), facing: 'left' },
    side: 'template',
    ms: 0,
  }
  it('右邊用左邊翻（左右腳換）；傘疊在這一格的頭頂、翻的時候傘也跟著鏡像', () => {
    const look = travellerLook(rec)
    const r = look.frame('right', 'stepL')
    expect(r.flip).toBe(true)
    expect(r.sprite).toBe(rec.left[2])
    expect(r.ax).toBe(2)
    expect(r.ay).toBe(4)
    expect(r.extra?.[0]).toMatchObject({ x: 1, y: -1 })
    expect(look.frame('down', 'stand').extra?.[0]).toMatchObject({ x: 0, y: -1 })
  })
  it('夥伴：邁步的那一格高 1px；朝左畫的往右走時翻', () => {
    const b = buddyLook(rec.buddy!)
    expect(b.frame('down', 'stand').ay).toBe(4)
    expect(b.frame('down', 'stepR').ay).toBe(5)
    expect(b.frame('right', 'stand').flip).toBe(true)
    expect(b.frame('left', 'stand').flip).toBe(false)
  })
})
