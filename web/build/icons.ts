import { readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

import type { Plugin } from 'vite'

// 主畫面圖示（決定事項 Q2，DESIGN.md §1b）：建置時從 data/regions.json 畫出 PNG，圖案和開場畫面相同——
// 47 都道府縣的圓點（JIS 順、從正上方順時針，各縣的地區色）排成一圈，底是全國的紙色，圓環的線是全國的 line 色。
// 原始碼不寫色碼；不另外裝影像套件，圓用距離算覆蓋率（邊緣抗鋸齒），自己編 PNG。
//
// - apple-touch-icon.png 180：iOS 的「加入主畫面」，不透明（iOS 會把透明的地方填黑）
// - icons/icon-192.png、icon-512.png：manifest purpose any
// - icons/maskable-192.png、maskable-512.png：manifest purpose maskable；圓點都在中心半徑 40% 的安全區內
//   https://web.dev/articles/maskable-icon 、https://www.w3.org/TR/appmanifest/#icon-masks

interface RegionsJson {
  national: { color: Record<string, string> }
  regions: { prefecture: string; color: Record<string, string> }[]
}

type Rgb = [number, number, number]

function hex(c: string | undefined, what: string): Rgb {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(c ?? '')
  if (!m) throw new Error(`icons：regions.json 的 ${what} 不是 #rrggbb（${c}）`)
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)]
}

export interface IconColors {
  paper: Rgb
  line: Rgb
  dots: Rgb[]
}

export function iconColors(regionsPath: URL): IconColors {
  const r = JSON.parse(readFileSync(regionsPath, 'utf-8')) as RegionsJson
  return {
    paper: hex(r.national.color.paper, 'national.color.paper'),
    line: hex(r.national.color.line, 'national.color.line'),
    dots: r.regions.map((x) => hex(x.color.base, `${x.prefecture}.color.base`)),
  }
}

/** 圓環半徑（佔邊長的比例）：any 與 apple 留一點邊；maskable 的圓點外緣要在 40% 安全區內 */
const RING = { any: 0.36, maskable: 0.31 } as const
// 開場畫面：半徑 86 的圓環、圓點 4.2 亮起時放大 1.3 倍、線寬 1（index.html）
const DOT = (4.2 * 1.3) / 86
const TRACK = 1 / 86

/** 畫一張 size×size 的圖，回傳 RGB 像素 */
export function drawIcon(size: number, kind: keyof typeof RING, colors: IconColors): Uint8Array {
  const px = new Uint8Array(size * size * 3)
  for (let i = 0; i < size * size; i++) px.set(colors.paper, i * 3)
  const c = size / 2
  const R = RING[kind] * size
  const blend = (x: number, y: number, rgb: Rgb, a: number) => {
    if (a <= 0 || x < 0 || y < 0 || x >= size || y >= size) return
    const k = (y * size + x) * 3
    for (let j = 0; j < 3; j++) px[k + j] = Math.round(px[k + j]! * (1 - a) + rgb[j]! * a)
  }
  // 圓環的線（像素中心到圓的距離，線寬至少 1px）
  const half = Math.max(1, TRACK * R) / 2
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c)
      blend(x, y, colors.line, Math.min(1, Math.max(0, half + 0.5 - Math.abs(d - R))))
    }
  // 47 個圓點
  const r = DOT * R
  const n = colors.dots.length
  colors.dots.forEach((rgb, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2
    const cx = c + R * Math.cos(a)
    const cy = c + R * Math.sin(a)
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
        blend(x, y, rgb, Math.min(1, Math.max(0, r + 0.5 - d)))
      }
  })
  return px
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC[(c ^ b) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  out.set(data, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** RGB 8-bit、不透明的 PNG（https://www.w3.org/TR/png-3/） */
export function encodePng(size: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter: none
    raw.set(rgb.subarray(y * size * 3, (y + 1) * size * 3), y * (size * 3 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // bit depth 8、color type 2（RGB）
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ])
}

export const ICONS = [
  { file: 'apple-touch-icon.png', size: 180, kind: 'any' },
  { file: 'icons/icon-192.png', size: 192, kind: 'any' },
  { file: 'icons/icon-512.png', size: 512, kind: 'any' },
  { file: 'icons/maskable-192.png', size: 192, kind: 'maskable' },
  { file: 'icons/maskable-512.png', size: 512, kind: 'maskable' },
] as const

/** manifest 的 icons */
export const manifestIcons = ICONS.filter((i) => i.file.startsWith('icons/')).map((i) => ({
  src: i.file,
  sizes: `${i.size}x${i.size}`,
  type: 'image/png',
  purpose: i.kind,
}))

/** 建置時輸出圖示；開發伺服器直接回應同樣的網址 */
export function homeIcons(regionsPath: URL): Plugin {
  let files: Map<string, Buffer> | undefined
  const render = () =>
    (files ??= new Map(
      (() => {
        const colors = iconColors(regionsPath)
        return ICONS.map((i) => [i.file, encodePng(i.size, drawIcon(i.size, i.kind, colors))] as const)
      })(),
    ))
  return {
    name: 'home-icons',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]!.replace(server.config.base, '')
        const png = render().get(path)
        if (!png) return next()
        res.setHeader('Content-Type', 'image/png')
        res.end(png)
      })
    },
    generateBundle() {
      for (const [fileName, source] of render()) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}
