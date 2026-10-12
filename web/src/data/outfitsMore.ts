import type { Outfit } from './outfits'
import { C, dots, E, line, LONG, LONG_SHADE, mirror, NECK, PANTS, ROBE, SH, shape, SHORTS, SLEEVE_L, SLEEVE_R, TOP, TOP_SHADE } from './dollArt'

/**
 * 不限縣的服裝第二批（使用者回饋 2026-10-12：衣服太少，多一些不用去特定縣市的）。全部用抽獎券抽。
 * 衣服 19 件（日常、制服、和服、旅行）、頭上 7、臉上 6、手上 9、夥伴 5。畫法同 outfits.ts（剪紙、平塗、淡邊）。
 * 半透明的部分（透明傘、金魚缸、彈珠汽水）不透明度要超過 0.5：3D 旅人用 alpha 0.5 當形狀的邊界，太淡就不見了。
 */

const H = 'var(--hair)'
const BODY_ICON = '58 140 124 140'
/** 米色：棕上疊一層半透明的奶油色（token 裡沒有米色） */
const beige = (d: string) => shape(d, C.brown) + `<path d="${d}" fill="${C.cream}" opacity=".55"/>`

// ---------- 版型 ----------
// 帽子垂在肩上（帽 T、雨衣）：頭擋住中間，只露出脖子兩旁
const HOOD = 'M88 160 C86 146 100 138 120 138 C140 138 154 146 152 160 C146 154 134 150 120 150 C106 150 94 154 88 160Z'
// 立領（學生服、運動外套、羽絨衣）
const STAND = 'M101 145 C110 149 130 149 139 145 L141 156 C131 160 109 160 99 156Z'
// 長外套：到膝蓋
const COAT = 'M98 151 L142 151 C153 153 161 158 165 167 L171 214 L153 216 L157 262 L83 262 L87 216 L69 214 L75 167 C79 158 87 153 98 151Z'
const COAT_SHADE = 'M140 151 C153 153 161 158 165 167 L171 214 L153 216 L157 262 L138 262Z'
// 百褶裙
const SKIRT = 'M90 230 L150 230 L160 260 L80 260Z'
const PLEATS = `<path d="M100 232 L94 260 M110 232 L107 260 M120 232 L120 260 M130 232 L133 260 M140 232 L146 260" ${line(1.2, C.ink, 0.3)}/>`
// 連身裙：小包袖、A 字到膝
const DRESS = 'M100 151 L140 151 C150 153 157 158 159 167 L153 178 L150 200 L161 258 L79 258 L90 200 L87 178 L81 167 C83 158 90 153 100 151Z'
// 甚平：方袖、到腰
const JINBEI = 'M96 151 L144 151 L150 156 L172 160 L172 196 L152 196 L152 238 L88 238 L88 196 L68 196 L68 160 L90 156Z'
// 振袖：袖子垂到小腿
const FURI_L = 'M92 156 C80 158 70 166 68 180 L64 254 C64 262 70 266 78 266 L95 266 L95 170Z'
const FURI_R = 'M148 156 C160 158 170 166 172 180 L176 254 C176 262 170 266 162 266 L145 266 L145 170Z'
// 羽織、丹前：前面敞開
const HAORI_L = 'M96 151 L112 151 L114 232 L86 232 L88 162Z'
const HAORI_R = 'M144 151 L128 151 L126 232 L154 232 L152 162Z'
const SEAM = `<path d="M120 240 L120 250" ${line(1.4, C.ink, 0.3)}/>`
const shade = (d: string) => `<path d="${d}" ${SH}/>`

/** 五角星的路徑 */
function star(cx: number, cy: number, R: number, r: number): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const k = i % 2 ? r : R
    return `${(cx + k * Math.cos(a)).toFixed(1)} ${(cy + k * Math.sin(a)).toFixed(1)}`
  })
  return `M${pts.join(' L')}Z`
}

const BODY: Outfit[] = [
  {
    id: 'stripe-tee',
    name: '橫條紋 T 恤',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg: shape(PANTS, C.blue) + SEAM + shape(TOP, C.white) + `<path d="${TOP}" fill="url(#doll-border)"/>` + shade(TOP_SHADE) + NECK,
  },
  {
    id: 'hoodie',
    name: '帽 T',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      SEAM +
      shape(LONG, C.grey) +
      shade(LONG_SHADE) +
      `<path d="M100 212 L140 212 L146 236 L94 236Z" ${line(1.4, C.ink, 0.3)}/>` +
      `<path d="M89 236 L151 236 M69.5 211 L89 213 M151 213 L170.5 211" ${line(3, C.ink, 0.12)}/>` +
      shape(HOOD, C.grey) +
      shade(HOOD) +
      `<path d="M112 152 L111 176 M128 152 L129 176" ${line(2, C.white)}/>`,
  },
  {
    id: 'check-shirt',
    name: '格紋襯衫',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.brown) +
      SEAM +
      shape(LONG, C.red) +
      `<path d="${LONG}" fill="url(#doll-check)"/>` +
      shade(LONG_SHADE) +
      `<path d="M120 160 L120 240" ${line(1.4, C.ink, 0.3)}/>` +
      dots(C.white, 1.8, [
        [123, 174],
        [123, 192],
        [123, 210],
        [123, 228],
      ]) +
      `<path d="M69.5 208 L89 210 M151 210 L170.5 208" ${line(2, C.ink, 0.2)}/>` +
      shape('M108 150 L120 161 L110 168 L100 154Z', C.red) +
      shape('M132 150 L120 161 L130 168 L140 154Z', C.red),
  },
  {
    id: 'sweater',
    name: '針織毛衣',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      SEAM +
      shape(LONG, C.yellow) +
      `<path d="${LONG}" fill="url(#doll-knit)"/>` +
      shade(LONG_SHADE) +
      `<path d="M114 166 C110 172 118 178 114 184 C110 190 118 196 114 202 C110 208 118 214 114 220 M126 166 C130 172 122 178 126 184 C130 190 122 196 126 202 C130 208 122 214 126 220" ${line(1.8, C.ink, 0.16)}/>` +
      `<path d="M89 231 L151 231 M69.5 208 L89 210 M151 210 L170.5 208" ${line(1.6, C.ink, 0.22)}/>` +
      `<path d="M106 151 Q120 161 134 151" ${line(4, C.yellow)}/>` +
      NECK,
  },
  {
    id: 'denim-jacket',
    name: '牛仔外套',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      SEAM +
      shape(LONG, C.blue) +
      shade(LONG_SHADE) +
      shape('M110 151 L130 151 L128 240 L112 240Z', C.white) +
      shape('M100 151 L110 151 L114 168 L104 176Z', C.blue) +
      shade('M100 151 L110 151 L114 168 L104 176Z') +
      shape('M140 151 L130 151 L126 168 L136 176Z', C.blue) +
      shade('M140 151 L130 151 L126 168 L136 176Z') +
      shape('M95 180 L108 180 L108 190 L101.5 193 L95 190Z', C.blue) +
      shape('M132 180 L145 180 L145 190 L138.5 193 L132 190Z', C.blue) +
      `<path d="M89 228 L112 228 M128 228 L151 228 M70 206 L89 208 M151 208 L170 206" ${line(1.2, C.cream, 0.85)} stroke-dasharray="2 2"/>` +
      dots(C.gold, 1.8, [
        [107, 204],
        [107, 220],
        [133, 204],
        [133, 220],
      ]),
  },
  {
    id: 'down-jacket',
    name: '羽絨外套',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.grey) +
      SEAM +
      shape('M96 150 L144 150 C156 152 164 158 168 168 L175 216 L153 218 L154 242 L86 242 L87 218 L65 216 L72 168 C76 158 84 152 96 150Z', C.orange) +
      shade('M142 150 C156 152 164 158 168 168 L175 216 L153 218 L154 242 L140 242Z') +
      `<path d="M88 172 C104 176 136 176 152 172 M88 192 C104 196 136 196 152 192 M87 212 C104 216 136 216 153 212 M87 230 C104 234 136 234 153 230 M71 184 L88 186 M68 198 L88 200 M152 186 L169 184 M152 200 L172 198" ${line(1.6, C.ink, 0.2)}/>` +
      `<path d="M120 158 L120 242" ${line(1.6, C.ink, 0.35)}/>` +
      shape(STAND, C.orange) +
      `<path d="M120 147 L120 158" ${line(1.6, C.ink, 0.35)}/>`,
  },
  {
    id: 'trench',
    name: '風衣',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      beige(COAT) +
      shade(COAT_SHADE) +
      shape('M108 151 L132 151 L120 176Z', C.white) +
      beige('M100 151 L108 151 L120 176 L114 186 L98 158Z') +
      beige('M140 151 L132 151 L120 176 L126 186 L142 158Z') +
      shade('M140 151 L132 151 L120 176 L126 186 L142 158Z') +
      shape('M86 206 L154 206 L154 214 L86 214Z', C.brown) +
      `<rect x="114" y="204" width="11" height="12" rx="1.5" ${line(1.8, C.gold)}/>` +
      dots(C.brown, 2.2, [
        [110, 192],
        [130, 192],
        [110, 228],
        [130, 228],
      ]) +
      `<path d="M120 240 L120 262 M86 168 L100 162 M154 168 L140 162" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'overalls',
    name: '吊帶褲',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(TOP, C.yellow) +
      shade(TOP_SHADE) +
      NECK +
      shape(PANTS, C.blue) +
      SEAM +
      shape('M100 184 L140 184 L141 236 L99 236Z', C.blue) +
      shape('M110 194 L130 194 L130 208 C126 211 114 211 110 208Z', C.blue) +
      shade('M110 194 L130 194 L130 208 C126 211 114 211 110 208Z') +
      `<path d="M101 152 L104 186 M139 152 L136 186" ${line(6, C.blue)}/>` +
      `<path d="M100 186 L140 186 M100 236 L140 236" ${line(1.2, C.cream, 0.8)} stroke-dasharray="2 2"/>` +
      dots(C.gold, 2.4, [
        [104, 188],
        [136, 188],
      ]),
  },
  {
    id: 'jersey',
    name: '運動服',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.blue) +
      SEAM +
      `<path d="M91 240 L97 272 M149 240 L143 272" ${line(2.4, C.white)}/>` +
      shape(LONG, C.blue) +
      shade(LONG_SHADE) +
      `<path d="M76 170 L70.5 212 M164 170 L169.5 212" ${line(2.4, C.white)}/>` +
      `<path d="M120 156 L120 240" ${line(1.8, C.white, 0.85)}/>` +
      shape(STAND, C.blue) +
      `<path d="M120 147 L120 158" ${line(1.8, C.white, 0.85)}/>`,
  },
  {
    id: 'gakuran',
    name: '立領學生服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.ink) +
      shape(LONG, C.ink) +
      `<path d="M75 167 L69 214 M69.5 207 L89 209 M151 209 L170.5 207" ${line(1.4, C.white, 0.15)}/>` +
      shape(STAND, C.ink) +
      `<path d="M101 146.5 C110 150.5 130 150.5 139 146.5" ${line(1.6, C.white, 0.9)}/>` +
      dots(C.gold, 2.6, [
        [120, 168],
        [120, 184],
        [120, 200],
        [120, 216],
        [120, 232],
      ]),
  },
  {
    id: 'sailor',
    name: '水手服',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(SKIRT, C.navy) +
      PLEATS +
      shape(TOP, C.white) +
      shade(TOP_SHADE) +
      `<path d="M70.5 185.5 L89 189.5 M151 189.5 L169.5 185.5" ${line(4, C.navy)}/>` +
      shape('M98 151 L142 151 L148 156 L120 196 L92 156Z', C.navy) +
      shape('M106 151 L134 151 L120 178Z', C.white) +
      `<path d="M96 157.5 L120 191 L144 157.5" ${line(1.4, C.white)}/>` +
      shape('M116 189 L109 208 L116 205 L120 192Z', C.red) +
      shape('M124 189 L131 208 L124 205 L120 192Z', C.red) +
      shape('M113 181 L127 181 L124 191 L116 191Z', C.red),
  },
  {
    id: 'dress',
    name: '連身裙',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(DRESS, C.pink) +
      `<path d="${DRESS}" fill="url(#doll-dots)"/>` +
      shade('M138 151 C150 153 157 158 159 167 L153 178 L150 200 L161 258 L136 258Z') +
      `<path d="M90 200 L150 200" ${line(4, C.white)}/>` +
      shape('M136 196 C142 190 148 194 144 200 C148 206 142 210 136 204Z', C.white) +
      shape('M106 150 C104 160 112 165 120 158 C128 165 136 160 134 150Z', C.white),
  },
  {
    id: 'suit',
    name: '西裝',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.grey) +
      `<path d="M106 244 L106 272 M134 244 L134 272" ${line(1.2, C.ink, 0.2)}/>` +
      shape(LONG, C.grey) +
      shade(LONG_SHADE) +
      shape('M107 151 L133 151 L120 184Z', C.white) +
      shape('M116 152 L124 152 L123 158 L117 158Z', C.red) +
      shape('M117 157 L123 157 L125 182 L120 188 L115 182Z', C.red) +
      `<path d="M103 151 L113 176 L120 188 M137 151 L127 176 L120 188" ${line(1.8, C.ink, 0.3)}/>` +
      shape('M132 174 L142 172 L142 176 L132 178Z', C.white) +
      dots(C.ink, 1.8, [
        [120, 202],
        [120, 218],
      ]),
  },
  {
    id: 'jinbei',
    name: '甚平',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(SHORTS, C.cream) +
      `<path d="${SHORTS}" fill="url(#doll-kasuri)"/>` +
      shape(JINBEI, C.cream) +
      `<path d="${JINBEI}" fill="url(#doll-kasuri)"/>` +
      shade('M138 151 L144 151 L150 156 L172 160 L172 196 L152 196 L152 238 L138 238Z') +
      `<path d="M106 151 L126 206 M134 151 L118 190" ${line(4, C.navy)}/>` +
      `<path d="M126 206 L134 212 M126 206 L132 202 M88 196 L88 238 M152 196 L152 238" ${line(1.4, C.navy, 0.7)}/>`,
  },
  {
    id: 'furisode',
    name: '振袖',
    slot: 'body',
    rarity: 3,
    icon: '56 140 128 140',
    svg:
      shape(FURI_L, C.red) +
      shape(FURI_R, C.red) +
      `<path d="${FURI_L}" fill="url(#doll-sakura)"/><path d="${FURI_R}" fill="url(#doll-sakura)"/>` +
      shape(ROBE, C.red) +
      `<path d="${ROBE}" fill="url(#doll-sakura)"/>` +
      shade('M144 151 L153 162 L158 274 L138 274Z') +
      shade(FURI_R) +
      `<path d="M106 150 L122 196 M134 150 L124 178" ${line(5, C.cream)}/>` +
      shape('M85 186 L155 186 L156 214 L84 214Z', C.gold) +
      `<path d="M86 189 L154 189" ${line(3, C.pink)}/>` +
      `<path d="M84 201 L156 201" ${line(2.4, C.red)}/>` +
      `<path d="M120 274 L122 214" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'hakama',
    name: '袴',
    slot: 'body',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.pink) +
      shape(SLEEVE_R, C.pink) +
      `<path d="${SLEEVE_L}" fill="url(#doll-sakura)"/><path d="${SLEEVE_R}" fill="url(#doll-sakura)"/>` +
      shape(ROBE, C.pink) +
      `<path d="${ROBE}" fill="url(#doll-sakura)"/>` +
      shape('M86 198 L154 198 L161 274 L79 274Z', C.purple) +
      shade('M140 198 L154 198 L161 274 L140 274Z') +
      `<path d="M104 200 L100 274 M120 200 L120 274 M136 200 L140 274" ${line(1.2, C.ink, 0.3)}/>` +
      `<path d="M86 199 L154 199" ${line(3, C.cream)}/>` +
      shape('M140 196 C146 190 152 194 148 200 C152 206 146 210 140 204Z', C.cream) +
      shade(SLEEVE_R) +
      `<path d="M106 150 L120 192 M134 150 L122 180" ${line(5, C.cream)}/>`,
  },
  {
    id: 'ryokan-yukata',
    name: '旅館浴衣',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(ROBE, C.cream) +
      `<path d="${ROBE}" fill="url(#doll-kasuri)"/>` +
      `<path d="M106 150 L122 196 M134 150 L124 178" ${line(3, C.navy, 0.6)}/>` +
      shape('M88 200 L152 200 L152 208 L88 208Z', C.navy) +
      shape(SLEEVE_L, C.navy) +
      shape(SLEEVE_R, C.navy) +
      shade(SLEEVE_R) +
      shape(HAORI_L, C.navy) +
      shape(HAORI_R, C.navy) +
      shade(HAORI_R) +
      `<path d="M111 152 L113.5 231 M129 152 L126.5 231" ${line(3.5, C.ink, 0.45)}/>` +
      `<path d="M120 274 L122 208" ${line(1.4, C.ink, 0.25)}/>`,
  },
  {
    id: 'raincoat',
    name: '雨衣',
    slot: 'body',
    rarity: 1,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      shape(COAT, C.yellow) +
      shade(COAT_SHADE) +
      `<path d="M120 158 L120 262" ${line(1.4, C.ink, 0.25)}/>` +
      dots(C.navy, 2.4, [
        [125, 176],
        [125, 196],
        [125, 216],
        [125, 236],
      ]) +
      `<path d="M94 222 L108 222 M132 222 L146 222" ${line(1.8, C.ink, 0.25)}/>` +
      shape(HOOD, C.yellow) +
      shade(HOOD),
  },
  {
    id: 'hiking',
    name: '登山外套',
    slot: 'body',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.grey) +
      SEAM +
      shape('M95 254 L113 254 L112 264 L96 264Z', C.ink, 'opacity=".25"') +
      shape(LONG, C.red) +
      shade(LONG_SHADE) +
      `<path d="M120 156 L120 240" ${line(1.8, C.ink, 0.45)}/>` +
      `<path d="M126 176 L144 173 M96 196 L112 196" ${line(1.6, C.ink, 0.4)}/>` +
      `<path d="M69.5 210.5 L89 212.5 M151 212.5 L170.5 210.5" ${line(4, C.grey)}/>` +
      shape(STAND, C.red) +
      `<path d="M120 147 L120 158" ${line(1.8, C.ink, 0.45)}/>`,
  },
]

const HEAD: Outfit[] = [
  {
    id: 'beanie',
    name: '毛帽',
    slot: 'head',
    rarity: 1,
    icon: '50 14 140 92',
    svg:
      shape('M68 84 C66 50 92 32 120 32 C148 32 174 50 172 84Z', C.red) +
      `<path d="M68 84 C66 50 92 32 120 32 C148 32 174 50 172 84Z" fill="url(#doll-knit)"/>` +
      shade('M146 36 C164 46 174 62 172 84 L150 84Z') +
      shape('M63 78 C90 86 150 86 177 78 L178 96 C150 104 90 104 62 96Z', C.red) +
      `<path d="M63 78 C90 86 150 86 177 78 L178 96 C150 104 90 104 62 96Z" fill="url(#doll-knit)"/>` +
      shade('M63 78 C90 86 150 86 177 78 L178 96 C150 104 90 104 62 96Z') +
      `<circle cx="120" cy="27" r="10" fill="${C.cream}" ${E}/>`,
  },
  {
    id: 'bucket-hat',
    name: '漁夫帽',
    slot: 'head',
    rarity: 1,
    icon: '44 24 152 82',
    svg:
      beige('M78 76 C78 46 94 32 120 32 C146 32 162 46 162 76Z') +
      shade('M140 34 C154 40 162 54 162 76 L144 76Z') +
      shape('M78 68 C98 72 142 72 162 68 L162 76 C142 80 98 80 78 76Z', C.navy) +
      beige('M56 74 C84 84 156 84 184 74 L190 88 C160 100 80 100 50 88Z') +
      `<path d="M58 82 C88 92 152 92 182 82" ${line(1.2, C.ink, 0.22)}/>`,
  },
  {
    id: 'straw-hat',
    name: '草帽',
    slot: 'head',
    rarity: 2,
    icon: '22 26 196 76',
    svg:
      shape('M84 76 C84 46 100 34 120 34 C140 34 156 46 156 76Z', C.yellow) +
      shade('M138 36 C150 42 156 56 156 76 L140 76Z') +
      `<path d="M88 50 C104 46 136 46 152 50 M85 60 C102 56 138 56 155 60" ${line(1.2, C.brown, 0.4)}/>` +
      shape('M84 64 C100 68 140 68 156 64 L156 76 C140 80 100 80 84 76Z', C.red) +
      shape('M28 80 C56 72 184 72 212 80 C214 84 210 89 202 90 C162 96 78 96 38 90 C30 89 26 84 28 80Z', C.yellow) +
      shade('M30 86 C60 92 180 92 210 86 C208 89 205 90 202 90 C162 96 78 96 38 90 C34 89 31 88 30 86Z') +
      `<path d="M44 82 C80 78 160 78 196 82" ${line(1.2, C.brown, 0.4)}/>`,
  },
  {
    id: 'cat-ears',
    name: '貓耳髮箍',
    slot: 'head',
    rarity: 2,
    icon: '60 16 120 84',
    svg:
      `<path d="M70 92 C66 56 90 40 120 40 C150 40 174 56 170 92" ${line(6, C.ink)}/>` +
      shape('M74 62 L78 24 L104 46Z', C.ink) +
      shape('M166 62 L162 24 L136 46Z', C.ink) +
      shape('M81 54 L83 34 L96 47Z', C.pink) +
      shape('M159 54 L157 34 L144 47Z', C.pink),
  },
  {
    id: 'ribbon',
    name: '蝴蝶結',
    slot: 'head',
    rarity: 1,
    icon: '50 28 80 54',
    // 戴在頭的右側（畫面左邊）：左側留給側戴的面具
    svg: mirror(
      shape('M146 56 L139 76 L146 73 L150 60Z', C.red) +
      shape('M154 56 L161 76 L154 73 L150 60Z', C.red) +
      shape('M150 52 C138 34 118 36 120 52 C118 68 138 70 150 52Z', C.red) +
      shape('M150 52 C162 34 182 36 180 52 C182 68 162 70 150 52Z', C.red) +
      shade('M150 52 C162 34 182 36 180 52 C182 68 162 70 150 52Z') +
      `<path d="M126 46 C132 42 138 44 142 48 M158 48 C162 44 168 42 174 46" ${line(1.6, C.white, 0.45)}/>` +
      `<circle cx="150" cy="52" r="6" fill="${C.red}" ${E}/>`,
    ),
  },
  {
    id: 'earmuffs',
    name: '耳罩',
    slot: 'head',
    rarity: 1,
    icon: '44 24 152 108',
    svg:
      `<path d="M68 104 C64 52 90 32 120 32 C150 32 176 52 172 104" ${line(5, C.grey)}/>` +
      `<circle cx="66" cy="112" r="15" fill="${C.pink}" ${E}/><circle cx="174" cy="112" r="15" fill="${C.pink}" ${E}/>` +
      shade('M178 98 C186 102 190 110 188 118 C186 124 180 127 174 127 C182 120 184 108 178 98Z') +
      dots(
        C.white,
        2.2,
        [
          [60, 106],
          [70, 104],
          [62, 116],
          [72, 114],
          [66, 122],
          [168, 106],
          [178, 104],
          [170, 116],
          [180, 114],
          [174, 122],
        ],
        'opacity=".55"',
      ),
  },
  {
    id: 'school-hat',
    name: '通學帽',
    slot: 'head',
    rarity: 1,
    icon: '52 22 136 82',
    svg:
      shape('M74 80 C72 48 94 32 120 32 C146 32 168 48 166 80Z', C.yellow) +
      shade('M142 35 C158 42 168 58 166 80 L146 80Z') +
      `<path d="M120 34 L120 78 M98 40 L92 78 M142 40 L148 78" ${line(1.2, C.ink, 0.2)}/>` +
      `<circle cx="120" cy="33" r="3.4" fill="${C.yellow}" ${E}/>` +
      shape('M62 78 C90 88 150 88 178 78 L180 90 C150 100 90 100 60 90Z', C.yellow) +
      shade('M62 84 C90 94 150 94 178 84 L180 90 C150 100 90 100 60 90Z'),
  },
]

const FACE: Outfit[] = [
  {
    id: 'mask',
    name: '口罩',
    slot: 'face',
    rarity: 1,
    icon: '66 100 108 48',
    svg:
      `<path d="M98 119 C88 114 78 110 70 108 M142 119 C152 114 162 110 170 108" ${line(1.4, C.ink, 0.3)}/>` +
      shape('M98 117 C108 113 132 113 142 117 L143 134 C134 143 106 143 97 134Z', C.white) +
      `<path d="M100 123 C112 120 128 120 140 123 M100 129.5 C112 126.5 128 126.5 140 129.5" ${line(1.2, C.ink, 0.18)}/>`,
  },
  {
    id: 'square-glasses',
    name: '黑框眼鏡',
    slot: 'face',
    rarity: 1,
    icon: '76 92 88 36',
    svg:
      `<rect x="89" y="101" width="26" height="19" rx="4" fill="${C.white}" opacity=".18"/><rect x="125" y="101" width="26" height="19" rx="4" fill="${C.white}" opacity=".18"/>` +
      `<rect x="89" y="101" width="26" height="19" rx="4" ${line(3, C.ink)}/><rect x="125" y="101" width="26" height="19" rx="4" ${line(3, C.ink)}/>` +
      `<path d="M115 108 Q120 105 125 108 M89 106 L78 103 M151 106 L162 103" ${line(2.6, C.ink)}/>`,
  },
  {
    id: 'bandage',
    name: 'OK 繃',
    slot: 'face',
    rarity: 1,
    icon: '122 98 52 46',
    svg:
      shape('M136 121 L158 113 L161 122 L139 130Z', C.orange) +
      `<path d="M136 121 L158 113 L161 122 L139 130Z" fill="${C.cream}" opacity=".6"/>` +
      `<path d="M144 118.2 L152 115.3 L155 123.7 L147 126.6Z" fill="${C.cream}"/>` +
      dots(C.brown, 0.7, [
        [140, 121],
        [141.5, 125],
        [156, 116],
        [157.5, 120],
      ]),
  },
  {
    id: 'heart-glasses',
    name: '愛心墨鏡',
    slot: 'face',
    rarity: 2,
    icon: '76 90 88 38',
    svg:
      shape('M102 120 C94 114 88 110 88 104 C88 99 92 97 96 97 C99 97 101 99 102 101 C103 99 105 97 108 97 C112 97 116 99 116 104 C116 110 110 114 102 120Z', C.red) +
      shape('M138 120 C130 114 124 110 124 104 C124 99 128 97 132 97 C135 97 137 99 138 101 C139 99 141 97 144 97 C148 97 152 99 152 104 C152 110 146 114 138 120Z', C.red) +
      `<path d="M92 103 C93 100 96 100 98 101 M128 103 C129 100 132 100 134 101" ${line(1.8, C.white, 0.7)}/>` +
      `<path d="M116 103 L124 103 M88 103 L78 100 M152 103 L162 100" ${line(2.4, C.red)}/>`,
  },
  {
    id: 'mustache',
    name: '八字鬍',
    slot: 'face',
    rarity: 2,
    icon: '90 108 60 28',
    svg: shape('M120 122 C114 117 104 117 98 124 C97 126 99 128 101 127 C107 125 114 126 120 125 C126 126 133 125 139 127 C141 128 143 126 142 124 C136 117 126 117 120 122Z', H),
  },
  {
    id: 'star-sticker',
    name: '星星貼紙',
    slot: 'face',
    rarity: 1,
    icon: '68 99 44 44',
    svg: shape(star(90, 121, 7.5, 3.2), C.yellow) + `<circle cx="88" cy="119" r="1.2" fill="${C.white}" opacity=".8"/>`,
  },
]

const HAND: Outfit[] = [
  {
    id: 'suitcase',
    name: '行李箱',
    slot: 'hand',
    rarity: 1,
    icon: '138 206 66 82',
    svg:
      `<path d="M152 224 L158 240 M159 224 L166 240" ${line(2.6, C.grey)}/>` +
      shape('M153 238 L191 238 C194 238 196 240 196 243 L196 272 C196 275 194 277 191 277 L153 277 C150 277 148 275 148 272 L148 243 C148 240 150 238 153 238Z', C.red) +
      shade('M180 238 L191 238 C194 238 196 240 196 243 L196 272 C196 275 194 277 191 277 L180 277Z') +
      `<path d="M160 242 L160 273 M172 242 L172 273 M184 242 L184 273" ${line(1.4, C.ink, 0.2)}/>` +
      shape('M154 248 L166 246 L167 254 L155 256Z', C.cream) +
      `<circle cx="178" cy="262" r="4.6" fill="${C.yellow}" ${E}/>` +
      dots(C.ink, 3, [
        [155, 280],
        [189, 280],
      ]),
  },
  {
    id: 'map',
    name: '旅遊地圖',
    slot: 'hand',
    rarity: 1,
    icon: '132 182 72 56',
    svg:
      shape('M138 194 L196 188 L198 226 L140 232Z', C.cream) +
      shade('M177 190 L196 188 L198 226 L179 228Z') +
      `<ellipse cx="166" cy="202" rx="7" ry="5" fill="${C.green}" opacity=".7"/>` +
      `<path d="M140 214 C152 208 164 218 178 208 C186 202 192 206 198 204" ${line(3, C.blue, 0.7)}/>` +
      `<path d="M157.5 192 L159.5 230 M177 190 L179 228" ${line(1.2, C.ink, 0.22)}/>` +
      `<path d="M146 224 C156 220 164 212 172 206 C180 200 186 198 190 196" ${line(1.8, C.red)} stroke-dasharray="3 2"/>` +
      `<circle cx="190" cy="196" r="3" fill="${C.red}" ${E}/>`,
  },
  {
    id: 'onigiri',
    name: '飯糰',
    slot: 'hand',
    rarity: 1,
    icon: '142 180 56 52',
    svg:
      shape('M162 194 C166 186 176 186 180 194 L191 214 C194 221 190 226 183 226 L159 226 C152 226 148 221 151 214Z', C.white) +
      shade('M180 194 L191 214 C194 221 190 226 183 226 L176 226 C182 216 182 204 180 194Z') +
      shape('M162 210 L180 210 L182 226 L160 226Z', C.ink, 'opacity=".88"') +
      dots(C.ink, 0.9, [
        [168, 198],
        [174, 202],
        [164, 204],
      ], 'opacity=".45"'),
  },
  {
    id: 'ramune',
    name: '彈珠汽水',
    slot: 'hand',
    rarity: 1,
    icon: '146 160 46 84',
    svg:
      shape('M165 172 L173 172 L173 182 C179 186 181 192 179 200 L177 234 C177 237 175 238 173 238 L165 238 C163 238 161 237 161 234 L159 200 C157 192 159 186 165 182Z', C.blue, 'fill-opacity=".55"') +
      shape('M164 166 L174 166 L174 173 L164 173Z', C.blue) +
      `<path d="M165 182 C167 186 171 186 173 182" ${line(1.2, C.ink, 0.25)}/>` +
      `<circle cx="169" cy="194" r="4" fill="${C.white}" opacity=".85" ${E}/>` +
      `<path d="M163.5 204 L164.5 228" ${line(2, C.white, 0.65)}/>`,
  },
  {
    id: 'taiyaki',
    name: '鯛魚燒',
    slot: 'hand',
    rarity: 1,
    icon: '138 188 66 44',
    svg:
      shape('M146 214 C150 202 166 196 182 200 L192 196 C196 194 200 196 198 202 L194 210 L198 218 C200 224 196 226 192 224 L182 220 C166 226 150 226 146 214Z', C.orange) +
      `<path d="M146 214 C150 202 166 196 182 200 L192 196 C196 194 200 196 198 202 L194 210 L198 218 C200 224 196 226 192 224 L182 220 C166 226 150 226 146 214Z" fill="${C.brown}" opacity=".32"/>` +
      `<path d="M164 210 Q168 206 172 210 M172 214 Q176 210 180 214 M164 218 Q168 214 172 218 M182 202 C178 208 178 214 182 220" ${line(1.4, C.brown, 0.75)}/>` +
      `<path d="M148 216 L153 215" ${line(1.4, C.ink, 0.6)}/>` +
      `<circle cx="155" cy="208" r="2" fill="${C.ink}"/>`,
  },
  {
    id: 'clear-umbrella',
    name: '透明傘',
    slot: 'hand',
    rarity: 2,
    icon: '128 72 112 168',
    svg:
      `<path d="M158 226 L184 124" ${line(2.6, C.grey)}/>` +
      `<path d="M158 226 C157 234 149 236 147 230" ${line(3.4, C.ink, 0.8)}/>` +
      shape('M136 126 C140 96 162 82 184 82 C206 82 228 96 232 126 C221 120 210 120 199 126 C188 120 177 120 166 126 C156 120 146 120 136 126Z', C.white, 'fill-opacity=".6"') +
      `<path d="M184 82 L136 126 M184 82 L166 126 M184 82 L199 126 M184 82 L232 126" ${line(1.2, C.grey)}/>` +
      `<path d="M150 104 C158 94 168 90 176 89" ${line(2.4, C.white, 0.8)}/>` +
      `<circle cx="184" cy="81" r="3" fill="${C.grey}"/>`,
  },
  {
    id: 'ekiben',
    name: '車站便當',
    slot: 'hand',
    rarity: 2,
    icon: '128 192 72 46',
    svg:
      shape('M136 204 L188 200 L196 212 L144 216Z', C.cream) +
      shape('M139 205 L161 203 L166 211 L144 213Z', C.white) +
      `<circle cx="153" cy="208" r="2.4" fill="${C.red}"/>` +
      shape('M163 203 L175 202 L179 209 L167 210Z', C.orange) +
      shape('M177 202 L187 201 L191 207 L181 208Z', C.yellow) +
      `<ellipse cx="185" cy="210" rx="3.4" ry="2" fill="${C.green}"/>` +
      shape('M144 216 L196 212 L196 228 L144 232Z', C.brown) +
      `<path d="M144 216 L196 212 L196 228 L144 232Z" fill="url(#doll-wood)" opacity=".7"/>` +
      shape('M136 204 L144 216 L144 232 L136 220Z', C.brown) +
      shade('M136 204 L144 216 L144 232 L136 220Z') +
      `<path d="M170 214 L170 230" ${line(2.6, C.red, 0.9)}/>`,
  },
  {
    id: 'soft-serve',
    name: '霜淇淋',
    slot: 'hand',
    rarity: 1,
    icon: '138 150 54 88',
    svg:
      shape('M150 196 L174 196 L162 234Z', C.orange) +
      `<path d="M150 196 L174 196 L162 234Z" fill="url(#doll-waffle)"/>` +
      shape('M148 197 C145 187 151 181 159 181 C157 173 163 167 160 158 C170 162 175 172 171 181 C179 182 183 190 177 197Z', C.white) +
      shade('M171 181 C179 182 183 190 177 197 L166 197 C172 192 174 186 171 181Z') +
      `<path d="M150 190 C158 192 168 192 175 188 M155 182 C160 184 166 184 170 181" ${line(1.4, C.ink, 0.15)}/>`,
  },
  {
    id: 'paper-crane',
    name: '紙鶴',
    slot: 'hand',
    rarity: 2,
    icon: '134 170 72 50',
    svg:
      shape('M188 206 L201 189 L196 207Z', C.red) +
      shape('M156 206 L145 190 L149 189 L160 203Z', C.red) +
      shape('M145 190 L140 194 L147 192Z', C.red) +
      shape('M152 208 L172 198 L192 208 L172 214Z', C.red) +
      shade('M172 198 L192 208 L172 214Z') +
      shape('M174 202 L196 185 L184 206Z', C.red) +
      shade('M174 202 L196 185 L184 206Z') +
      shape('M166 202 L183 175 L178 205Z', C.red) +
      `<path d="M172 199 L172 213 M166 202 L180 182" ${line(1, C.white, 0.5)}/>`,
  },
]

const BUDDY: Outfit[] = [
  {
    id: 'shiba',
    name: '柴犬',
    slot: 'buddy',
    rarity: 2,
    icon: '24 206 78 92',
    svg:
      `<path d="M76 278 C90 276 94 262 86 256 C80 252 76 260 82 264" ${line(7, C.orange)}/>` +
      `<path d="M78 276 C88 274 91 264 86 259" ${line(2.4, C.cream)}/>` +
      shape('M36 292 C32 270 40 256 58 254 C76 256 84 270 80 292Z', C.orange) +
      shade('M66 255 C76 258 84 270 80 292 L68 292 C74 280 72 264 66 255Z') +
      shape('M48 292 C46 276 52 266 58 266 C64 266 70 276 68 292Z', C.cream) +
      shape('M38 238 L40 214 L56 228Z', C.orange) +
      shape('M78 238 L76 214 L60 228Z', C.orange) +
      shape('M42 232 L43 220 L51 228Z', C.cream) +
      shape('M74 232 L73 220 L65 228Z', C.cream) +
      shape('M58 222 C74 222 82 232 82 244 C82 256 72 262 58 262 C44 262 34 256 34 244 C34 232 42 222 58 222Z', C.orange) +
      shape('M38 248 C42 240 52 238 58 245 C64 238 74 240 78 248 C76 258 67 262 58 262 C49 262 40 258 38 248Z', C.cream) +
      dots(C.cream, 2.2, [
        [50, 236],
        [66, 236],
      ]) +
      dots(C.ink, 2.6, [
        [50, 242],
        [66, 242],
      ]) +
      `<ellipse cx="58" cy="250" rx="3.4" ry="2.4" fill="${C.ink}"/>` +
      `<path d="M54 255 Q58 258 62 255" ${line(1.4)}/>`,
  },
  {
    id: 'calico',
    name: '三花貓',
    slot: 'buddy',
    rarity: 2,
    icon: '24 206 78 92',
    svg:
      `<path d="M74 288 C90 288 92 274 86 264" ${line(6, C.white)}/>` +
      `<path d="M86 264 L87 260" ${line(6, C.ink)}/>` +
      shape('M38 292 C34 270 42 258 58 258 C74 258 82 270 78 292Z', C.white) +
      shape('M40 276 C42 266 50 262 56 266 C54 276 48 282 40 284Z', C.orange) +
      shape('M68 262 C76 264 80 274 78 282 C72 280 66 272 68 262Z', C.ink) +
      shape('M40 238 L40 214 L56 230Z', C.orange) +
      shape('M76 238 L76 214 L60 230Z', C.ink) +
      shape('M58 226 C74 226 80 236 80 248 C80 260 70 266 58 266 C46 266 36 260 36 248 C36 236 42 226 58 226Z', C.white) +
      shape('M37 244 C38 232 46 227 54 228 C52 236 46 244 37 248Z', C.orange) +
      shape('M62 228 C72 229 79 236 79 244 C72 242 64 236 62 228Z', C.ink) +
      shape('M44 226 L44 220 L50 226Z', C.pink) +
      dots(C.ink, 2.4, [
        [50, 248],
        [66, 248],
      ]) +
      `<path d="M56 253 L60 253 L58 255.5Z" fill="${C.pink}"/>` +
      `<path d="M54 258 Q56 260 58 258 Q60 260 62 258 M40 252 L48 254 M40 258 L48 257 M76 252 L68 254 M76 258 L68 257" ${line(1.2, C.ink, 0.7)}/>`,
  },
  {
    id: 'teru-teru',
    name: '晴天娃娃',
    slot: 'buddy',
    rarity: 1,
    icon: '26 202 64 96',
    svg:
      `<path d="M58 222 L58 208" ${line(1.4, C.ink, 0.45)}/>` +
      shape('M42 248 C38 266 32 282 38 292 C46 288 50 294 58 290 C66 294 70 288 78 292 C84 282 78 266 74 248Z', C.white) +
      shade('M68 250 L74 248 C78 266 84 282 78 292 C74 290 72 290 70 291 C74 278 72 262 68 250Z') +
      `<circle cx="58" cy="236" r="16" fill="${C.white}" ${E}/>` +
      `<path d="M44 250 Q58 256 72 250" ${line(2.4, C.red)}/>` +
      `<ellipse cx="49" cy="242" rx="3" ry="1.8" fill="${C.pink}" opacity=".8"/><ellipse cx="67" cy="242" rx="3" ry="1.8" fill="${C.pink}" opacity=".8"/>` +
      `<path d="M51 236 Q53 233 55 236 M61 236 Q63 233 65 236 M54 241 Q58 245 62 241" ${line(1.6)}/>`,
  },
  {
    id: 'snowman',
    name: '雪人',
    slot: 'buddy',
    rarity: 1,
    icon: '20 206 76 94',
    svg:
      `<path d="M40 268 L26 258 M76 268 L90 256 M30 261 L28 254 M86 259 L90 252" ${line(2, C.brown)}/>` +
      `<circle cx="58" cy="276" r="20" fill="${C.white}" ${E}/>` +
      shade('M68 259 C76 264 80 272 78 282 C76 290 70 295 62 296 C72 288 74 272 68 259Z') +
      `<circle cx="58" cy="242" r="15" fill="${C.white}" ${E}/>` +
      `<path d="M46 254 Q58 260 70 254" ${line(4, C.blue)}/>` +
      shape('M48 230 L68 230 L65 214 L51 214Z', C.red) +
      shade('M60 214 L65 214 L68 230 L62 230Z') +
      dots(C.ink, 2.2, [
        [52, 240],
        [64, 240],
      ]) +
      `<path d="M58 244 L64 246 L58 247Z" fill="${C.orange}"/>` +
      dots(C.ink, 2, [
        [58, 268],
        [58, 280],
      ]),
  },
  {
    id: 'goldfish',
    name: '金魚缸',
    slot: 'buddy',
    rarity: 2,
    icon: '24 236 70 64',
    svg:
      shape('M34 252 C30 262 30 280 40 290 C48 296 68 296 76 290 C86 280 86 262 82 252Z', C.blue, 'fill-opacity=".55"') +
      `<path d="M33 260 C46 264 70 264 83 260" ${line(1.4, C.blue, 0.7)}/>` +
      `<path d="M68 292 C66 284 70 280 68 272 M72 291 C74 284 72 280 74 276" ${line(2.4, C.green)}/>` +
      shape('M48 276 C52 270 60 270 64 276 C60 282 52 282 48 276Z', C.red) +
      shape('M64 276 L72 270 L70 282Z', C.red) +
      `<circle cx="52.5" cy="275" r="1.2" fill="${C.ink}"/>` +
      shape('M38 268 C40 264 45 264 47 268 C45 272 40 272 38 268Z', C.orange) +
      shape('M47 268 L52 265 L51 271Z', C.orange) +
      `<circle cx="44" cy="258" r="1.8" ${line(1, C.white, 0.8)}/><circle cx="48" cy="252" r="1.3" ${line(1, C.white, 0.8)}/>` +
      `<ellipse cx="58" cy="252" rx="26" ry="5" ${line(2.4, C.blue, 0.6)}/>` +
      `<path d="M38 268 C36 276 38 284 44 288" ${line(2.4, C.white, 0.55)}/>`,
  },
]

export const MORE_OUTFITS: Outfit[] = [...BODY, ...HEAD, ...FACE, ...HAND, ...BUDDY]
