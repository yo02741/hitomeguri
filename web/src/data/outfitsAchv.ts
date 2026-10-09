/**
 * 旅人的成就服裝（DESIGN.md §7.24、§7.25）：幾個大的成就各送 1 件，不進扭蛋。
 * 和代表單品一樣由紀錄算出來、不另外存：成就拿掉（取消去過、刪掉旅行）就跟著拿掉，標回去就回來。
 * 畫法同 outfitsPref.ts（剪紙、平塗、淡邊，只用 dollArt 的顏色 token）。
 * 座標：右手握在 (156, 222)、頭頂約 y 38、眼睛 y 110、夥伴站在左腳邊（地面 y 294）。
 */
import { C, dots, E, line, SH, shape } from './dollArt'
import type { Outfit } from './outfits'

const PANTS = 'M89 234 L151 234 L152 244 L145 274 L124 274 L121.5 250 L118.5 250 L116 274 L95 274 L88 244Z'

/** 摺扇的一片：以 (cx, cy) 為軸，角度 a0→a1（度，0 是右、−90 是上），內外半徑 r0、r1 */
function fanSector(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, fill: string): string {
  const p = (r: number, a: number) => `${(cx + r * Math.cos((a * Math.PI) / 180)).toFixed(1)} ${(cy + r * Math.sin((a * Math.PI) / 180)).toFixed(1)}`
  return shape(`M${p(r0, a0)} L${p(r1, a0)} A${r1} ${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 0 0 ${p(r0, a0)}Z`, fill)
}

/** 唐草：小小的渦卷 */
const swirl = (x: number, y: number, s = 1) =>
  `<path d="M${x} ${y} c${3 * s} ${-5 * s} ${10 * s} ${-3 * s} ${8 * s} ${3 * s} c${-1.5 * s} ${4 * s} ${-7 * s} ${3 * s} ${-5 * s} ${-1 * s} M${x} ${y} c${-4 * s} ${2 * s} ${-6 * s} ${6 * s} ${-3 * s} ${9 * s}" ${line(1.8, C.white, 0.85)}/>`

export const ACHV_OUTFITS: Outfit[] = [
  {
    // 都道府縣 47：江戶時代走遍各國的旅人披的道中合羽
    id: 'achv-kappa',
    name: '道中合羽',
    slot: 'body',
    achv: 'prefs-47',
    rarity: 3,
    icon: '50 140 140 140',
    svg:
      shape(PANTS, C.navy) +
      `<path d="${PANTS}" ${SH}/>` +
      shape('M100 150 L140 150 C150 152 156 158 160 166 L184 246 C162 255 78 255 56 246 L80 166 C84 158 90 152 100 150Z', C.brown) +
      `<path d="M136 151 C150 152 156 158 160 166 L184 246 C176 249 160 252 144 253Z" ${SH}/>` +
      // 前襟：裡布的朱色從兩邊露出來
      `<path d="M114 156 L104 252 M126 156 L136 252" ${line(4, C.red)}/>` +
      shape('M114 156 L126 156 L136 252 L104 252Z', C.cream) +
      `<path d="M120 166 L120 252" ${line(1.4, C.ink, 0.25)}/>` +
      // 衿與繫繩
      `<path d="M100 151 Q120 166 140 151" ${line(7, C.navy)}/>` +
      `<path d="M112 162 L120 170 L128 162" ${line(2, C.gold)}/>` +
      `<circle cx="120" cy="171" r="3" fill="${C.gold}" ${E}/>` +
      `<path d="M62 238 C100 246 140 246 178 238" ${line(1.4, C.cream, 0.5)}/>`,
  },
  {
    // 日本100名城 50 城：武士的陣笠，黑漆、金色的家紋
    id: 'achv-jingasa',
    name: '陣笠',
    slot: 'head',
    achv: 'castle100-50',
    rarity: 3,
    icon: '30 18 180 80',
    svg:
      `<path d="M72 86 C74 118 92 142 110 152 M168 86 C166 118 148 142 130 152" ${line(2.2, C.red, 0.9)}/>` +
      shape('M120 30 C136 30 192 64 206 78 C192 90 48 90 34 78 C48 64 104 30 120 30Z', C.ink) +
      `<path d="M120 30 C136 30 192 64 206 78 C192 86 160 88 126 88 C140 70 136 44 120 30Z" fill="${C.white}" opacity=".08"/>` +
      `<path d="M34 78 C48 90 192 90 206 78" ${line(2.4, C.gold, 0.9)}/>` +
      `<path d="M98 40 C88 48 72 60 62 70" ${line(3, C.white, 0.22)}/>` +
      `<circle cx="120" cy="62" r="10" fill="${C.gold}" ${E}/>` +
      `<circle cx="120" cy="62" r="6" fill="none" stroke="${C.ink}" stroke-width="1.6" stroke-opacity=".7"/>` +
      dots(C.ink, 1.6, [[120, 59], [117.4, 63.5], [122.6, 63.5]], 'opacity=".7"'),
  },
  {
    // 四季：四片顏色的摺扇（春櫻、夏青、秋紅葉、冬雪）
    id: 'achv-shiki-sensu',
    name: '四季扇子',
    slot: 'hand',
    achv: 'seasons-4',
    rarity: 3,
    icon: '116 148 108 92',
    svg:
      fanSector(158, 224, 18, 66, -128, -98, C.pink) +
      fanSector(158, 224, 18, 66, -98, -68, C.blue) +
      fanSector(158, 224, 18, 66, -68, -38, C.orange) +
      fanSector(158, 224, 18, 66, -38, -8, C.white) +
      `<path d="M158 224 L117.4 172 M158 224 L148.8 158.6 M158 224 L182.7 162.8 M158 224 L210 214.8" ${line(1, C.brown, 0.45)}/>` +
      dots(C.white, 1.6, [[128, 186], [138, 176], [134, 194]]) +
      dots(C.cream, 1.4, [[196, 190], [204, 200], [190, 204], [200, 182]]) +
      `<path d="M160 168 C166 174 168 182 166 190" ${line(2, C.white, 0.6)}/>` +
      `<path d="M178 180 L184 172 M182 188 L190 182" ${line(2.2, C.red, 0.75)}/>` +
      `<circle cx="158" cy="224" r="3.4" fill="${C.gold}" ${E}/>`,
  },
  {
    // 一趟 7 天：長途旅行的唐草風呂敷包
    id: 'achv-furoshiki',
    name: '唐草風呂敷',
    slot: 'hand',
    achv: 'trip-7days',
    rarity: 3,
    icon: '120 196 80 76',
    svg:
      shape('M134 240 C132 260 146 268 162 268 C180 268 192 260 190 240 C188 228 178 222 162 222 C146 222 136 228 134 240Z', C.green) +
      `<path d="M176 224 C188 230 192 244 190 252 C188 262 178 268 166 268 C182 256 184 238 176 224Z" ${SH}/>` +
      swirl(146, 240) +
      swirl(168, 236, 0.9) +
      swirl(154, 256, 0.9) +
      swirl(178, 254, 0.8) +
      // 結び目：左右兩個耳朵
      shape('M150 226 C142 220 140 210 146 206 C152 210 156 218 158 224Z', C.green) +
      shape('M170 226 C178 220 182 210 176 206 C170 210 166 218 164 224Z', C.green) +
      `<circle cx="161" cy="225" r="5" fill="${C.green}" ${E}/>` +
      `<path d="M144 210 C146 214 150 218 154 222" ${line(1.4, C.white, 0.7)}/>`,
  },
  {
    // 足跡 300 處：走遍各地的金剛杖，頂端繫著錦布與鈴
    id: 'achv-kongozue',
    name: '金剛杖',
    slot: 'hand',
    achv: 'spots-300',
    rarity: 3,
    icon: '126 70 92 214',
    svg:
      shape('M146 280 L150 281 L188 92 L183 91Z', C.cream) +
      `<path d="M150 281 L188 92 L186 91.6 L148 280.6Z" ${SH}/>` +
      `<path d="M158 238 L160 228 M166 200 L168 190 M174 160 L176 150" ${line(1.2, C.brown, 0.5)}/>` +
      `<path d="M182 92 L184 82 C185 78 189 78 189 82 L188 92Z" fill="${C.cream}" ${E}/>` +
      shape('M178 104 L194 107 L190 128 L174 125Z', C.purple) +
      `<path d="M178 104 L194 107 L190 128 L174 125Z" fill="url(#doll-asanoha)" opacity=".5"/>` +
      `<path d="M176 115 C170 122 168 132 170 140 M184 117 C186 126 192 132 196 136" ${line(1.8, C.red)}/>` +
      `<circle cx="170" cy="143" r="4.6" fill="${C.gold}" ${E}/>` +
      `<path d="M167 144 L173 144" ${line(1.2, C.ink, 0.5)}/>` +
      `<circle cx="196" cy="139" r="3.4" fill="${C.gold}" ${E}/>`,
  },
  {
    // 旅行 10 趟：無事カエル（平安回家）的青蛙，戴小斗笠
    id: 'achv-kaeru',
    name: '無事蛙',
    slot: 'buddy',
    achv: 'trips-10',
    rarity: 3,
    icon: '14 208 90 92',
    svg:
      shape('M32 290 C28 272 40 260 58 260 C76 260 88 272 84 290 C80 296 36 296 32 290Z', C.green) +
      `<path d="M70 262 C82 268 88 280 84 290 C80 294 72 295 64 295 C76 286 78 272 70 262Z" ${SH}/>` +
      shape('M44 292 C44 280 50 274 58 274 C66 274 72 280 72 292Z', C.cream) +
      shape('M28 294 C26 286 34 282 40 286 L44 294Z', C.green) +
      shape('M88 294 C90 286 82 282 76 286 L72 294Z', C.green) +
      shape('M58 236 C76 236 84 246 84 256 C84 266 72 272 58 272 C44 272 32 266 32 256 C32 246 40 236 58 236Z', C.green) +
      `<circle cx="44" cy="240" r="8" fill="${C.green}" ${E}/><circle cx="72" cy="240" r="8" fill="${C.green}" ${E}/>` +
      `<circle cx="44" cy="240" r="5" fill="${C.white}"/><circle cx="72" cy="240" r="5" fill="${C.white}"/>` +
      `<circle cx="45" cy="241" r="2.6" fill="${C.ink}"/><circle cx="71" cy="241" r="2.6" fill="${C.ink}"/>` +
      `<path d="M46 258 Q58 266 70 258" ${line(1.8)}/>` +
      `<ellipse cx="40" cy="256" rx="4" ry="2.6" fill="${C.pink}" opacity=".8"/><ellipse cx="76" cy="256" rx="4" ry="2.6" fill="${C.pink}" opacity=".8"/>` +
      // 小斗笠
      shape('M58 216 L88 232 C76 237 40 237 28 232Z', C.yellow) +
      `<path d="M58 216 L88 232 C80 235 68 236 58 236Z" ${SH}/>` +
      `<path d="M58 216 L42 235 M58 216 L74 235" ${line(1, C.brown, 0.5)}/>` +
      `<path d="M38 272 C48 276 68 276 78 272" ${line(3.4, C.red)}/>`,
  },
]
