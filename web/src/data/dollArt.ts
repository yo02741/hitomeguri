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

// ---------- 衣服的版型（240×320 的畫布，肩 y151、腰 y240、腳踝 y274） ----------
// 上衣：肩到腰，短袖蓋到手肘
export const TOP = 'M98 151 L142 151 C153 153 161 158 165 167 L170 188 L151 192 L151 240 L89 240 L89 192 L70 188 L75 167 C79 158 87 153 98 151Z'
export const TOP_SHADE = 'M140 151 C153 153 161 158 165 167 L170 188 L151 192 L151 240 L138 240Z'
// 作務衣：袖子到手腕
export const TOP_LONG = 'M98 151 L142 151 C153 153 161 158 165 167 L172 208 L151 210 L151 240 L89 240 L89 210 L68 208 L75 167 C79 158 87 153 98 151Z'
// 長褲、短褲
export const PANTS = 'M89 234 L151 234 L152 244 L145 274 L124 274 L121.5 250 L118.5 250 L116 274 L95 274 L88 244Z'
export const SHORTS = 'M89 234 L151 234 L154 256 L124 258 L121 246 L119 246 L116 258 L86 256Z'
// 和服形（浴衣）：到腳踝，袂垂到腰下
export const ROBE = 'M96 151 L144 151 L153 162 L158 274 L82 274 L87 162Z'
export const SLEEVE_L = 'M92 156 C80 158 70 166 68 180 L66 224 C66 231 71 234 78 234 L95 234 L95 170Z'
export const SLEEVE_R = 'M148 156 C160 158 170 166 172 180 L174 224 C174 231 169 234 162 234 L145 234 L145 170Z'
export const NECK = `<path d="M108 151 Q120 159 132 151" ${line(1.6, C.ink, 0.25)}/>`
