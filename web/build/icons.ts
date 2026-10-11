import { readFileSync } from 'node:fs'

import type { Plugin } from 'vite'

import { MEGURI } from './glyph-meguri.ts'
import { Canvas, hex, type Rgb, type Transform } from './raster.ts'

// 圖示（DESIGN.md §1b）：建置時從 data/regions.json 畫出來，原始碼不寫色碼；開發伺服器回應同樣的網址。
//
// 主畫面圖示「巡の輪」：全國 paper 底（加紙紋）、line 細圓、47 都道府縣的圓點（JIS 順、從正上方順時針，各縣的 strong 色），
// 中央是 ink 色的「巡」（Noto Sans JP Black 的外框，build/glyph-meguri.ts）。全部在中心 80% 的圓裡，
// 同一張圖當 manifest 的 purpose any 與 maskable（https://web.dev/articles/maskable-icon 、https://www.w3.org/TR/appmanifest/#icon-masks）。
// - apple-touch-icon.png 180：iOS 的「加入主畫面」，不透明（iOS 會把透明的地方填黑）
// - icons/icon-192.png、icon-512.png：manifest（any、maskable 各列一次）
//
// 分頁圖示：紙色圓角方塊上 ink 色的「巡」，下緣一條 47 縣 strong 色的色帶。
// - favicon.svg（index.html 的 <link rel="icon" type="image/svg+xml">）
// - favicon-32.png（不支援 SVG 分頁圖示的瀏覽器用，透明底）

interface RegionsJson {
  national: { color: Record<string, string> }
  regions: { prefecture: string; color: Record<string, string> }[]
}

export interface IconColors {
  paper: Rgb
  line: Rgb
  ink: Rgb
  /** 47 縣的 strong 色，JIS 順 */
  prefs: Rgb[]
}

export function iconColors(regionsPath: URL): IconColors {
  const r = JSON.parse(readFileSync(regionsPath, 'utf-8')) as RegionsJson
  const nat = (key: string) => hex(r.national.color[key], `regions.json 的 national.color.${key}`)
  return {
    paper: nat('paper'),
    line: nat('line'),
    ink: nat('ink'),
    prefs: r.regions.map((x) => hex(x.color.strong, `regions.json 的 ${x.prefecture}.color.strong`)),
  }
}

/** 主畫面圖示的比例（以邊長為 1；提案 A 是 512 的畫布，數字照抄再除以 512） */
export const HOME = {
  /** 圓環半徑、線寬 */
  ring: 0.335,
  ringWidth: 3 / 512,
  /** 圓點半徑 */
  dot: 9.5 / 512,
  /** 「巡」的字級（1 em）；字形外框的中心對齊圖示中心，往右挪一點視覺修正 */
  glyph: 228 / 512,
  optical: 2 / 512,
  /** 紙紋的濃度（黑色 alpha 的上限） */
  grain: 0.07,
  /** maskable 的安全區：中心半徑 40% 的圓 */
  safe: 0.4,
} as const

/** 分頁圖示（32 的畫布） */
export const FAVICON = {
  size: 32,
  radius: 5,
  glyph: { size: 20, cx: 16, cy: 13.2 },
  band: { x: 2, y: 26, w: 28, h: 4 },
} as const

/** 「巡」的外框中心放在 (cx, cy)、字級 size */
export function glyphAt(size: number, cx: number, cy: number): Transform {
  const k = size / MEGURI.unitsPerEm
  const b = MEGURI.bbox
  return { k, tx: cx - ((b.x1 + b.x2) / 2) * k, ty: cy - ((b.y1 + b.y2) / 2) * k }
}

/** 第 i 縣在圓環上的角度：從正上方順時針 */
const angle = (i: number, n: number) => (i / n) * 2 * Math.PI - Math.PI / 2

/** 主畫面圖示 size × size（不透明）；grain = false 不加紙紋（測試用） */
export function homeIcon(size: number, colors: IconColors, grain = true): Canvas {
  const cv = new Canvas(size)
  const c = size / 2
  const R = HOME.ring * size
  cv.fill(colors.paper)
  if (grain) cv.grain(HOME.grain)
  cv.ring(c, c, R, Math.max(1, HOME.ringWidth * size), colors.line)
  const n = colors.prefs.length
  colors.prefs.forEach((rgb, i) => {
    const a = angle(i, n)
    cv.circle(c + R * Math.cos(a), c + R * Math.sin(a), HOME.dot * size, rgb)
  })
  cv.path(MEGURI.d, glyphAt(HOME.glyph * size, c + HOME.optical * size, c), colors.ink)
  return cv
}

/** 分頁圖示的點陣版（透明底） */
export function faviconPng(colors: IconColors): Canvas {
  const s = FAVICON.size
  const cv = new Canvas(s)
  cv.roundRect(0, 0, s, s, FAVICON.radius, colors.paper)
  const g = FAVICON.glyph
  cv.path(MEGURI.d, glyphAt(g.size, g.cx, g.cy), colors.ink)
  const b = FAVICON.band
  cv.band(b.x, b.y, b.w, b.h, colors.prefs)
  return cv
}

const css = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
const num = (v: number) => String(Number(v.toFixed(3)))

/** 分頁圖示的 SVG：和 faviconPng 同一個圖 */
export function faviconSvg(colors: IconColors): string {
  const s = FAVICON.size
  const g = FAVICON.glyph
  const t = glyphAt(g.size, g.cx, g.cy)
  const b = FAVICON.band
  const n = colors.prefs.length
  // 相鄰的色段各多畫 0.05，瀏覽器才不會在接縫露出底色
  const band = colors.prefs
    .map(
      (c, i) =>
        `<rect x="${num(b.x + (b.w * i) / n)}" y="${b.y}" width="${num(b.w / n + 0.05)}" height="${b.h}" fill="${css(c)}"/>`,
    )
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">` +
    `<rect width="${s}" height="${s}" rx="${FAVICON.radius}" fill="${css(colors.paper)}"/>` +
    `<path transform="translate(${num(t.tx)} ${num(t.ty)}) scale(${num(t.k)})" fill="${css(colors.ink)}" d="${MEGURI.d}"/>` +
    band +
    `</svg>\n`
  )
}

export const ICONS = [
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icons/icon-192.png', size: 192 },
  { file: 'icons/icon-512.png', size: 512 },
] as const

/** manifest 的 icons：同一張圖列兩次，purpose any 與 maskable */
export const manifestIcons = ICONS.filter((i) => i.file.startsWith('icons/')).flatMap((i) =>
  (['any', 'maskable'] as const).map((purpose) => ({
    src: i.file,
    sizes: `${i.size}x${i.size}`,
    type: 'image/png',
    purpose,
  })),
)

/** 所有圖示檔：網址（相對 base）→ 內容 */
export function renderIcons(regionsPath: URL): Map<string, { type: string; body: Buffer }> {
  const colors = iconColors(regionsPath)
  const png = (body: Buffer) => ({ type: 'image/png', body })
  return new Map([
    ...ICONS.map((i) => [i.file, png(homeIcon(i.size, colors).toPng())] as const),
    ['favicon.svg', { type: 'image/svg+xml', body: Buffer.from(faviconSvg(colors)) }] as const,
    ['favicon-32.png', png(faviconPng(colors).toPng())] as const,
  ])
}

/** 建置時輸出圖示；開發伺服器直接回應同樣的網址 */
export function homeIcons(regionsPath: URL): Plugin {
  let files: ReturnType<typeof renderIcons> | undefined
  const render = () => (files ??= renderIcons(regionsPath))
  return {
    name: 'home-icons',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]!.replace(server.config.base, '')
        const file = render().get(path)
        if (!file) return next()
        res.setHeader('Content-Type', file.type)
        res.end(file.body)
      })
    },
    generateBundle() {
      for (const [fileName, f] of render()) this.emitFile({ type: 'asset', fileName, source: f.body })
    },
  }
}
