/**
 * 紙娃娃（DESIGN.md §7.24）：角色的部位與服裝。SVG 畫在 240×320 的畫布上（PaperDoll.vue），
 * 顏色一律用 theme.css 的 `--color-doll-*`、`--color-item-*` token。
 * 服裝分五個位置：頭（帽子、髮箍）、臉（眼鏡）、身（衣服）、手（拿的東西）、夥伴（腳邊或胸前）。
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

const L = 'var(--color-doll-line)'
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
}
const stroke = `stroke="${L}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`

// ---------- 身體的部位 ----------
export const SKINS = [1, 2, 3] as const
export const HAIR_COLORS = [1, 2, 3, 4, 5] as const
export type HairStyle = 'short' | 'bob' | 'long' | 'bun' | 'ponytail'
export type EyeStyle = 'round' | 'happy' | 'calm'
export const HAIR_STYLES: Array<{ key: HairStyle; label: string }> = [
  { key: 'short', label: '短髮' },
  { key: 'bob', label: '鮑伯' },
  { key: 'long', label: '長髮' },
  { key: 'bun', label: '丸子頭' },
  { key: 'ponytail', label: '馬尾' },
]
export const EYE_STYLES: Array<{ key: EyeStyle; label: string }> = [
  { key: 'round', label: '圓眼' },
  { key: 'happy', label: '笑眼' },
  { key: 'calm', label: '細眼' },
]

const H = 'var(--hair)'
/** 頭髮：後面那層（畫在頭之前）與前面的瀏海（畫在臉之後） */
export const HAIR: Record<HairStyle, { back: string; front: string }> = {
  short: {
    back: '',
    front: `<path d="M62 92 C58 48 92 28 120 30 C150 30 182 50 178 92 C170 74 156 68 142 74 C132 78 126 70 120 62 C112 72 100 78 90 72 C78 66 68 76 62 92Z" fill="${H}" ${stroke}/>`,
  },
  bob: {
    back: `<path d="M58 96 C52 54 86 30 120 30 C154 30 188 54 182 96 L184 150 C184 166 172 170 160 164 L160 120 L80 120 L80 164 C68 170 56 166 56 150Z" fill="${H}" ${stroke}/>`,
    front: `<path d="M62 94 C58 50 92 30 120 30 C150 30 182 50 178 94 C168 78 150 72 136 80 C126 70 114 70 104 80 C90 72 72 78 62 94Z" fill="${H}" ${stroke}/>`,
  },
  long: {
    back: `<path d="M58 96 C52 54 86 30 120 30 C154 30 188 54 182 96 L190 210 C190 224 176 228 164 220 L160 130 L80 130 L76 220 C64 228 50 224 50 210Z" fill="${H}" ${stroke}/>`,
    front: `<path d="M62 94 C58 50 92 30 120 30 C150 30 182 50 178 94 C172 76 160 70 148 76 C138 68 128 64 120 70 C108 64 96 68 88 78 C76 72 66 80 62 94Z" fill="${H}" ${stroke}/>`,
  },
  bun: {
    back: `<circle cx="150" cy="38" r="18" fill="${H}" ${stroke}/>`,
    front: `<path d="M62 92 C58 48 92 28 120 30 C150 30 182 50 178 92 C170 74 156 68 142 74 C132 78 126 70 120 62 C112 72 100 78 90 72 C78 66 68 76 62 92Z" fill="${H}" ${stroke}/>`,
  },
  ponytail: {
    back: `<path d="M74 70 C50 90 44 140 60 186 C64 196 76 196 78 186 C70 150 72 110 92 84Z" fill="${H}" ${stroke}/><circle cx="82" cy="70" r="10" fill="${H}" ${stroke}/>`,
    front: `<path d="M62 94 C58 50 92 30 120 30 C150 30 182 50 178 94 C170 78 158 70 146 78 C136 68 124 66 116 74 C104 66 90 72 84 82 C74 78 66 84 62 94Z" fill="${H}" ${stroke}/>`,
  },
}

export const EYES: Record<EyeStyle, string> = {
  round: `<circle cx="99" cy="100" r="5.5" fill="${L}"/><circle cx="141" cy="100" r="5.5" fill="${L}"/><circle cx="101" cy="98" r="1.8" fill="${C.white}"/><circle cx="143" cy="98" r="1.8" fill="${C.white}"/>`,
  happy: `<path d="M92 102 Q99 94 106 102" fill="none" ${stroke}/><path d="M134 102 Q141 94 148 102" fill="none" ${stroke}/>`,
  calm: `<path d="M92 100 L106 100" fill="none" ${stroke}/><path d="M134 100 L148 100" fill="none" ${stroke}/>`,
}

// ---------- 服裝 ----------
const body = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}" ${stroke}/>${extra}`
// 上衣的基本形：身體加兩個袖子
const TOP = 'M80 152 C96 146 144 146 160 152 L178 164 L178 200 L162 204 L162 246 C140 252 100 252 78 246 L78 204 L62 200 L62 164Z'
// 長的和服形：下襬到膝
const ROBE = 'M80 152 C96 146 144 146 160 152 L182 166 L178 206 L162 206 L166 266 C136 276 104 276 74 266 L78 206 L62 206 L58 166Z'

export const OUTFITS: Outfit[] = [
  // ----- 抽的 -----
  { id: 'tee', name: '白 T 恤', slot: 'body', rarity: 1, icon: '50 140 140 120', svg: body(TOP, C.white, `<path d="M106 152 Q120 164 134 152" fill="none" ${stroke}/>`) },
  { id: 'tee-navy', name: '藏青 T 恤', slot: 'body', rarity: 1, icon: '50 140 140 120', svg: body(TOP, C.navy, `<path d="M106 152 Q120 164 134 152" fill="none" ${stroke}/>`) },
  { id: 'yukata', name: '浴衣', slot: 'body', rarity: 2, icon: '50 140 140 140', svg: body(ROBE, C.blue, `<path d="M120 150 L92 210 M120 150 L148 210 M80 200 L160 200 L158 214 L82 214Z" fill="${C.red}" ${stroke}/><circle cx="100" cy="236" r="5" fill="${C.white}"/><circle cx="134" cy="178" r="5" fill="${C.white}"/><circle cx="150" cy="240" r="5" fill="${C.white}"/>`) },
  { id: 'happi', name: '法被', slot: 'body', rarity: 2, icon: '50 140 140 120', svg: body(TOP, C.navy, `<path d="M104 152 L104 246 M136 152 L136 246" fill="none" stroke="${C.red}" stroke-width="10"/><path d="M104 152 L104 246 M136 152 L136 246" fill="none" ${stroke}/><text x="120" y="212" text-anchor="middle" font-size="22" font-weight="900" fill="${C.white}" font-family="var(--font-ja)">祭</text>`) },
  { id: 'samue', name: '作務衣', slot: 'body', rarity: 2, icon: '50 140 140 120', svg: body(TOP, C.matcha, `<path d="M120 150 L94 200 M120 150 L146 200" fill="none" ${stroke}/>`) },
  { id: 'cap', name: '棒球帽', slot: 'head', rarity: 1, icon: '50 10 140 80', svg: `<path d="M66 72 C70 34 170 34 174 72Z" fill="${C.blue}" ${stroke}/><path d="M60 72 L196 72 C200 80 192 86 184 82 L66 82Z" fill="${C.blue}" ${stroke}/>` },
  { id: 'sugegasa', name: '斗笠', slot: 'head', rarity: 2, icon: '30 0 180 100', svg: `<path d="M120 14 L206 76 L34 76Z" fill="${C.yellow}" ${stroke}/><path d="M60 58 L180 58 M80 42 L160 42" fill="none" stroke="${L}" stroke-width="2"/>` },
  { id: 'beret', name: '貝雷帽', slot: 'head', rarity: 2, icon: '50 10 140 80', svg: `<path d="M64 70 C60 34 110 24 126 30 C170 30 186 54 176 72 C150 60 90 60 64 70Z" fill="${C.red}" ${stroke}/><circle cx="130" cy="30" r="4" fill="${L}"/>` },
  { id: 'glasses', name: '眼鏡', slot: 'face', rarity: 1, icon: '70 80 100 40', svg: `<circle cx="99" cy="100" r="13" fill="none" ${stroke}/><circle cx="141" cy="100" r="13" fill="none" ${stroke}/><path d="M112 100 L128 100 M86 98 L72 92 M154 98 L168 92" fill="none" ${stroke}/>` },
  { id: 'sunglasses', name: '太陽眼鏡', slot: 'face', rarity: 2, icon: '70 80 100 40', svg: `<path d="M84 92 L114 92 L112 108 C104 114 90 114 86 108Z M126 92 L156 92 L154 108 C146 114 132 114 128 108Z" fill="${C.navy}" ${stroke}/><path d="M114 94 L126 94 M84 94 L72 90 M156 94 L168 90" fill="none" ${stroke}/>` },
  { id: 'camera', name: '相機', slot: 'hand', rarity: 1, icon: '150 200 80 60', svg: `<rect x="160" y="216" width="52" height="34" rx="6" fill="${C.grey}" ${stroke}/><circle cx="186" cy="233" r="10" fill="${C.navy}" ${stroke}/><rect x="166" y="208" width="14" height="10" rx="2" fill="${C.grey}" ${stroke}/>` },
  { id: 'wagasa', name: '和傘', slot: 'hand', rarity: 2, icon: '140 100 110 160', svg: `<path d="M172 230 L172 250" fill="none" ${stroke}/><path d="M118 176 C140 120 204 120 226 176 C190 168 154 168 118 176Z" fill="${C.red}" ${stroke}/><path d="M172 124 L172 176 M136 166 L172 128 M208 166 L172 128" fill="none" stroke="${L}" stroke-width="2"/>` },
  { id: 'goshuincho', name: '御朱印帳', slot: 'hand', rarity: 2, icon: '150 200 80 60', svg: `<rect x="162" y="212" width="40" height="46" rx="4" fill="${C.purple}" ${stroke}/><rect x="170" y="218" width="14" height="30" rx="2" fill="${C.cream}" stroke="${L}" stroke-width="2"/>` },
  { id: 'fan', name: '團扇', slot: 'hand', rarity: 1, icon: '150 190 80 70', svg: `<path d="M172 236 L172 256" fill="none" ${stroke}/><circle cx="172" cy="218" r="20" fill="${C.cream}" ${stroke}/><circle cx="172" cy="218" r="8" fill="${C.red}"/>` },
  { id: 'maneki', name: '招財貓', slot: 'buddy', rarity: 3, icon: '20 230 80 80', svg: `<ellipse cx="58" cy="286" rx="20" ry="18" fill="${C.white}" ${stroke}/><circle cx="58" cy="262" r="15" fill="${C.white}" ${stroke}/><path d="M46 252 L44 240 L54 250 M70 252 L72 240 L62 250" fill="${C.white}" ${stroke}/><circle cx="53" cy="261" r="2" fill="${L}"/><circle cx="63" cy="261" r="2" fill="${L}"/><path d="M74 270 L80 258" fill="none" ${stroke}/><rect x="48" y="272" width="20" height="8" rx="2" fill="${C.red}"/>` },
  { id: 'daruma', name: '達摩', slot: 'buddy', rarity: 2, icon: '20 230 80 80', svg: `<path d="M38 292 C34 254 82 254 78 292Z" fill="${C.red}" ${stroke}/><ellipse cx="58" cy="276" rx="12" ry="10" fill="${C.cream}"/><circle cx="53" cy="274" r="2.5" fill="${L}"/><circle cx="63" cy="274" r="2.5" fill="${L}"/>` },

  // ----- 各縣的特色單品：去過就有 -----
  { id: 'hokkaido-melon', name: '哈密瓜帽', slot: 'head', pref: 'hokkaido', rarity: 2, icon: '50 0 140 90', svg: `<path d="M64 74 C64 30 176 30 176 74Z" fill="${C.green}" ${stroke}/><path d="M80 60 L100 40 M110 70 L130 36 M140 66 L160 42 M70 50 L120 72 M100 36 L170 60" fill="none" stroke="${C.cream}" stroke-width="2.5"/><path d="M118 32 L124 20" fill="none" ${stroke}/>` },
  { id: 'miyagi-zunda', name: '毛豆麻糬', slot: 'hand', pref: 'miyagi', rarity: 2, icon: '150 200 80 60', svg: `<ellipse cx="186" cy="246" rx="24" ry="8" fill="${C.cream}" ${stroke}/><ellipse cx="186" cy="232" rx="18" ry="12" fill="${C.matcha}" ${stroke}/><circle cx="178" cy="228" r="3" fill="${C.green}"/><circle cx="192" cy="226" r="3" fill="${C.green}"/><circle cx="186" cy="236" r="3" fill="${C.green}"/>` },
  { id: 'tokyo-chochin', name: '提燈', slot: 'hand', pref: 'tokyo', rarity: 2, icon: '150 170 80 90', svg: `<path d="M172 176 L172 190" fill="none" ${stroke}/><rect x="152" y="190" width="40" height="52" rx="18" fill="${C.red}" ${stroke}/><path d="M154 204 L190 204 M154 218 L190 218 M154 230 L190 230" fill="none" stroke="${L}" stroke-width="1.5"/><rect x="160" y="186" width="24" height="6" rx="2" fill="${L}"/><rect x="160" y="240" width="24" height="6" rx="2" fill="${L}"/>` },
  { id: 'yamanashi-budo', name: '葡萄', slot: 'hand', pref: 'yamanashi', rarity: 2, icon: '150 190 80 70', svg: `<path d="M184 206 L188 196" fill="none" ${stroke}/><g fill="${C.purple}" ${stroke}><circle cx="170" cy="214" r="7"/><circle cx="184" cy="212" r="7"/><circle cx="198" cy="214" r="7"/><circle cx="177" cy="226" r="7"/><circle cx="191" cy="226" r="7"/><circle cx="184" cy="238" r="7"/></g>` },
  { id: 'nagano-soba', name: '信州蕎麥麵', slot: 'hand', pref: 'nagano', rarity: 2, icon: '150 200 80 60', svg: `<rect x="160" y="222" width="52" height="24" rx="4" fill="${C.navy}" ${stroke}/><path d="M166 222 C176 212 196 212 206 222" fill="${C.grey}" ${stroke}/><path d="M176 214 L170 204 M182 212 L178 200" fill="none" ${stroke}/>` },
  { id: 'shizuoka-fuji', name: '富士山帽', slot: 'head', pref: 'shizuoka', rarity: 3, icon: '40 0 160 90', svg: `<path d="M120 10 L198 78 L42 78Z" fill="${C.blue}" ${stroke}/><path d="M120 10 L148 36 C140 40 136 32 128 38 C120 32 112 40 104 34 C98 30 94 36 92 36Z" fill="${C.white}" ${stroke}/>` },
  { id: 'aichi-shachi', name: '金鯱帽', slot: 'head', pref: 'aichi', rarity: 3, icon: '50 0 140 90', svg: `<path d="M66 72 C70 44 170 44 174 72Z" fill="${C.navy}" ${stroke}/><path d="M140 48 C150 30 158 20 162 10 C170 20 172 34 164 46 C160 52 148 54 140 48Z" fill="${C.gold}" ${stroke}/><path d="M92 48 C84 36 80 24 82 14 C92 20 100 32 100 44Z" fill="${C.gold}" ${stroke}/>` },
  { id: 'kyoto-matcha', name: '抹茶', slot: 'hand', pref: 'kyoto', rarity: 2, icon: '150 200 80 60', svg: `<path d="M158 222 L164 250 L198 250 L204 222Z" fill="${C.cream}" ${stroke}/><ellipse cx="181" cy="222" rx="23" ry="7" fill="${C.matcha}" ${stroke}/>` },
  { id: 'osaka-takoyaki', name: '章魚燒', slot: 'hand', pref: 'osaka', rarity: 2, icon: '150 200 80 60', svg: `<path d="M156 236 L166 252 L206 252 L216 236Z" fill="${C.cream}" ${stroke}/><g fill="${C.brown}" ${stroke}><circle cx="172" cy="232" r="9"/><circle cx="188" cy="226" r="9"/><circle cx="202" cy="234" r="9"/></g><path d="M166 226 L176 230 M184 220 L194 224 M196 228 L206 232" fill="none" stroke="${C.green}" stroke-width="2"/>` },
  { id: 'nara-shika', name: '鹿角髮箍', slot: 'head', pref: 'nara', rarity: 2, icon: '50 0 140 90', svg: `<path d="M66 70 C70 54 170 54 174 70" fill="none" ${stroke}/><path d="M86 62 C78 48 76 34 84 20 M84 34 L72 28 M86 48 L74 46" fill="none" stroke="${C.brown}" stroke-width="6" stroke-linecap="round"/><path d="M154 62 C162 48 164 34 156 20 M156 34 L168 28 M154 48 L166 46" fill="none" stroke="${C.brown}" stroke-width="6" stroke-linecap="round"/>` },
  { id: 'hiroshima-momiji', name: '紅葉饅頭', slot: 'hand', pref: 'hiroshima', rarity: 2, icon: '150 200 80 60', svg: `<path d="M186 206 L180 226 L162 220 L172 234 L160 244 L178 246 L186 258 L194 246 L212 244 L200 234 L210 220 L192 226Z" fill="${C.orange}" ${stroke}/>` },
  { id: 'kagawa-udon', name: '讚岐烏龍麵', slot: 'hand', pref: 'kagawa', rarity: 2, icon: '150 200 80 60', svg: `<path d="M156 226 C156 250 206 250 206 226Z" fill="${C.cream}" ${stroke}/><ellipse cx="181" cy="226" rx="25" ry="7" fill="${C.white}" ${stroke}/><path d="M166 224 C174 218 188 218 196 224" fill="none" stroke="${C.cream}" stroke-width="3"/><path d="M190 208 L198 196 M196 208 L204 196" fill="none" ${stroke}/>` },
  { id: 'fukuoka-mentaiko', name: '明太子', slot: 'hand', pref: 'fukuoka', rarity: 2, icon: '150 200 80 60', svg: `<path d="M158 232 C156 216 196 212 212 226 C216 240 192 254 170 250 C158 248 156 240 158 232Z" fill="${C.pink}" ${stroke}/><g fill="${C.red}"><circle cx="172" cy="232" r="2.5"/><circle cx="184" cy="226" r="2.5"/><circle cx="196" cy="232" r="2.5"/><circle cx="184" cy="240" r="2.5"/></g>` },
  { id: 'okinawa-shisa', name: '風獅爺', slot: 'buddy', pref: 'okinawa', rarity: 3, icon: '20 230 80 80', svg: `<ellipse cx="58" cy="288" rx="22" ry="14" fill="${C.orange}" ${stroke}/><circle cx="58" cy="262" r="18" fill="${C.orange}" ${stroke}/><path d="M40 262 C34 246 48 240 52 250 M76 262 C82 246 68 240 64 250 M44 272 C50 282 66 282 72 272" fill="none" ${stroke}/><circle cx="51" cy="259" r="2.5" fill="${L}"/><circle cx="65" cy="259" r="2.5" fill="${L}"/><path d="M48 268 L68 268 L62 276 L54 276Z" fill="${C.cream}" ${stroke}/>` },
  { id: 'aomori-ringo', name: '蘋果', slot: 'hand', pref: 'aomori', rarity: 1, icon: '150 200 80 60', svg: `<path d="M184 212 L186 202" fill="none" ${stroke}/><path d="M184 214 C166 204 156 222 162 238 C166 250 178 254 184 248 C190 254 202 250 206 238 C212 222 202 204 184 214Z" fill="${C.red}" ${stroke}/><path d="M186 208 C192 200 200 202 202 206 C196 210 190 210 186 208Z" fill="${C.green}" ${stroke}/>` },
  { id: 'ishikawa-kinpaku', name: '金箔霜淇淋', slot: 'hand', pref: 'ishikawa', rarity: 3, icon: '150 180 80 80', svg: `<path d="M168 230 L184 260 L200 230Z" fill="${C.yellow}" ${stroke}/><path d="M166 230 C160 212 174 196 184 190 C194 196 208 212 202 230Z" fill="${C.gold}" ${stroke}/><path d="M174 212 L182 200 M190 216 L196 204" fill="none" stroke="${C.cream}" stroke-width="2"/>` },
]

export const outfitById = new Map(OUTFITS.map((o) => [o.id, o]))
/** 預設穿的（沒有存檔時） */
export const DEFAULT_EQUIPPED: Partial<Record<Slot, string>> = { body: 'tee' }
/** 一開始就有的 */
export const STARTER_IDS = ['tee']
