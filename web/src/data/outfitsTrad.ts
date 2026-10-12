import type { Outfit } from './outfits'
import { C, dots, E, HAKAMA, HAORI_L, HAORI_R, line, LONG, LONG_SHADE, PANTS, ROBE, shape, SLEEVE_L, SLEEVE_R, vtext } from './dollArt'
import { robe } from './outfitsPref'
import { beige, BODY_ICON, COLLAR, FURI_L, FURI_R, HAKAMA_SHADE, mon, pat, PLEATS, ROBE_SHORT, ROBE_SHORT_SHADE, ROBE_UP, shade } from './outfitsWa'

/**
 * 各縣的傳統服裝，第二批 35 件（使用者回饋 2026-10-12：其他縣也各加一件）。加上 outfitsWa.ts 的 12 件，47 縣各一件；
 * 去過那個縣之後加進扭蛋（不是代表單品）。題材取自那個縣實際的祭典（data/festivals）、經濟產業大臣指定的傳統工藝品
 * 與代表的景點，出處寫在每一件上面。畫法同 outfitsWa.ts（剪紙、平塗、淡邊），花紋在 DollDefs.vue。
 */

const ROBE_SHADE = 'M144 151 L153 162 L158 274 L138 274Z'
// 狩衣、神樂的寬袖（只在背後縫住，垂到大腿）
const KARI_L = 'M96 154 C84 156 66 164 60 178 L56 238 C56 244 60 247 66 247 L92 247 L94 200Z'
const KARI_R = 'M144 154 C156 156 174 164 180 178 L184 238 C184 244 180 247 174 247 L148 247 L146 200Z'
// 長到小腿的白腳絆（行衣、鬼）
const KYAHAN =
  shape('M97 254 L117 254 L116 272 L98 272Z', C.white) +
  shape('M123 254 L143 254 L142 272 L124 272Z', C.white) +
  `<path d="M98 262 L116 262 M124 262 L142 262" ${line(1.2, C.ink, 0.25)}/>`
/** 和服袖子的下緣停在 b（斎王的袿一層一層露出來） */
const furiL = (b: number) => `M92 156 C80 158 70 166 68 180 L64 ${b - 12} C64 ${b - 4} 70 ${b} 78 ${b} L95 ${b} L95 170Z`
const furiR = (b: number) => `M148 156 C160 158 170 166 172 180 L176 ${b - 12} C176 ${b - 4} 170 ${b} 162 ${b} L145 ${b} L145 170Z`
/** 山小屋的朱印 */
const stamp = (x: number, y: number, r: number) =>
  `<g transform="rotate(${r} ${x} ${y})"><rect x="${x - 4.5}" y="${y - 4.5}" width="9" height="9" rx="1.4" fill="${C.red}" opacity=".85"/>` +
  `<path d="M${x - 2.4} ${y - 1.4} L${x + 2.4} ${y - 1.4} M${x} ${y - 1.4} L${x} ${y + 2.6}" ${line(1.1, C.white)}/></g>`
/** 桔梗紋（龍馬的紋付） */
const kikyo = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="4.6" fill="${C.white}"/>` +
  `<g fill="${C.ink}">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - 1.9}" rx="1.1" ry="1.8" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g>` +
  `<circle cx="${x}" cy="${y}" r=".8" fill="${C.white}"/>`
/** 草繩：黃底上一段一段的棕色，看起來是擰的 */
const rope = (d: string) => `<path d="${d}" ${line(5, C.yellow)}/><path d="${d}" fill="none" stroke="${C.brown}" stroke-width="5" stroke-dasharray="1.6 2.4" stroke-opacity=".5"/>`
/** 朝顔（浪華本染） */
const asagao = (x: number, y: number, r = 7) =>
  `<g fill="${C.navy}" ${E}>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${x}" cy="${+(y - r * 0.5).toFixed(2)}" r="${+(r * 0.56).toFixed(2)}" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g>` +
  `<circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="${C.navy}"/>` +
  `<g ${line(0.9, C.white, 0.75)}>${[0, 72, 144, 216, 288].map((a) => `<path d="M${x} ${y} L${x} ${+(y - r * 0.85).toFixed(2)}" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g>` +
  `<circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="${C.white}"/>`

export const TRAD_OUTFITS: Outfit[] = [
  {
    // 二風谷アットゥシ（經濟產業大臣指定傳統工藝品）：オヒョウの樹皮纖維織的布，袖口、下襬、前襟貼藍布、繡白色的渦紋
    id: 'hokkaido-attush',
    name: '二風谷厚司織',
    slot: 'body',
    pref: 'hokkaido',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      beige(LONG) +
      beige(ROBE) +
      shade(LONG_SHADE) +
      shade(ROBE_SHADE) +
      shape('M69.6 204 L89 206 L89 216 L69 214Z', C.navy) +
      shape('M151 206 L170.4 204 L171 214 L151 216Z', C.navy) +
      shape('M83.5 252 L156.5 252 L158 274 L82 274Z', C.navy) +
      `<path d="M106 150 L122 196 L124 252 M134 150 L124 178" ${line(7, C.navy)}/>` +
      `<path d="M108.5 155 L121 192 L122.6 248" ${line(1.2, C.white)}/>` +
      `<path d="M88 264 C88 258 96 258 96 264 C96 270 104 270 104 264 M136 264 C136 258 144 258 144 264 C144 270 152 270 152 264 M110 264 C110 259 116 258 118 262 C120 266 126 265 126 260" ${line(1.5, C.white)}/>` +
      `<path d="M72 209.5 L87 211 M153 211 L168 209.5" ${line(1.3, C.white)}/>` +
      shape('M86 196 L154 196 L154 203 L86 203Z', C.red) +
      `<path d="M86 199.5 L154 199.5" ${line(1, C.white, 0.6)}/>`,
  },
  {
    // 藤原まつり（data/festivals）的源義經東下行列：平安時代的狩衣、指貫
    id: 'iwate-kariginu',
    name: '藤原祭狩衣',
    slot: 'body',
    pref: 'iwate',
    rarity: 3,
    icon: '50 140 140 140',
    svg:
      shape('M86 200 L154 200 C162 230 163 258 155 271 C149 278 133 278 125 271 L120 258 L115 271 C107 278 91 278 85 271 C77 258 78 230 86 200Z', C.purple) +
      pat('M86 200 L154 200 C162 230 163 258 155 271 C149 278 133 278 125 271 L120 258 L115 271 C107 278 91 278 85 271 C77 258 78 230 86 200Z', 'doll-dots') +
      shade('M140 200 L154 200 C162 230 163 258 155 271 C151 276 144 277 140 276Z') +
      `<path d="M120 214 L120 258" ${line(1.2, C.ink, 0.3)}/>` +
      shape(KARI_L, C.blue) +
      shape(KARI_R, C.blue) +
      shade(KARI_R) +
      // 袖只在背後縫住：袖與身之間露出白色的單
      shape('M87 158 L95 156 L93 236 L85 236Z', C.white) +
      shape('M153 158 L145 156 L147 236 L155 236Z', C.white) +
      shape('M100 151 L140 151 L148 160 L150 238 L90 238 L92 160Z', C.blue) +
      shade('M136 151 L140 151 L148 160 L150 238 L136 238Z') +
      `<path d="M94 160 L92 238 M146 160 L148 238" ${line(1.2, C.ink, 0.25)}/>` +
      `<path d="M102 151 Q120 168 138 151" ${line(4.5, C.navy)}/>` +
      `<circle cx="139" cy="153" r="2.6" fill="${C.white}" ${E}/>` +
      shape('M91 204 L149 204 L149 210 L91 210Z', C.navy) +
      `<path d="M58 238 C66 243 82 244 92 243 M182 238 C174 243 158 244 148 243" fill="none" stroke="${C.white}" stroke-width="2" stroke-dasharray="3 2" stroke-linecap="round"/>` +
      `<path d="M61 244 L59 255 M64 245 L64 256 M179 244 L181 255 M176 245 L176 256" ${line(1.6, C.white)}/>`,
  },
  {
    // 置賜紬（經濟產業大臣指定）：米澤一帶，紅花染的絣
    id: 'yamagata-oitama',
    name: '置賜紬',
    slot: 'body',
    pref: 'yamagata',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.orange, pattern: 'doll-kasuri-w', collar: C.cream, obi: C.navy, obiLine: C.orange }),
  },
  {
    // 会津まつり（data/festivals）的會津藩公行列：白虎隊的和服、白襷、袴與刀
    id: 'fukushima-byakkotai',
    name: '白虎隊裝束',
    slot: 'body',
    pref: 'fukushima',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.navy) +
      shape(SLEEVE_R, C.navy) +
      shade(SLEEVE_R) +
      shape(ROBE_UP, C.navy) +
      COLLAR(C.white, 4) +
      shape(HAKAMA, C.grey) +
      pat(HAKAMA, 'doll-stripes') +
      shade(HAKAMA_SHADE) +
      PLEATS +
      `<path d="M86 199.5 L154 199.5" ${line(3, C.ink)}/>` +
      `<path d="M95 158 L147 199 M145 158 L93 199" ${line(3.4, C.white)}/>` +
      `<path d="M150 210 L176 230" ${line(4, C.ink)}/>` +
      `<path d="M145 203 L168 190" ${line(3.6, C.ink)}/>` +
      `<path d="M150 200.5 L165 192" fill="none" stroke="${C.white}" stroke-width="2.2" stroke-dasharray="1.6 2" stroke-opacity=".7"/>` +
      `<ellipse cx="146.5" cy="203.5" rx="2.4" ry="4" fill="${C.gold}" ${E} transform="rotate(-30 146.5 203.5)"/>`,
  },
  {
    // 本場結城紬（經濟產業大臣指定，茨城・栃木）：亀甲絣
    id: 'ibaraki-yuki',
    name: '結城紬',
    slot: 'body',
    pref: 'ibaraki',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.navy, pattern: 'doll-kikko', collar: C.cream, obi: C.brown, obiLine: C.cream }),
  },
  {
    // 日光修驗：日光山輪王寺的強飯式（同類的発光路の強飯式在 data/festivals）由山伏打扮的僧人主持。柿色的鈴懸、結袈裟的梵天
    id: 'tochigi-yamabushi',
    name: '日光山伏裝束',
    slot: 'body',
    pref: 'tochigi',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.orange) +
      shape(SLEEVE_R, C.orange) +
      pat(SLEEVE_L, 'doll-check') +
      pat(SLEEVE_R, 'doll-check') +
      shade(SLEEVE_R) +
      shape(ROBE_UP, C.orange) +
      pat(ROBE_UP, 'doll-check') +
      COLLAR(C.white) +
      shape(HAKAMA, C.orange) +
      pat(HAKAMA, 'doll-check') +
      shade(HAKAMA_SHADE) +
      PLEATS +
      `<path d="M86 199.5 L154 199.5" ${line(3, C.white)}/>` +
      `<path d="M110 151 L106 200 M130 151 L134 200" ${line(3, C.purple)}/>` +
      [
        [108.9, 164],
        [107.6, 180.5],
        [106.3, 196.5],
        [131.1, 164],
        [132.4, 180.5],
        [133.7, 196.5],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.6" fill="${C.white}" ${E}/><path d="M${x! - 3} ${y} Q${x} ${y! - 2.4} ${x! + 3} ${y}" ${line(1, C.ink, 0.2)}/>`)
        .join(''),
  },
  {
    // 伊勢崎絣（經濟產業大臣指定）：大正、昭和流行的伊勢崎銘仙，矢絣
    id: 'gunma-isesaki',
    name: '伊勢崎銘仙',
    slot: 'body',
    pref: 'gunma',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.purple, pattern: 'doll-yagasuri', collar: C.cream, obi: C.yellow, obiLine: C.red }),
  },
  {
    // 秩父銘仙（經濟產業大臣指定）：ほぐし織，花的輪廓柔柔的
    id: 'saitama-chichibu',
    name: '秩父銘仙',
    slot: 'body',
    pref: 'saitama',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.cream, pattern: 'doll-hogushi', collar: C.white, obi: C.green, obiLine: C.pink }),
  },
  {
    // 房總的萬祝（まいわい）：大漁時船主送給漁夫的祝衣，藍底染上鶴、日出與浪
    id: 'chiba-maiwai',
    name: '萬祝大漁衣',
    slot: 'body',
    pref: 'chiba',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.navy) +
      shape(SLEEVE_R, C.navy) +
      shade(SLEEVE_R) +
      shape(ROBE, C.navy) +
      shade(ROBE_SHADE) +
      shape('M83.3 250 C88 244 94 244 98 250 C102 244 110 244 114 250 C118 244 126 244 130 250 C134 244 142 244 146 250 C150 244 154 245 156.7 249 L158 274 L82 274Z', C.blue) +
      `<path d="M84 259 C90 253 96 255 100 259 C106 253 112 255 118 259 C124 253 130 255 136 259 C142 253 148 255 156 259 M84 268 C90 262 96 264 100 268 C106 262 112 264 118 268 C124 262 130 264 136 268 C142 262 148 264 157 268" ${line(1.6, C.white)}/>` +
      `<circle cx="100" cy="176" r="8" fill="${C.red}" ${E}/>` +
      shape('M116 230 C122 226 134 226 140 230 C134 234 122 234 116 230Z', C.white) +
      shape('M122 228 L112 212 L128 224Z', C.white) +
      shape('M132 228 L146 211 L138 226Z', C.white) +
      `<path d="M116 230 C110 228 106 223 101 223" ${line(2.2, C.white)}/>` +
      `<circle cx="100.5" cy="223" r="2" fill="${C.red}"/>` +
      `<path d="M140 230 L149 235" ${line(2.4, C.ink)}/>` +
      COLLAR(C.white, 6) +
      shape('M86 196 L154 196 L154 203 L86 203Z', C.brown),
  },
  {
    // 小田原北條五代祭り（data/festivals）的武者行列：黑漆的胴、紅色的縅，胸前是北條的三つ鱗
    id: 'kanagawa-hojo',
    name: '小田原北條鎧',
    slot: 'body',
    pref: 'kanagawa',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      shape('M95 250 L115 250 L116 272 L96 272Z', C.ink) +
      shape('M125 250 L145 250 L144 272 L124 272Z', C.ink) +
      `<path d="M98 256 L113 256 M98 263 L114 263 M127 256 L142 256 M126 263 L142 263" ${line(1.4, C.gold, 0.8)}/>` +
      shape(LONG, C.navy) +
      shade(LONG_SHADE) +
      shape('M70 196 L88 198 L88 212 L69.5 210Z', C.ink) +
      shape('M152 198 L170 196 L170.5 210 L152 212Z', C.ink) +
      ['M87 204 L103 204 L102 242 L85 242Z', 'M105 204 L119 204 L119 244 L104 244Z', 'M121 204 L135 204 L136 244 L121 244Z', 'M137 204 L153 204 L155 242 L138 242Z']
        .map((d) => shape(d, C.ink))
        .join('') +
      `<path d="M86 214 L154 214 M86 224 L154 224 M85.5 234 L154.5 234" ${line(2, C.red)}/>` +
      shape('M95 152 L145 152 L151 162 L151 206 L89 206 L89 162Z', C.ink) +
      `<path d="M90 186 L150 186 M90 196 L150 196" ${line(2.2, C.red)}/>` +
      shape('M120 158 L126 168 L114 168Z', C.gold) +
      shape('M114 168 L120 178 L108 178Z', C.gold) +
      shape('M126 168 L132 178 L120 178Z', C.gold) +
      shape('M74 156 L96 152 L96 188 L71 192Z', C.ink) +
      shape('M166 156 L144 152 L144 188 L169 192Z', C.ink) +
      `<path d="M73 166 L96 163 M72.5 176 L96 173 M72 186 L96 183 M167 166 L144 163 M167.5 176 L144 173 M168 186 L144 183" ${line(2, C.red)}/>`,
  },
  {
    // 吉田の火祭（data/festivals）：富士山的山閉。富士講的白色行衣，蓋滿山小屋的朱印
    id: 'yamanashi-fujiko',
    name: '富士講行衣',
    slot: 'body',
    pref: 'yamanashi',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      KYAHAN +
      shape(SLEEVE_L, C.white) +
      shape(SLEEVE_R, C.white) +
      shade(SLEEVE_R) +
      shape(ROBE_SHORT, C.white) +
      shade(ROBE_SHORT_SHADE) +
      COLLAR(C.cream) +
      shape('M120 186 L128 172 L132 172 L140 186Z', C.blue) +
      shape('M126.4 175.5 L128 172 L132 172 L133.6 175.5 L131.6 177.5 L130 175.8 L128.4 177.5Z', C.white) +
      stamp(100, 174, -8) +
      stamp(77, 206, 6) +
      stamp(163, 196, -4) +
      stamp(110, 226, 10) +
      stamp(138, 240, -6) +
      stamp(96, 244, 4) +
      stamp(146, 216, 8) +
      `<path d="M86 200 L154 200" ${line(3, C.cream)}/>` +
      `<path d="M104 200 L100 214 M104 200 L107 213" ${line(2.2, C.cream)}/>`,
  },
  {
    // 信州紬（經濟產業大臣指定）：上田紬一類的格子
    id: 'nagano-tsumugi',
    name: '信州紬',
    slot: 'body',
    pref: 'nagano',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.matcha, pattern: 'doll-check', collar: C.cream, obi: C.brown, obiLine: C.cream }),
  },
  {
    // 長良川鵜飼的鵜匠（頭上的風折烏帽子已有）：藍色漁服、胸當て、草編的腰蓑
    id: 'gifu-usho',
    name: '鵜匠腰蓑',
    slot: 'body',
    pref: 'gifu',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.navy) +
      shape(LONG, C.navy) +
      shade(LONG_SHADE) +
      shape('M100 154 L140 154 L142 204 L98 204Z', C.ink) +
      `<path d="M104 155 L110 150 M136 155 L130 150" ${line(1.6, C.ink)}/>` +
      shape('M86 202 L154 202 L158 228 L154 252 L148 236 L142 256 L136 238 L130 258 L124 240 L118 258 L112 240 L106 256 L100 236 L94 254 L88 234 L82 250 L82 226Z', C.yellow) +
      `<path d="M86 202 L154 202 L158 228 L154 252 L148 236 L142 256 L136 238 L130 258 L124 240 L118 258 L112 240 L106 256 L100 236 L94 254 L88 234 L82 250 L82 226Z" fill="${C.brown}" opacity=".3"/>` +
      `<path d="M92 206 L90 232 M100 206 L100 234 M108 206 L110 238 M116 206 L118 244 M124 206 L124 238 M132 206 L134 240 M140 206 L142 236 M148 206 L150 232" ${line(1, C.brown, 0.55)}/>` +
      `<path d="M86 203 L154 203" ${line(3.2, C.brown)}/>`,
  },
  {
    // 靜岡茶（data/specialties）：茶摘的打扮，紺絣、紅襷、紅前掛，腰邊的茶籠
    id: 'shizuoka-chatsumi',
    name: '茶摘裝束',
    slot: 'body',
    pref: 'shizuoka',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.navy) +
      shape(SLEEVE_R, C.navy) +
      pat(SLEEVE_L, 'doll-kasuri-w') +
      pat(SLEEVE_R, 'doll-kasuri-w') +
      shade(SLEEVE_R) +
      shape(ROBE, C.navy) +
      pat(ROBE, 'doll-kasuri-w') +
      shade(ROBE_SHADE) +
      COLLAR(C.white) +
      shape('M94 208 L146 208 L148 262 L92 262Z', C.red) +
      shade('M136 208 L146 208 L148 262 L136 262Z') +
      shape('M86 198 L154 198 L154 208 L86 208Z', C.yellow) +
      `<path d="M95 158 L147 198 M145 158 L93 198" ${line(3.2, C.red)}/>` +
      `<path d="M145 215 L136 199" ${line(1.6, C.brown)}/>` +
      dots(C.green, 2.8, [
        [146, 214],
        [152, 211.5],
        [158, 212],
        [163, 214.5],
      ]) +
      shape('M142 214 L166 214 L163 238 L145 238Z', C.yellow) +
      `<path d="M142 214 L166 214 L163 238 L145 238Z" fill="${C.brown}" opacity=".35"/>` +
      `<path d="M143 220 L165 220 M143.5 226 L164.5 226 M144 232 L164 232 M150 214 L151 238 M158 214 L157 238" ${line(1, C.brown, 0.6)}/>`,
  },
  {
    // あえのこと（奧能登，聯合國教科文組織無形文化遺產；data/festivals）：主人穿裃迎田之神
    id: 'ishikawa-kamishimo',
    name: '饗之事裃',
    slot: 'body',
    pref: 'ishikawa',
    rarity: 3,
    icon: '54 140 132 140',
    svg:
      shape(SLEEVE_L, C.brown) +
      shape(SLEEVE_R, C.brown) +
      shade(SLEEVE_R) +
      shape(ROBE_UP, C.brown) +
      COLLAR(C.white, 4) +
      shape(HAKAMA, C.blue) +
      shade(HAKAMA_SHADE) +
      PLEATS +
      `<path d="M86 199.5 L154 199.5" ${line(3, C.blue)}/>` +
      shape('M60 150 C80 148 96 147 106 149 L119 200 L98 200 L93 162 C80 162 70 161 62 160Z', C.blue) +
      shape('M180 150 C160 148 144 147 134 149 L121 200 L142 200 L147 162 C160 162 170 161 178 160Z', C.blue) +
      shade('M180 150 C160 148 144 147 134 149 L121 200 L142 200 L147 162 C160 162 170 161 178 160Z') +
      mon(103, 174) +
      mon(137, 174),
  },
  {
    // 大本山永平寺（景點）：雲水的黑色法衣，胸前的絡子
    id: 'fukui-unsui',
    name: '永平寺雲水衣',
    slot: 'body',
    pref: 'fukui',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape('M92 156 C80 158 70 166 68 180 L66 246 C66 252 70 255 76 255 L95 255 L95 170Z', C.ink) +
      shape('M148 156 C160 158 170 166 172 180 L174 246 C174 252 170 255 164 255 L145 255 L145 170Z', C.ink) +
      shape(ROBE, C.ink) +
      `<path d="M98 214 L96 270 M142 214 L144 270 M80 200 L78 248 M160 200 L162 248" ${line(1.2, C.white, 0.16)}/>` +
      COLLAR(C.white, 5) +
      `<path d="M108 152 L105 175 M132 152 L135 175" ${line(2, C.navy)}/>` +
      shape('M102 174 L138 174 L138 200 L102 200Z', C.navy) +
      `<path d="M114 174 L114 200 M126 174 L126 200 M102 187 L138 187" ${line(1, C.white, 0.35)}/>` +
      `<circle cx="106" cy="171" r="3.2" fill="none" stroke="${C.gold}" stroke-width="1.6"/>`,
  },
  {
    // 斎王まつり（data/festivals，明和町）的斎王群行：袿一層一層的襲色、唐衣、緋袴
    id: 'mie-saio',
    name: '斎王十二單',
    slot: 'body',
    pref: 'mie',
    rarity: 3,
    icon: '56 140 128 140',
    svg:
      shape('M86 198 L154 198 L164 274 L76 274Z', C.red) +
      PLEATS +
      shade('M140 198 L154 198 L164 274 L140 274Z') +
      [
        [266, C.green],
        [262, C.yellow],
        [258, C.pink],
        [254, C.purple],
      ]
        .map(([b, c]) => shape(furiL(b as number), c as string) + shape(furiR(b as number), c as string))
        .join('') +
      shade(furiR(254)) +
      pat(furiL(254), 'doll-asanoha') +
      pat(furiR(254), 'doll-asanoha') +
      shape(ROBE_UP, C.purple) +
      pat(ROBE_UP, 'doll-asanoha') +
      shape('M94 151 L112 151 L114 198 L82 198 L84 164Z', C.gold) +
      shape('M146 151 L128 151 L126 198 L158 198 L156 164Z', C.gold) +
      pat('M94 151 L112 151 L114 198 L82 198 L84 164Z', 'doll-kiriko') +
      pat('M146 151 L128 151 L126 198 L158 198 L156 164Z', 'doll-kiriko') +
      shade('M146 151 L128 151 L126 198 L158 198 L156 164Z') +
      COLLAR(C.green, 11) +
      COLLAR(C.yellow, 8) +
      COLLAR(C.pink, 5) +
      COLLAR(C.white, 2) +
      `<path d="M84 198.5 L156 198.5" ${line(3, C.white)}/>`,
  },
  {
    // 近江上布（經濟產業大臣指定）：麻布，十字絣
    id: 'shiga-omi',
    name: '近江上布',
    slot: 'body',
    pref: 'shiga',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.white, pattern: 'doll-juji', collar: C.blue, obi: C.navy, obiLine: C.blue }),
  },
  {
    // 浪華本染め（經濟產業大臣指定，注染）：下襬染得深、往上淡，白底上的朝顏
    id: 'osaka-chusen',
    name: '浪華本染浴衣',
    slot: 'body',
    pref: 'osaka',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({
      base: C.white,
      collar: C.navy,
      obi: C.yellow,
      obiLine: C.red,
      extra:
        `<path d="M84 236 L156.2 236 L158 274 L82 274Z" fill="${C.blue}" opacity=".45"/>` +
        `<path d="M83 252 L157 252 L158 274 L82 274Z" fill="${C.navy}" opacity=".55"/>` +
        `<path d="M66 214 L95 214 L95 234 L78 234 C71 234 66 231 66 224Z M174 214 L145 214 L145 234 L162 234 C169 234 174 231 174 224Z" fill="${C.blue}" opacity=".5"/>` +
        `<ellipse cx="110" cy="177" rx="4.5" ry="2.4" fill="${C.green}" transform="rotate(-30 110 177)"/>` +
        `<ellipse cx="126" cy="230" rx="4.5" ry="2.4" fill="${C.green}" transform="rotate(30 126 230)"/>` +
        asagao(100, 172) +
        asagao(138, 178, 6) +
        asagao(110, 226, 6) +
        asagao(136, 224) +
        asagao(79, 192, 6) +
        asagao(162, 198, 6),
    }),
  },
  {
    // 赤穂義士祭（data/festivals）：討入的火事裝束，黑底，袖口與羽織下襬是白色的山形
    id: 'hyogo-ako',
    name: '赤穗義士裝束',
    slot: 'body',
    pref: 'hyogo',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.ink) +
      shape(SLEEVE_R, C.ink) +
      shape('M66 216 L70.8 210 L75.6 216 L80.4 210 L85.2 216 L90 210 L95 216 L95 234 L78 234 C71 234 66 231 66 224Z', C.white) +
      shape('M174 216 L169.2 210 L164.4 216 L159.6 210 L154.8 216 L150 210 L145 216 L145 234 L162 234 C169 234 174 231 174 224Z', C.white) +
      shape(ROBE_UP, C.ink) +
      COLLAR(C.white, 4) +
      shape(HAKAMA, C.ink) +
      `<path d="M104 200 L100 274 M120 200 L120 274 M136 200 L140 274" ${line(1.2, C.white, 0.2)}/>` +
      shape(HAORI_L, C.ink) +
      shape(HAORI_R, C.ink) +
      shape('M86 226 L90.7 220 L95.3 226 L100 220 L104.7 226 L109.3 220 L114 226 L114 232 L86 232Z', C.white) +
      shape('M126 226 L130.7 220 L135.3 226 L140 220 L144.7 226 L149.3 220 L154 226 L154 232 L126 232Z', C.white) +
      `<path d="M112 152 L114 220 M128 152 L126 220" ${line(1.2, C.white, 0.18)}/>` +
      shape('M98 168 L108 168 L108 186 L98 186Z', C.white) +
      `<path d="M100.5 172.5 L105.5 172.5 M100.5 177 L105.5 177 M100.5 181.5 L105.5 181.5" ${line(1, C.ink, 0.5)}/>`,
  },
  {
    // 平城宮跡（景點）：天平時代的衣裝，筒袖的衣、背子、高腰的條紋裙與領巾
    id: 'nara-tenpyo',
    name: '天平衣裝',
    slot: 'body',
    pref: 'nara',
    rarity: 3,
    icon: '56 140 128 140',
    svg:
      shape(LONG, C.white) +
      shade(LONG_SHADE) +
      [C.red, C.green, C.yellow, C.white, C.red, C.green]
        .map((c, i) => {
          const t0 = 88 + i * 10.67
          const t1 = 88 + (i + 1) * 10.67
          const b0 = 78 + i * 14
          const b1 = 78 + (i + 1) * 14
          return shape(`M${t0.toFixed(1)} 184 L${t1.toFixed(1)} 184 L${b1} 274 L${b0} 274Z`, c)
        })
        .join('') +
      shade('M140 184 L152 184 L162 274 L144 274Z') +
      shape('M98 151 L112 151 L116 184 L92 184 L91 160Z', C.green) +
      shape('M142 151 L128 151 L124 184 L148 184 L149 160Z', C.green) +
      `<path d="M112 152 L116 183 L92 183 L91.5 160 L98 152 M128 152 L124 183 L148 183 L148.5 160 L142 152" ${line(1.6, C.gold)}/>` +
      `<path d="M114 151 L120 170 L126 151" ${line(2.4, C.red)}/>` +
      shape('M90 182 L150 182 L150 188 L90 188Z', C.yellow) +
      `<path d="M118 188 L113 236 M122 188 L127 232" ${line(3, C.yellow)}/>` +
      `<path d="M96 154 C82 158 70 170 66 196 C64 214 66 236 70 256 M144 154 C158 158 170 170 174 196 C176 214 174 236 170 256" ${line(4.5, C.pink, 0.9)}/>`,
  },
  {
    // 弓浜絣（經濟產業大臣指定）：藍底上的絵絣，飛鶴與龜
    id: 'tottori-yumihama',
    name: '弓浜絣',
    slot: 'body',
    pref: 'tottori',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.navy, pattern: 'doll-ekasuri', collar: C.cream, obi: C.red, obiLine: C.cream }),
  },
  {
    // 石見神樂（臉上的大蛇面已有；出雲的佐陀神能在 data/festivals）：紅底、金線刺繡的衣裳，白袴
    id: 'shimane-kagura',
    name: '石見神樂衣裳',
    slot: 'body',
    pref: 'shimane',
    rarity: 3,
    icon: '50 140 140 140',
    svg:
      shape(HAKAMA, C.white) +
      shade(HAKAMA_SHADE) +
      PLEATS +
      shape(KARI_L, C.red) +
      shape(KARI_R, C.red) +
      pat(KARI_L, 'doll-asanoha') +
      pat(KARI_R, 'doll-asanoha') +
      shade(KARI_R) +
      `<path d="M57 238 C65 245 82 247 92 246 M183 238 C175 245 158 247 148 246" ${line(3, C.gold)}/>` +
      shape('M96 151 L144 151 L152 162 L154 236 L86 236 L88 162Z', C.red) +
      pat('M96 151 L144 151 L152 162 L154 236 L86 236 L88 162Z', 'doll-asanoha') +
      shade('M140 151 L144 151 L152 162 L154 236 L140 236Z') +
      `<path d="M86 234 L154 234" ${line(3, C.gold)}/>` +
      `<path d="M100 178 C110 166 124 188 136 174 C142 168 147 172 145 178" ${line(4, C.gold)}/>` +
      `<circle cx="146" cy="175" r="4.2" fill="${C.gold}" ${E}/><circle cx="147" cy="174" r="1.1" fill="${C.red}"/>` +
      `<path d="M96 222 C92 216 100 211 104 215 C108 219 102 223 100 219 M132 222 C128 216 136 211 140 215 C144 219 138 223 136 219 M70 214 C66 208 74 203 78 207 C82 211 76 215 74 211 M162 214 C158 208 166 203 170 207 C174 211 168 215 166 211" ${line(2, C.gold)}/>` +
      COLLAR(C.white, 5) +
      `<path d="M86 204 L154 204" ${line(3.6, C.gold)}/>`,
  },
  {
    // おかやま桃太郎まつり（data/festivals）：桃太郎的陣羽織（頭上的頭帶已有）、括袴、腳絆
    id: 'okayama-jinbaori',
    name: '桃太郎陣羽織',
    slot: 'body',
    pref: 'okayama',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape('M97 248 L117 248 L116 272 L98 272Z', C.white) +
      shape('M123 248 L143 248 L142 272 L124 272Z', C.white) +
      `<path d="M98 262 L116 262 M124 262 L142 262" ${line(1.2, C.ink, 0.25)}/>` +
      shape('M86 198 L154 198 L158 248 C150 254 128 254 122 248 L120 236 L118 248 C112 254 90 254 82 248Z', C.navy) +
      shade('M140 198 L154 198 L158 248 C154 251 146 252 140 252Z') +
      `<path d="M104 200 L101 250 M136 200 L139 250" ${line(1.2, C.white, 0.2)}/>` +
      shape(SLEEVE_L, C.white) +
      shape(SLEEVE_R, C.white) +
      shade(SLEEVE_R) +
      shape(ROBE_UP, C.white) +
      COLLAR(C.pink) +
      shape('M90 151 L150 151 L158 160 L158 232 L126 232 L122 172 L118 172 L114 232 L82 232 L82 160Z', C.red) +
      shade('M140 151 L150 151 L158 160 L158 232 L140 232Z') +
      `<path d="M90 151 L82 160 L82 232 L114 232 L118 172 M150 151 L158 160 L158 232 L126 232 L122 172" ${line(2.4, C.gold)}/>` +
      shape('M98 186 C92 186 89 192 92 198 C94 203 98 206 98 206 C98 206 104 202 105 198 C107 192 104 186 98 186Z', C.pink) +
      `<path d="M98 188 C96 194 97 200 98 205" ${line(1, C.red, 0.5)}/>` +
      shape('M98 186 C100 181 105 180 107 182 C104 185 101 186 98 186Z', C.green) +
      shape('M142 186 C136 186 133 192 136 198 C138 203 142 206 142 206 C142 206 148 202 149 198 C151 192 148 186 142 186Z', C.pink) +
      `<path d="M142 188 C140 194 141 200 142 205" ${line(1, C.red, 0.5)}/>` +
      shape('M142 186 C144 181 149 180 151 182 C148 185 145 186 142 186Z', C.green),
  },
  {
    // 酒まつり（data/festivals，東廣島西條）：酒藏的白衣與藍色的前掛
    id: 'hiroshima-saijo',
    name: '西條酒藏前掛',
    slot: 'body',
    pref: 'hiroshima',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape(PANTS, C.white) +
      `<path d="M96 270 L115 270 M125 270 L144 270" ${line(2, C.ink, 0.3)}/>` +
      shape(LONG, C.white) +
      shade(LONG_SHADE) +
      `<path d="M108 151 L120 168 L132 151" ${line(1.6, C.ink, 0.3)}/>` +
      shape('M90 198 L150 198 L152 268 L88 268Z', C.navy) +
      shade('M138 198 L150 198 L152 268 L138 268Z') +
      `<path d="M86 198 L154 198" ${line(3.4, C.yellow)}/>` +
      `<path d="M150 198 L156 210 M150 198 L160 206" ${line(2.2, C.yellow)}/>` +
      `<circle cx="120" cy="232" r="15" fill="none" stroke="${C.white}" stroke-width="2"/>` +
      vtext('酒', 120, 232, 18, C.white),
  },
  {
    // 先帝祭（data/festivals，下關赤間神宮）的上臈參拜：黑底大花的打掛、前面打結的帶
    id: 'yamaguchi-jorou',
    name: '先帝祭上臈打掛',
    slot: 'body',
    pref: 'yamaguchi',
    rarity: 3,
    icon: '56 140 128 140',
    svg:
      shape(ROBE, C.red) +
      COLLAR(C.white, 9) +
      COLLAR(C.red, 5) +
      shape(FURI_L, C.ink) +
      shape(FURI_R, C.ink) +
      pat(FURI_L, 'doll-yuzen') +
      pat(FURI_R, 'doll-yuzen') +
      shape('M96 151 L110 151 L114 274 L80 274 L87 162Z', C.ink) +
      pat('M96 151 L110 151 L114 274 L80 274 L87 162Z', 'doll-yuzen') +
      shape('M144 151 L130 151 L126 274 L160 274 L153 162Z', C.ink) +
      pat('M144 151 L130 151 L126 274 L160 274 L153 162Z', 'doll-yuzen') +
      `<path d="M110 151 L114 274 M130 151 L126 274" ${line(2.4, C.gold)}/>` +
      shape('M106 188 L134 188 L139 252 L101 252Z', C.gold) +
      pat('M106 188 L134 188 L139 252 L101 252Z', 'doll-kiriko') +
      `<path d="M104 204 L136 204 M102.5 220 L137.5 220 M101.5 236 L138.5 236" ${line(2, C.red)}/>` +
      shape('M98 180 L142 180 L142 192 L98 192Z', C.gold) +
      `<path d="M98 186 L142 186" ${line(1.6, C.red)}/>`,
  },
  {
    // 阿波正藍しじら織（經濟產業大臣指定）：藍的直條，布面有細細的縐
    id: 'tokushima-shijira',
    name: '阿波藍縐織',
    slot: 'body',
    pref: 'tokushima',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.blue, pattern: 'doll-shijira', collar: C.white, obi: C.navy, obiLine: C.white }),
  },
  {
    // 保多織（高松，香川縣的傳統工藝品）：細格子的織紋
    id: 'kagawa-hotaori',
    name: '保多織',
    slot: 'body',
    pref: 'kagawa',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.cream, pattern: 'doll-grid', collar: C.navy, obi: C.navy, obiLine: C.cream }),
  },
  {
    // 鹿踊（data/festivals，宇和島的八つ鹿踊り）：鹿頭垂下來的紅幕、胸前的小太鼓
    id: 'ehime-shikaodori',
    name: '八鹿踊衣裳',
    slot: 'body',
    pref: 'ehime',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(HAKAMA, C.navy) +
      shade(HAKAMA_SHADE) +
      PLEATS +
      shape(SLEEVE_L, C.white) +
      shape(SLEEVE_R, C.white) +
      shape(ROBE_UP, C.white) +
      COLLAR(C.cream) +
      shape('M98 150 C84 152 70 160 64 176 L60 226 L98 214Z', C.red) +
      shape('M142 150 C156 152 170 160 176 176 L180 226 L142 214Z', C.red) +
      shade('M142 150 C156 152 170 160 176 176 L180 226 L142 214Z') +
      mon(80, 188) +
      mon(160, 188) +
      `<path d="M60 226 L98 214 M180 226 L142 214" ${line(2.4, C.gold)}/>` +
      `<path d="M106 160 L113 186 M134 160 L127 186" ${line(2, C.red)}/>` +
      `<ellipse cx="120" cy="199" rx="17" ry="14" fill="${C.red}" ${E}/>` +
      `<ellipse cx="120" cy="197" rx="14" ry="11.5" fill="${C.cream}" ${E}/>` +
      `<path d="M120 191 C124 191 125 196 121 197 M114.5 199.5 C112.5 196 115.5 192.5 118.5 195 M125.5 199.5 C123 202.5 118.5 202.5 118 199" ${line(2, C.ink, 0.6)}/>`,
  },
  {
    // 坂本龍馬（桂浜等景點）：黑紋付（桔梗紋）、條紋袴，配長靴
    id: 'kochi-ryoma',
    name: '龍馬紋付袴',
    slot: 'body',
    pref: 'kochi',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(SLEEVE_L, C.ink) +
      shape(SLEEVE_R, C.ink) +
      shape(ROBE_UP, C.ink) +
      COLLAR(C.white, 4) +
      shape(HAKAMA, C.grey) +
      pat(HAKAMA, 'doll-stripes') +
      shade(HAKAMA_SHADE) +
      PLEATS +
      `<path d="M86 199.5 L154 199.5" ${line(3, C.grey)}/>` +
      shape('M95 268 L116 268 L117 280 L92 280 C91 276 92 272 95 270Z', C.brown) +
      shape('M124 268 L145 268 L148 271 C149 275 148 278 146 280 L123 280Z', C.brown) +
      kikyo(100, 170) +
      kikyo(140, 170) +
      kikyo(78, 192) +
      kikyo(162, 192),
  },
  {
    // 佐賀錦（佐賀的傳統織物）：金銀箔的和紙作經線、絲作緯線，網代紋，做成帶
    id: 'saga-nishiki',
    name: '佐賀錦',
    slot: 'body',
    pref: 'saga',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({
      base: C.pink,
      pattern: 'doll-asanoha',
      collar: C.white,
      obi: C.gold,
      extra: `<path d="M86 190 L154 190 L155 212 L85 212Z" fill="url(#doll-waffle)"/>` + `<path d="M86 201 L154 201" ${line(1.8, C.red)}/>`,
    }),
  },
  {
    // 長崎ランタンフェスティバル（data/festivals）的皇帝遊行：黃色的龍袍、馬蹄袖、下襬的海水江崖
    id: 'nagasaki-kotei',
    name: '皇帝遊行龍袍',
    slot: 'body',
    pref: 'nagasaki',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      shape(LONG, C.yellow) +
      shade(LONG_SHADE) +
      shape(ROBE, C.yellow) +
      shade(ROBE_SHADE) +
      shape('M68.5 206 L89 208 L89 218 L66 216Z', C.navy) +
      shape('M151 208 L171.5 206 L174 216 L151 218Z', C.navy) +
      shape('M83.3 250 L156.7 250 L158 274 L82 274Z', C.blue) +
      `<path d="M86 274 L92 254 M106 274 L112 254 M126 274 L132 254 M146 274 L152 254" ${line(2.6, C.white, 0.8)}/>` +
      `<path d="M96 274 L102 254 M116 274 L122 254 M136 274 L142 254" ${line(2.6, C.red, 0.8)}/>` +
      `<path d="M83.3 251 C88 246 92 246 96 251 C100 246 104 246 108 251 C112 246 116 246 120 251 C124 246 128 246 132 251 C136 246 140 246 144 251 C148 246 152 246 156.7 251" ${line(2, C.white)}/>` +
      `<path d="M100 214 C96 200 108 190 118 196 C128 202 132 188 128 180 C124 172 134 166 142 172" ${line(4, C.red)}/>` +
      dots(C.gold, 1.2, [
        [99, 206],
        [106, 194],
        [118, 196],
        [128, 192],
        [127, 180],
        [134, 170],
      ]) +
      shape('M140 168 L150 166 L152 174 L144 178Z', C.red) +
      `<circle cx="147" cy="170.5" r="1.1" fill="${C.ink}"/>` +
      `<path d="M150 168 L156 164 M151 172 L158 174" ${line(1, C.red)}/>` +
      `<path d="M92 176 C90 172 96 170 98 173 M146 222 C144 218 150 216 152 219" ${line(1.8, C.blue)}/>` +
      `<path d="M104 152 Q120 162 136 152" ${line(4, C.navy)}/>` +
      `<path d="M120 159 C132 160 144 166 151 178" ${line(3.4, C.navy)}/>` +
      shape('M86.5 220 L153.5 220 L154 225 L86 225Z', C.navy),
  },
  {
    // 山鹿灯籠まつり（data/festivals；山鹿燈籠是經濟產業大臣指定的傳統工藝品）：千人燈籠踊的浴衣，白底流水
    id: 'kumamoto-yamaga',
    name: '山鹿燈籠浴衣',
    slot: 'body',
    pref: 'kumamoto',
    rarity: 2,
    icon: BODY_ICON,
    svg: robe({ base: C.white, pattern: 'doll-ryusui', collar: C.navy, obi: C.yellow, obiLine: C.red }),
  },
  {
    // 修正鬼会（data/festivals，國東半島；臉上的鬼面已有）：鬼的白裝束，身上綁著草繩
    id: 'oita-onigoromo',
    name: '修正鬼會鬼裝束',
    slot: 'body',
    pref: 'oita',
    rarity: 3,
    icon: BODY_ICON,
    svg:
      KYAHAN +
      shape(SLEEVE_L, C.white) +
      shape(SLEEVE_R, C.white) +
      shade(SLEEVE_R) +
      shape(ROBE_SHORT, C.white) +
      shade(ROBE_SHORT_SHADE) +
      COLLAR(C.cream) +
      rope('M96 157 L146 197 M144 157 L94 197') +
      rope('M68.5 202 L95 204 M145 204 L171.5 202') +
      rope('M86 198 L154 198') +
      rope('M85.5 208 L154.5 208') +
      rope('M110 208 L106 228 M114 208 L117 230'),
  },
  {
    // 西都古墳まつり（data/festivals；西都原古墳群）：古墳時代的衣褌，足結、勾玉
    id: 'miyazaki-kofun',
    name: '古墳時代衣褌',
    slot: 'body',
    pref: 'miyazaki',
    rarity: 2,
    icon: BODY_ICON,
    svg:
      shape('M88 218 L152 218 C156 236 158 252 152 262 L144 266 L126 266 L122 248 L118 248 L114 266 L96 266 L88 262 C82 252 84 236 88 218Z', C.cream) +
      shade('M140 218 L152 218 C156 236 158 252 152 262 L144 266 L140 266Z') +
      `<path d="M92 256 L116 256 M124 256 L148 256" ${line(2.4, C.red)}/>` +
      `<path d="M104 256 L101 264 M104 256 L108 263 M136 256 L133 264 M136 256 L140 263" ${line(1.6, C.red)}/>` +
      shape(LONG, C.white) +
      shade(LONG_SHADE) +
      `<path d="M104 151 L134 212" ${line(1.6, C.ink, 0.3)}/>` +
      `<path d="M89 212 L151 212" ${line(3.4, C.green)}/>` +
      `<path d="M100 212 L97 228 M104 212 L106 226" ${line(2, C.green)}/>` +
      `<path d="M102 153 Q120 178 138 153" ${line(1.4, C.ink, 0.5)}/>` +
      dots(C.blue, 1.8, [
        [106, 162],
        [111, 167],
        [129, 167],
        [134, 162],
      ]) +
      `<path d="M120 170 C124.5 170 125.5 175.5 121.5 176.5 C118.5 177.3 116.8 180 117.5 182.5 C113 179.5 114 170 120 170Z" fill="${C.green}" ${E}/>` +
      `<path d="M110 170 C113 170 113.8 173.6 111.2 174.3 C109.4 174.8 108.4 176.4 108.8 178 C106 176 106.6 170 110 170Z M130 170 C133 170 133.8 173.6 131.2 174.3 C129.4 174.8 128.4 176.4 128.8 178 C126 176 126.6 170 130 170Z" fill="${C.red}" ${E}/>`,
  },
]
