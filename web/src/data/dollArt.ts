/**
 * 紙娃娃的繪圖小工具（DESIGN.md §7.24）：顏色 token、紙的淡邊、陰影、線條。
 * 服裝的 SVG 字串都用這些組，顏色不寫死。
 */
export const C = {
  red: 'var(--color-item-red)',
  pink: 'var(--color-item-pink)',
  green: 'var(--color-item-green)',
  matcha: 'var(--color-item-matcha)',
  blue: 'var(--color-item-blue)',
  navy: 'var(--color-item-navy)',
  yellow: 'var(--color-item-yellow)',
  orange: 'var(--color-item-orange)',
  brown: 'var(--color-item-brown)',
  cream: 'var(--color-item-cream)',
  white: 'var(--color-item-white)',
  grey: 'var(--color-item-grey)',
  purple: 'var(--color-item-purple)',
  gold: 'var(--color-gold-2)',
  ink: 'var(--color-doll-line)',
}
/** 紙的淡邊（同一張紙的切口，不是黑線） */
export const E = 'stroke="var(--color-doll-line)" stroke-opacity=".2" stroke-width="1.4" stroke-linejoin="round"'
/** 陰影：疊一層半透明 */
export const SH = 'fill="var(--color-doll-line)" opacity=".16"'
export const line = (w = 2.4, color = C.ink, op = 1) => `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}"`
export const shape = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${E} ${extra}/>`
export const dots = (fill: string, r: number, pts: Array<[number, number]>, extra = '') => `<g fill="${fill}" ${extra}>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`

