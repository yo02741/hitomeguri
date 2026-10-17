/**
 * 像素散步（形象網站，DESIGN.md §14a）的調色盤：顏色全部取自 theme.css 的 `--color-px-*` token，這裡只有名稱。
 * 時段（白天、黃昏、夜晚）用調色盤換色做（GBA 的做法）：一般的顏色往 tint-dusk／tint-night 混、變暗；
 * 天空、燈、霓虹、星、月不變（天空依時段直接選色，燈在夜裡才亮得起來）。
 */
export const PX = [
  'ink', 'ink-2', 'white', 'paper', 'paper-2',
  'stone-1', 'stone-2', 'stone-3', 'stone-4',
  'wood-1', 'wood-2', 'wood-3',
  'roof-1', 'roof-2', 'roof-3',
  'shu-1', 'shu-2', 'gold-1', 'gold-2',
  'leaf-1', 'leaf-2', 'leaf-3', 'leaf-4',
  'dirt-1', 'dirt-2', 'sand-1', 'sand-2',
  'sea-1', 'sea-2', 'sea-3', 'foam',
  'sakura-1', 'sakura-2', 'momiji-1', 'momiji-2', 'lavender', 'snow-1', 'snow-2',
  'skin-1', 'skin-2', 'hair', 'cloth-1', 'cloth-2', 'bag',
  'sky-day-1', 'sky-day-2', 'sky-day-3', 'sky-dusk-1', 'sky-dusk-2', 'sky-dusk-3', 'sky-night-1', 'sky-night-2', 'sky-night-3',
  'cloud-1', 'cloud-2',
  'lamp-1', 'lamp-2', 'neon-1', 'neon-2', 'star', 'moon',
  'tint-dusk', 'tint-night',
  // 番外篇的地方 kit（沖繩、近畿）
  'kawara-1', 'kawara-2', 'kawara-3', 'coral-1', 'coral-2', 'coral-3', 'lagoon-1', 'lagoon-2',
  'tatami-1', 'tatami-2', 'kanhi-1', 'kanhi-2', 'bougain', 'ajisai', 'shu-3',
] as const
export type Px = (typeof PX)[number]
/** 畫的時候可以不填色（透明） */
export type Ink = Px | null

export type TimeOfDay = 'day' | 'dusk' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 時段不改的顏色 */
export const UNTINTED = (k: Px) => k.startsWith('sky-') || k.startsWith('lamp-') || k.startsWith('neon-') || k === 'star' || k === 'moon'

export type Rgb = [number, number, number]
export type Tokens = Record<Px, string>

export interface Palette {
  /** 這組調色盤的名字（快取用） */
  key: string
  /** ImageData 的一個像素（little-endian：0xAABBGGRR） */
  u32: Record<Px, number>
}

/**
 * CSS 顏色 → [r, g, b]。正式站的 CSS 會被壓縮：六碼的白寫成三碼的 #fff、純紅寫成 red，
 * 所以三碼、六碼（含透明度的四、八碼）與 rgb 函式都要讀得懂；顏色名字交給 resolve（瀏覽器用 canvas 換成六碼）。
 */
export function parseColor(v: string, resolve?: (v: string) => string): Rgb {
  const s = v.trim()
  const h = /^#([0-9a-f]{3,8})$/i.exec(s)?.[1]
  if (h && (h.length === 3 || h.length === 4)) return [0, 1, 2].map((i) => parseInt(h[i]! + h[i]!, 16)) as Rgb
  if (h && (h.length === 6 || h.length === 8)) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s)
  if (m) return [m[1], m[2], m[3]].map((x) => Math.max(0, Math.min(255, Math.round(Number(x))))) as Rgb
  if (resolve) {
    const r = resolve(s)
    if (r && r !== s) return parseColor(r)
  }
  throw new Error(`pixelwalk: 讀不懂的顏色（${v}）`)
}
const pack = ([r, g, b]: Rgb) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
const mix = (a: Rgb, b: Rgb, t: number, dim: number): Rgb => [0, 1, 2].map((i) => Math.round((a[i]! * (1 - t) + b[i]! * t) * dim)) as Rgb

/** 時段的換色：往色調混多少、整體亮度 */
const TIME = { day: [0, 1], dusk: [0.2, 0.9], night: [0.5, 0.62] } as const

/**
 * 任意一個 RGB（番外篇旅人 sprite 的顏色，來自旅人自己的 SVG）照時段換色：跟 makePalette 同一套混法。
 * 白天原色；黃昏往 tint-dusk、夜晚往 tint-night 混，再變暗。
 */
export function tintRgb(rgb: Rgb, tokens: Tokens, time: TimeOfDay): Rgb {
  if (time === 'day') return [rgb[0], rgb[1], rgb[2]]
  const [t, dim] = TIME[time]
  return mix(rgb, parseColor(time === 'night' ? tokens['tint-night'] : tokens['tint-dusk']), t, dim)
}
/** [r, g, b] → ImageData 的一個像素（0xAABBGGRR） */
export const packRgb = pack

export function makePalette(tokens: Tokens, time: TimeOfDay): Palette {
  const base = Object.fromEntries(PX.map((k) => [k, parseColor(tokens[k])])) as Record<Px, Rgb>
  const [t, dim] = TIME[time]
  const target = time === 'night' ? base['tint-night'] : base['tint-dusk']
  const u32 = {} as Record<Px, number>
  for (const k of PX) u32[k] = pack(UNTINTED(k) || time === 'day' ? base[k] : mix(base[k], target, t, dim))
  return { key: time, u32 }
}

/** 瀏覽器裡：從 :root 讀 token，一律換成六碼（壓縮過的三碼、顏色名字也行） */
export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement)
  let ctx: CanvasRenderingContext2D | null | undefined
  const resolve = (v: string) => {
    ctx ??= document.createElement('canvas').getContext('2d')
    // 空的（theme.css 少了這個 token）不要變成黑色：交回去讓 parseColor 報錯
    if (!v || !ctx) return v
    ctx.fillStyle = 'black'
    ctx.fillStyle = v
    return String(ctx.fillStyle)
  }
  const hex2 = (n: number) => n.toString(16).padStart(2, '0')
  return Object.fromEntries(
    PX.map((k) => {
      const v = cs.getPropertyValue(`--color-px-${k}`).trim()
      return [k, '#' + parseColor(v, resolve).map(hex2).join('')]
    }),
  ) as Tokens
}
