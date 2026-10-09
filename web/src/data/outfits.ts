/**
 * 紙娃娃（DESIGN.md §7.24）：角色的部位與服裝。SVG 畫在 240×320 的畫布上（PaperDoll.vue），
 * 畫風是剪紙的紙人形：平塗、不描黑邊，只用同色的淡邊與一層陰影、一層亮面；整隻外面一圈白邊（剪下來的紙）。
 * 顏色一律用 theme.css 的 `--color-doll-*`、`--color-item-*` token；花紋用 DollDefs.vue 的 <pattern>。
 * 服裝分五個位置：頭（帽子、髮箍）、臉（眼鏡）、身（衣服）、手（拿的東西，在右手）、夥伴（腳邊）。
 * 各縣的特色單品去過那個縣就有；幾個大的成就各送 1 件（outfitsAchv.ts）；其他的用抽獎券抽。
 */
import { C, dots, E, line, SH, shape } from './dollArt'
import { ACHV_OUTFITS } from './outfitsAchv'
import { PREF_OUTFITS } from './outfitsPref'

export type Slot = 'head' | 'face' | 'body' | 'hand' | 'buddy'
export const SLOTS: Array<{ key: Slot; label: string }> = [
  { key: 'body', label: '衣服' },
  { key: 'head', label: '頭上' },
  { key: 'face', label: '臉上' },
  { key: 'hand', label: '手上' },
  { key: 'buddy', label: '夥伴' },
]

export interface Outfit {
  id: string
  name: string
  slot: Slot
  /** 去過這個縣就有；沒有的是抽的 */
  pref?: string
  /** 抽到的機率權重：1 常見、2 少見、3 稀有 */
  rarity: 1 | 2 | 3
  /** 單品本身的 SVG（放在 PaperDoll 的 <g> 裡） */
  svg: string
  /** 小圖的裁切範圍 viewBox：x y w h */
  icon: string
  /** 那個縣的代表單品：第一次去那個縣就送；同縣的其他單品加進扭蛋 */
  gift?: boolean
  /** 成就服裝：這個成就（data/achievements.ts 的 id）達成就有，不進扭蛋 */
  achv?: string
}

// ---------- 身體的部位 ----------
/** 膚色、髮色的 token 號碼（--color-doll-skin-n、--color-doll-hair-n）；陣列順序就是選項的排列（淺到深） */
export const SKINS = [4, 1, 2, 5, 3, 6] as const
export type Skin = (typeof SKINS)[number]
export const HAIR_COLORS = [1, 2, 3, 6, 4, 7, 5, 8, 9] as const
export type HairColor = (typeof HAIR_COLORS)[number]
export type HairStyle = 'short' | 'bob' | 'long' | 'bun' | 'ponytail' | 'buzz' | 'spiky' | 'sidepart' | 'curly' | 'wavy' | 'twintails' | 'twinbuns' | 'braid'
export type EyeStyle = 'round' | 'happy' | 'calm' | 'wink' | 'lashes' | 'dot' | 'sharp' | 'sleepy'
export const HAIR_STYLES: Array<{ key: HairStyle; label: string }> = [
  { key: 'bob', label: '妹妹頭' },
  { key: 'short', label: '短髮' },
  { key: 'buzz', label: '平頭' },
  { key: 'spiky', label: '刺刺頭' },
  { key: 'sidepart', label: '旁分' },
  { key: 'curly', label: '捲髮' },
  { key: 'long', label: '長髮' },
  { key: 'wavy', label: '波浪長髮' },
  { key: 'bun', label: '丸子頭' },
  { key: 'twinbuns', label: '雙丸子' },
  { key: 'ponytail', label: '馬尾' },
  { key: 'twintails', label: '雙馬尾' },
  { key: 'braid', label: '麻花辮' },
]
export const EYE_STYLES: Array<{ key: EyeStyle; label: string }> = [
  { key: 'round', label: '圓眼' },
  { key: 'dot', label: '豆豆眼' },
  { key: 'lashes', label: '睫毛' },
  { key: 'sharp', label: '鳳眼' },
  { key: 'happy', label: '笑眼' },
  { key: 'calm', label: '瞇眼' },
  { key: 'sleepy', label: '睡眼' },
  { key: 'wink', label: '眨眼' },
]

const H = 'var(--hair)'
const HAIR_SHINE = `<path d="M90 58 C102 49 118 46 134 48" ${line(4, C.white, 0.28)}/>`
// 共用的瀏海：齊瀏海（姬髮式），兩側垂到 side
const FRINGE = (side: number) =>
  `M120 38 C153 38 178 62 177 100 L175 ${side} C174 ${side + 6} 166 ${side + 6} 166 ${side} L163 90 C146 82 94 82 77 90 L74 ${side} C74 ${side + 6} 66 ${side + 6} 65 ${side} L63 100 C62 62 87 38 120 38Z`

/** 頭髮：後面那層（畫在身體之前）與前面的瀏海（畫在臉之後） */
export const HAIR: Record<HairStyle, { back: string; front: string }> = {
  bob: {
    back: shape('M62 100 C62 62 88 38 120 38 C152 38 178 62 178 100 L181 150 C181 157 175 159 169 156 L71 156 C65 159 59 157 59 150Z', H),
    front: shape(FRINGE(140), H) + HAIR_SHINE,
  },
  short: {
    back: shape('M66 100 C64 62 90 40 120 40 C150 40 176 62 174 100 L172 126 L68 126Z', H),
    front:
      shape('M120 38 C154 38 180 62 176 106 C172 94 166 88 160 86 C150 94 128 98 106 92 C96 90 90 86 86 82 C78 90 72 98 66 110 C60 66 86 38 120 38Z', H) +
      shape('M66 104 L64 124 C64 128 70 128 70 124 L72 100Z', H) +
      shape('M174 104 L176 124 C176 128 170 128 170 124 L168 100Z', H) +
      HAIR_SHINE,
  },
  long: {
    back: shape('M60 100 C60 60 88 38 120 38 C152 38 180 60 180 100 L186 226 C186 234 178 237 170 233 L70 233 C62 237 54 234 54 226Z', H),
    front: shape(FRINGE(176), H) + HAIR_SHINE,
  },
  bun: {
    back: `<circle cx="120" cy="32" r="18" fill="${H}" ${E}/><path d="M106 45 C112 49 128 49 134 45" ${line(3, C.red)}/>`,
    front: shape(FRINGE(112), H) + HAIR_SHINE,
  },
  buzz: {
    back: shape('M63 104 C61 60 89 38 120 38 C151 38 179 60 177 104 C176 110 172 112 168 108 L72 108 C68 112 64 110 63 104Z', H),
    front:
      shape('M68 96 C66 62 90 42 120 42 C150 42 174 62 172 96 C166 82 156 74 144 71 C128 67 112 67 96 71 C84 74 74 82 68 96Z', H) +
      shape('M66 96 L67 112 C67 116 72 116 72 112 L72 94Z', H) +
      shape('M174 96 L173 112 C173 116 168 116 168 112 L168 94Z', H) +
      HAIR_SHINE,
  },
  spiky: {
    back: shape('M62 118 L58 92 L46 86 L62 74 L52 56 L74 58 L74 36 L94 46 L104 22 L120 38 L136 22 L146 46 L166 36 L166 58 L188 56 L178 74 L194 86 L182 92 L178 118Z', H),
    front:
      shape('M120 38 C152 38 176 60 176 98 L170 90 L166 102 L156 86 L150 100 L140 84 L132 100 L120 82 L108 100 L100 84 L90 100 L84 86 L74 102 L70 90 L64 98 C64 60 88 38 120 38Z', H) +
      HAIR_SHINE,
  },
  sidepart: {
    back: shape('M62 100 C62 62 88 38 120 38 C152 38 178 62 178 100 L180 146 C180 152 174 154 170 150 L70 150 C66 154 60 152 60 146Z', H),
    front:
      shape('M120 38 C154 38 180 62 178 104 L178 146 C178 153 169 153 169 146 L166 100 C148 98 118 90 98 74 L90 68 C84 80 76 92 72 104 L72 138 C72 145 63 145 63 138 L62 104 C60 62 86 38 120 38Z', H) +
      `<path d="M91 50 C90 56 90 62 90 68" ${line(1.6, C.ink, 0.22)}/>` +
      `<path d="M102 52 C118 50 140 54 156 64" ${line(4, C.white, 0.28)}/>`,
  },
  curly: {
    back:
      shape('M60 100 C60 60 88 36 120 36 C152 36 180 60 180 100 L182 150 L58 150Z', H) +
      dots(H, 14, [[60, 150], [58, 128], [60, 106], [64, 84], [74, 64], [90, 48], [108, 38], [132, 38], [150, 48], [166, 64], [176, 84], [180, 106], [182, 128], [180, 150]], E),
    front:
      shape('M66 100 C64 60 90 40 120 40 C150 40 176 60 174 100 L160 88 L80 88Z', H) +
      dots(H, 11, [[74, 94], [88, 86], [104, 82], [120, 80], [136, 82], [152, 86], [166, 94]], E) +
      `<path d="M96 52 C106 46 120 44 132 46" ${line(4, C.white, 0.28)}/>`,
  },
  wavy: {
    back: shape('M60 100 C60 60 88 38 120 38 C152 38 180 60 180 100 C186 120 176 136 184 156 C192 176 180 192 188 212 C192 226 184 236 172 232 L68 232 C56 236 48 226 52 212 C60 192 48 176 56 156 C64 136 54 120 60 100Z', H),
    front:
      shape('M120 38 C152 38 178 62 178 100 C182 120 174 140 180 160 C182 170 172 174 168 166 C164 150 172 128 168 104 C168 80 148 62 126 59 L120 52 L114 59 C92 62 72 80 72 104 C68 128 76 150 72 166 C68 174 58 170 60 160 C66 140 58 120 62 100 C62 62 88 38 120 38Z', H) +
      `<path d="M112 46 C102 54 90 62 80 74" ${line(3.4, C.white, 0.26)}/>`,
  },
  twintails: {
    back:
      shape('M170 76 C204 84 212 128 202 172 C199 182 188 182 188 172 C194 136 188 108 168 94Z', H) +
      shape('M70 76 C36 84 28 128 38 172 C41 182 52 182 52 172 C46 136 52 108 72 94Z', H),
    front:
      shape(FRINGE(118), H) +
      `<circle cx="70" cy="82" r="7" fill="${C.red}" ${E}/><circle cx="170" cy="82" r="7" fill="${C.red}" ${E}/>` +
      HAIR_SHINE,
  },
  twinbuns: {
    back:
      `<circle cx="78" cy="46" r="17" fill="${H}" ${E}/><circle cx="162" cy="46" r="17" fill="${H}" ${E}/>` +
      `<path d="M66 58 C72 63 84 64 92 60" ${line(3, C.red)}/><path d="M174 58 C168 63 156 64 148 60" ${line(3, C.red)}/>`,
    front: shape(FRINGE(112), H) + HAIR_SHINE,
  },
  braid: {
    back: shape('M62 100 C62 62 88 38 120 38 C152 38 178 62 178 100 L178 132 L62 132Z', H),
    front:
      shape('M120 38 C154 38 180 62 177 104 C170 92 160 86 148 86 C130 86 104 92 84 100 C78 102 72 106 66 112 C60 66 86 38 120 38Z', H) +
      shape('M66 104 L65 130 C65 135 72 135 72 130 L74 98Z', H) +
      [[164, 128], [166, 146], [167, 164], [167, 182], [166, 199]]
        .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="${y > 190 ? 8 : 10}" ry="11" fill="${H}" ${E}/><path d="M${x! - 6} ${y! - 4} Q${x} ${y! + 4} ${x! + 6} ${y! - 4}" ${line(1.5, C.ink, 0.22)}/>`)
        .join('') +
      `<path d="M159 208 L173 208" ${line(4, C.red)}/>` +
      shape('M162 210 C160 220 172 220 170 210Z', H) +
      HAIR_SHINE,
  },
  ponytail: {
    back:
      shape('M158 60 C196 62 206 110 196 158 C193 168 182 168 182 158 C188 122 182 94 160 80Z', H) +
      `<circle cx="164" cy="64" r="7" fill="${C.red}" ${E}/>`,
    front:
      shape('M120 38 C154 38 180 62 177 104 C170 92 160 86 148 86 C130 86 104 92 84 100 C78 102 72 106 66 112 C60 66 86 38 120 38Z', H) +
      shape('M66 104 L65 132 C65 137 72 137 72 132 L74 98Z', H) +
      HAIR_SHINE,
  },
}

export const EYES: Record<EyeStyle, string> = {
  round:
    `<ellipse cx="102" cy="110" rx="4.6" ry="5.8" fill="${C.ink}"/><ellipse cx="138" cy="110" rx="4.6" ry="5.8" fill="${C.ink}"/>` +
    `<circle cx="103.8" cy="107.6" r="1.7" fill="${C.white}"/><circle cx="139.8" cy="107.6" r="1.7" fill="${C.white}"/>`,
  happy: `<path d="M96 112 Q102 104 108 112" ${line(2.8)}/><path d="M132 112 Q138 104 144 112" ${line(2.8)}/>`,
  calm: `<path d="M96 109 Q102 114 108 109" ${line(2.6)}/><path d="M132 109 Q138 114 144 109" ${line(2.6)}/>`,
  wink:
    `<ellipse cx="102" cy="110" rx="4.6" ry="5.8" fill="${C.ink}"/><circle cx="103.8" cy="107.6" r="1.7" fill="${C.white}"/>` +
    `<path d="M132 111 Q138 104 144 111" ${line(2.8)}/>`,
  lashes:
    `<ellipse cx="102" cy="110" rx="4.6" ry="5.8" fill="${C.ink}"/><ellipse cx="138" cy="110" rx="4.6" ry="5.8" fill="${C.ink}"/>` +
    `<circle cx="103.8" cy="107.6" r="1.7" fill="${C.white}"/><circle cx="139.8" cy="107.6" r="1.7" fill="${C.white}"/>` +
    `<path d="M97.6 106 L93.6 102.6 M97.2 109 L92.8 108" ${line(1.7)}/><path d="M142.4 106 L146.4 102.6 M142.8 109 L147.2 108" ${line(1.7)}/>`,
  dot: `<circle cx="102" cy="111" r="3.4" fill="${C.ink}"/><circle cx="138" cy="111" r="3.4" fill="${C.ink}"/>`,
  sharp:
    `<path d="M95 107.5 C99 104.6 105.5 105.4 109 110 C106 114.2 99 114.6 96.6 111.6 C95.6 110.4 95 109 95 107.5Z" fill="${C.ink}"/>` +
    `<path d="M145 107.5 C141 104.6 134.5 105.4 131 110 C134 114.2 141 114.6 143.4 111.6 C144.4 110.4 145 109 145 107.5Z" fill="${C.ink}"/>` +
    `<circle cx="102.6" cy="108.6" r="1.4" fill="${C.white}"/><circle cx="138.6" cy="108.6" r="1.4" fill="${C.white}"/>`,
  sleepy:
    `<path d="M96 109 C96 116 108 116 108 109Z" fill="${C.ink}"/><path d="M132 109 C132 116 144 116 144 109Z" fill="${C.ink}"/>` +
    `<path d="M94.5 108.4 Q102 110.6 109.5 108.4" ${line(2.2)}/><path d="M130.5 108.4 Q138 110.6 145.5 108.4" ${line(2.2)}/>`,
}

// ---------- 服裝 ----------
// 上衣：肩到腰，短袖蓋到手肘
const TOP = 'M98 151 L142 151 C153 153 161 158 165 167 L170 188 L151 192 L151 240 L89 240 L89 192 L70 188 L75 167 C79 158 87 153 98 151Z'
const TOP_SHADE = 'M140 151 C153 153 161 158 165 167 L170 188 L151 192 L151 240 L138 240Z'
// 作務衣：袖子到手腕
const TOP_LONG = 'M98 151 L142 151 C153 153 161 158 165 167 L172 208 L151 210 L151 240 L89 240 L89 210 L68 208 L75 167 C79 158 87 153 98 151Z'
// 長褲、短褲
const PANTS = 'M89 234 L151 234 L152 244 L145 274 L124 274 L121.5 250 L118.5 250 L116 274 L95 274 L88 244Z'
const SHORTS = 'M89 234 L151 234 L154 256 L124 258 L121 246 L119 246 L116 258 L86 256Z'
// 和服形（浴衣）：到腳踝，袂垂到腰下
const ROBE = 'M96 151 L144 151 L153 162 L158 274 L82 274 L87 162Z'
const SLEEVE_L = 'M92 156 C80 158 70 166 68 180 L66 224 C66 231 71 234 78 234 L95 234 L95 170Z'
const SLEEVE_R = 'M148 156 C160 158 170 166 172 180 L174 224 C174 231 169 234 162 234 L145 234 L145 170Z'
const NECK = `<path d="M108 151 Q120 159 132 151" ${line(1.6, C.ink, 0.25)}/>`

export const OUTFITS: Outfit[] = [
  // ----- 抽的 -----
  {
    id: 'tee',
    name: '白 T 恤',
    slot: 'body',
    rarity: 1,
    icon: '58 140 124 140',
    svg: shape(PANTS, C.blue) + `<path d="M120 240 L120 250" ${line(1.4, C.ink, 0.3)}/>` + shape(TOP, C.cream) + `<path d="${TOP_SHADE}" ${SH}/>` + NECK,
  },
  {
    id: 'tee-navy',
    name: '藏青 T 恤',
    slot: 'body',
    rarity: 1,
    icon: '58 140 124 140',
    svg: shape(SHORTS, C.grey) + shape(TOP, C.navy) + `<path d="${TOP_SHADE}" ${SH}/>` + NECK + `<path d="M100 200 L140 200" ${line(5, C.cream, 0.9)}/>`,
  },
  {
    id: 'yukata',
    name: '浴衣',
    slot: 'body',
    rarity: 2,
    icon: '58 140 124 140',
    svg:
      shape(SLEEVE_L, C.blue) +
      shape(SLEEVE_R, C.blue) +
      `<path d="${SLEEVE_L}" fill="url(#doll-dots)"/><path d="${SLEEVE_R}" fill="url(#doll-dots)"/>` +
      shape(ROBE, C.blue) +
      `<path d="${ROBE}" fill="url(#doll-dots)"/>` +
      `<path d="M144 151 L153 162 L158 274 L138 274Z" ${SH}/>` +
      `<path d="M106 150 L122 196 M134 150 L124 178" ${line(5, C.cream)}/>` +
      shape('M86 190 L154 190 L155 212 L85 212Z', C.yellow) +
      `<path d="M86 201 L154 201" ${line(1.6, C.red)}/>` +
      `<path d="M120 274 L122 212" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'happi',
    name: '法被',
    slot: 'body',
    rarity: 2,
    icon: '58 140 124 140',
    svg:
      shape(SHORTS, C.cream) +
      shape('M98 151 L142 151 C154 153 163 160 167 170 L172 204 L152 206 L153 246 L87 246 L88 206 L68 204 L73 170 C77 160 86 153 98 151Z', C.navy) +
      `<path d="M140 151 C154 153 163 160 167 170 L172 204 L152 206 L153 246 L138 246Z" ${SH}/>` +
      `<path d="M106 150 L114 246 M134 150 L126 246" ${line(9, C.red)}/>` +
      `<text x="110" y="200" font-size="9" font-weight="900" fill="${C.white}" text-anchor="middle" font-family="var(--font-ja)">祭</text>` +
      `<path d="M88 236 L153 236" ${line(3, C.white, 0.85)}/>`,
  },
  {
    id: 'samue',
    name: '作務衣',
    slot: 'body',
    rarity: 2,
    icon: '58 140 124 140',
    svg:
      shape(PANTS, C.matcha) +
      `<path d="${PANTS}" ${SH}/>` +
      shape(TOP_LONG, C.matcha) +
      `<path d="M106 150 L132 214 M134 150 L114 192" ${line(2, C.ink, 0.35)}/>` +
      `<path d="M128 204 L138 212 M128 204 L136 198" ${line(2, C.cream)}/>`,
  },
  {
    id: 'cap',
    name: '棒球帽',
    slot: 'head',
    rarity: 1,
    icon: '50 14 140 84',
    svg:
      shape('M68 78 C66 42 92 30 120 30 C148 30 174 42 172 78Z', C.blue) +
      `<path d="M140 32 C162 38 174 54 172 78 L150 78Z" ${SH}/>` +
      shape('M62 76 C90 86 150 86 178 76 C182 80 180 86 176 88 C150 96 90 96 64 88 C60 86 58 80 62 76Z', C.navy) +
      `<circle cx="120" cy="31" r="4" fill="${C.navy}"/>` +
      `<path d="M120 33 L120 76" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'sugegasa',
    name: '斗笠',
    slot: 'head',
    rarity: 2,
    icon: '24 6 192 92',
    svg:
      shape('M120 14 L212 74 C190 84 50 84 28 74Z', C.yellow) +
      `<path d="M120 14 L212 74 C200 79 160 82 120 82Z" ${SH}/>` +
      `<path d="M120 14 L68 79 M120 14 L94 81 M120 14 L146 81 M120 14 L172 79" ${line(1.2, C.brown, 0.5)}/>` +
      `<path d="M74 80 C84 120 100 140 112 150 M166 80 C156 120 140 140 128 150" ${line(1.6, C.red, 0.8)}/>`,
  },
  {
    id: 'beret',
    name: '貝雷帽',
    slot: 'head',
    rarity: 2,
    icon: '50 10 140 84',
    svg:
      shape('M62 74 C52 46 84 26 124 28 C166 30 188 50 178 70 C170 80 150 70 120 70 C92 70 72 82 62 74Z', C.red) +
      `<path d="M150 32 C172 40 186 54 178 70 C170 78 158 72 146 70Z" ${SH}/>` +
      `<path d="M124 28 L128 18" ${line(3, C.red)}/>`,
  },
  {
    id: 'glasses',
    name: '圓眼鏡',
    slot: 'face',
    rarity: 1,
    icon: '76 88 88 44',
    svg:
      `<circle cx="102" cy="110" r="11" fill="${C.white}" opacity=".18"/><circle cx="138" cy="110" r="11" fill="${C.white}" opacity=".18"/>` +
      `<circle cx="102" cy="110" r="11" ${line(2.6, C.brown)}/><circle cx="138" cy="110" r="11" ${line(2.6, C.brown)}/>` +
      `<path d="M113 108 Q120 104 127 108 M91 107 L78 104 M149 107 L162 104" ${line(2.4, C.brown)}/>`,
  },
  {
    id: 'sunglasses',
    name: '太陽眼鏡',
    slot: 'face',
    rarity: 2,
    icon: '76 88 88 44',
    svg:
      shape('M88 102 L114 102 L112 116 C106 122 94 122 90 116Z', C.navy) +
      shape('M126 102 L152 102 L150 116 C146 122 134 122 128 116Z', C.navy) +
      `<path d="M92 106 L100 106 M130 106 L138 106" ${line(2, C.white, 0.6)}/>` +
      `<path d="M114 104 L126 104 M88 103 L78 100 M152 103 L162 100" ${line(2.4, C.navy)}/>`,
  },
  {
    id: 'camera',
    name: '相機',
    slot: 'hand',
    rarity: 1,
    icon: '128 182 72 60',
    svg:
      `<path d="M98 152 C110 180 132 196 146 206" ${line(1.8, C.brown)}/>` +
      shape('M140 202 L184 202 C187 202 189 204 189 207 L189 228 C189 231 187 233 184 233 L140 233 C137 233 135 231 135 228 L135 207 C135 204 137 202 140 202Z', C.grey) +
      shape('M146 196 L160 196 L162 202 L144 202Z', C.grey) +
      `<path d="M135 214 L189 214 L189 228 C189 231 187 233 184 233 L140 233 C137 233 135 231 135 228Z" fill="${C.ink}" opacity=".7"/>` +
      `<circle cx="164" cy="217" r="10" fill="${C.navy}" ${E}/><circle cx="164" cy="217" r="5" fill="${C.blue}"/><circle cx="161.5" cy="214.5" r="1.8" fill="${C.white}"/>` +
      `<circle cx="181" cy="207" r="2.4" fill="${C.red}"/>`,
  },
  {
    id: 'wagasa',
    name: '和傘',
    slot: 'hand',
    rarity: 2,
    icon: '128 72 112 168',
    svg:
      `<path d="M158 226 L184 124" ${line(3, C.brown)}/>` +
      shape('M136 126 C140 96 162 82 184 82 C206 82 228 96 232 126 C221 120 210 120 199 126 C188 120 177 120 166 126 C156 120 146 120 136 126Z', C.red) +
      `<path d="M184 82 C206 82 228 96 232 126 C221 120 210 120 199 126 C194 112 190 96 184 82Z" ${SH}/>` +
      `<path d="M146 110 C164 100 204 100 222 110" ${line(4, C.cream, 0.9)}/>` +
      `<path d="M184 82 L136 126 M184 82 L166 126 M184 82 L199 126 M184 82 L232 126" ${line(1, C.ink, 0.25)}/>` +
      `<circle cx="184" cy="81" r="3.4" fill="${C.ink}"/>`,
  },
  {
    id: 'goshuincho',
    name: '御朱印帳',
    slot: 'hand',
    rarity: 2,
    icon: '130 182 66 66',
    svg:
      shape('M142 192 L182 190 C184 190 186 192 186 194 L188 238 C188 240 186 242 184 242 L144 244 C142 244 140 242 140 240 L138 196 C138 194 140 192 142 192Z', C.purple) +
      `<path d="M142 192 L182 190 L188 238 L144 244Z" fill="url(#doll-asanoha)" opacity=".55"/>` +
      shape('M168 198 L180 197.5 L182 228 L170 228.5Z', C.cream) +
      `<path d="M172 205 L178 205 M172 211 L178 211 M172 217 L178 217" ${line(1.4, C.ink, 0.5)}/>`,
  },
  {
    id: 'fan',
    name: '團扇',
    slot: 'hand',
    rarity: 1,
    icon: '128 160 72 84',
    svg:
      `<path d="M158 226 L162 204" ${line(4, C.brown)}/>` +
      shape('M163 166 C184 166 196 180 194 196 C192 208 178 214 164 212 C148 210 138 198 140 184 C142 172 150 166 163 166Z', C.cream) +
      `<path d="M163 166 C184 166 196 180 194 196 C192 208 178 214 164 212 Z" ${SH}/>` +
      `<path d="M150 186 C156 178 164 182 166 188 C170 196 160 200 156 194" ${line(3, C.red)}/>` +
      `<path d="M168 178 L176 172 M170 196 L182 194" ${line(2.4, C.blue, 0.7)}/>`,
  },
  {
    id: 'maneki',
    name: '招財貓',
    slot: 'buddy',
    rarity: 3,
    icon: '22 218 78 80',
    svg:
      shape('M38 292 C34 268 42 258 58 258 C74 258 82 268 78 292Z', C.white) +
      shape('M58 230 C72 230 78 240 78 250 C78 262 70 268 58 268 C46 268 38 262 38 250 C38 240 44 230 58 230Z', C.white) +
      shape('M42 240 L42 222 L54 232Z', C.white) +
      shape('M74 240 L74 222 L62 232Z', C.white) +
      `<path d="M44 236 L44 228 L50 233Z M72 236 L72 228 L66 233Z" fill="${C.pink}"/>` +
      shape('M76 262 C84 258 86 246 82 240 C78 236 72 240 74 246Z', C.white) +
      `<path d="M50 248 Q53 245 56 248 M60 248 Q63 245 66 248" ${line(1.8)}/>` +
      `<path d="M56 254 Q58 256 60 254" ${line(1.4)}/>` +
      `<path d="M42 268 C52 272 64 272 74 268" ${line(4, C.red)}/>` +
      `<circle cx="58" cy="274" r="4" fill="${C.gold}" ${E}/>` +
      `<ellipse cx="66" cy="284" rx="6" ry="4" fill="${C.orange}" opacity=".85"/><ellipse cx="46" cy="280" rx="5" ry="3.5" fill="${C.ink}" opacity=".75"/>`,
  },
  {
    id: 'daruma',
    name: '達摩',
    slot: 'buddy',
    rarity: 2,
    icon: '22 226 76 76',
    svg:
      shape('M58 234 C78 234 88 252 86 272 C84 288 74 294 58 294 C42 294 32 288 30 272 C28 252 38 234 58 234Z', C.red) +
      `<path d="M72 238 C82 246 88 260 86 274 C84 288 76 294 66 294 C76 280 78 258 72 238Z" ${SH}/>` +
      shape('M58 246 C68 246 74 252 74 260 C74 268 68 272 58 272 C48 272 42 268 42 260 C42 252 48 246 58 246Z', C.cream) +
      `<circle cx="52" cy="258" r="3.4" fill="${C.ink}"/><circle cx="64" cy="258" r="3.4" ${line(1.6)}/>` +
      `<path d="M48 252 Q52 249 56 252 M60 252 Q64 249 68 252" ${line(1.8)}/>` +
      `<path d="M46 280 Q58 286 70 280" ${line(2.2, C.gold)}/>`,
  },

  ...ACHV_OUTFITS,
  ...PREF_OUTFITS,
]

export const outfitById = new Map(OUTFITS.map((o) => [o.id, o]))
/** 這個縣的代表單品 */
export function giftOf(pref: string): Outfit | undefined {
  return OUTFITS.find((o) => o.pref === pref && o.gift)
}
/** 這個成就送的服裝 */
export function achvOutfitOf(achvId: string): Outfit | undefined {
  return OUTFITS.find((o) => o.achv === achvId)
}
/** 預設穿的（沒有存檔時） */
export const DEFAULT_EQUIPPED: Partial<Record<Slot, string>> = { body: 'tee' }
/** 一開始就有的 */
export const STARTER_IDS = ['tee']
