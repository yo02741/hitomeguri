/**
 * 紙娃娃（DESIGN.md §7.24）：角色的部位與服裝。SVG 畫在 240×320 的畫布上（PaperDoll.vue），
 * 畫風是剪紙的紙人形：平塗、不描黑邊，只用同色的淡邊與一層陰影、一層亮面；整隻外面一圈白邊（剪下來的紙）。
 * 顏色一律用 theme.css 的 `--color-doll-*`、`--color-item-*` token；花紋用 DollDefs.vue 的 <pattern>。
 * 服裝分五個位置：頭（帽子、髮箍）、臉（眼鏡）、身（衣服）、手（拿的東西，在右手）、夥伴（腳邊）。
 * 各縣的特色單品去過那個縣就有；其他的用旅行得到的抽獎機會抽。
 */
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
}

const C = {
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
const E = 'stroke="var(--color-doll-line)" stroke-opacity=".2" stroke-width="1.4" stroke-linejoin="round"'
/** 陰影：疊一層半透明 */
const SH = 'fill="var(--color-doll-line)" opacity=".16"'
const line = (w = 2.4, color = C.ink, op = 1) => `fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${op}"`
const shape = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${E} ${extra}/>`
const dots = (fill: string, r: number, pts: Array<[number, number]>, extra = '') => `<g fill="${fill}" ${extra}>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`

// ---------- 身體的部位 ----------
export const SKINS = [1, 2, 3] as const
export const HAIR_COLORS = [1, 2, 3, 4, 5] as const
export type HairStyle = 'short' | 'bob' | 'long' | 'bun' | 'ponytail'
export type EyeStyle = 'round' | 'happy' | 'calm'
export const HAIR_STYLES: Array<{ key: HairStyle; label: string }> = [
  { key: 'bob', label: '妹妹頭' },
  { key: 'short', label: '短髮' },
  { key: 'long', label: '長髮' },
  { key: 'bun', label: '丸子頭' },
  { key: 'ponytail', label: '馬尾' },
]
export const EYE_STYLES: Array<{ key: EyeStyle; label: string }> = [
  { key: 'round', label: '圓眼' },
  { key: 'happy', label: '笑眼' },
  { key: 'calm', label: '瞇眼' },
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

  // ----- 各縣的特色單品：去過就有 -----
  {
    id: 'hokkaido-melon',
    name: '哈密瓜帽',
    slot: 'head',
    pref: 'hokkaido',
    rarity: 2,
    icon: '50 6 140 90',
    svg:
      shape('M64 80 C60 42 88 26 120 26 C152 26 180 42 176 80 C150 86 90 86 64 80Z', C.green) +
      `<path d="M64 80 C60 42 88 26 120 26 C152 26 180 42 176 80 C150 86 90 86 64 80Z" fill="url(#doll-net)" opacity=".7"/>` +
      `<path d="M140 30 C164 38 178 56 176 80 C164 83 150 84 140 84Z" ${SH}/>` +
      `<path d="M118 26 L114 14" ${line(3.4, C.brown)}/>` +
      shape('M114 18 C104 10 94 14 92 20 C102 22 108 22 114 18Z', C.matcha),
  },
  {
    id: 'miyagi-zunda',
    name: '毛豆麻糬',
    slot: 'hand',
    rarity: 2,
    pref: 'miyagi',
    icon: '130 182 70 60',
    svg:
      shape('M136 224 C136 216 192 216 192 224 C192 232 136 232 136 224Z', C.cream) +
      shape('M146 216 C144 202 158 194 164 194 C172 194 186 202 182 216 C176 222 152 222 146 216Z', C.matcha) +
      `<g fill="${C.green}"><ellipse cx="156" cy="204" rx="4" ry="3"/><ellipse cx="168" cy="200" rx="4" ry="3"/><ellipse cx="174" cy="210" rx="4" ry="3"/><ellipse cx="160" cy="213" rx="4" ry="3"/></g>` +
      `<path d="M150 200 C154 196 160 195 164 195" ${line(2, C.white, 0.5)}/>`,
  },
  {
    id: 'tokyo-chochin',
    name: '提燈',
    slot: 'hand',
    pref: 'tokyo',
    rarity: 2,
    icon: '128 154 84 92',
    svg:
      `<path d="M156 226 L170 160 L170 168" ${line(3, C.brown)}/>` +
      shape('M156 168 L184 168 L186 174 L154 174Z', C.ink) +
      shape('M170 172 C192 172 198 190 198 204 C198 218 192 236 170 236 C148 236 142 218 142 204 C142 190 148 172 170 172Z', C.red) +
      `<path d="M182 174 C194 180 198 192 198 204 C198 218 192 232 180 236 C188 222 190 190 182 174Z" ${SH}/>` +
      `<path d="M144 190 L196 190 M142 204 L198 204 M144 218 L196 218" ${line(1, C.ink, 0.3)}/>` +
      `<text x="170" y="210" font-size="16" font-weight="900" fill="${C.cream}" text-anchor="middle" font-family="var(--font-ja)">祭</text>` +
      shape('M156 234 L184 234 L186 240 L154 240Z', C.ink),
  },
  {
    id: 'yamanashi-budo',
    name: '葡萄',
    slot: 'hand',
    pref: 'yamanashi',
    rarity: 2,
    icon: '134 172 70 70',
    svg:
      `<path d="M160 224 L168 186" ${line(2.6, C.brown)}/>` +
      shape('M168 186 C178 176 192 178 196 184 C186 190 176 190 168 186Z', C.matcha) +
      dots(C.purple, 7, [[152, 196], [166, 194], [180, 196], [159, 208], [173, 207], [187, 206], [166, 219], [180, 218], [173, 230]], E) +
      dots(C.white, 2, [[150, 193], [164, 191], [178, 193], [157, 205], [171, 204], [164, 216]], 'opacity=".45"'),
  },
  {
    id: 'nagano-soba',
    name: '信州蕎麥麵',
    slot: 'hand',
    pref: 'nagano',
    rarity: 2,
    icon: '128 166 80 72',
    svg:
      shape('M132 214 L196 214 L192 232 L136 232Z', C.navy) +
      shape('M134 214 C134 196 194 196 194 214Z', C.brown) +
      `<path d="M138 212 C146 204 156 210 164 204 C172 210 182 202 190 212" ${line(2, C.cream, 0.7)}/>` +
      `<path d="M142 208 C150 200 160 206 168 200 C176 206 184 200 188 206" ${line(2, C.ink, 0.35)}/>` +
      `<path d="M176 190 L198 172 M180 194 L202 178" ${line(2.4, C.cream)}/>`,
  },
  {
    id: 'kyoto-matcha',
    name: '抹茶',
    slot: 'hand',
    pref: 'kyoto',
    rarity: 2,
    icon: '128 182 76 60',
    svg:
      shape('M134 206 L192 206 C192 226 180 236 163 236 C146 236 134 226 134 206Z', C.cream) +
      `<path d="M176 208 L192 206 C192 226 180 236 163 236 C176 228 180 218 176 208Z" ${SH}/>` +
      `<path d="M138 222 C150 226 176 226 188 222" ${line(3, C.matcha, 0.7)}/>` +
      `<ellipse cx="163" cy="206" rx="29" ry="6" fill="${C.matcha}" ${E}/>` +
      `<ellipse cx="160" cy="205" rx="10" ry="2.4" fill="${C.green}" opacity=".6"/>`,
  },
  {
    id: 'osaka-takoyaki',
    name: '章魚燒',
    slot: 'hand',
    pref: 'osaka',
    rarity: 2,
    icon: '128 174 84 66',
    svg:
      shape('M132 218 L198 218 L190 234 L140 234Z', C.cream) +
      `<path d="M132 218 L198 218 L190 234 L140 234Z" fill="url(#doll-wood)" opacity=".5"/>` +
      dots(C.brown, 10, [[150, 212], [167, 208], [182, 213]], E) +
      `<path d="M143 207 C148 204 154 206 156 210 M160 203 C165 200 171 202 173 206 M175 208 C180 205 186 207 188 211" ${line(3, C.ink, 0.55)}/>` +
      `<path d="M146 212 L148 211 M164 206 L166 207 M178 212 L180 211 M152 208 L153 210" ${line(2, C.green)}/>` +
      `<path d="M188 204 L204 182" ${line(2, C.cream)}/>`,
  },
  {
    id: 'nara-shika',
    name: '鹿角髮箍',
    slot: 'head',
    pref: 'nara',
    rarity: 2,
    icon: '46 4 148 92',
    svg:
      `<path d="M68 82 C70 50 170 50 172 82" ${line(4, C.brown)}/>` +
      `<path d="M84 60 C80 44 76 32 82 16 M80 36 L66 28 M82 48 L70 46 M82 22 L92 12" ${line(5, C.brown)}/>` +
      `<path d="M156 60 C160 44 164 32 158 16 M160 36 L174 28 M158 48 L170 46 M158 22 L148 12" ${line(5, C.brown)}/>` +
      shape('M70 66 C58 60 50 64 50 70 C58 74 66 72 72 70Z', C.brown) +
      shape('M170 66 C182 60 190 64 190 70 C182 74 174 72 168 70Z', C.brown) +
      `<path d="M56 68 C60 67 64 68 68 69 M184 68 C180 67 176 68 172 69" ${line(2, C.pink)}/>`,
  },
  {
    id: 'shizuoka-fuji',
    name: '富士山帽',
    slot: 'head',
    pref: 'shizuoka',
    rarity: 3,
    icon: '32 4 176 92',
    svg:
      shape('M100 14 L140 14 L204 82 C160 90 80 90 36 82Z', C.blue) +
      `<path d="M140 14 L204 82 C186 86 166 88 150 88Z" ${SH}/>` +
      shape('M100 14 L140 14 L160 36 C152 42 146 34 140 40 C134 34 126 44 120 38 C114 44 106 34 100 40 C94 34 88 42 80 36Z', C.white) +
      `<path d="M36 82 C80 90 160 90 204 82" ${line(3, C.navy, 0.6)}/>`,
  },
  {
    id: 'aichi-shachi',
    name: '金鯱髮箍',
    slot: 'head',
    pref: 'aichi',
    rarity: 3,
    icon: '56 -2 128 96',
    svg:
      `<path d="M68 82 C70 50 170 50 172 82" ${line(4, C.navy)}/>` +
      // 身體：頭朝下、尾巴翹起來
      shape('M96 64 C88 48 98 32 114 28 C126 25 134 20 136 10 L144 18 C142 32 130 42 122 50 C116 56 116 60 118 64Z', C.gold) +
      // 尾鰭
      shape('M136 12 C130 4 134 -2 142 0 C144 6 150 8 156 6 C154 14 148 20 142 20Z', C.gold) +
      // 背鰭
      shape('M110 30 L104 20 L116 27Z M122 26 L120 14 L130 22Z', C.gold) +
      `<path d="M122 50 C130 42 142 32 144 18 L138 14 C136 26 126 38 116 46Z" ${SH}/>` +
      `<path d="M104 42 Q110 38 116 42 M106 50 Q112 46 118 50 M112 34 Q118 30 124 34" ${line(1.4, C.brown, 0.55)}/>` +
      `<circle cx="101" cy="56" r="2.2" fill="${C.ink}"/>` +
      `<path d="M96 62 Q100 60 104 63" ${line(1.4, C.brown, 0.7)}/>`,
  },
  {
    id: 'hiroshima-momiji',
    name: '紅葉饅頭',
    slot: 'hand',
    pref: 'hiroshima',
    rarity: 2,
    icon: '128 170 80 72',
    svg:
      shape('M168 178 L174 196 L190 188 L184 204 L200 208 L184 214 L190 228 L174 222 L168 236 L162 222 L146 228 L152 214 L136 208 L152 204 L146 188 L162 196Z', C.orange) +
      `<path d="M168 178 L174 196 L190 188 L184 204 L200 208 L184 214 L190 228 L174 222 L168 236Z" ${SH}/>` +
      `<path d="M168 190 L168 226 M168 206 L150 196 M168 206 L186 196 M168 214 L152 222 M168 214 L184 222" ${line(1.4, C.brown, 0.6)}/>`,
  },
  {
    id: 'kagawa-udon',
    name: '讚岐烏龍麵',
    slot: 'hand',
    pref: 'kagawa',
    rarity: 2,
    icon: '128 166 80 76',
    svg:
      shape('M134 208 C134 230 150 238 166 238 C182 238 198 230 198 208Z', C.red) +
      `<path d="M182 210 L198 208 C198 230 184 238 168 238 C184 228 186 218 182 210Z" ${SH}/>` +
      `<ellipse cx="166" cy="208" rx="32" ry="7" fill="${C.cream}" ${E}/>` +
      `<path d="M142 208 C150 202 156 212 164 206 C172 212 180 202 190 208" ${line(2.6, C.white)}/>` +
      `<circle cx="176" cy="205" r="4" fill="${C.green}" opacity=".8"/>` +
      `<path d="M180 196 L196 172 M186 198 L202 174" ${line(2.4, C.brown)}/>`,
  },
  {
    id: 'fukuoka-mentaiko',
    name: '明太子',
    slot: 'hand',
    pref: 'fukuoka',
    rarity: 2,
    icon: '128 182 82 58',
    svg:
      shape('M132 222 C132 214 200 214 200 222 C200 230 132 230 132 222Z', C.white) +
      shape('M140 214 C138 202 156 196 168 200 C176 202 178 210 174 216 C164 222 146 222 140 214Z', C.pink) +
      shape('M162 214 C160 202 178 196 190 200 C198 204 198 212 194 216 C184 222 168 222 162 214Z', C.pink) +
      dots(C.red, 1.6, [[150, 208], [158, 204], [164, 210], [176, 206], [184, 210], [180, 203]], 'opacity=".7"') +
      `<path d="M148 202 C154 199 160 199 164 200 M170 202 C176 199 182 199 186 200" ${line(1.8, C.white, 0.5)}/>`,
  },
  {
    id: 'okinawa-shisa',
    name: '風獅爺',
    slot: 'buddy',
    pref: 'okinawa',
    rarity: 3,
    icon: '22 220 76 80',
    svg:
      shape('M36 294 C34 276 42 268 58 268 C74 268 82 276 80 294Z', C.orange) +
      shape('M58 232 C76 232 84 242 84 254 C84 268 74 276 58 276 C42 276 32 268 32 254 C32 242 40 232 58 232Z', C.orange) +
      `<path d="M34 244 C30 236 38 228 44 234 C40 226 50 222 54 230 C56 222 66 222 66 230 C70 222 80 228 76 234 C82 230 88 238 82 246" ${line(5, C.brown)}/>` +
      dots(C.white, 4, [[50, 252], [66, 252]]) +
      dots(C.ink, 2.2, [[50, 252], [66, 252]]) +
      shape('M46 262 L70 262 C70 270 64 274 58 274 C52 274 46 270 46 262Z', C.red) +
      `<path d="M48 262 L52 266 L56 262 L60 266 L64 262 L68 266" ${line(1.6, C.white)}/>`,
  },
  {
    id: 'aomori-ringo',
    name: '蘋果',
    slot: 'hand',
    pref: 'aomori',
    rarity: 1,
    icon: '132 176 70 66',
    svg:
      shape('M166 196 C150 186 136 198 138 214 C140 230 152 238 166 234 C180 238 192 230 194 214 C196 198 182 186 166 196Z', C.red) +
      `<path d="M178 192 C190 196 196 206 194 216 C192 228 184 236 172 236 C184 226 186 206 178 192Z" ${SH}/>` +
      `<path d="M148 200 C150 196 154 194 158 194" ${line(3, C.white, 0.55)}/>` +
      `<path d="M166 196 L168 184" ${line(2.6, C.brown)}/>` +
      shape('M168 188 C174 180 184 180 188 184 C182 190 174 190 168 188Z', C.green),
  },
  {
    id: 'ishikawa-kinpaku',
    name: '金箔霜淇淋',
    slot: 'hand',
    pref: 'ishikawa',
    rarity: 3,
    icon: '130 150 72 92',
    svg:
      shape('M152 204 L166 238 L180 204Z', C.yellow) +
      `<path d="M152 204 L166 238 L180 204" fill="url(#doll-waffle)" opacity=".5"/>` +
      shape('M150 206 C142 196 150 186 158 186 C152 174 162 162 166 156 C170 162 180 174 174 186 C182 186 190 196 182 206Z', C.cream) +
      shape('M154 196 C152 186 160 176 166 170 C172 176 180 186 178 196 C172 200 160 200 154 196Z', C.gold) +
      `<path d="M158 184 L164 180 M168 190 L174 186 M160 194 L166 192" ${line(1.4, C.white, 0.7)}/>`,
  },
]

export const outfitById = new Map(OUTFITS.map((o) => [o.id, o]))
/** 預設穿的（沒有存檔時） */
export const DEFAULT_EQUIPPED: Partial<Record<Slot, string>> = { body: 'tee' }
/** 一開始就有的 */
export const STARTER_IDS = ['tee']
