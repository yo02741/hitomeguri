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
] as const
export type Px = (typeof PX)[number]
/** 畫的時候可以不填色（透明） */
export type Ink = Px | null

export type TimeOfDay = 'day' | 'dusk' | 'night'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

/** 時段不改的顏色 */
export const UNTINTED = (k: Px) => k.startsWith('sky-') || k.startsWith('lamp-') || k.startsWith('neon-') || k === 'star' || k === 'moon'

type Rgb = [number, number, number]
export type Tokens = Record<Px, string>

export interface Palette {
  /** 這組調色盤的名字（快取用） */
  key: string
  /** ImageData 的一個像素（little-endian：0xAABBGGRR） */
  u32: Record<Px, number>
}

function hex(s: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim())
  if (!m) throw new Error(`pixelwalk: 顏色要是 #RRGGBB（${s}）`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const pack = ([r, g, b]: Rgb) => ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
const mix = (a: Rgb, b: Rgb, t: number, dim: number): Rgb => [0, 1, 2].map((i) => Math.round((a[i]! * (1 - t) + b[i]! * t) * dim)) as Rgb

/** 時段的換色：往色調混多少、整體亮度 */
const TIME = { day: [0, 1], dusk: [0.2, 0.9], night: [0.5, 0.62] } as const

export function makePalette(tokens: Tokens, time: TimeOfDay): Palette {
  const base = Object.fromEntries(PX.map((k) => [k, hex(tokens[k])])) as Record<Px, Rgb>
  const [t, dim] = TIME[time]
  const target = time === 'night' ? base['tint-night'] : base['tint-dusk']
  const u32 = {} as Record<Px, number>
  for (const k of PX) u32[k] = pack(UNTINTED(k) || time === 'day' ? base[k] : mix(base[k], target, t, dim))
  return { key: time, u32 }
}

/** 瀏覽器裡：從 :root 讀 token */
export function readTokens(): Tokens {
  const cs = getComputedStyle(document.documentElement)
  return Object.fromEntries(PX.map((k) => [k, cs.getPropertyValue(`--color-px-${k}`).trim()])) as Tokens
}
