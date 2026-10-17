import { splitOver } from '../../data/dollArt'
import { EYES, HAIR, outfitById, type Slot } from '../../data/outfits'

import type { Geom } from './geometry'
import { LAYER, layerCode } from './pixelize'
import type { TravellerLook } from './types'

/**
 * 把旅人組成一段 SVG（跟 components/PaperDoll.vue 同一套圖層順序），給 raster.ts 畫成大圖：
 * - 正面：後髮 → 手腳、衣服、左手 → 頭、腮紅、嘴 → 眼睛 → 瀏海 → 臉上的 → 頭上的 → 側戴的面具 → 手上的、右手。
 *   ids：每一層包一個濾鏡，整片塗成那一層的代碼色（pixelize.ts 的 layerCode），用來找圖層交界與眼睛看不看得到。
 * - 背面（便宜的 2D）：整個左右翻；手上的東西畫在身體後面；頭整顆填髮色、瀏海、後髮在上、最後疊頭上的。
 * 顏色都還是 var(--…)（紙娃娃的 token），raster.ts 畫之前才換成算好的顏色。
 */
const SK = `fill="var(--skin)" stroke="var(--color-doll-line)" stroke-opacity=".2" stroke-width="1.4"`
const LIMBS = `<g ${SK}><rect x="104" y="236" width="13" height="36" rx="5"/><rect x="123" y="236" width="13" height="36" rx="5"/><rect x="77" y="160" width="14" height="60" rx="7"/><rect x="149" y="160" width="14" height="60" rx="7"/></g>`
const SHOES = `<g fill="var(--color-item-brown)"><path d="M98 276 C98 270 104 268 110 268 C116 268 119 271 119 276 C119 279 117 280 114 280 L101 280 C99 280 98 278 98 276Z"/><path d="M142 276 C142 270 136 268 130 268 C124 268 121 271 121 276 C121 279 123 280 126 280 L139 280 C141 280 142 278 142 276Z"/></g>`
const HEAD = `<path ${SK} d="M120 44 C153 44 174 68 174 101 C174 134 151 156 120 156 C89 156 66 134 66 101 C66 68 87 44 120 44Z"/>`
const FACE =
  `<ellipse cx="93" cy="123" rx="8.5" ry="5" fill="var(--color-doll-blush)" opacity=".7"/><ellipse cx="147" cy="123" rx="8.5" ry="5" fill="var(--color-doll-blush)" opacity=".7"/>` +
  `<path d="M116 129 Q120 132.5 124 129" fill="none" stroke="var(--color-doll-line)" stroke-width="2.2" stroke-linecap="round"/>`
const LEFT_HAND = `<circle cx="84" cy="222" r="8" ${SK}/>`
const RIGHT_HAND = `<circle cx="156" cy="222" r="8" ${SK}/>`

export const svgOf = (look: TravellerLook, slot: Exclude<Slot, 'bg'>) => {
  const id = look.equipped[slot]
  return id ? (outfitById.get(id)?.svg ?? '') : ''
}

/** 這隻旅人自己的 CSS 變數（膚色、髮色） */
export const localVars = (look: TravellerLook): Record<string, string> => ({
  '--skin': `var(--color-doll-skin-${look.parts.skin})`,
  '--hair': `var(--color-doll-hair-${look.parts.hairColor})`,
})

const FILTER_PREFIX = 'hm-px-lid'
/** 圖層代碼色的濾鏡：RGB 換成代碼、alpha 照舊（sRGB 下算，顏色才準） */
export function layerFilters(): string {
  let out = ''
  for (let k = 1; k <= 9; k++) {
    const [r, g, b] = layerCode(k).map((v) => +(v / 255).toFixed(4))
    out +=
      `<filter id="${FILTER_PREFIX}${k}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="640" height="720" color-interpolation-filters="sRGB">` +
      `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0"/></filter>`
  }
  return out
}

export interface FrontOptions {
  /** 圖層代碼那一趟 */
  ids?: boolean
  /** 手上的東西畫在頭後面（舉高的東西不擋臉） */
  handBehind?: boolean
  /** 畫不畫手上的東西（傘改成頭頂的疊加 sprite，這裡不畫） */
  hand?: boolean
}

export function composeFront(look: TravellerLook, g: Geom, o: FrontOptions = {}): string {
  const face = splitOver(svgOf(look, 'face'))
  const hair = HAIR[look.parts.hair] ?? HAIR.bob
  const eyes = EYES[look.parts.eyes] ?? EYES.round
  const H = (x: string) => `<g transform="${g.head}">${x}</g>`
  const hand = o.hand === false ? '' : svgOf(look, 'hand')
  const layers: Array<[number, string]> = [
    [LAYER.hairBack, H(hair.back)],
    [LAYER.body, `<g transform="${g.body}">${LIMBS}${SHOES}${svgOf(look, 'body')}${LEFT_HAND}</g>`],
    [LAYER.skin, H(HEAD + FACE)],
    [LAYER.eyes, H(eyes)],
    [LAYER.hairFront, H(hair.front)],
    [LAYER.face, H(face.under)],
    [LAYER.hat, H(svgOf(look, 'head'))],
    [LAYER.faceOver, H(face.over)],
    [LAYER.hand, `<g transform="${g.hand}">${hand}${RIGHT_HAND}</g>`],
  ]
  if (o.handBehind) layers.splice(2, 0, layers.pop()!)
  return layers.map(([id, x]) => (o.ids ? `<g filter="url(#${FILTER_PREFIX}${id})">${x}</g>` : x)).join('')
}

export function composeBack(look: TravellerLook, g: Geom, o: { hand?: boolean } = {}): string {
  const hair = HAIR[look.parts.hair] ?? HAIR.bob
  const hand = o.hand === false ? '' : svgOf(look, 'hand')
  return (
    `<g transform="matrix(-1 0 0 1 240 0)">` +
    `<g transform="${g.hand}">${hand}${RIGHT_HAND}</g>` +
    `<g transform="${g.body}">${LIMBS}${SHOES}${svgOf(look, 'body')}${LEFT_HAND}</g>` +
    `<g transform="${g.head}">${HEAD.replace('fill="var(--skin)"', 'fill="var(--hair)"')}${hair.front}${hair.back}${svgOf(look, 'head')}</g>` +
    `</g>`
  )
}
