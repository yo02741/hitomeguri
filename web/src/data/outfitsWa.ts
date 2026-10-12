import type { Outfit } from './outfits'
import { C, dots, E, HAKAMA, HAORI_L, HAORI_R, line, LONG, LONG_SHADE, mirror, PANTS, ROBE, SH, shape, SLEEVE_L, SLEEVE_R, TOP, TOP_SHADE, vtext } from './dollArt'
import { happi, robe, sideMask, skewer } from './outfitsPref'

/**
 * 和風的第三批（使用者回饋 2026-10-12：再多一批日本元素的服飾與地區限定）。
 * - 不限縣的 34 件（衣服 12、頭上 5、臉上 2、手上 10、夥伴 5），用抽獎券抽。
 * - 各縣限定的傳統服裝 12 件：去過那個縣之後加進扭蛋（不是代表單品）。題材取自那個縣實際的祭典與工藝：
 *   data/festivals 的ねぶた（青森）、西馬音内の盆踊（秋田）、すずめ踊り（宮城）、おわら風の盆（富山），
 *   data/specialties 的有松・鳴海絞（愛知），與經濟產業大臣指定的傳統工藝品（小千谷縮、久留米絣、本場大島紬、琉球びんがた）、
 *   江戶的町火消、京都的舞妓、熊野古道的壺裝束。
 * 畫法同 outfits.ts（剪紙、平塗、淡邊），和服、法被、面具、串沿用 outfitsPref.ts 的模板。
 */

export const BODY_ICON = '58 140 124 140'
export const shade = (d: string) => `<path d="${d}" ${SH}/>`
export const pat = (d: string, id: string) => `<path d="${d}" fill="url(#${id})"/>`
/** 米色：棕上疊一層半透明的奶油色 */
export const beige = (d: string) => shape(d, C.brown) + `<path d="${d}" fill="${C.cream}" opacity=".55"/>`

// ---------- 版型 ----------
// 和服的上半身（下面穿袴）
export const ROBE_UP = 'M96 151 L144 151 L153 162 L154 204 L86 204 L87 162Z'
// 撩起來到小腿的和服（跳人、壺裝束）
export const ROBE_SHORT = 'M96 151 L144 151 L153 162 L156 254 L84 254 L87 162Z'
export const ROBE_SHORT_SHADE = 'M144 151 L153 162 L156 254 L138 254Z'
export const HAKAMA_SHADE = 'M140 198 L154 198 L161 274 L140 274Z'
export const PLEATS = `<path d="M104 200 L100 274 M120 200 L120 274 M136 200 L140 274" ${line(1.2, C.ink, 0.3)}/>`
export const COLLAR = (color: string, w = 5) => `<path d="M106 150 L122 196 M134 150 L124 178" ${line(w, color)}/>`
// 振袖的長袂
export const FURI_L = 'M92 156 C80 158 70 166 68 180 L64 254 C64 262 70 266 78 266 L95 266 L95 170Z'
export const FURI_R = 'M148 156 C160 158 170 166 172 180 L176 254 C176 262 170 266 162 266 L145 266 L145 170Z'

/** 紋：白圈裡一個小家紋 */
export const mon = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${C.white}"/><circle cx="${x}" cy="${y}" r="2.8" fill="${C.ink}"/><circle cx="${x}" cy="${y}" r="1.3" fill="${C.white}"/>`
/** 五瓣的花（櫻花髮夾） */
export const blossom = (x: number, y: number, r: number, fill: string) =>
  `<g ${E}>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - r}" rx="${r * 0.62}" ry="${r}" fill="${fill}" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g><circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="${C.yellow}"/>`

/** ROBE 的左右邊在 y 時的 x（端縫い的拼布用） */
function robeX(y: number, side: -1 | 1): number {
  if (y < 162) {
    const t = (y - 151) / 11
    return side < 0 ? 96 - 9 * t : 144 + 9 * t
  }
  const t = (y - 162) / 112
  return side < 0 ? 87 - 5 * t : 153 + 5 * t
}
/** 端縫い衣裳：絹布的碎片拼成的和服身頃，左右兩欄、每列一塊，接縫錯開 */
function patchRobe(colors: string[]): string {
  const rows = [151, 178, 204, 232, 274]
  let out = ''
  let k = 0
  for (let r = 0; r < rows.length - 1; r++) {
    const y0 = rows[r]!
    const y1 = rows[r + 1]!
    const m0 = r % 2 ? 124 : 116
    const m1 = r % 2 ? 116 : 124
    const lx0 = robeX(y0, -1)
    const lx1 = robeX(y1, -1)
    const rx0 = robeX(y0, 1)
    const rx1 = robeX(y1, 1)
    out += shape(`M${lx0.toFixed(1)} ${y0} L${m0} ${y0} L${m1} ${y1} L${lx1.toFixed(1)} ${y1}Z`, colors[k++ % colors.length]!)
    out += shape(`M${m0} ${y0} L${rx0.toFixed(1)} ${y0} L${rx1.toFixed(1)} ${y1} L${m1} ${y1}Z`, colors[k++ % colors.length]!)
  }
  return out
}

const BODY: Outfit[] = [
  {
    id: 'miko',
    name: '巫女服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.white) +
      shape(SLEEVE_R, C.white) +
      shade(SLEEVE_R) +
      shape(ROBE_UP, C.white) +
      COLLAR(C.white) +
      `<path d="M108.5 150 L122 190 M131.5 150 L124 174" ${line(1.4, C.red, 0.8)}/>` +
      shape(HAKAMA, C.red) +
      shade(HAKAMA_SHADE) +
      PLEATS +
      `<path d="M86 199.5 L154 199.5" ${line(3, C.red)}/>` +
      shape('M114 198 C108 192 106 203 112 205 L120 201 L128 205 C134 203 132 192 126 198 L120 200Z', C.red),
  },
  {
    id: 'haori-hakama',
    name: '羽織袴',
    slot: 'body',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.ink) +
      shape(SLEEVE_R, C.ink) +
      shape(ROBE_UP, C.ink) +
      `<path d="M106 150 L120 190 M134 150 L120 190" ${line(4, C.white)}/>` +
      shape(HAKAMA, C.grey) +
      pat(HAKAMA, 'doll-stripes') +
      shade(HAKAMA_SHADE) +
      PLEATS +
      shape(HAORI_L, C.ink) +
      shape(HAORI_R, C.ink) +
      `<path d="M112 152 L114 231 M128 152 L126 231" ${line(1.2, C.white, 0.18)}/>` +
      mon(100, 172) +
      mon(140, 172) +
      mon(78, 190) +
      mon(162, 190) +
      `<path d="M113 188 L127 188" ${line(2.4, C.white)}/>` +
      `<circle cx="120" cy="192" r="3.2" fill="${C.white}" ${E}/>` +
      `<path d="M120 195 L120 204" ${line(2, C.white)}/>`,
  },
  {
    id: 'kappogi',
    name: '割烹著',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(ROBE, C.purple) +
      pat(ROBE, 'doll-asanoha') +
      shade('M144 151 L153 162 L158 274 L138 274Z') +
      shape('M98 151 L142 151 C153 153 161 158 165 167 L171 214 L151 216 L153 246 L87 246 L89 216 L69 214 L75 167 C79 158 87 153 98 151Z', C.white) +
      shade('M140 151 C153 153 161 158 165 167 L171 214 L151 216 L153 246 L138 246Z') +
      shape('M106 151 L134 151 L120 166Z', C.purple) +
      `<path d="M107 151 L120 165 L133 151" ${line(2.2, C.cream)}/>` +
      `<path d="M110 160 L108 170 M120 162 L120 172 M130 160 L132 170 M69.5 209 L89 211 M151 211 L170.5 209" ${line(1.2, C.ink, 0.22)}/>` +
      shape('M126 216 L144 216 L144 232 L126 232Z', C.white),
  },
  {
    id: 'hanten',
    name: '半纏',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.grey) +
      shape('M96 151 L144 151 L150 156 L172 160 L174 214 L152 214 L152 234 L88 234 L88 214 L66 214 L68 160 L90 156Z', C.navy) +
      pat('M96 151 L144 151 L150 156 L172 160 L174 214 L152 214 L152 234 L88 234 L88 214 L66 214 L68 160 L90 156Z', 'doll-kasuri-w') +
      shade('M138 151 L144 151 L150 156 L172 160 L174 214 L152 214 L152 234 L138 234Z') +
      shape('M112 152 L128 152 L126 234 L114 234Z', C.cream) +
      `<path d="M110 151 L113 234 M130 151 L127 234" ${line(6, C.ink)}/>` +
      `<path d="M66 196 L88 196 M152 196 L174 196 M88 206 L111 206 M129 206 L152 206" ${line(1.2, C.ink, 0.25)}/>`,
  },
  {
    id: 'komon',
    name: '小紋和服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.matcha, pattern: 'doll-sakura', collar: C.cream, obi: C.gold, obiLine: C.red }),
  },
  {
    id: 'shosei',
    name: '書生服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.navy) +
      shape(SLEEVE_R, C.navy) +
      pat(SLEEVE_L, 'doll-kasuri-w') +
      pat(SLEEVE_R, 'doll-kasuri-w') +
      shade(SLEEVE_R) +
      shape(ROBE_UP, C.navy) +
      pat(ROBE_UP, 'doll-kasuri-w') +
      shape('M101 145 C110 149 130 149 139 145 L140 153 C130 157 110 157 100 153Z', C.white) +
      shape('M107 151 L133 151 L120 174Z', C.white) +
      `<path d="M106 151 L120 180 M134 151 L120 180" ${line(3.4, C.navy)}/>` +
      shape(HAKAMA, C.brown) +
      shade(HAKAMA_SHADE) +
      PLEATS +
      `<path d="M86 199.5 L154 199.5" ${line(2.6, C.brown)}/>`,
  },
  {
    id: 'kendo',
    name: '劍道服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(HAKAMA, C.navy) +
      shade(HAKAMA_SHADE) +
      PLEATS +
      shape(TOP, C.navy) +
      shade(TOP_SHADE) +
      `<path d="M106 151 L118 186 M134 151 L126 170" ${line(1.2, C.cream, 0.6)} stroke-dasharray="2 2"/>` +
      shape('M88 206 L152 206 L154 240 L86 240Z', C.navy) +
      `<path d="M104 212 L102 240 M136 212 L138 240" ${line(1.2, C.ink, 0.4)}/>` +
      shape('M113 212 L127 212 L127 238 L113 238Z', C.white) +
      `<path d="M116 218 L124 218 M116 224 L124 224 M116 230 L122 230" ${line(1.2, C.ink, 0.5)}/>` +
      shape('M92 168 C104 162 136 162 148 168 L146 206 C136 212 104 212 94 206Z', C.ink) +
      shape('M92 168 C104 162 136 162 148 168 L148 178 C136 172 104 172 92 178Z', C.brown) +
      `<path d="M100 188 C110 184 130 184 140 188" ${line(2, C.white, 0.25)}/>` +
      `<path d="M96 168 L100 152 M144 168 L140 152" ${line(1.6, C.white, 0.8)}/>`,
  },
  {
    id: 'judo',
    name: '柔道服',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.white) +
      `<path d="M120 240 L120 250" ${line(1.4, C.ink, 0.3)}/>` +
      shape(LONG, C.white) +
      shade(LONG_SHADE) +
      shape('M103 151 L111 151 L128 204 L121 206Z', C.white) +
      shape('M137 151 L129 151 L113 192 L119 194Z', C.white) +
      `<path d="M69.5 208 L89 210 M151 210 L170.5 208" ${line(1.2, C.ink, 0.22)}/>` +
      shape('M88 214 L152 214 L152 222 L88 222Z', C.ink) +
      shape('M113 211 L127 211 L129 225 L111 225Z', C.ink) +
      `<path d="M116 225 L110 246 M124 225 L130 246" ${line(4.5, C.ink)}/>`,
  },
  {
    id: 'kyudo',
    name: '弓道服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(TOP, C.white) +
      shade(TOP_SHADE) +
      `<path d="M106 151 L122 196 M134 151 L124 178" ${line(1.6, C.ink, 0.3)}/>` +
      shape(HAKAMA, C.ink) +
      `<path d="M104 200 L100 274 M120 200 L120 274 M136 200 L140 274" ${line(1.2, C.white, 0.15)}/>` +
      shape('M122 158 C136 156 148 162 150 174 L148 196 L124 196 C122 184 122 170 122 158Z', C.ink) +
      `<path d="M124 160 L104 152 M149 170 L158 162" ${line(1.4, C.white, 0.8)}/>`,
  },
  {
    id: 'tobi',
    name: '鳶職服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape('M97 270 C97 267 100 265 104 265 L117 265 L118 280 C118 281 117 282 115 282 L100 282 C98 282 97 280 97 278Z', C.ink) +
      shape('M143 270 C143 267 140 265 136 265 L123 265 L122 280 C122 281 123 282 125 282 L140 282 C142 282 143 280 143 278Z', C.ink) +
      beige('M89 232 L151 232 L163 254 L148 271 L126 271 L122 250 L118 250 L114 271 L92 271 L77 254Z') +
      shade('M138 232 L151 232 L163 254 L148 271 L136 271Z') +
      `<path d="M95 266 L113 266 M127 266 L145 266 M84 250 L90 258 M156 250 L150 258" ${line(1.4, C.ink, 0.3)}/>` +
      shape(LONG, C.navy) +
      shade(LONG_SHADE) +
      `<path d="M100 153 Q120 168 140 153" ${line(5, C.white)}/>` +
      `<path d="M101 154 L99 174 M139 154 L141 174" ${line(5, C.white)}/>`,
  },
  {
    id: 'itamae',
    name: '板前服',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.ink) +
      shape(LONG, C.white) +
      shade(LONG_SHADE) +
      `<path d="M106 151 L124 200 M134 151 L118 188" ${line(1.8, C.ink, 0.3)}/>` +
      shape('M88 214 L152 214 L152 264 L88 264Z', C.navy) +
      shade('M138 214 L152 214 L152 264 L138 264Z') +
      `<path d="M86 214.5 L154 214.5" ${line(3, C.white)}/>` +
      `<circle cx="120" cy="240" r="9" ${line(2.2, C.white)}/>`,
  },
  {
    id: 'station-staff',
    name: '站務員制服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      `<path d="M120 240 L120 250" ${line(1.4, C.ink, 0.3)}/>` +
      shape(LONG, C.navy) +
      shade(LONG_SHADE) +
      shape('M108 151 L132 151 L120 180Z', C.white) +
      shape('M117 156 L123 156 L122 161 L118 161Z', C.blue) +
      shape('M118 160 L122 160 L124 180 L120 186 L116 180Z', C.blue) +
      `<path d="M104 151 L114 176 L120 186 M136 151 L126 176 L120 186" ${line(1.8, C.ink, 0.3)}/>` +
      dots(C.gold, 2.2, [
        [120, 198],
        [120, 213],
        [120, 228],
      ]) +
      `<path d="M69.5 208 L89 210 M151 210 L170.5 208 M86 158 L98 154 M154 158 L142 154" ${line(2, C.gold)}/>` +
      shape('M151 176 L166 172 L168 185 L152 189Z', C.red),
  },
]

const HEAD: Outfit[] = [
  {
    id: 'nejiri-hachimaki',
    name: '捻鉢卷',
    slot: 'head',
    rarity: 1,
    icon: '56 52 128 52',
    svg:
      shape('M64 86 C82 74 158 74 176 86 L176 94 C158 82 82 82 64 94Z', C.white) +
      `<path d="M65 90 C83 78 157 78 175 90" fill="none" stroke="${C.red}" stroke-width="7" stroke-dasharray="5 5"/>` +
      `<path d="M118 75 L107 60" ${line(5, C.red)}/><path d="M122 75 L134 61" ${line(5, C.white)}/>` +
      shape('M111 77 C111 70 129 70 129 77 C129 83 111 83 111 77Z', C.white) +
      `<path d="M113 74 L127 80" ${line(2.4, C.red)}/>`,
  },
  {
    id: 'tenugui',
    name: '手拭頭巾',
    slot: 'head',
    rarity: 1,
    icon: '52 22 140 80',
    svg:
      shape('M170 70 L188 62 L186 72 L174 78Z', C.blue) +
      shape('M64 94 C58 52 88 30 120 30 C152 30 182 52 176 94 C162 86 78 86 64 94Z', C.blue) +
      pat('M64 94 C58 52 88 30 120 30 C152 30 182 52 176 94 C162 86 78 86 64 94Z', 'doll-dots') +
      shade('M146 34 C166 44 180 64 176 94 C168 90 160 88 152 87Z') +
      `<path d="M66 90 C80 84 160 84 174 90" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'station-cap',
    name: '站務員帽',
    slot: 'head',
    rarity: 2,
    icon: '56 30 128 72',
    svg:
      shape('M66 54 C66 44 92 38 120 38 C148 38 174 44 174 54 L166 72 L74 72Z', C.navy) +
      shade('M150 40 C164 44 174 48 174 54 L166 72 L150 72Z') +
      shape('M74 68 L166 68 L166 80 L74 80Z', C.navy) +
      shade('M74 68 L166 68 L166 80 L74 80Z') +
      `<path d="M74 74 L166 74" ${line(2, C.gold)}/>` +
      `<circle cx="120" cy="57" r="5" fill="${C.gold}" ${E}/>` +
      `<path d="M108 57 L113 57 M127 57 L132 57" ${line(2, C.gold)}/>` +
      shape('M82 80 C98 92 142 92 158 80 L160 85 C142 98 98 98 80 85Z', C.ink),
  },
  {
    id: 'oni-horns',
    name: '鬼角髮箍',
    slot: 'head',
    rarity: 1,
    icon: '60 10 120 90',
    svg:
      `<path d="M70 92 C66 56 90 40 120 40 C150 40 174 56 170 92" ${line(5, C.red)}/>` +
      shape('M92 50 L86 16 L107 44Z', C.yellow) +
      shape('M148 50 L154 16 L133 44Z', C.yellow) +
      shade('M148 50 L154 16 L141 47Z') +
      `<path d="M89 36 L99 34 M88 27 L95 26 M151 36 L141 34 M152 27 L145 26" ${line(1.8, C.brown, 0.7)}/>`,
  },
  {
    id: 'sakura-clip',
    name: '櫻花髮夾',
    slot: 'head',
    rarity: 1,
    // 戴在頭的右側（畫面左邊）：左側留給側戴的面具
    icon: '48 32 64 64',
    svg: mirror(blossom(152, 58, 7, C.pink) + blossom(168, 74, 5.5, C.pink) + `<path d="M144 70 L160 64" ${line(2, C.gold)}/>`),
  },
]

const FACE: Outfit[] = [
  {
    id: 'okame',
    name: '阿龜面',
    slot: 'face',
    rarity: 2,
    icon: '126 34 70 80',
    svg: sideMask(
      `<ellipse cx="152" cy="62" rx="3" ry="1.8" fill="${C.ink}"/><ellipse cx="168" cy="62" rx="3" ry="1.8" fill="${C.ink}"/>` +
        `<path d="M149 76 Q152.5 72.5 156 76 M164 76 Q167.5 72.5 171 76" ${line(1.6)}/>` +
        `<ellipse cx="147" cy="87" rx="5" ry="3.4" fill="${C.pink}"/><ellipse cx="173" cy="87" rx="5" ry="3.4" fill="${C.pink}"/>` +
        `<ellipse cx="160" cy="93" rx="2.8" ry="2.2" fill="${C.red}"/>`,
      C.white,
    ),
  },
  {
    id: 'hannya',
    name: '般若面',
    slot: 'face',
    rarity: 3,
    icon: '126 20 70 94',
    svg: sideMask(
      shape('M146 54 L136 32 L153 49Z', C.gold) +
        shape('M174 54 L184 32 L167 49Z', C.gold) +
        `<path d="M143 64 L156 71 M177 64 L164 71" ${line(2.4)}/>` +
        shape('M145 72 L157 76 L148 81Z', C.gold) +
        shape('M175 72 L163 76 L172 81Z', C.gold) +
        `<circle cx="151" cy="76.5" r="1.6" fill="${C.ink}"/><circle cx="169" cy="76.5" r="1.6" fill="${C.ink}"/>` +
        shape('M145 90 C152 99 168 99 175 90 C171 102 149 102 145 90Z', C.red) +
        `<path d="M150 92 L152 98 M170 92 L168 98" ${line(2, C.white)}/>`,
      C.white,
    ),
  },
]

const HAND: Outfit[] = [
  {
    id: 'hanami-dango',
    name: '三色糰子',
    slot: 'hand',
    rarity: 1,
    icon: '140 150 50 92',
    svg: skewer((x, y, i) => `<circle cx="${x}" cy="${y}" r="8" fill="${[C.green, C.white, C.pink][i]}" ${E}/>`, [0.42, 0.6, 0.78]),
  },
  {
    id: 'hagoita',
    name: '羽子板',
    slot: 'hand',
    rarity: 2,
    icon: '138 78 88 158',
    svg:
      `<path d="M156 226 L163 198" ${line(5, C.brown)}/>` +
      shape('M162 200 L172 122 C173 116 178 114 184 115 L194 117 C199 118 201 122 200 128 L188 204Z', C.cream) +
      shade('M190 117 L194 117 C199 118 201 122 200 128 L188 204 L182 203Z') +
      shape('M173 152 L192 155 L186 198 L168 195Z', C.red) +
      `<path d="M171 172 L190 175" ${line(4, C.gold)}/>` +
      `<circle cx="183" cy="141" r="5.4" fill="${C.cream}" ${E}/>` +
      shape('M175 136 C176 126 192 126 192 138 C188 134 180 134 175 136Z', C.ink) +
      shape('M210 97 L204 86 L209 87Z', C.red) +
      shape('M210 97 L211 84 L215 87Z', C.yellow) +
      shape('M211 97 L219 88 L220 92Z', C.green) +
      `<circle cx="210" cy="100" r="4" fill="${C.ink}"/>`,
  },
  {
    id: 'kendama',
    name: '劍玉',
    slot: 'hand',
    rarity: 1,
    icon: '128 160 58 80',
    svg:
      beige('M152 206 L160 206 L159 236 L153 236Z') +
      beige('M138 200 L174 200 L172 208 L140 208Z') +
      `<ellipse cx="140" cy="200" rx="5" ry="2.8" fill="${C.brown}" opacity=".55"/><ellipse cx="172" cy="200" rx="4" ry="2.4" fill="${C.brown}" opacity=".55"/>` +
      beige('M154 200 L158 200 L156 188Z') +
      `<path d="M171 207 C182 202 176 190 166 186" ${line(1, C.ink, 0.5)}/>` +
      `<circle cx="156" cy="177" r="10" fill="${C.red}" ${E}/>` +
      `<path d="M150 172 C151 169 154 168 157 168" ${line(2, C.white, 0.7)}/>`,
  },
  {
    id: 'kazaguruma',
    name: '風車',
    slot: 'hand',
    rarity: 1,
    icon: '142 136 64 100',
    svg:
      `<path d="M156 228 L176 168" ${line(2.6, C.brown)}/>` +
      shape('M176 168 L176 146 L192 156Z', C.red) +
      shape('M176 168 L198 168 L188 184Z', C.yellow) +
      shape('M176 168 L176 190 L160 180Z', C.blue) +
      shape('M176 168 L154 168 L164 152Z', C.green) +
      `<circle cx="176" cy="168" r="2.6" fill="${C.gold}" ${E}/>`,
  },
  {
    id: 'senko-hanabi',
    name: '線香花火',
    slot: 'hand',
    rarity: 1,
    icon: '136 212 50 70',
    svg:
      `<path d="M155 220 L159 230" ${line(3, C.purple)}/>` +
      `<path d="M158 228 C159 240 160 250 162 259" fill="none" stroke="${C.pink}" stroke-width="1.8" stroke-dasharray="2 1.2"/>` +
      `<path d="M162 262 L174 254 M162 262 L175 270 M162 262 L150 270 M162 262 L151 252 M162 262 L166 276 M170 258 L176 251 M170 267 L177 268 M154 268 L150 275" ${line(1.2, C.yellow)}/>` +
      `<circle cx="162" cy="262" r="3.6" fill="${C.orange}" ${E}/>`,
  },
  {
    id: 'ringo-ame',
    name: '蘋果糖',
    slot: 'hand',
    rarity: 1,
    icon: '134 154 56 82',
    svg:
      `<path d="M156 226 L160 196" ${line(2.6, C.brown)}/>` +
      shape('M146 192 C152 200 170 200 176 192 L178 197 C170 205 152 205 144 197Z', C.red, 'opacity=".75"') +
      shape('M161 166 C172 162 180 172 178 184 C176 196 168 200 161 198 C154 200 146 196 144 184 C142 172 150 162 161 166Z', C.red) +
      shade('M168 164 C176 168 180 176 178 184 C176 196 168 200 161 198 C170 192 174 178 168 164Z') +
      `<path d="M150 176 C152 170 156 168 160 168" ${line(2.4, C.white, 0.75)}/>` +
      `<path d="M161 166 L162 160" ${line(2, C.brown)}/>`,
  },
  {
    id: 'nigiri',
    name: '握壽司',
    slot: 'hand',
    rarity: 1,
    icon: '128 190 76 50',
    svg:
      `<path d="M142 228 L142 234 M190 224 L190 230" ${line(4, C.brown)}/>` +
      beige('M134 218 L196 213 L198 224 L136 229Z') +
      shape('M140 215 C140 207 162 205 164 211 L164 219 L140 221Z', C.white) +
      shape('M138 211 C142 201 164 199 168 207 C162 211 146 213 138 211Z', C.orange) +
      `<path d="M144 206 L148 211 M151 204 L155 209 M158 203 L161 208" ${line(1.2, C.white, 0.85)}/>` +
      shape('M170 213 C170 205 192 203 194 209 L194 217 L170 219Z', C.white) +
      shape('M168 209 C172 199 194 197 198 205 C192 209 176 211 168 209Z', C.red),
  },
  {
    id: 'omamori',
    name: '御守',
    slot: 'hand',
    rarity: 1,
    icon: '150 174 46 58',
    svg:
      `<path d="M172 190 C169 181 180 181 177 190" ${line(1.8, C.gold)}/>` +
      shape('M164 197 L171 190 L178 190 L185 197 L185 227 L164 227Z', C.red) +
      `<path d="M164 197 L171 190 L178 190 L185 197 L185 227 L164 227Z" fill="url(#doll-asanoha)" opacity=".7"/>` +
      shape('M169.5 202 L179.5 202 L179.5 221 L169.5 221Z', C.gold) +
      vtext('御守', 174.5, 211.5, 6, C.red),
  },
  {
    id: 'ema',
    name: '繪馬',
    slot: 'hand',
    rarity: 2,
    icon: '142 176 54 56',
    svg:
      `<path d="M164 191 C161 182 175 182 172 191" ${line(1.8, C.red)}/>` +
      beige('M150 198 L168 186 L186 198 L186 226 L150 226Z') +
      shade('M176 192 L186 198 L186 226 L176 226Z') +
      `<circle cx="168" cy="204" r="4.6" fill="${C.red}"/>` +
      `<path d="M157 214 L179 214 M157 220 L174 220" ${line(1.4, C.ink, 0.6)}/>`,
  },
  {
    id: 'taketombo',
    name: '竹蜻蜓',
    slot: 'hand',
    rarity: 1,
    icon: '136 154 62 82',
    svg:
      `<path d="M156 228 L166 172" ${line(2.6, C.yellow)}/>` +
      shape('M142 170 C150 164 182 164 190 170 C182 176 150 176 142 170Z', C.yellow) +
      shade('M142 170 C150 172 182 172 190 170 C182 176 150 176 142 170Z') +
      `<circle cx="166" cy="170" r="2.4" fill="${C.brown}"/>`,
  },
]

const BUDDY: Outfit[] = [
  {
    id: 'komainu',
    name: '狛犬',
    slot: 'buddy',
    rarity: 2,
    icon: '18 198 82 102',
    svg:
      shape('M28 288 L88 288 L90 297 L26 297Z', C.grey) +
      shade('M60 288 L88 288 L90 297 L60 297Z') +
      `<path d="M80 272 C92 264 93 248 84 243" ${line(7, C.grey)}/>` +
      shape('M38 288 C34 264 42 250 58 248 C74 250 84 264 80 288Z', C.grey) +
      shade('M68 250 C78 254 84 266 80 288 L70 288 C74 274 72 260 68 250Z') +
      shape('M44 288 L44 270 C44 265 53 265 53 270 L53 288Z', C.grey) +
      shape('M63 288 L63 270 C63 265 72 265 72 270 L72 288Z', C.grey) +
      dots(
        C.grey,
        6.5,
        [
          [38, 226],
          [36, 240],
          [40, 252],
          [78, 226],
          [80, 240],
          [76, 252],
          [46, 215],
          [58, 211],
          [70, 215],
        ],
        E,
      ) +
      shape('M58 218 C72 218 80 228 80 238 C80 250 70 256 58 256 C46 256 36 250 36 238 C36 228 44 218 58 218Z', C.grey) +
      `<circle cx="50" cy="234" r="4.6" fill="${C.white}" ${E}/><circle cx="66" cy="234" r="4.6" fill="${C.white}" ${E}/>` +
      dots(C.ink, 2.2, [
        [51, 234],
        [65, 234],
      ]) +
      `<path d="M44 227 Q50 223 55 227 M61 227 Q66 223 72 227" ${line(2.2, C.ink, 0.7)}/>` +
      `<ellipse cx="58" cy="242" rx="4" ry="3" fill="${C.ink}" opacity=".7"/>` +
      shape('M48 247 Q58 257 68 247 Q58 252 48 247Z', C.ink) +
      `<path d="M52 248.5 L52.5 251 M64 248.5 L63.5 251" ${line(1.4, C.white)}/>`,
  },
  {
    id: 'koinobori',
    name: '鯉魚旗',
    slot: 'buddy',
    rarity: 2,
    icon: '22 194 80 106',
    svg:
      `<path d="M34 297 L34 204" ${line(3, C.brown)}/>` +
      `<circle cx="34" cy="202" r="4" fill="${C.gold}" ${E}/>` +
      `<path d="M36 211 L82 213 M36 215 L80 217" ${line(2.4, C.blue)}/><path d="M36 213 L81 215" ${line(2.4, C.yellow)}/>` +
      shape('M36 222 C52 214 78 216 88 224 L96 218 L94 233 L88 229 C78 237 52 237 36 229Z', C.ink) +
      `<path d="M58 222 Q61 226 58 230 M66 222 Q69 226 66 230 M74 223 Q77 226 74 229" ${line(1.2, C.white, 0.35)}/>` +
      `<circle cx="44" cy="224.5" r="3" fill="${C.white}"/><circle cx="44" cy="224.5" r="1.4" fill="${C.ink}"/>` +
      shape('M36 240 C50 234 70 236 78 242 L85 237 L84 249 L78 246 C70 252 50 252 36 246Z', C.red) +
      `<circle cx="43" cy="242" r="2.6" fill="${C.white}"/><circle cx="43" cy="242" r="1.2" fill="${C.ink}"/>` +
      shape('M36 256 C48 251 64 252 70 257 L76 253 L75 263 L70 260 C64 265 48 265 36 260Z', C.blue) +
      `<circle cx="42" cy="257.5" r="2.2" fill="${C.white}"/><circle cx="42" cy="257.5" r="1" fill="${C.ink}"/>`,
  },
  {
    id: 'hariko-tora',
    name: '張子老虎',
    slot: 'buddy',
    rarity: 2,
    icon: '22 206 76 92',
    svg:
      `<path d="M76 278 C90 276 92 262 86 252" ${line(5, C.yellow)}/>` +
      `<path d="M88 264 L82 263 M89 257 L84 258" ${line(2, C.ink)}/>` +
      shape('M38 290 C34 268 42 256 58 256 C74 256 82 268 78 290Z', C.yellow) +
      shade('M68 258 C76 262 82 272 78 290 L70 290 C74 278 72 266 68 258Z') +
      `<path d="M41 272 L50 270 M40 282 L49 280 M75 272 L66 270 M76 282 L67 280" ${line(2.4)}/>` +
      dots(C.yellow, 6, [
        [40, 226],
        [76, 226],
      ], E) +
      dots(C.ink, 2.6, [
        [40, 226],
        [76, 226],
      ]) +
      shape('M58 222 C76 222 84 232 84 244 C84 256 74 262 58 262 C42 262 32 256 32 244 C32 232 40 222 58 222Z', C.yellow) +
      `<path d="M52 227 L54 233 M58 225 L58 233 M64 227 L62 233 M34 240 L40 242 M34 248 L40 248 M82 240 L76 242 M82 248 L76 248" ${line(2)}/>` +
      `<ellipse cx="50" cy="240" rx="4.4" ry="3.6" fill="${C.white}" ${E}/><ellipse cx="66" cy="240" rx="4.4" ry="3.6" fill="${C.white}" ${E}/>` +
      dots(C.ink, 2, [
        [50, 240],
        [66, 240],
      ]) +
      shape('M49 249 C49 244 67 244 67 249 C67 256 49 256 49 249Z', C.white) +
      `<ellipse cx="58" cy="247" rx="2.6" ry="1.8" fill="${C.red}"/>` +
      `<path d="M54 252 Q58 255 62 252" ${line(1.4, C.red)}/>`,
  },
  {
    id: 'shishimai',
    name: '獅子舞',
    slot: 'buddy',
    rarity: 3,
    icon: '22 202 82 98',
    svg:
      shape('M30 250 C28 270 32 288 40 295 L96 295 C98 280 94 262 86 250Z', C.green) +
      `<path d="M40 270 C44 264 50 268 46 272 M58 282 C62 276 68 280 64 284 M78 266 C82 260 88 264 84 268 M74 286 C78 280 84 284 80 288" ${line(1.8, C.white, 0.85)}/>` +
      shade('M78 252 L86 250 C94 262 98 280 96 295 L84 295 C90 280 86 264 78 252Z') +
      shape('M34 236 C34 220 46 212 60 212 C74 212 86 220 86 236 L86 248 C86 256 78 260 70 258 L50 258 C42 260 34 256 34 248Z', C.red) +
      shade('M74 214 C82 220 86 228 86 236 L86 248 C86 256 78 260 70 258 C78 248 80 228 74 214Z') +
      shape('M30 230 L36 222 L38 236Z', C.gold) +
      shape('M90 230 L84 222 L82 236Z', C.gold) +
      `<path d="M40 221 Q48 214 56 221 M64 221 Q72 214 80 221" ${line(3)}/>` +
      `<circle cx="48" cy="229" r="6" fill="${C.gold}" ${E}/><circle cx="72" cy="229" r="6" fill="${C.gold}" ${E}/>` +
      dots(C.ink, 3, [
        [48, 229],
        [72, 229],
      ]) +
      dots(C.ink, 2.4, [
        [55, 239],
        [65, 239],
      ]) +
      shape('M38 246 L82 246 L80 258 C70 263 50 263 40 258Z', C.red) +
      `<path d="M42 248 L78 248" fill="none" stroke="${C.white}" stroke-width="3" stroke-dasharray="4 2"/>` +
      `<circle cx="60" cy="214" r="3.4" fill="${C.gold}" ${E}/>`,
  },
  {
    id: 'tancho',
    name: '丹頂鶴',
    slot: 'buddy',
    rarity: 2,
    icon: '14 196 86 104',
    svg:
      `<path d="M54 296 L56 262 M64 296 L62 262" ${line(2, C.ink)}/>` +
      `<path d="M50 296 L58 296 M60 296 L68 296" ${line(2, C.ink)}/>` +
      shape('M80 254 C90 254 96 262 92 271 C88 265 84 263 78 263Z', C.ink) +
      shape('M40 262 C40 246 54 238 70 240 C82 242 90 250 88 258 C80 266 56 268 40 262Z', C.white) +
      shade('M70 241 C82 243 90 251 88 258 C82 263 72 265 62 266 C74 260 78 250 70 241Z') +
      shape('M42 251 C38 236 36 226 38 216 L44 216 C44 226 46 236 51 249Z', C.ink) +
      `<circle cx="40" cy="212" r="6" fill="${C.white}" ${E}/>` +
      shape('M36 208 C37 204.5 43 204.5 44 208Z', C.red) +
      shape('M35 211 L20 215 L35 215Z', C.grey) +
      `<circle cx="41" cy="211" r="1.2" fill="${C.ink}"/>`,
  },
]

/** 各縣限定的傳統服裝：去過那個縣之後加進扭蛋 */
const LOCAL: Outfit[] = [
  {
    id: 'aomori-haneto',
    name: '睡魔祭跳人浴衣',
    slot: 'body',
    pref: 'aomori',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.white) +
      shape(SLEEVE_R, C.white) +
      pat(SLEEVE_L, 'doll-kasuri') +
      pat(SLEEVE_R, 'doll-kasuri') +
      shape(ROBE_SHORT, C.white) +
      pat(ROBE_SHORT, 'doll-kasuri') +
      shade(ROBE_SHORT_SHADE) +
      COLLAR(C.pink) +
      shape('M85 196 L155 196 L155 210 L85 210Z', C.pink) +
      shape('M148 206 L158 206 L163 244 L153 244Z', C.pink) +
      `<path d="M96 157 L146 201 M144 157 L94 201" ${line(3.4, C.orange)}/>` +
      dots(
        C.gold,
        2.8,
        [
          [100, 216],
          [110, 218],
          [130, 218],
          [140, 216],
        ],
        E,
      ),
  },
  {
    id: 'akita-hanui',
    name: '西馬音內端縫衣裳',
    slot: 'body',
    pref: 'akita',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape('M92 156 C80 158 70 166 68 180 L67 196 L95 196 L95 170Z', C.red) +
      shape('M67 196 L66 224 C66 231 71 234 78 234 L95 234 L95 196Z', C.green) +
      shape('M148 156 C160 158 170 166 172 180 L173 196 L145 196 L145 170Z', C.yellow) +
      shape('M173 196 L174 224 C174 231 169 234 162 234 L145 234 L145 196Z', C.purple) +
      shade('M145 156 L148 156 C160 158 170 166 172 180 L174 224 C174 231 169 234 162 234 L145 234Z') +
      patchRobe([C.purple, C.red, C.yellow, C.navy, C.pink, C.green, C.orange, C.blue]) +
      shade('M144 151 L153 162 L158 274 L138 274Z') +
      COLLAR(C.cream) +
      shape('M86 196 L154 196 L154 206 L86 206Z', C.navy) +
      `<path d="M120 274 L122 206" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'miyagi-suzume',
    name: '雀舞法被',
    slot: 'body',
    pref: 'miyagi',
    rarity: 2,
    icon: BODY_ICON,
    svg: happi({ base: C.green, collar: C.yellow, text: '雀', textColor: C.white, band: C.yellow }),
  },
  {
    id: 'tokyo-hikeshi',
    name: '町火消半纏',
    slot: 'body',
    pref: 'tokyo',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      happi({ base: C.navy, collar: C.ink, text: 'め組', textColor: C.white, bottom: PANTS, bottomColor: C.navy }) +
      `<path d="M88 220 L153 220 M88 228 L153 228" ${line(2.4, C.white)}/>` +
      `<path d="M68.5 202 L88 205 M152 205 L171.5 202" ${line(3, C.red)}/>`,
  },
  {
    id: 'niigata-ojiya',
    name: '小千谷縮',
    slot: 'body',
    pref: 'niigata',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.navy, pattern: 'doll-stripes', collar: C.white, obi: C.cream, obiLine: C.navy }),
  },
  {
    id: 'toyama-owara',
    name: '風之盆浴衣',
    slot: 'body',
    pref: 'toyama',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.pink, pattern: 'doll-kasuri', collar: C.cream, obi: C.ink, obiLine: C.pink }),
  },
  {
    id: 'aichi-arimatsu',
    name: '有松絞浴衣',
    slot: 'body',
    pref: 'aichi',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.navy, pattern: 'doll-shibori', collar: C.cream, obi: C.yellow, obiLine: C.red }),
  },
  {
    id: 'kyoto-maiko',
    name: '舞妓和服',
    slot: 'body',
    pref: 'kyoto',
    rarity: 3,
    icon: '56 140 128 140',
    svg:
      shape(FURI_L, C.red) +
      shape(FURI_R, C.red) +
      pat(FURI_L, 'doll-yuzen') +
      pat(FURI_R, 'doll-yuzen') +
      shape(ROBE, C.red) +
      pat(ROBE, 'doll-yuzen') +
      shade('M144 151 L153 162 L158 274 L138 274Z') +
      shade(FURI_R) +
      COLLAR(C.red, 6) +
      `<path d="M108 150 L122 192 M132 150 L124 176" ${line(1.4, C.white, 0.9)}/>` +
      shape('M84 184 L156 184 L157 214 L83 214Z', C.gold) +
      `<path d="M84 184 L156 184 L157 214 L83 214Z" fill="url(#doll-kiriko)" opacity=".55"/>` +
      `<path d="M85 187 L155 187" ${line(3, C.red)}/>` +
      `<circle cx="120" cy="205" r="5" fill="${C.gold}" ${E}/><circle cx="120" cy="205" r="2.6" fill="${C.green}"/>` +
      `<path d="M120 274 L122 214" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'wakayama-kumano',
    name: '熊野古道壺裝束',
    slot: 'body',
    pref: 'wakayama',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.purple) +
      shape(SLEEVE_R, C.purple) +
      pat(SLEEVE_L, 'doll-sakura') +
      pat(SLEEVE_R, 'doll-sakura') +
      shape(ROBE_SHORT, C.purple) +
      pat(ROBE_SHORT, 'doll-sakura') +
      shade(ROBE_SHORT_SHADE) +
      shade(SLEEVE_R) +
      COLLAR(C.cream) +
      shape('M86 198 L154 198 L154 205 L86 205Z', C.brown) +
      `<path d="M98 154 L148 212" ${line(4.5, C.red)}/>` +
      `<circle cx="148" cy="212" r="3.4" fill="${C.red}" ${E}/>`,
  },
  {
    id: 'fukuoka-kurume',
    name: '久留米絣',
    slot: 'body',
    pref: 'fukuoka',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      pat(PANTS, 'doll-kasuri-w') +
      `<path d="M96 270 L115 270 M125 270 L144 270" ${line(2, C.ink, 0.35)}/>` +
      shape('M96 151 L144 151 L150 156 L170 162 L172 214 L152 214 L152 238 L88 238 L88 214 L68 214 L70 162 L90 156Z', C.navy) +
      pat('M96 151 L144 151 L150 156 L170 162 L172 214 L152 214 L152 238 L88 238 L88 214 L68 214 L70 162 L90 156Z', 'doll-kasuri-w') +
      shade('M138 151 L144 151 L150 156 L170 162 L172 214 L152 214 L152 238 L138 238Z') +
      `<path d="M106 151 L126 206 M134 151 L118 190" ${line(3.4, C.cream)}/>` +
      `<path d="M88 226 L152 226" ${line(3, C.red)}/>`,
  },
  {
    id: 'kagoshima-oshima',
    name: '大島紬和服',
    slot: 'body',
    pref: 'kagoshima',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.brown, pattern: 'doll-kiriko', collar: C.cream, obi: C.cream, obiLine: C.red }),
  },
  {
    id: 'okinawa-bingata',
    name: '紅型琉裝',
    slot: 'body',
    pref: 'okinawa',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.yellow) +
      shape(SLEEVE_R, C.yellow) +
      pat(SLEEVE_L, 'doll-bingata') +
      pat(SLEEVE_R, 'doll-bingata') +
      shape(ROBE, C.yellow) +
      pat(ROBE, 'doll-bingata') +
      shade('M144 151 L153 162 L158 274 L138 274Z') +
      shade(SLEEVE_R) +
      `<path d="M104 150 L124 210 M136 150 L126 186" ${line(7, C.red)}/>` +
      `<path d="M104 150 L124 210 M136 150 L126 186" ${line(1.6, C.yellow)}/>` +
      `<path d="M120 274 L124 210" ${line(1.4, C.ink, 0.25)}/>`,
  },
]

export const WA_OUTFITS: Outfit[] = [...BODY, ...HEAD, ...FACE, ...HAND, ...BUDDY]
export const LOCAL_OUTFITS: Outfit[] = LOCAL
