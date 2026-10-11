import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { MEGURI } from './glyph-meguri.ts'
import { FAVICON, HOME, faviconPng, faviconSvg, glyphAt, homeIcon, iconColors, renderIcons } from './icons.ts'
import { type Canvas, flattenPath } from './raster.ts'

const colors = iconColors(new URL('../../data/regions.json', import.meta.url))
/** a 的前 b.length 個值和 b 差 1 以內 */
const same = (a: readonly number[], b: readonly number[]) => b.every((v, i) => Math.abs(a[i]! - v) <= 1)

/** PNG → 每個像素的 RGBA（只解 8-bit RGB／RGBA、五種 filter） */
function decodePng(buf: Buffer): { size: number; ch: number; px: Uint8Array } {
  expect([...buf.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let o = 8
  let size = 0
  let ch = 0
  const idat: Buffer[] = []
  while (o < buf.length) {
    const len = buf.readUInt32BE(o)
    const type = buf.toString('ascii', o + 4, o + 8)
    const d = buf.subarray(o + 8, o + 8 + len)
    if (type === 'IHDR') {
      size = d.readUInt32BE(0)
      ch = d[9] === 2 ? 3 : 4
    }
    if (type === 'IDAT') idat.push(d)
    o += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = size * ch
  expect(raw.length).toBe((stride + 1) * size)
  const px = new Uint8Array(size * stride)
  for (let y = 0; y < size; y++) {
    const f = raw[y * (stride + 1)]!
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? px[y * stride + i - ch]! : 0
      const b = y > 0 ? px[(y - 1) * stride + i]! : 0
      const c = i >= ch && y > 0 ? px[(y - 1) * stride + i - ch]! : 0
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f]!
      px[y * stride + i] = (raw[y * (stride + 1) + 1 + i]! + pred) & 0xff
    }
  }
  return { size, ch, px }
}

function expectPngMatches(cv: Canvas, ch: number) {
  const png = decodePng(cv.toPng())
  expect(png.size).toBe(cv.size)
  expect(png.ch).toBe(ch)
  for (const [x, y] of [[0, 0], [cv.size >> 1, cv.size >> 1], [cv.size - 1, cv.size >> 2]] as const) {
    const k = (y * cv.size + x) * ch
    expect([...png.px.subarray(k, k + ch)]).toEqual(cv.rgba(x, y).slice(0, ch))
  }
}

describe('主畫面圖示（巡の輪）', () => {
  it.each([180, 192, 512])('%i：中心 80% 的圓外面只有紙色（maskable 安全區）', (size) => {
    const cv = homeIcon(size, colors, false)
    const c = size / 2
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (Math.hypot(x + 0.5 - c, y + 0.5 - c) <= HOME.safe * size) continue
        expect(cv.rgba(x, y)).toEqual([...colors.paper, 255])
      }
  })

  it('47 個圓點是各縣的 strong 色，從正上方順時針', () => {
    const size = 512
    const cv = homeIcon(size, colors, false)
    const R = HOME.ring * size
    expect(colors.prefs).toHaveLength(47)
    colors.prefs.forEach((rgb, i) => {
      const a = (i / 47) * 2 * Math.PI - Math.PI / 2
      const x = Math.floor(size / 2 + R * Math.cos(a))
      const y = Math.floor(size / 2 + R * Math.sin(a))
      expect(same(cv.rgba(x, y), [...rgb, 255])).toBe(true)
    })
  })

  it('「巡」是墨色，畫在字形外框的範圍裡', () => {
    const size = 512
    const cv = homeIcon(size, colors, false)
    const t = glyphAt(HOME.glyph * size, size / 2 + HOME.optical * size, size / 2)
    const b = MEGURI.bbox
    let ink = 0
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (!same(cv.rgba(x, y), [...colors.ink, 255])) continue
        ink++
        expect(x + 0.5).toBeGreaterThan(b.x1 * t.k + t.tx)
        expect(x + 0.5).toBeLessThan(b.x2 * t.k + t.tx)
        expect(y + 0.5).toBeGreaterThan(b.y1 * t.k + t.ty)
        expect(y + 0.5).toBeLessThan(b.y2 * t.k + t.ty)
      }
    // Black 字重的「巡」大約佔外框的六成
    const box = (b.x2 - b.x1) * (b.y2 - b.y1) * t.k * t.k
    expect(ink / box).toBeGreaterThan(0.5)
    expect(ink / box).toBeLessThan(0.65)
  })

  it('PNG 不透明（RGB），解回來和畫布一樣；有紙紋', () => {
    const cv = homeIcon(192, colors)
    expectPngMatches(cv, 3)
    expect(cv.rgba(2, 2)).not.toEqual([...colors.paper, 255])
  })
})

describe('分頁圖示', () => {
  it('PNG：圓角外透明、底是紙色、下緣是 47 縣色帶', () => {
    const cv = faviconPng(colors)
    expectPngMatches(cv, 4)
    expect(cv.rgba(0, 0)[3]).toBe(0)
    expect(cv.rgba(16, 1)).toEqual([...colors.paper, 255])
    const b = FAVICON.band
    // 色帶上面一列是紙色；色帶裡每一格都不透明、不是紙色（相鄰色段之間沒有縫）
    expect(cv.rgba(16, b.y - 1)).toEqual([...colors.paper, 255])
    for (let x = b.x; x < b.x + b.w; x++) {
      const p = cv.rgba(x, b.y + 1)
      expect(p[3]).toBe(255)
      expect(p).not.toEqual([...colors.paper, 255])
    }
    // 第一格（x 2–3）是北海道（x 2–2.60）與青森（2.60–3）依面積平均
    const [h, a] = [colors.prefs[0]!, colors.prefs[1]!]
    const w0 = b.w / 47
    expect(same(cv.rgba(b.x, b.y + 1), h.map((v, j) => v * w0 + a[j]! * (1 - w0)))).toBe(true)
  })

  it('SVG 只用 regions.json 的顏色', () => {
    const svg = faviconSvg(colors)
    const allowed = new Set(
      [colors.paper, colors.ink, ...colors.prefs].map((c) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`),
    )
    const used = svg.match(/#[0-9a-f]{6}/gi) ?? []
    expect(used.length).toBe(2 + 47)
    for (const c of used) expect(allowed.has(c.toLowerCase())).toBe(true)
  })

  it('輸出的檔名與類型', () => {
    const files = renderIcons(new URL('../../data/regions.json', import.meta.url))
    expect([...files.keys()].sort()).toEqual(
      ['apple-touch-icon.png', 'favicon-32.png', 'favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'].sort(),
    )
    expect(files.get('favicon.svg')!.type).toBe('image/svg+xml')
  })
})

describe('flattenPath', () => {
  it('Q 曲線切成線段，終點落在指定座標', () => {
    const [poly] = flattenPath('M0 0Q10 0 10 10Z', { k: 2, tx: 1, ty: 1 })
    expect(poly![0]).toEqual([1, 1])
    expect(poly![poly!.length - 1]).toEqual([21, 21])
    expect(poly!.length).toBeGreaterThan(10)
  })
  it('不支援的指令要報錯', () => {
    expect(() => flattenPath('M0 0H10Z', { k: 1, tx: 0, ty: 0 })).toThrow()
  })
})
