/**
 * 旅人的各縣特色裝扮（DESIGN.md §7.24）：每個縣 3 件，取自那個縣實際的特產、工藝、祭典
 * （data/specialties、data/festivals 與各縣的代表名物）。第一件是代表單品（gift）：第一次去那個縣就送；
 * 另外兩件去過那個縣之後加進扭蛋。
 * 畫法跟 outfits.ts 一樣（剪紙、平塗、淡邊），多數用下面的模板：碗、串、盤、水果、城、面具、法被、浴衣。
 * 座標：右手握在 (156, 222)、頭頂約 y 38、眼睛 y 110、夥伴站在左腳邊（地面 y 294）。
 */
import { C, dots, E, line, SH, shape } from './dollArt'
import type { Outfit } from './outfits'

type Def = Omit<Outfit, 'pref' | 'gift'>
const ICON = {
  hand: '124 156 92 90',
  bowl: '128 168 82 76',
  head: '40 0 160 100',
  face: '118 34 78 74',
  body: '58 140 124 140',
  buddy: '16 216 86 84',
}

// ---------- 手上：碗（拉麵、烏龍麵、蕎麥麵、丼） ----------
const STICKS = `<path d="M180 196 L198 170 M186 198 L204 172" ${line(2.4, C.brown)}/>`
function bowl(o: { bowl: string; soup: string; noodle?: string; top?: string; rim?: string; sticks?: boolean; soupOp?: number }): string {
  return (
    shape('M134 208 C134 230 150 238 166 238 C182 238 198 230 198 208Z', o.bowl) +
    `<path d="M182 210 L198 208 C198 230 184 238 168 238 C184 228 186 218 182 210Z" ${SH}/>` +
    (o.rim ? `<path d="M137 217 C150 223 182 223 195 217" ${line(2.6, o.rim)}/>` : '') +
    `<ellipse cx="166" cy="208" rx="32" ry="7" fill="${o.soup}" ${E} ${o.soupOp ? `fill-opacity="${o.soupOp}"` : ''}/>` +
    (o.noodle ? `<path d="M142 208 C150 202 156 212 164 206 C172 212 180 202 190 208" ${line(2.6, o.noodle)}/>` : '') +
    (o.top ?? '') +
    (o.sticks === false ? '' : STICKS)
  )
}
const naruto = (x: number, y: number) =>
  `<circle cx="${x}" cy="${y}" r="5" fill="${C.white}" ${E}/><path d="M${x - 2} ${y} a2 2 0 1 1 2 2 a3.5 3.5 0 1 1 -3.5 -3.5" ${line(1.1, C.pink)}/>`
const chashu = (x: number, y: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="8" ry="4.5" fill="${C.brown}" ${E}/><ellipse cx="${x}" cy="${y}" rx="5" ry="2.4" fill="${C.cream}" opacity=".45"/>`
const egg = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="4" fill="${C.white}" ${E}/><circle cx="${x}" cy="${y}" r="2.6" fill="${C.orange}"/>`
const negi = (pts: Array<[number, number]>) => dots(C.green, 1.7, pts)
const nori = (x: number) => `<path d="M${x} 207 L${x + 1} 189 L${x + 12} 191 L${x + 11} 207Z" fill="${C.ink}" opacity=".88"/>`

// ---------- 手上：盤子、串、杯 ----------
const plate = (fill = C.white) => shape('M128 228 C128 220 204 220 204 228 C204 237 128 237 128 228Z', fill)
/** 竹籤：從手斜斜往上，pieces 在籤上的位置 t（0 手、1 頂） */
function skewer(piece: (x: number, y: number, i: number) => string, ts: number[], color = C.cream): string {
  const at = (t: number): [number, number] => [154 + 24 * t, 236 - 86 * t]
  const [x1, y1] = at(1.05)
  return `<path d="M154 236 L${x1} ${y1}" ${line(2.6, color)}/>` + ts.map((t, i) => piece(...at(t), i)).join('')
}
function cup(body: string, inside: string, extra = ''): string {
  return (
    shape('M140 200 L192 200 L188 236 C186 240 146 240 144 236Z', body) +
    `<path d="M178 200 L192 200 L188 236 C187 239 180 240 174 240 C180 232 182 214 178 200Z" ${SH}/>` +
    `<ellipse cx="166" cy="200" rx="26" ry="5" fill="${inside}" ${E}/>` +
    extra
  )
}
/** 圓圓的水果（桃、橘子、梨、柿…） */
function fruit(fill: string, o: { leaf?: boolean; crease?: boolean; stem?: string; dots?: string } = {}): string {
  return (
    shape('M166 194 C150 192 138 204 140 220 C142 234 154 240 166 240 C178 240 190 234 192 220 C194 204 182 192 166 194Z', fill) +
    `<path d="M178 196 C190 202 194 212 192 222 C190 234 180 240 170 240 C182 230 186 212 178 196Z" ${SH}/>` +
    (o.crease ? `<path d="M164 196 C158 208 158 226 164 238" ${line(1.6, C.ink, 0.25)}/>` : '') +
    (o.dots ? dots(o.dots, 1.2, [[152, 210], [160, 222], [174, 212], [180, 226], [168, 230], [156, 230]]) : '') +
    `<path d="M150 204 C153 200 157 198 161 198" ${line(3, C.white, 0.5)}/>` +
    `<path d="M166 196 L168 186" ${line(2.6, o.stem ?? C.brown)}/>` +
    (o.leaf === false ? '' : shape('M168 190 C174 182 184 182 188 186 C182 192 174 192 168 190Z', C.green))
  )
}

// ---------- 頭上 ----------
/** 天守閣的帽子：石垣、白壁或黑壁、三層屋頂，頂端一對金色的鯱 */
function castle(o: { wall: string; roof: string; trim?: string }): string {
  const t = o.trim ?? C.white
  return (
    shape('M70 82 L76 66 L164 66 L170 82Z', C.grey) +
    `<path d="M80 70 L160 70 M76 76 L164 76" ${line(1, C.ink, 0.25)}/>` +
    shape('M86 66 L86 50 L154 50 L154 66Z', o.wall) +
    `<rect x="96" y="55" width="8" height="6" fill="${C.ink}" opacity=".7"/><rect x="116" y="55" width="8" height="6" fill="${C.ink}" opacity=".7"/><rect x="136" y="55" width="8" height="6" fill="${C.ink}" opacity=".7"/>` +
    shape('M74 52 C90 46 150 46 166 52 L156 42 L84 42Z', o.roof) +
    shape('M96 42 L96 30 L144 30 L144 42Z', o.wall) +
    `<path d="M110 34 L130 34" ${line(3, C.ink, 0.6)}/>` +
    shape('M86 32 C100 27 140 27 154 32 L144 22 L96 22Z', o.roof) +
    shape('M106 22 L106 14 L134 14 L134 22Z', o.wall) +
    shape('M98 15 C108 11 132 11 142 15 L132 6 L108 6Z', o.roof) +
    `<path d="M74 52 C90 46 150 46 166 52 M86 32 C100 27 140 27 154 32 M98 15 C108 11 132 11 142 15" ${line(1.4, t, 0.8)}/>` +
    shape('M108 6 C104 2 104 -2 108 -2 L110 4Z', C.gold) +
    shape('M132 6 C136 2 136 -2 132 -2 L130 4Z', C.gold)
  )
}
/** 頭帶：綁在瀏海上，右邊打結，mark 是額頭前的圖樣 */
function hachimaki(color: string, mark = ''): string {
  return (
    shape('M64 84 C82 72 158 72 176 84 L176 94 C158 82 82 82 64 94Z', color) +
    shape('M172 84 L190 74 L192 82 L180 90Z', color) +
    shape('M174 90 L188 100 L182 104 L172 94Z', color) +
    `<circle cx="174" cy="88" r="4.5" fill="${color}" ${E}/>` +
    mark
  )
}
/** 髮簪：頭的右上方一叢花，下面垂幾條 */
function kanzashi(flower: string, center: string, extra = ''): string {
  const pts: Array<[number, number]> = [
    [158, 52],
    [170, 60],
    [150, 64],
    [164, 72],
  ]
  return (
    `<path d="M150 74 L176 92 M156 78 L172 104 M162 80 L166 112" ${line(1.4, C.gold)}/>` +
    dots(C.gold, 2.4, [
      [176, 92],
      [172, 104],
      [166, 112],
    ]) +
    pts
      .map(
        ([x, y]) =>
          `<g ${E}>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${y - 5}" rx="3.6" ry="5" fill="${flower}" transform="rotate(${a} ${x} ${y})"/>`).join('')}</g><circle cx="${x}" cy="${y}" r="2.2" fill="${center}"/>`,
      )
      .join('') +
    extra
  )
}

// ---------- 臉上：戴在頭側邊的面具 ----------
/** 祭典的面具斜戴在頭的右上，綁繩繞過額頭 */
function sideMask(face: string, base: string, extra = ''): string {
  return (
    `<path d="M66 88 C90 76 140 74 152 78" ${line(2, C.red)}/>` +
    `<g transform="rotate(16 160 76)">` +
    shape('M160 46 C176 46 186 60 186 76 C186 94 174 106 160 106 C146 106 134 94 134 76 C134 60 144 46 160 46Z', base) +
    `<path d="M172 50 C182 58 186 68 186 78 C186 94 176 106 162 106 C176 96 180 70 172 50Z" ${SH}/>` +
    face +
    `</g>` +
    extra
  )
}

// ---------- 身上 ----------
const SHORTS = 'M89 234 L151 234 L154 256 L124 258 L121 246 L119 246 L116 258 L86 256Z'
const PANTS = 'M89 234 L151 234 L152 244 L145 274 L124 274 L121.5 250 L118.5 250 L116 274 L95 274 L88 244Z'
const ROBE = 'M96 151 L144 151 L153 162 L158 274 L82 274 L87 162Z'
const SLEEVE_L = 'M92 156 C80 158 70 166 68 180 L66 224 C66 231 71 234 78 234 L95 234 L95 170Z'
const SLEEVE_R = 'M148 156 C160 158 170 166 172 180 L174 224 C174 231 169 234 162 234 L145 234 L145 170Z'
const HAPPI = 'M98 151 L142 151 C154 153 163 160 167 170 L172 204 L152 206 L153 246 L87 246 L88 206 L68 204 L73 170 C77 160 86 153 98 151Z'
const HAPPI_SHADE = 'M140 151 C154 153 163 160 167 170 L172 204 L152 206 L153 246 L138 246Z'
const TOP = 'M98 151 L142 151 C153 153 161 158 165 167 L170 188 L151 192 L151 240 L89 240 L89 192 L70 188 L75 167 C79 158 87 153 98 151Z'
/** 法被：底色、衿（前襟兩條）的顏色、衿上的字、下面穿的 */
function happi(o: { base: string; collar: string; text?: string; textColor?: string; bottom?: string; bottomColor?: string; pattern?: string; band?: string }): string {
  return (
    shape(o.bottom ?? SHORTS, o.bottomColor ?? C.white) +
    shape(HAPPI, o.base) +
    (o.pattern ? `<path d="${HAPPI}" fill="url(#${o.pattern})"/>` : '') +
    `<path d="${HAPPI_SHADE}" ${SH}/>` +
    `<path d="M106 150 L114 246 M134 150 L126 246" ${line(9, o.collar)}/>` +
    (o.band ? `<path d="M88 236 L153 236" ${line(4, o.band)}/>` : '') +
    (o.text
      ? `<text x="110" y="196" font-size="8" font-weight="900" fill="${o.textColor ?? C.white}" text-anchor="middle" font-family="var(--font-ja)" writing-mode="tb">${o.text}</text>`
      : '')
  )
}
/** 浴衣、和服：袂、到腳踝的身頃、衿、腰帶；pattern 是 DollDefs 的花紋 */
function robe(o: { base: string; pattern?: string; collar?: string; obi: string; obiLine?: string; extra?: string }): string {
  const pat = (d: string) => (o.pattern ? `<path d="${d}" fill="url(#${o.pattern})"/>` : '')
  return (
    shape(SLEEVE_L, o.base) +
    shape(SLEEVE_R, o.base) +
    pat(SLEEVE_L) +
    pat(SLEEVE_R) +
    shape(ROBE, o.base) +
    pat(ROBE) +
    `<path d="M144 151 L153 162 L158 274 L138 274Z" ${SH}/>` +
    `<path d="M106 150 L122 196 M134 150 L124 178" ${line(5, o.collar ?? C.cream)}/>` +
    shape('M86 190 L154 190 L155 212 L85 212Z', o.obi) +
    (o.obiLine ? `<path d="M86 201 L154 201" ${line(1.8, o.obiLine)}/>` : '') +
    `<path d="M120 274 L122 212" ${line(1.4, C.ink, 0.25)}/>` +
    (o.extra ?? '')
  )
}

// ---------- 夥伴：腳邊的小動物、小物 ----------
const eye = (x: number, y: number, r = 2.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.ink}"/>`

// 第一版的 16 件
const LEGACY: Outfit[] = [
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

// ---------- 各縣：第一件是代表單品（gift） ----------
// 沿用第一版的 16 件（LEGACY）用 id 放進來
const L = (id: string): Def => {
  const o = LEGACY.find((x) => x.id === id)
  if (!o) throw new Error(id)
  const { pref: _p, ...rest } = o
  return rest
}

const BY_PREF: Record<string, Def[]> = {
  hokkaido: [
    L('hokkaido-melon'),
    {
      id: 'hokkaido-ramen',
      name: '函館鹽味拉麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({ bowl: C.red, rim: C.white, soup: C.yellow, soupOp: 0.55, noodle: C.cream, top: chashu(152, 207) + egg(168, 207) + naruto(184, 206) + negi([[160, 203], [176, 211], [188, 210]]) }),
    },
    {
      id: 'hokkaido-bear',
      name: '木雕熊',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M34 292 C30 274 40 262 60 262 C80 262 92 270 92 284 L92 294 L82 294 L80 284 L48 284 L46 294 L36 294Z', C.brown) +
        shape('M22 270 C20 258 28 250 38 250 C48 250 54 258 52 268 C50 276 42 280 34 280 C28 280 23 276 22 270Z', C.brown) +
        `<circle cx="30" cy="250" r="5" fill="${C.brown}" ${E}/><circle cx="46" cy="250" r="5" fill="${C.brown}" ${E}/>` +
        `<path d="M54 270 C64 268 76 270 84 276 M50 278 C62 276 74 278 86 284" ${line(1.4, C.ink, 0.3)}/>` +
        shape('M12 276 C18 268 30 268 36 274 C30 280 18 282 12 276Z M10 272 L12 276 L8 280Z', C.pink) +
        `<path d="M18 274 L30 274" ${line(1, C.white, 0.7)}/>` +
        eye(32, 262, 1.8),
    },
  ],
  aomori: [
    L('aomori-ringo'),
    {
      id: 'aomori-kingyo',
      name: '金魚睡魔燈',
      slot: 'hand',
      rarity: 2,
      icon: '124 140 96 100',
      svg:
        `<path d="M156 226 L168 168" ${line(3, C.brown)}/>` +
        shape('M150 182 C150 166 170 156 188 160 C204 164 210 176 206 188 C202 198 188 204 172 202 C160 200 150 194 150 182Z', C.red) +
        shape('M150 182 C140 172 132 170 128 174 C132 182 132 190 128 198 C134 200 142 196 150 188Z', C.red) +
        shape('M170 198 C182 200 196 196 204 188 C200 196 190 202 178 204Z', C.white) +
        `<path d="M168 162 C174 172 174 190 168 200 M182 160 C186 172 186 190 182 202" ${line(1.2, C.ink, 0.3)}/>` +
        `<circle cx="196" cy="178" r="4" fill="${C.white}" ${E}/>` +
        eye(196, 178, 2) +
        `<path d="M160 166 C170 160 182 158 190 160" ${line(2.4, C.white, 0.5)}/>`,
    },
    {
      id: 'aomori-yawata',
      name: '八幡馬',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M34 272 C34 262 44 258 60 258 C74 258 82 262 82 272 L82 278 L34 278Z', C.red) +
        `<path d="M38 278 L38 294 M48 278 L48 294 M70 278 L70 294 M80 278 L80 294" ${line(5, C.red)}/>` +
        shape('M74 262 L82 240 C84 234 92 232 96 236 C100 240 98 246 94 248 L86 266Z', C.red) +
        shape('M80 236 L84 228 L88 236Z', C.red) +
        `<path d="M78 244 C80 238 84 234 88 232" ${line(3, C.ink)}/>` +
        shape('M44 260 C50 256 64 256 70 260 L68 272 L46 272Z', C.ink) +
        `<path d="M48 264 L66 264 M50 268 L64 268" ${line(1.4, C.gold)}/>` +
        dots(C.gold, 1.6, [[40, 270], [76, 270], [58, 276]]) +
        eye(92, 240, 1.6) +
        `<path d="M34 264 C28 268 26 276 28 282" ${line(3, C.ink)}/>`,
    },
  ],
  iwate: [
    {
      id: 'iwate-wanko',
      name: '碗子蕎麥麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg:
        shape('M140 226 C140 238 150 242 166 242 C182 242 192 238 192 226Z', C.ink) +
        shape('M142 216 C142 228 152 232 166 232 C180 232 190 228 190 216Z', C.red) +
        shape('M144 206 C144 218 154 222 166 222 C178 222 188 218 188 206Z', C.ink) +
        `<ellipse cx="166" cy="206" rx="22" ry="5" fill="${C.brown}" ${E}/>` +
        `<path d="M150 206 C156 202 160 208 166 204 C172 208 176 202 182 206" ${line(2, C.cream, 0.7)}/>` +
        `<path d="M182 196 L200 172 M188 198 L206 174" ${line(2.4, C.red)}/>`,
    },
    {
      id: 'iwate-kappa',
      name: '遠野河童',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M40 292 C36 274 44 266 58 266 C72 266 80 274 76 292Z', C.matcha) +
        shape('M58 230 C72 230 80 240 80 252 C80 264 70 270 58 270 C46 270 36 264 36 252 C36 240 44 230 58 230Z', C.matcha) +
        shape('M44 234 C46 226 70 226 72 234 C66 230 50 230 44 234Z', C.white) +
        `<ellipse cx="58" cy="232" rx="13" ry="4" fill="${C.cream}" ${E}/>` +
        `<path d="M42 236 L38 228 M50 232 L48 224 M66 232 L68 224 M74 236 L78 228" ${line(2.4, C.green)}/>` +
        shape('M50 256 L66 256 L58 264Z', C.yellow) +
        eye(50, 248) +
        eye(66, 248) +
        shape('M74 270 C84 270 88 280 82 288 C78 282 74 278 70 276Z', C.green),
    },
    {
      id: 'iwate-sansa',
      name: '盛岡三颯舞浴衣',
      slot: 'body',
      rarity: 2,
      icon: ICON.body,
      svg: robe({
        base: C.pink,
        pattern: 'doll-sakura',
        obi: C.purple,
        obiLine: C.gold,
        extra:
          shape('M74 202 C74 194 102 194 102 202 L102 222 C102 230 74 230 74 222Z', C.red) +
          `<ellipse cx="88" cy="202" rx="14" ry="4" fill="${C.cream}" ${E}/>` +
          `<path d="M76 212 L100 212" ${line(1.4, C.gold)}/>`,
      }),
    },
  ],
  miyagi: [
    L('miyagi-zunda'),
    {
      id: 'miyagi-kabuto',
      name: '伊達三日月兜',
      slot: 'head',
      rarity: 3,
      icon: '30 -6 180 100',
      svg:
        shape('M62 86 C58 46 86 28 120 28 C154 28 182 46 178 86 C170 78 160 74 150 74 L90 74 C80 74 70 78 62 86Z', C.ink) +
        `<path d="M66 80 C80 70 160 70 174 80" ${line(2, C.gold)}/>` +
        `<path d="M74 60 L166 60 M70 70 L170 70" ${line(1.2, C.white, 0.25)}/>` +
        shape('M120 34 C88 26 52 12 36 -2 C66 6 98 14 120 22 C142 14 174 6 204 -2 C188 12 152 26 120 34Z', C.gold) +
        `<circle cx="120" cy="32" r="5" fill="${C.gold}" ${E}/>`,
    },
    {
      id: 'miyagi-kokeshi',
      name: '小芥子',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M46 294 L46 262 C46 256 50 254 58 254 C66 254 70 256 70 262 L70 294Z', C.cream) +
        `<path d="M46 270 L70 270 M46 286 L70 286" ${line(3, C.red)}/>` +
        `<g ${E}>` +
        [0, 72, 144, 216, 288].map((a) => `<ellipse cx="58" cy="274" rx="2.6" ry="4" fill="${C.red}" transform="rotate(${a} 58 278)"/>`).join('') +
        `</g>` +
        shape('M58 226 C70 226 76 234 76 242 C76 252 68 258 58 258 C48 258 40 252 40 242 C40 234 46 226 58 226Z', C.cream) +
        shape('M40 240 C40 230 48 224 58 224 C68 224 76 230 76 240 C70 234 64 234 58 236 C52 234 46 234 40 240Z', C.ink) +
        `<path d="M50 246 Q53 249 56 246 M60 246 Q63 249 66 246" ${line(1.4)}/>` +
        `<circle cx="58" cy="252" r="1.4" fill="${C.red}"/>` +
        `<path d="M44 234 L40 240 M72 234 L76 240" ${line(2, C.red)}/>`,
    },
  ],
  akita: [
    {
      id: 'akita-namahage',
      name: '生剝鬼面',
      slot: 'face',
      rarity: 3,
      icon: '128 34 70 76',
      svg: sideMask(
        shape('M140 66 C134 54 140 44 150 44 L150 54 Z M180 66 C186 54 180 44 170 44 L170 54Z', C.white) +
          `<circle cx="150" cy="72" r="5" fill="${C.gold}" ${E}/><circle cx="170" cy="72" r="5" fill="${C.gold}" ${E}/>` +
          eye(150, 72, 2) +
          eye(170, 72, 2) +
          shape('M146 88 C152 96 168 96 174 88 L170 98 C164 102 156 102 150 98Z', C.ink) +
          `<path d="M150 88 L152 94 M170 88 L168 94" ${line(2, C.white)}/>` +
          `<path d="M136 80 C128 86 126 96 130 104 M184 80 C192 86 194 96 190 104 M140 60 C132 56 126 58 124 64" ${line(3, C.yellow)}/>`,
        C.red,
      ),
    },
    {
      id: 'akita-inu',
      name: '秋田犬',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M34 292 C32 276 40 266 56 266 C72 266 82 276 80 292Z', C.orange) +
        shape('M42 292 C42 280 48 274 56 274 C64 274 70 280 70 292Z', C.cream) +
        shape('M78 274 C90 270 94 258 86 254 C80 262 76 266 72 268Z', C.orange) +
        shape('M58 230 C72 230 80 240 80 252 C80 264 70 270 58 270 C46 270 36 264 36 252 C36 240 44 230 58 230Z', C.orange) +
        shape('M40 236 L42 220 L52 232Z M76 236 L74 220 L64 232Z', C.orange) +
        shape('M46 256 C46 248 70 248 70 256 C70 266 46 266 46 256Z', C.cream) +
        `<path d="M44 244 Q48 242 52 244 M64 244 Q68 242 72 244" ${line(1.8)}/>` +
        `<ellipse cx="58" cy="254" rx="3" ry="2.2" fill="${C.ink}"/>` +
        `<path d="M58 256 L58 260 M54 262 Q58 264 62 262" ${line(1.4)}/>`,
    },
    {
      id: 'akita-kiritanpo',
      name: '烤米棒',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        `<path d="M154 236 L182 134" ${line(3, C.brown)}/>` +
        `<g transform="rotate(16 168 180)">` +
        shape('M160 150 C160 144 176 144 176 150 L176 210 C176 216 160 216 160 210Z', C.cream) +
        `<path d="M160 162 L176 162 M160 178 L176 178 M160 194 L176 194" ${line(3, C.orange, 0.7)}/>` +
        `<path d="M172 150 L176 150 L176 210 L172 210Z" ${SH}/>` +
        `</g>`,
    },
  ],
  yamagata: [
    {
      id: 'yamagata-hanagasa',
      name: '花笠',
      slot: 'head',
      rarity: 2,
      icon: '24 6 192 92',
      svg:
        shape('M28 76 C48 52 192 52 212 76 C192 84 48 84 28 76Z', C.yellow) +
        shape('M84 62 C88 40 152 40 156 62Z', C.yellow) +
        `<path d="M40 74 C70 64 170 64 200 74 M90 56 L150 56" ${line(1.2, C.brown, 0.5)}/>` +
        [44, 64, 86, 108, 132, 154, 176, 196]
          .map((x, i) => `<g ${E}>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="${68 + (i % 2) * 4 - 4}" rx="3.4" ry="5" fill="${C.red}" transform="rotate(${a} ${x} ${68 + (i % 2) * 4})"/>`).join('')}</g>`)
          .join('') +
        `<g ${E}>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="120" cy="36" rx="5" ry="7" fill="${C.red}" transform="rotate(${a} 120 42)"/>`).join('')}</g>` +
        `<circle cx="120" cy="42" r="3" fill="${C.yellow}"/>`,
    },
    {
      id: 'yamagata-cherry',
      name: '櫻桃',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        `<path d="M156 224 C160 200 168 186 176 174 C178 190 184 204 190 214" ${line(2.4, C.green)}/>` +
        shape('M170 176 C178 166 192 168 196 174 C188 180 178 180 170 176Z', C.green) +
        `<circle cx="154" cy="228" r="12" fill="${C.red}" ${E}/><circle cx="190" cy="220" r="12" fill="${C.red}" ${E}/>` +
        `<path d="M148 222 C150 219 153 218 156 218 M184 214 C186 211 189 210 192 210" ${line(2.6, C.white, 0.6)}/>`,
    },
    {
      id: 'yamagata-koma',
      name: '天童將棋駒',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M58 224 L80 236 L86 294 L30 294 L36 236Z', C.yellow) +
        `<path d="M58 224 L80 236 L86 294 L64 294 Z" ${SH}/>` +
        `<text x="58" y="262" font-size="20" font-weight="900" fill="${C.ink}" text-anchor="middle" font-family="var(--font-ja)">王</text>` +
        `<text x="58" y="286" font-size="20" font-weight="900" fill="${C.ink}" text-anchor="middle" font-family="var(--font-ja)">将</text>`,
    },
  ],
  fukushima: [
    {
      id: 'fukushima-akabeko',
      name: '赤牛',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M30 270 C30 260 40 256 56 256 C72 256 84 260 84 270 L84 280 L30 280Z', C.red) +
        `<path d="M34 280 L34 294 M44 280 L44 294 M70 280 L70 294 M80 280 L80 294" ${line(5, C.ink)}/>` +
        `<path d="M40 262 L76 262" ${line(2, C.gold)}/>` +
        dots(C.white, 2.4, [[44, 270], [56, 268], [68, 270]]) +
        dots(C.ink, 1.6, [[50, 274], [62, 274]]) +
        `<g class="bob">` +
        shape('M10 254 C10 244 18 240 26 240 C34 240 40 246 40 254 C40 264 32 268 26 268 C18 268 10 264 10 254Z', C.red) +
        shape('M14 242 C10 236 12 232 16 232 L20 240Z M36 242 C40 236 38 232 34 232 L30 240Z', C.white) +
        shape('M12 258 C12 254 40 254 40 258 C40 264 12 264 12 258Z', C.ink) +
        eye(20, 250, 1.8) +
        eye(32, 250, 1.8) +
        `</g>`,
    },
    {
      id: 'fukushima-kitakata',
      name: '喜多方拉麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({ bowl: C.navy, rim: C.white, soup: C.brown, noodle: C.cream, top: chashu(150, 207) + chashu(164, 209) + chashu(180, 206) + negi([[156, 203], [172, 203], [186, 210]]) }),
    },
    {
      id: 'fukushima-momo',
      name: '福島水蜜桃',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: fruit(C.pink, { crease: true }),
    },
  ],
  ibaraki: [
    {
      id: 'ibaraki-natto',
      name: '稻草納豆',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M136 176 C150 196 180 196 196 176 C196 202 186 238 166 240 C146 238 136 202 136 176Z', C.yellow) +
        `<path d="M144 184 C150 206 156 226 162 238 M188 184 C182 206 176 226 170 238 M166 192 L166 238" ${line(1.2, C.brown, 0.5)}/>` +
        shape('M148 186 C156 192 176 192 184 186 C182 198 150 198 148 186Z', C.brown) +
        dots(C.orange, 2.4, [[156, 190], [164, 192], [172, 190], [168, 187]]) +
        `<path d="M134 176 L140 170 M198 176 L192 170" ${line(2, C.yellow)}/>` +
        `<path d="M146 214 L186 214" ${line(2.4, C.brown)}/>`,
    },
    {
      id: 'ibaraki-ume',
      name: '偕樂園梅花簪',
      slot: 'head',
      rarity: 2,
      icon: '120 30 80 96',
      svg: kanzashi(C.pink, C.red),
    },
    {
      id: 'ibaraki-anko',
      name: '鮟鱇魚',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M24 276 C24 256 44 248 62 252 C80 256 90 266 90 278 C90 290 76 294 58 294 C38 294 24 290 24 276Z', C.brown) +
        shape('M88 276 L100 266 L100 290Z', C.brown) +
        shape('M28 280 C40 288 54 288 64 282 L62 290 C50 294 36 292 28 286Z', C.cream) +
        `<path d="M30 280 L34 276 L38 282 L42 276 L46 282 L50 276 L54 282" ${line(1.4, C.white)}/>` +
        `<path d="M44 254 C40 240 30 236 24 238" ${line(1.8, C.brown)}/>` +
        `<circle cx="23" cy="238" r="3.4" fill="${C.yellow}" ${E}/>` +
        `<circle cx="50" cy="264" r="4" fill="${C.white}" ${E}/>` +
        eye(50, 264, 2),
    },
  ],
  tochigi: [
    {
      id: 'tochigi-gyoza',
      name: '宇都宮煎餃',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        [140, 156, 172, 188]
          .map((x) => shape(`M${x - 10} 226 C${x - 10} 212 ${x + 10} 212 ${x + 10} 226 Z`, C.cream) + `<path d="M${x - 10} 226 L${x + 10} 226" ${line(3, C.orange, 0.8)}/><path d="M${x - 5} 216 L${x - 4} 220 M${x} 214 L${x} 219 M${x + 5} 216 L${x + 4} 220" ${line(1, C.ink, 0.3)}/>`)
          .join('') +
        `<path d="M186 214 L204 190 M190 216 L208 192" ${line(2.4, C.brown)}/>`,
    },
    {
      id: 'tochigi-saru',
      name: '日光不看猴',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M38 294 C34 276 42 266 58 266 C74 266 82 276 78 294Z', C.brown) +
        shape('M58 232 C72 232 80 242 80 254 C80 266 70 272 58 272 C46 272 36 266 36 254 C36 242 44 232 58 232Z', C.brown) +
        `<circle cx="36" cy="252" r="6" fill="${C.pink}" ${E}/><circle cx="80" cy="252" r="6" fill="${C.pink}" ${E}/>` +
        shape('M44 250 C44 242 72 242 72 250 C72 266 44 266 44 250Z', C.pink) +
        `<path d="M60 264 Q58 266 56 264" ${line(1.4)}/>` +
        shape('M36 252 C40 240 56 240 58 246 C52 250 44 252 36 252Z M80 252 C76 240 60 240 58 246 C64 250 72 252 80 252Z', C.brown),
    },
    {
      id: 'tochigi-ichigo',
      name: '栃木草莓',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M150 198 C150 190 184 190 184 198 C184 214 174 232 167 236 C160 232 150 214 150 198Z', C.red) +
        `<path d="M176 196 C184 202 182 214 176 226 C172 232 168 236 167 236 C174 224 178 210 176 196Z" ${SH}/>` +
        dots(C.yellow, 1.2, [[158, 204], [168, 206], [176, 204], [162, 216], [172, 216], [167, 226]]) +
        shape('M150 196 L160 188 L167 194 L174 188 L184 196 L174 200 L167 196 L160 200Z', C.green) +
        `<path d="M167 192 L167 182" ${line(2.4, C.green)}/>`,
    },
  ],
  gunma: [
    {
      id: 'gunma-tengu',
      name: '天狗面',
      slot: 'face',
      rarity: 3,
      icon: '128 34 80 74',
      svg: sideMask(
        shape('M160 76 C172 74 196 70 204 66 C200 74 180 84 162 84Z', C.red) +
          `<path d="M144 64 Q150 58 156 64 M164 64 Q170 58 176 64" ${line(3, C.ink)}/>` +
          `<circle cx="150" cy="70" r="2.4" fill="${C.ink}"/><circle cx="170" cy="70" r="2.4" fill="${C.ink}"/>` +
          shape('M144 92 C150 100 170 100 176 92 C170 96 150 96 144 92Z', C.ink) +
          `<path d="M140 98 C146 108 174 108 180 98" ${line(4, C.white)}/>`,
        C.red,
      ),
    },
    {
      id: 'gunma-katsudon',
      name: '醬汁豬排丼',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({
        bowl: C.navy,
        rim: C.red,
        soup: C.white,
        sticks: true,
        top:
          shape('M142 206 C142 196 162 194 166 200 C164 208 150 212 142 206Z', C.brown) +
          shape('M164 204 C166 194 186 192 190 200 C186 208 172 210 164 204Z', C.brown) +
          `<path d="M146 202 L160 200 M168 200 L184 198" ${line(1.4, C.ink, 0.4)}/>`,
      }),
    },
    {
      id: 'gunma-yumomi',
      name: '草津湯揉板',
      slot: 'hand',
      rarity: 2,
      icon: '120 120 96 124',
      svg:
        shape('M152 238 L162 236 L192 126 L184 124Z', C.cream) +
        `<path d="M158 236 L188 125" ${line(1.2, C.brown, 0.4)}/>` +
        `<path d="M184 124 L192 126 L162 236 L158 237Z" ${SH}/>` +
        `<path d="M168 178 C172 176 176 178 178 182" ${line(1.4, C.brown, 0.5)}/>`,
    },
  ],
  saitama: [
    {
      id: 'saitama-senbei',
      name: '草加煎餅',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        `<circle cx="168" cy="210" r="26" fill="${C.brown}" ${E}/>` +
        `<path d="M184 190 C194 200 196 214 190 226 C184 236 174 238 168 236 C180 226 186 206 184 190Z" ${SH}/>` +
        `<path d="M150 200 C156 206 162 200 168 206 M156 222 C162 214 172 224 178 216" ${line(1.4, C.ink, 0.35)}/>` +
        shape('M158 194 L178 194 L178 230 L158 230Z', C.ink, 'opacity=".85"') +
        `<path d="M162 198 L174 198" ${line(1, C.white, 0.3)}/>`,
    },
    {
      id: 'saitama-hina',
      name: '岩槻雛人形',
      slot: 'buddy',
      rarity: 3,
      icon: ICON.buddy,
      svg:
        shape('M24 294 C24 270 40 258 58 258 C76 258 92 270 92 294Z', C.purple) +
        `<path d="M58 258 L58 294" ${line(1.4, C.ink, 0.3)}/>` +
        shape('M40 274 C40 266 76 266 76 274 L78 294 L38 294Z', C.red) +
        shape('M48 262 L58 276 L68 262Z', C.white) +
        `<path d="M50 262 L58 274 L66 262" ${line(2, C.gold)}/>` +
        shape('M58 230 C68 230 72 238 72 246 C72 254 66 260 58 260 C50 260 44 254 44 246 C44 238 48 230 58 230Z', C.white) +
        shape('M46 236 C46 226 70 226 70 236 C64 232 52 232 46 236Z', C.ink) +
        shape('M54 228 L62 228 L60 212 L56 212Z', C.ink) +
        `<path d="M52 248 L55 248 M61 248 L64 248" ${line(1.4)}/>` +
        `<circle cx="58" cy="254" r="1.2" fill="${C.red}"/>` +
        `<path d="M72 272 L82 254" ${line(3, C.gold)}/>`,
    },
    {
      id: 'saitama-imo',
      name: '川越番薯',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M138 216 C134 202 150 188 172 186 C192 184 202 196 198 210 C194 226 176 236 156 234 C146 232 140 226 138 216Z', C.purple) +
        `<path d="M186 188 C198 194 200 206 196 214 C190 228 176 234 166 234 C182 226 190 206 186 188Z" ${SH}/>` +
        shape('M138 216 C142 208 152 204 158 210 C154 222 146 228 140 226Z', C.yellow) +
        `<path d="M160 196 L164 200 M178 200 L182 196 M170 216 L174 220" ${line(1.4, C.ink, 0.3)}/>`,
    },
  ],
  chiba: [
    {
      id: 'chiba-rakkasei',
      name: '千葉落花生',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M148 208 C142 192 154 180 166 184 C172 186 174 194 170 200 C166 206 170 212 176 214 C186 216 192 226 186 236 C178 246 160 242 156 230 C154 222 152 216 148 208Z', C.cream) +
        `<path d="M176 216 C184 220 188 228 184 236 C180 242 170 242 164 238 C176 236 182 226 176 216Z" ${SH}/>` +
        `<path d="M152 196 L164 194 M150 204 L166 202 M164 222 L180 222 M164 230 L182 230" ${line(1.2, C.brown, 0.45)}/>`,
    },
    {
      id: 'chiba-futomaki',
      name: '太卷祭壽司',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg:
        plate(C.red) +
        [148, 184]
          .map(
            (x) =>
              `<circle cx="${x}" cy="214" r="15" fill="${C.ink}" ${E}/><circle cx="${x}" cy="214" r="12" fill="${C.white}"/>` +
              `<g>${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="${x}" cy="208" rx="3.6" ry="5" fill="${C.pink}" transform="rotate(${a} ${x} 214)"/>`).join('')}</g>` +
              `<circle cx="${x}" cy="214" r="2.4" fill="${C.yellow}"/>` +
              `<path d="M${x - 9} 222 C${x - 4} 218 ${x + 4} 218 ${x + 9} 222" ${line(2, C.green)}/>`,
          )
          .join(''),
    },
    {
      id: 'chiba-nanohana',
      name: '油菜花簪',
      slot: 'head',
      rarity: 1,
      icon: '120 30 80 96',
      svg: kanzashi(C.yellow, C.orange, `<path d="M146 76 C150 70 156 68 160 70" ${line(2.4, C.green)}/>`),
    },
  ],
  tokyo: [
    L('tokyo-chochin'),
    {
      id: 'tokyo-kumadori',
      name: '歌舞伎隈取',
      slot: 'face',
      rarity: 3,
      icon: '76 80 88 64',
      svg:
        `<path d="M90 104 C96 92 104 92 112 100 M128 100 C136 92 144 92 150 104" ${line(3.4, C.red)}/>` +
        `<path d="M92 116 C86 124 84 132 88 140 M148 116 C154 124 156 132 152 140" ${line(3.4, C.red)}/>` +
        `<path d="M96 100 C90 96 84 98 80 102 M144 100 C150 96 156 98 160 102" ${line(2.4, C.red)}/>` +
        `<path d="M112 130 L128 130" ${line(2.4, C.red)}/>`,
    },
    {
      id: 'tokyo-kiriko',
      name: '江戶切子',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg:
        shape('M144 198 L188 198 L184 238 C184 240 148 240 148 238Z', C.blue) +
        `<path d="M144 198 L188 198 L184 238 C184 240 148 240 148 238Z" fill="url(#doll-kiriko)" opacity=".8"/>` +
        `<path d="M176 200 L188 198 L184 238 L176 239Z" ${SH}/>` +
        `<ellipse cx="166" cy="198" rx="22" ry="4" fill="${C.white}" opacity=".7" ${E}/>` +
        `<path d="M152 204 L154 230" ${line(2.4, C.white, 0.6)}/>`,
    },
  ],
  kanagawa: [
    {
      id: 'kanagawa-curry',
      name: '橫須賀海軍咖哩',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        shape('M136 224 C134 212 150 204 164 206 C170 208 172 216 166 222 C158 228 142 230 136 224Z', C.white) +
        shape('M162 220 C166 208 186 204 196 214 C200 222 192 228 178 228 C168 228 162 226 162 220Z', C.orange) +
        dots(C.brown, 2.4, [[176, 216], [186, 220], [180, 224]]) +
        dots(C.orange, 2, [[172, 222]]) +
        `<path d="M196 226 L210 196" ${line(3, C.grey)}/><ellipse cx="196" cy="226" rx="5" ry="3" fill="${C.grey}"/>`,
    },
    {
      id: 'kanagawa-daibutsu',
      name: '鎌倉大佛',
      slot: 'buddy',
      rarity: 3,
      icon: ICON.buddy,
      svg:
        shape('M22 294 C22 270 36 256 58 256 C80 256 94 270 94 294Z', C.green) +
        `<path d="M28 294 C30 276 40 266 58 266 C76 266 86 276 88 294" ${SH}/>` +
        shape('M42 282 C42 276 74 276 74 282 C74 288 42 288 42 282Z', C.green) +
        `<path d="M46 280 C52 276 64 276 70 280" ${line(1.4, C.ink, 0.3)}/>` +
        shape('M58 220 C72 220 78 230 78 242 C78 254 70 262 58 262 C46 262 38 254 38 242 C38 230 44 220 58 220Z', C.green) +
        dots(C.matcha, 2.6, [[48, 226], [56, 222], [64, 222], [70, 228], [44, 234], [72, 236], [52, 230], [62, 230]]) +
        `<path d="M38 240 L34 258 M78 240 L82 258" ${line(4, C.green)}/>` +
        `<path d="M48 244 Q52 246 56 244 M60 244 Q64 246 68 244" ${line(1.6)}/>` +
        `<circle cx="58" cy="236" r="1.6" fill="${C.cream}"/>` +
        `<path d="M54 254 Q58 256 62 254" ${line(1.4)}/>`,
    },
    {
      id: 'kanagawa-yosegi',
      name: '箱根寄木細工',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg:
        shape('M140 204 L192 204 L192 236 L140 236Z', C.brown) +
        `<path d="M140 204 L192 204 L192 236 L140 236Z" fill="url(#doll-yosegi)"/>` +
        shape('M136 196 L196 196 L192 206 L140 206Z', C.cream) +
        `<path d="M136 196 L196 196 L192 206 L140 206Z" fill="url(#doll-yosegi)" opacity=".7"/>` +
        `<path d="M180 206 L192 206 L192 236 L180 236Z" ${SH}/>`,
    },
  ],
  niigata: [
    {
      id: 'niigata-sasadango',
      name: '笹團子',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        [
          [150, 216, -20],
          [176, 212, 18],
        ]
          .map(
            ([x, y, r]) =>
              `<g transform="rotate(${r} ${x} ${y})">` +
              shape(`M${x} ${y - 24} C${x + 14} ${y - 12} ${x + 14} ${y + 14} ${x} ${y + 24} C${x - 14} ${y + 14} ${x - 14} ${y - 12} ${x} ${y - 24}Z`, C.green) +
              `<path d="M${x} ${y - 22} L${x} ${y + 22}" ${line(1, C.matcha, 0.8)}/>` +
              `<path d="M${x - 11} ${y - 4} L${x + 11} ${y - 4} M${x - 11} ${y + 6} L${x + 11} ${y + 6}" ${line(2, C.cream)}/>` +
              `</g>`,
          )
          .join(''),
    },
    {
      id: 'niigata-koi',
      name: '錦鯉',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        `<ellipse cx="58" cy="290" rx="34" ry="6" fill="${C.blue}" opacity=".45"/>` +
        `<path d="M30 288 C36 284 44 286 48 290 M66 290 C72 286 80 284 86 288" ${line(1.6, C.white, 0.7)}/>` +
        `<g transform="rotate(-24 58 262)">` +
        shape('M26 262 C34 246 64 242 82 254 C88 258 88 266 82 270 C64 282 34 278 26 262Z', C.white) +
        shape('M84 262 L98 250 L96 262 L98 274Z', C.white) +
        shape('M36 254 C44 248 56 248 60 254 C54 262 42 262 36 254Z M62 268 C70 266 78 268 80 272 C72 276 66 274 62 268Z', C.red) +
        shape('M44 266 C50 264 56 266 56 270 C50 272 46 270 44 266Z', C.ink) +
        eye(32, 260, 1.6) +
        `<path d="M24 264 C20 266 18 270 18 272" ${line(1.4, C.ink, 0.6)}/>` +
        `</g>`,
    },
    {
      id: 'niigata-sake',
      name: '新潟日本酒',
      slot: 'hand',
      rarity: 2,
      icon: '124 130 92 116',
      svg:
        shape('M154 238 L154 176 C154 166 160 162 162 152 L162 138 L174 138 L174 152 C176 162 182 166 182 176 L182 238 C182 242 154 242 154 238Z', C.green) +
        `<path d="M172 152 C176 162 182 166 182 176 L182 238 C182 241 178 242 174 242 C176 210 176 176 172 152Z" ${SH}/>` +
        shape('M160 136 L176 136 L176 142 L160 142Z', C.gold) +
        shape('M156 186 L180 186 L180 222 L156 222Z', C.white) +
        `<text x="168" y="210" font-size="13" font-weight="900" fill="${C.ink}" text-anchor="middle" font-family="var(--font-ja)">酒</text>` +
        `<path d="M158 182 L158 236" ${line(2.4, C.white, 0.4)}/>`,
    },
  ],
  toyama: [
    {
      id: 'toyama-masuzushi',
      name: '鱒壽司',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M132 216 C132 206 200 206 200 216 L198 232 C198 240 134 240 134 232Z', C.cream) +
        `<path d="M134 224 C150 230 182 230 198 224" ${line(4, C.red, 0.9)}/>` +
        `<ellipse cx="166" cy="214" rx="32" ry="8" fill="${C.green}" ${E}/>` +
        shape('M144 212 C152 204 180 204 188 212 C180 218 152 218 144 212Z', C.pink) +
        `<path d="M150 210 L182 210 M154 213 L178 213" ${line(1, C.white, 0.6)}/>` +
        `<path d="M136 214 L144 206 M196 214 L188 206" ${line(2, C.green)}/>`,
    },
    {
      id: 'toyama-raicho',
      name: '雷鳥',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M30 274 C30 256 46 248 62 250 C80 252 90 264 88 280 C86 292 74 296 58 296 C42 296 30 290 30 274Z', C.white) +
        shape('M86 270 L98 262 L94 276Z', C.white) +
        shape('M36 252 C36 238 46 232 54 232 C62 232 68 238 66 248 C64 256 56 260 48 260 C40 260 36 258 36 252Z', C.white) +
        shape('M44 238 C48 234 54 234 58 238 C54 240 48 240 44 238Z', C.red) +
        eye(50, 242, 1.8) +
        shape('M36 246 L30 248 L36 250Z', C.ink) +
        `<path d="M56 270 C64 266 74 268 80 274" ${line(1.4, C.ink, 0.25)}/>` +
        `<path d="M50 294 L50 298 M66 294 L66 298" ${line(3, C.white)}/>`,
    },
    {
      id: 'toyama-black',
      name: '富山黑拉麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({ bowl: C.white, rim: C.red, soup: C.ink, noodle: C.yellow, top: chashu(154, 207) + nori(178) + negi([[164, 204], [170, 210], [186, 208]]) }),
    },
  ],
  ishikawa: [
    L('ishikawa-kinpaku'),
    {
      id: 'ishikawa-yuzen',
      name: '加賀友禪',
      slot: 'body',
      rarity: 3,
      icon: ICON.body,
      svg: robe({ base: C.purple, pattern: 'doll-yuzen', obi: C.gold, obiLine: C.red, collar: C.white }),
    },
    {
      id: 'ishikawa-kutani',
      name: '九谷燒茶杯',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg: cup(
        C.white,
        C.matcha,
        `<path d="M142 212 L190 212 M144 226 L188 226" ${line(4, C.red)}/>` +
          `<path d="M148 212 L154 226 M162 212 L168 226 M176 212 L182 226" ${line(3, C.green)}/>` +
          dots(C.gold, 1.6, [[150, 219], [164, 219], [178, 219]]) +
          `<path d="M144 232 L188 232" ${line(2, C.blue)}/>`,
      ),
    },
  ],
  fukui: [
    {
      id: 'fukui-sabae',
      name: '鯖江眼鏡',
      slot: 'face',
      rarity: 2,
      icon: '76 88 88 44',
      svg:
        shape('M88 101 C88 98 116 98 116 101 L114 116 C112 122 92 122 90 116Z', C.red, `fill-opacity="0"`) +
        `<path d="M88 101 C88 98 116 98 116 101 L114 116 C112 122 92 122 90 116Z M124 101 C124 98 152 98 152 101 L150 116 C148 122 128 122 126 116Z" ${line(3.4, C.red)}/>` +
        `<path d="M116 104 Q120 100 124 104 M88 102 L78 100 M152 102 L162 100" ${line(2.6, C.red)}/>` +
        `<path d="M94 106 L100 106 M130 106 L136 106" ${line(2, C.white, 0.6)}/>`,
    },
    {
      id: 'fukui-dino',
      name: '福井恐龍',
      slot: 'buddy',
      rarity: 3,
      icon: ICON.buddy,
      svg:
        shape('M38 290 C34 270 44 258 62 258 C80 258 88 270 86 284 C94 288 100 286 104 280 C102 292 92 296 80 294 L42 294Z', C.green) +
        `<path d="M44 294 L44 300 M70 294 L70 300" ${line(5, C.green)}/>` +
        shape('M44 266 C40 250 44 232 54 226 C64 220 76 224 80 232 C84 240 78 248 70 248 L62 248 C60 256 58 262 56 268Z', C.green) +
        `<path d="M50 230 L46 222 L54 226 L54 216 L60 224 L64 216 L66 226" ${line(2.6, C.matcha)}/>` +
        shape('M52 276 C52 268 72 268 72 276 C72 286 52 286 52 276Z', C.cream) +
        eye(70, 234, 2.2) +
        `<path d="M70 244 L78 242" ${line(1.4)}/>` +
        `<path d="M74 266 L80 270" ${line(3, C.green)}/>`,
    },
    {
      id: 'fukui-kani',
      name: '越前蟹',
      slot: 'hand',
      rarity: 2,
      icon: '120 168 100 76',
      svg:
        `<path d="M146 214 L130 202 L126 190 M146 222 L128 222 L122 214 M186 214 L202 202 L206 190 M186 222 L204 222 L210 214 M150 228 L138 238 M182 228 L194 238" ${line(4, C.orange)}/>` +
        shape('M144 214 C144 198 188 198 188 214 C188 228 144 228 144 214Z', C.orange) +
        `<path d="M176 202 C186 206 188 214 186 220 C182 226 174 228 168 228 C178 222 180 210 176 202Z" ${SH}/>` +
        shape('M124 186 C118 178 126 170 132 176 L128 190Z M208 186 C214 178 206 170 200 176 L204 190Z', C.red) +
        dots(C.white, 1.4, [[156, 208], [166, 206], [176, 208]]) +
        eye(158, 200, 1.8) +
        eye(174, 200, 1.8),
    },
  ],
  yamanashi: [
    L('yamanashi-budo'),
    {
      id: 'yamanashi-hoto',
      name: '餺飥麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg:
        shape('M132 210 C132 230 148 238 166 238 C184 238 200 230 200 210Z', C.ink) +
        `<path d="M128 212 L136 210 M196 210 L204 212" ${line(4, C.ink)}/>` +
        `<ellipse cx="166" cy="210" rx="34" ry="7" fill="${C.orange}" ${E}/>` +
        `<path d="M144 210 C150 204 156 214 162 208 M168 210 C174 204 180 214 188 208" ${line(4, C.cream)}/>` +
        shape('M150 206 L160 200 L164 208Z', C.yellow) +
        shape('M172 204 L184 202 L180 210Z', C.green) +
        `<path d="M184 196 L202 172 M190 198 L208 174" ${line(2.4, C.brown)}/>`,
    },
    {
      id: 'yamanashi-kabuto',
      name: '信玄白毛兜',
      slot: 'head',
      rarity: 3,
      icon: '30 -6 180 120',
      svg:
        shape('M64 86 C40 96 32 124 36 150 C48 132 58 112 70 98Z M176 86 C200 96 208 124 204 150 C192 132 182 112 170 98Z', C.white) +
        `<path d="M44 120 L52 100 M196 120 L188 100" ${line(1.2, C.grey, 0.6)}/>` +
        shape('M62 86 C58 46 86 28 120 28 C154 28 182 46 178 86 C170 78 160 74 150 74 L90 74 C80 74 70 78 62 86Z', C.ink) +
        shape('M60 40 C70 30 90 26 120 26 C150 26 170 30 180 40 C160 36 140 38 120 46 C100 38 80 36 60 40Z', C.white) +
        shape('M104 32 C92 18 84 4 90 -4 C96 8 106 18 114 26Z M136 32 C148 18 156 4 150 -4 C144 8 134 18 126 26Z', C.gold) +
        `<circle cx="120" cy="40" r="5" fill="${C.gold}" ${E}/>`,
    },
  ],
  nagano: [
    L('nagano-soba'),
    {
      id: 'nagano-monkey',
      name: '地獄谷雪猴',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        `<ellipse cx="58" cy="288" rx="38" ry="9" fill="${C.blue}" opacity=".45"/>` +
        shape('M32 288 C28 268 40 256 58 256 C76 256 88 268 84 288Z', C.grey) +
        shape('M58 226 C74 226 82 236 82 250 C82 262 72 268 58 268 C44 268 34 262 34 250 C34 236 42 226 58 226Z', C.grey) +
        shape('M44 248 C44 238 72 238 72 248 C72 262 44 262 44 248Z', C.pink) +
        eye(52, 248, 1.8) +
        eye(64, 248, 1.8) +
        `<path d="M54 258 Q58 260 62 258" ${line(1.4)}/>` +
        shape('M44 228 C48 220 68 220 72 228 C66 226 50 226 44 228Z', C.white) +
        `<path d="M30 286 C40 280 76 280 86 286" ${line(2, C.white, 0.7)}/>` +
        `<path d="M70 274 C74 270 80 272 80 278" ${line(1.4, C.white, 0.6)}/>`,
    },
    {
      id: 'nagano-matsumoto',
      name: '松本城帽',
      slot: 'head',
      rarity: 3,
      icon: '40 -6 160 96',
      svg: castle({ wall: C.ink, roof: C.ink, trim: C.white }),
    },
  ],
  gifu: [
    {
      id: 'gifu-sarubobo',
      name: '猿寶寶',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M40 292 C36 276 44 266 58 266 C72 266 80 276 76 292Z', C.red) +
        `<path d="M40 276 L28 266 M76 276 L88 266 M48 292 L46 300 M68 292 L70 300" ${line(6, C.red)}/>` +
        shape('M58 230 C72 230 78 240 78 252 C78 264 70 270 58 270 C46 270 38 264 38 252 C38 240 44 230 58 230Z', C.red) +
        shape('M36 252 C34 232 46 222 58 222 C70 222 82 232 80 252 L74 244 C70 236 64 234 58 234 C52 234 46 236 42 244Z', C.ink) +
        shape('M50 266 L66 266 L66 274 L50 274Z', C.ink) +
        `<path d="M50 256 L66 256" ${line(1.2, C.ink, 0.15)}/>`,
    },
    {
      id: 'gifu-hidagyu',
      name: '飛驒牛串',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: skewer(
        (x, y) => `<g transform="rotate(16 ${x} ${y})">` + shape(`M${x - 11} ${y - 8} C${x - 11} ${y - 12} ${x + 11} ${y - 12} ${x + 11} ${y - 8} L${x + 11} ${y + 8} C${x + 11} ${y + 12} ${x - 11} ${y + 12} ${x - 11} ${y + 8}Z`, C.brown) + `<path d="M${x - 8} ${y - 2} L${x + 8} ${y - 4} M${x - 8} ${y + 4} L${x + 8} ${y + 2}" ${line(1.4, C.pink, 0.8)}/>` + `</g>`,
        [0.38, 0.62, 0.86],
      ),
    },
    {
      id: 'gifu-eboshi',
      name: '鵜匠風折烏帽子',
      slot: 'head',
      rarity: 3,
      icon: '50 -4 140 100',
      svg:
        shape('M70 82 C68 54 86 38 112 30 C126 24 136 10 150 -2 C156 14 152 32 160 46 C170 60 174 72 172 84 C150 76 92 76 70 82Z', C.ink) +
        `<path d="M112 30 C126 24 136 10 150 -2" ${line(1.4, C.white, 0.25)}/>` +
        `<path d="M86 60 L160 56 M80 72 L166 70" ${line(1, C.white, 0.2)}/>` +
        `<path d="M74 82 C70 98 72 114 80 124 M168 82 C172 98 170 114 162 124" ${line(2, C.white)}/>`,
    },
  ],
  shizuoka: [
    L('shizuoka-fuji'),
    {
      id: 'shizuoka-tea',
      name: '靜岡茶',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: cup(C.cream, C.matcha, `<text x="166" y="226" font-size="13" font-weight="900" fill="${C.green}" text-anchor="middle" font-family="var(--font-ja)">茶</text><path d="M158 192 C160 184 156 178 158 172 M172 192 C174 184 170 178 172 172" ${line(1.6, C.white, 0.7)}/>`),
    },
    {
      id: 'shizuoka-oden',
      name: '靜岡關東煮',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: skewer(
        (x, y, i) =>
          i === 0
            ? shape(`M${x - 10} ${y + 8} L${x + 10} ${y + 8} L${x} ${y - 10}Z`, C.grey) + dots(C.ink, 0.8, [[x - 3, y + 2], [x + 3, y + 3], [x, y - 2]])
            : i === 1
              ? `<circle cx="${x}" cy="${y}" r="10" fill="${C.cream}" ${E}/><circle cx="${x}" cy="${y}" r="10" fill="${C.brown}" opacity=".5"/>`
              : shape(`M${x - 10} ${y - 9} L${x + 10} ${y - 9} L${x + 10} ${y + 9} L${x - 10} ${y + 9}Z`, C.ink) + dots(C.green, 1, [[x - 4, y - 4], [x + 3, y - 2], [x - 2, y + 3], [x + 5, y + 5]]),
        [0.36, 0.6, 0.84],
        C.brown,
      ),
    },
  ],
  aichi: [
    L('aichi-shachi'),
    {
      id: 'aichi-hitsumabushi',
      name: '鰻魚飯三吃',
      slot: 'hand',
      rarity: 2,
      icon: ICON.bowl,
      svg: bowl({
        bowl: C.ink,
        rim: C.gold,
        soup: C.white,
        top:
          [146, 160, 174, 188].map((x) => shape(`M${x - 7} 206 L${x + 7} 204 L${x + 7} 212 L${x - 7} 213Z`, C.brown) + `<path d="M${x - 5} 207 L${x + 5} 206" ${line(1, C.ink, 0.4)}/>`).join('') +
          negi([[152, 202], [180, 201]]),
      }),
    },
    {
      id: 'aichi-ogura',
      name: '小倉吐司',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        shape('M140 226 L140 196 C140 186 150 182 166 182 C182 182 192 186 192 196 L192 226Z', C.yellow) +
        shape('M144 222 L144 198 C144 190 152 187 166 187 C180 187 188 190 188 198 L188 222Z', C.cream) +
        shape('M150 214 C148 202 164 196 176 202 C184 206 182 216 172 218 C162 220 152 220 150 214Z', C.purple) +
        dots(C.brown, 1.4, [[158, 206], [166, 210], [174, 206], [162, 214]]) +
        shape('M174 196 L186 196 L186 204 L174 204Z', C.yellow),
    },
  ],
  mie: [
    {
      id: 'mie-ama',
      name: '海女磯著',
      slot: 'body',
      rarity: 2,
      icon: ICON.body,
      svg:
        shape(PANTS, C.white) +
        shape('M98 151 L142 151 C153 153 161 158 165 167 L172 208 L151 210 L151 240 L89 240 L89 210 L68 208 L75 167 C79 158 87 153 98 151Z', C.white) +
        `<path d="M140 151 C153 153 161 158 165 167 L172 208 L151 210 L151 240 L138 240Z" ${SH}/>` +
        `<path d="M106 150 L132 214 M134 150 L114 192" ${line(1.6, C.ink, 0.3)}/>` +
        `<path d="M88 224 L152 224" ${line(4, C.navy)}/>` +
        `<path d="M138 224 L144 238" ${line(3, C.navy)}/>`,
    },
    {
      id: 'mie-iseudon',
      name: '伊勢烏龍麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({ bowl: C.red, rim: C.ink, soup: C.ink, noodle: C.cream, top: `<path d="M144 206 C152 200 160 210 168 204 C176 210 184 202 190 206" ${line(4, C.cream)}/>` + negi([[156, 202], [176, 210], [184, 203]]) }),
    },
    {
      id: 'mie-ebi',
      name: '伊勢龍蝦',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        `<path d="M30 262 C20 250 16 236 22 222 M36 258 C34 244 38 230 46 222" ${line(1.6, C.red)}/>` +
        shape('M26 272 C26 260 44 256 60 258 C72 260 78 264 82 270 L98 268 L96 280 L82 278 C76 286 62 288 48 286 C34 284 26 280 26 272Z', C.red) +
        `<path d="M54 260 L52 286 M64 262 L62 286 M74 266 L72 282" ${line(1.4, C.ink, 0.3)}/>` +
        `<path d="M36 284 L30 294 M48 286 L46 294 M60 286 L60 294 M72 284 L76 294" ${line(2.4, C.red)}/>` +
        shape('M26 264 C18 260 12 262 10 266 C16 270 22 270 26 268Z', C.orange) +
        eye(34, 266, 2),
    },
  ],
  shiga: [
    {
      id: 'shiga-tanuki',
      name: '信樂燒狸貓',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M30 294 C26 270 38 256 58 256 C78 256 90 270 86 294Z', C.brown) +
        shape('M42 294 C40 276 48 268 58 268 C68 268 76 276 74 294Z', C.cream) +
        shape('M58 226 C72 226 80 236 80 248 C80 260 70 266 58 266 C46 266 36 260 36 248 C36 236 44 226 58 226Z', C.brown) +
        shape('M34 232 C32 216 84 216 82 232 C70 226 46 226 34 232Z', C.yellow) +
        `<ellipse cx="58" cy="222" rx="14" ry="6" fill="${C.yellow}" ${E}/>` +
        shape('M44 246 C44 240 72 240 72 246 C72 254 44 254 44 246Z', C.cream) +
        eye(50, 244, 2) +
        eye(66, 244, 2) +
        `<ellipse cx="58" cy="250" rx="2.6" ry="2" fill="${C.ink}"/>` +
        shape('M82 270 C92 268 96 278 94 288 L84 288 C84 280 82 276 80 274Z', C.white) +
        `<text x="89" y="284" font-size="7" font-weight="900" fill="${C.ink}" text-anchor="middle" font-family="var(--font-ja)">酒</text>`,
    },
    {
      id: 'shiga-ninja',
      name: '甲賀忍者裝',
      slot: 'body',
      rarity: 3,
      icon: ICON.body,
      svg:
        shape(PANTS, C.navy) +
        `<path d="M95 262 L116 262 M124 262 L145 262 M96 268 L116 268 M124 268 L144 268" ${line(1.6, C.white, 0.35)}/>` +
        shape('M98 151 L142 151 C153 153 161 158 165 167 L172 208 L151 210 L151 240 L89 240 L89 210 L68 208 L75 167 C79 158 87 153 98 151Z', C.navy) +
        `<path d="M140 151 C153 153 161 158 165 167 L172 208 L151 210 L151 240 L138 240Z" ${SH}/>` +
        `<path d="M106 150 L132 214 M134 150 L114 192" ${line(1.6, C.white, 0.25)}/>` +
        shape('M88 214 L152 214 L152 224 L88 224Z', C.ink) +
        `<g transform="rotate(20 140 219)">` +
        shape('M140 210 L143 216 L150 219 L143 222 L140 228 L137 222 L130 219 L137 216Z', C.grey) +
        `<circle cx="140" cy="219" r="1.6" fill="${C.ink}"/></g>`,
    },
    {
      id: 'shiga-omigyu',
      name: '近江牛排',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg:
        shape('M128 226 C128 216 204 216 204 226 C204 236 128 236 128 226Z', C.ink) +
        shape('M140 220 C138 206 160 200 176 202 C192 204 196 214 190 222 C184 228 150 230 140 220Z', C.brown) +
        `<path d="M150 210 C158 206 172 206 182 210 M146 218 C158 214 176 214 186 218" ${line(1.4, C.pink, 0.8)}/>` +
        dots(C.orange, 2, [[184, 224], [176, 226]]) +
        `<path d="M196 216 L212 196" ${line(2.6, C.grey)}/>`,
    },
  ],
  kyoto: [
    L('kyoto-matcha'),
    {
      id: 'kyoto-kitsune',
      name: '伏見稻荷狐面',
      slot: 'face',
      rarity: 3,
      icon: '128 26 70 84',
      svg: sideMask(
        shape('M142 54 L136 32 L154 48Z M178 54 L184 32 L166 48Z', C.white) +
          `<path d="M140 50 L138 38 M180 50 L182 38" ${line(2.4, C.red)}/>` +
          `<path d="M144 70 C148 66 154 66 156 70 M164 70 C166 66 172 66 176 70" ${line(2.6, C.red)}/>` +
          `<path d="M146 72 L154 72 M166 72 L174 72" ${line(1.6, C.ink)}/>` +
          `<path d="M160 58 L160 66 M156 62 L164 62" ${line(1.6, C.red)}/>` +
          `<ellipse cx="160" cy="92" rx="3" ry="2" fill="${C.ink}"/>` +
          `<path d="M152 98 Q160 102 168 98" ${line(1.6, C.red)}/>`,
        C.white,
      ),
    },
    {
      id: 'kyoto-kanzashi',
      name: '舞妓花簪',
      slot: 'head',
      rarity: 3,
      icon: '120 30 80 96',
      svg: kanzashi(C.red, C.yellow, dots(C.pink, 3, [[148, 46], [176, 70]]) + dots(C.white, 2.4, [[166, 50]])),
    },
  ],
  osaka: [
    L('osaka-takoyaki'),
    {
      id: 'osaka-castle',
      name: '大阪城帽',
      slot: 'head',
      rarity: 3,
      icon: '40 -6 160 96',
      svg: castle({ wall: C.white, roof: C.green, trim: C.gold }),
    },
    {
      id: 'osaka-danjiri',
      name: '岸和田地車法被',
      slot: 'body',
      rarity: 2,
      icon: ICON.body,
      svg: happi({ base: C.blue, collar: C.white, text: '地車', textColor: C.ink, band: C.red, bottom: PANTS, bottomColor: C.navy }),
    },
  ],
  hyogo: [
    {
      id: 'hyogo-himeji',
      name: '姬路城帽',
      slot: 'head',
      rarity: 3,
      icon: '40 -6 160 96',
      svg: castle({ wall: C.white, roof: C.grey, trim: C.white }),
    },
    {
      id: 'hyogo-akashiyaki',
      name: '明石燒',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M130 222 L196 222 L194 232 L132 232Z', C.yellow) +
        `<path d="M134 227 L192 227" ${line(1, C.brown, 0.4)}/>` +
        dots(C.yellow, 9, [[146, 214], [164, 212], [182, 214]], E) +
        `<path d="M140 208 C144 205 150 205 152 208 M158 206 C162 203 168 203 170 206 M176 208 C180 205 186 205 188 208" ${line(2.4, C.white, 0.6)}/>` +
        shape('M188 218 C188 208 210 208 210 218 C210 228 188 228 188 218Z', C.cream) +
        `<ellipse cx="199" cy="214" rx="9" ry="3" fill="${C.yellow}" opacity=".7"/>`,
    },
    {
      id: 'hyogo-kounotori',
      name: '豐岡東方白鸛',
      slot: 'buddy',
      rarity: 2,
      icon: '14 200 92 100',
      svg:
        `<path d="M50 278 L48 296 M64 278 L66 296" ${line(2.6, C.red)}/>` +
        shape('M30 262 C30 248 46 242 62 244 C78 246 88 256 86 266 C84 276 70 282 54 280 C40 278 30 272 30 262Z', C.white) +
        shape('M58 268 C66 262 80 262 90 270 C84 278 70 280 60 276Z', C.ink) +
        `<path d="M40 252 C38 236 42 222 50 214" ${line(6, C.white)}/>` +
        `<circle cx="52" cy="212" r="7" fill="${C.white}" ${E}/>` +
        shape('M56 210 L80 214 L56 216Z', C.ink) +
        eye(52, 210, 1.6) +
        `<circle cx="52" cy="210" r="3.4" fill="none" stroke="${C.red}" stroke-width="1.2"/>`,
    },
  ],
  nara: [
    L('nara-shika'),
    {
      id: 'nara-deer',
      name: '奈良鹿',
      slot: 'buddy',
      rarity: 2,
      icon: '14 206 92 96',
      svg:
        shape('M30 276 C30 264 40 258 56 258 C72 258 82 264 82 276 L82 282 L30 282Z', C.orange) +
        `<path d="M34 282 L34 296 M44 282 L44 296 M68 282 L68 296 M78 282 L78 296" ${line(4, C.orange)}/>` +
        dots(C.cream, 2, [[44, 264], [54, 262], [64, 264], [50, 270], [62, 270]]) +
        shape('M26 262 C24 252 28 240 36 236 C44 232 52 238 50 248 L46 266Z', C.orange) +
        shape('M22 236 C14 232 10 236 12 240 C18 242 22 240 24 238Z M44 232 C50 226 56 228 54 232 C50 236 46 236 44 234Z', C.orange) +
        `<path d="M30 232 C28 222 24 216 20 212 M28 224 L22 222 M38 230 C40 220 44 214 48 210 M40 222 L46 220" ${line(2, C.brown)}/>` +
        eye(38, 244, 1.8) +
        `<ellipse cx="28" cy="252" rx="2.4" ry="1.8" fill="${C.ink}"/>` +
        shape('M32 260 L44 256 L46 264 L34 268Z', C.white) +
        `<path d="M84 266 C90 262 90 258 86 256" ${line(2, C.white)}/>`,
    },
    {
      id: 'nara-kakinoha',
      name: '柿葉壽司',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate(C.cream) +
        [142, 166, 190]
          .map((x) => shape(`M${x - 11} 226 L${x - 9} 206 C${x - 4} 200 ${x + 4} 200 ${x + 9} 206 L${x + 11} 226Z`, C.green) + `<path d="M${x} 202 L${x} 226 M${x - 8} 214 L${x} 210 L${x + 8} 214" ${line(1, C.matcha, 0.9)}/>`)
          .join('') +
        shape('M178 206 L190 200 L200 208 L188 214Z', C.pink),
    },
  ],
  wakayama: [
    {
      id: 'wakayama-ume',
      name: '紀州梅乾',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M144 206 C138 222 144 238 166 240 C188 238 194 222 188 206Z', C.cream) +
        shape('M150 198 L182 198 L186 206 L146 206Z', C.brown) +
        `<path d="M176 206 L188 206 C194 222 188 238 170 240 C182 230 182 216 176 206Z" ${SH}/>` +
        `<text x="166" y="230" font-size="13" font-weight="900" fill="${C.red}" text-anchor="middle" font-family="var(--font-ja)">梅</text>` +
        dots(C.red, 6, [[156, 190], [170, 188], [180, 194]], E) +
        `<path d="M152 186 L154 184 M166 184 L168 182" ${line(1.6, C.white, 0.6)}/>`,
    },
    {
      id: 'wakayama-yatagarasu',
      name: '熊野八咫烏',
      slot: 'buddy',
      rarity: 3,
      icon: ICON.buddy,
      svg:
        shape('M30 270 C30 252 46 244 62 246 C80 248 90 260 88 274 C86 284 74 288 58 288 C42 288 30 282 30 270Z', C.ink) +
        shape('M84 266 L100 258 L98 270 L102 280 L86 276Z', C.ink) +
        shape('M36 250 C34 236 44 228 54 228 C64 228 70 236 68 246 C66 254 58 258 50 258 C42 258 36 256 36 250Z', C.ink) +
        shape('M36 244 L24 248 L36 252Z', C.gold) +
        `<circle cx="50" cy="240" r="3" fill="${C.gold}"/>` +
        `<path d="M52 288 L50 298 M60 288 L60 298 M68 288 L70 298" ${line(2.4, C.gold)}/>` +
        `<path d="M56 262 C66 258 78 260 84 268" ${line(1.4, C.white, 0.3)}/>`,
    },
    {
      id: 'wakayama-ramen',
      name: '和歌山拉麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({ bowl: C.white, rim: C.blue, soup: C.brown, noodle: C.cream, top: chashu(152, 207) + naruto(170, 205) + negi([[180, 210], [186, 204], [160, 211]]) }),
    },
  ],
  tottori: [
    {
      id: 'tottori-nashi',
      name: '二十世紀梨',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: fruit(C.matcha, { dots: C.yellow }),
    },
    {
      id: 'tottori-usagi',
      name: '因幡白兔',
      slot: 'buddy',
      rarity: 2,
      icon: '14 196 92 104',
      svg:
        shape('M34 292 C30 274 42 264 58 264 C74 264 84 274 80 292Z', C.white) +
        shape('M42 240 C40 220 44 206 50 204 C56 206 56 222 54 238Z M64 238 C62 222 64 206 70 204 C76 206 78 220 74 240Z', C.white) +
        `<path d="M48 214 L50 234 M70 214 L68 234" ${line(3, C.pink)}/>` +
        shape('M58 232 C72 232 78 242 78 254 C78 264 70 270 58 270 C46 270 38 264 38 254 C38 242 44 232 58 232Z', C.white) +
        `<circle cx="50" cy="250" r="2.2" fill="${C.red}"/><circle cx="66" cy="250" r="2.2" fill="${C.red}"/>` +
        `<path d="M58 256 L58 260 M54 262 Q58 264 62 262" ${line(1.2)}/>` +
        `<circle cx="82" cy="286" r="5" fill="${C.white}" ${E}/>`,
    },
    {
      id: 'tottori-kani',
      name: '松葉蟹帽',
      slot: 'head',
      rarity: 3,
      icon: '24 0 192 96',
      svg:
        `<path d="M76 58 L54 50 L44 40 M76 66 L50 66 L40 58 M164 58 L186 50 L196 40 M164 66 L190 66 L200 58" ${line(4, C.orange)}/>` +
        shape('M70 64 C70 36 170 36 170 64 C170 80 70 80 70 64Z', C.orange) +
        `<path d="M148 42 C164 48 170 58 168 68 C164 76 150 78 140 78 C156 70 158 54 148 42Z" ${SH}/>` +
        shape('M60 34 C50 20 66 8 76 18 L70 36Z M180 34 C190 20 174 8 164 18 L170 36Z', C.red) +
        `<path d="M64 22 L72 28 M176 22 L168 28" ${line(1.4, C.white, 0.6)}/>` +
        `<path d="M108 40 L106 30 M132 40 L134 30" ${line(2, C.orange)}/>` +
        `<circle cx="106" cy="28" r="4" fill="${C.white}" ${E}/><circle cx="134" cy="28" r="4" fill="${C.white}" ${E}/>` +
        eye(106, 28, 2) +
        eye(134, 28, 2) +
        dots(C.white, 1.6, [[100, 54], [120, 50], [140, 54], [110, 64], [130, 64]]),
    },
  ],
  shimane: [
    {
      id: 'shimane-shimenawa',
      name: '出雲注連繩髮帶',
      slot: 'head',
      rarity: 2,
      icon: '44 50 152 74',
      svg:
        shape('M62 86 C82 70 158 70 178 86 L178 98 C158 84 82 84 62 98Z', C.yellow) +
        `<path d="M70 84 L76 96 M84 78 L90 90 M98 75 L104 87 M112 74 L118 86 M126 74 L132 86 M140 75 L146 87 M154 78 L160 90 M168 82 L172 94" ${line(1.6, C.brown, 0.6)}/>` +
        [92, 120, 148]
          .map((x) => shape(`M${x - 4} 86 L${x + 4} 86 L${x + 4} 94 L${x + 8} 94 L${x + 8} 104 L${x} 104 L${x} 112 L${x - 6} 112 L${x - 6} 100 L${x - 4} 100Z`, C.white))
          .join(''),
    },
    {
      id: 'shimane-warigo',
      name: '出雲割子蕎麥',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        [236, 224, 212]
          .map((y, i) => shape(`M140 ${y - 6} C140 ${y + 4} 192 ${y + 4} 192 ${y - 6} L190 ${y} C190 ${y + 8} 142 ${y + 8} 142 ${y}Z`, i % 2 ? C.ink : C.red) + `<ellipse cx="166" cy="${y - 6}" rx="26" ry="5" fill="${C.brown}" ${E}/><path d="M150 ${y - 6} C156 ${y - 9} 162 ${y - 3} 168 ${y - 7} C174 ${y - 3} 180 ${y - 9} 184 ${y - 6}" ${line(1.6, C.cream, 0.7)}/>`)
          .join('') +
        dots(C.green, 1.4, [[160, 204], [172, 207]]) +
        dots(C.yellow, 1.6, [[166, 202]]),
    },
    {
      id: 'shimane-orochi',
      name: '石見神樂大蛇面',
      slot: 'face',
      rarity: 3,
      icon: '128 34 70 76',
      svg: sideMask(
        `<circle cx="150" cy="68" r="6" fill="${C.gold}" ${E}/><circle cx="170" cy="68" r="6" fill="${C.gold}" ${E}/>` +
          eye(150, 68, 2.6) +
          eye(170, 68, 2.6) +
          shape('M142 86 C150 98 170 98 178 86 L172 100 C166 104 154 104 148 100Z', C.red) +
          `<path d="M148 86 L150 94 M172 86 L170 94" ${line(2.4, C.white)}/>` +
          `<path d="M140 52 C146 46 152 46 156 50 M180 52 C174 46 168 46 164 50" ${line(2.4, C.gold)}/>` +
          `<path d="M160 50 L160 60" ${line(2, C.gold)}/>` +
          dots(C.matcha, 2.2, [[146, 58], [174, 58], [142, 78], [178, 78]]),
        C.green,
      ),
    },
  ],
  okayama: [
    {
      id: 'okayama-momotaro',
      name: '桃太郎頭帶',
      slot: 'head',
      rarity: 2,
      icon: '50 54 150 60',
      svg: hachimaki(
        C.white,
        shape('M120 74 C110 72 104 80 108 88 C112 94 118 94 120 92 C122 94 128 94 132 88 C136 80 130 72 120 74Z', C.pink) +
          `<path d="M120 76 C118 82 118 88 120 92" ${line(1.2, C.red, 0.6)}/>` +
          shape('M120 76 C124 70 130 70 132 72 C128 76 124 76 120 76Z', C.green) +
          `<text x="96" y="90" font-size="7" font-weight="900" fill="${C.red}" text-anchor="middle" font-family="var(--font-ja)">日本</text>` +
          `<text x="146" y="90" font-size="7" font-weight="900" fill="${C.red}" text-anchor="middle" font-family="var(--font-ja)">一</text>`,
      ),
    },
    {
      id: 'okayama-hakuto',
      name: '岡山白桃',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: fruit(C.cream, { crease: true }) + `<ellipse cx="174" cy="214" rx="10" ry="12" fill="${C.pink}" opacity=".55"/>`,
    },
    {
      id: 'okayama-kibidango',
      name: '吉備糰子',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: skewer((x, y) => `<circle cx="${x}" cy="${y}" r="9" fill="${C.cream}" ${E}/><path d="M${x - 5} ${y - 4} C${x - 3} ${y - 6} ${x} ${y - 7} ${x + 2} ${y - 7}" ${line(1.6, C.white, 0.7)}/>`, [0.42, 0.64, 0.86]),
    },
  ],
  hiroshima: [
    L('hiroshima-momiji'),
    {
      id: 'hiroshima-shamoji',
      name: '宮島飯杓',
      slot: 'hand',
      rarity: 2,
      icon: '124 120 96 124',
      svg:
        `<path d="M154 236 L176 168" ${line(7, C.cream)}/>` +
        shape('M172 172 C162 160 164 136 180 128 C196 122 210 134 206 152 C204 164 194 174 182 176Z', C.cream) +
        `<path d="M190 126 C204 130 210 142 206 154 C204 164 196 172 186 176 C198 164 200 142 190 126Z" ${SH}/>` +
        `<text x="186" y="160" font-size="11" font-weight="900" fill="${C.brown}" text-anchor="middle" font-family="var(--font-ja)">宮島</text>`,
    },
    {
      id: 'hiroshima-okonomi',
      name: '廣島燒',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        `<path d="M154 232 L170 214" ${line(4, C.brown)}/>` +
        shape('M158 216 L198 200 L206 212 L168 228Z', C.grey) +
        shape('M168 204 C170 192 196 184 204 196 C206 204 190 212 174 214 C168 214 166 210 168 204Z', C.yellow) +
        shape('M170 200 C172 190 194 184 200 192 C198 200 184 206 172 206Z', C.brown) +
        `<path d="M176 196 C182 192 188 194 194 190" ${line(1.4, C.white, 0.7)}/>` +
        dots(C.green, 1.2, [[180, 198], [190, 194], [186, 200]]),
    },
  ],
  yamaguchi: [
    {
      id: 'yamaguchi-fukuchochin',
      name: '下關河豚燈籠',
      slot: 'hand',
      rarity: 2,
      icon: '124 140 96 104',
      svg:
        `<path d="M156 226 L168 160" ${line(3, C.brown)}/>` +
        shape('M168 164 C188 164 204 178 204 194 C204 210 188 220 168 220 C148 220 134 210 134 194 C134 178 148 164 168 164Z', C.yellow) +
        shape('M204 186 L214 178 L212 194 L214 208 L204 200Z', C.yellow) +
        `<path d="M148 172 L144 166 M160 166 L158 160 M176 166 L178 160 M190 172 L194 166" ${line(2, C.yellow)}/>` +
        shape('M140 204 C150 216 186 216 198 204 C190 220 150 222 140 204Z', C.white) +
        `<circle cx="150" cy="186" r="6" fill="${C.white}" ${E}/>` +
        eye(150, 186, 2.6) +
        `<path d="M136 198 Q140 200 142 196" ${line(1.6)}/>` +
        `<path d="M170 172 C178 172 186 176 190 182" ${line(2, C.white, 0.6)}/>`,
    },
    {
      id: 'yamaguchi-kawara',
      name: '瓦蕎麥',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        shape('M128 226 C128 214 204 214 204 226 L204 232 C204 238 128 238 128 232Z', C.grey) +
        `<path d="M130 230 C150 236 182 236 202 230" ${line(1.4, C.ink, 0.3)}/>` +
        `<path d="M138 222 C146 216 152 226 160 220 C168 226 174 216 182 222 C188 226 192 220 196 222" ${line(3, C.matcha)}/>` +
        `<path d="M140 218 C148 212 154 222 162 216 C170 222 176 212 184 218" ${line(3, C.green)}/>` +
        shape('M150 212 L166 210 L164 216 L150 217Z', C.brown) +
        shape('M170 210 L184 208 L184 214 L170 215Z', C.yellow) +
        `<circle cx="160" cy="206" r="4" fill="${C.yellow}" ${E}/>` +
        dots(C.red, 1.4, [[176, 205]]),
    },
    {
      id: 'yamaguchi-fugu',
      name: '河豚',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M58 244 C78 244 92 258 92 272 C92 286 78 294 58 294 C38 294 24 286 24 272 C24 258 38 244 58 244Z', C.yellow) +
        shape('M90 266 L100 258 L100 286 L90 278Z', C.yellow) +
        `<path d="M32 254 L28 248 M44 246 L42 240 M58 244 L58 238 M72 246 L74 240 M84 254 L88 248" ${line(2, C.yellow)}/>` +
        shape('M30 280 C40 292 76 292 88 280 C80 296 38 298 30 280Z', C.white) +
        dots(C.brown, 1.6, [[46, 262], [66, 258], [76, 268], [52, 274]]) +
        `<circle cx="38" cy="266" r="5" fill="${C.white}" ${E}/>` +
        eye(37, 266, 2.2) +
        shape('M26 276 C24 274 24 280 28 280Z', C.orange),
    },
  ],
  tokushima: [
    {
      id: 'tokushima-amigasa',
      name: '阿波舞編笠',
      slot: 'head',
      rarity: 2,
      icon: '34 0 172 100',
      svg:
        shape('M48 86 C46 40 80 6 120 6 C160 6 194 40 192 86 C178 70 156 62 120 62 C84 62 62 70 48 86Z', C.yellow) +
        `<path d="M120 6 C160 6 194 40 192 86 C182 76 166 68 150 64 C164 50 160 24 120 6Z" ${SH}/>` +
        `<path d="M60 70 C80 40 160 40 180 70 M72 50 C92 28 148 28 168 50 M90 30 C104 18 136 18 150 30" ${line(1.2, C.brown, 0.5)}/>` +
        `<path d="M48 86 C62 70 84 62 120 62 C156 62 178 70 192 86" ${line(3, C.red)}/>` +
        `<path d="M64 84 C70 100 80 112 92 118 M176 84 C170 100 160 112 148 118" ${line(1.6, C.red)}/>`,
    },
    {
      id: 'tokushima-sudachi',
      name: '酢橘',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        `<circle cx="154" cy="220" r="14" fill="${C.green}" ${E}/>` +
        `<path d="M146 212 C148 209 151 208 154 208" ${line(2.6, C.white, 0.5)}/>` +
        `<circle cx="182" cy="214" r="14" fill="${C.matcha}" ${E}/>` +
        `<circle cx="182" cy="214" r="11" fill="${C.yellow}" opacity=".9"/>` +
        `<path d="M182 203 L182 225 M171 214 L193 214 M174 206 L190 222 M190 206 L174 222" ${line(1.2, C.white, 0.8)}/>` +
        shape('M154 206 C158 198 166 198 168 202 C162 206 158 206 154 206Z', C.green),
    },
    {
      id: 'tokushima-awa',
      name: '阿波舞浴衣',
      slot: 'body',
      rarity: 2,
      icon: ICON.body,
      svg: robe({ base: C.navy, pattern: 'doll-stripes', obi: C.red, obiLine: C.gold, collar: C.white, extra: `<path d="M84 262 C100 270 140 270 156 262 L158 274 L82 274Z" fill="${C.pink}" ${E}/>` }),
    },
  ],
  kagawa: [
    L('kagawa-udon'),
    {
      id: 'kagawa-olive',
      name: '小豆島橄欖冠',
      slot: 'head',
      rarity: 2,
      icon: '44 40 152 70',
      svg:
        `<path d="M64 88 C80 72 160 72 176 88" ${line(2.4, C.brown)}/>` +
        [70, 84, 98, 112, 128, 142, 156, 170]
          .map((x, i) => {
            const y = 88 - Math.sin(((x - 64) / 112) * Math.PI) * 14
            const r = i % 2 ? 30 : -30
            return `<ellipse cx="${x}" cy="${y - 4}" rx="3.4" ry="8" fill="${C.matcha}" ${E} transform="rotate(${r} ${x} ${y})"/>`
          })
          .join('') +
        dots(C.green, 3.4, [[92, 80], [148, 80]], E) +
        dots(C.purple, 3.4, [[120, 74]], E),
    },
    {
      id: 'kagawa-konpira',
      name: '金比羅狗',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        shape('M34 292 C32 276 40 266 56 266 C72 266 82 276 80 292Z', C.white) +
        shape('M58 232 C72 232 80 242 80 254 C80 266 70 272 58 272 C46 272 36 266 36 254 C36 242 44 232 58 232Z', C.white) +
        shape('M38 242 C30 244 28 256 34 262 L40 250Z M78 242 C86 244 88 256 82 262 L76 250Z', C.brown) +
        eye(50, 252, 2) +
        eye(66, 252, 2) +
        `<ellipse cx="58" cy="258" rx="2.6" ry="2" fill="${C.ink}"/>` +
        `<path d="M40 270 C50 276 66 276 76 270" ${line(3, C.red)}/>` +
        shape('M50 274 L66 274 L68 288 L48 288Z', C.yellow) +
        `<text x="58" y="285" font-size="8" font-weight="900" fill="${C.ink}" text-anchor="middle" font-family="var(--font-ja)">金</text>`,
    },
  ],
  ehime: [
    {
      id: 'ehime-mikan',
      name: '愛媛蜜柑',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: fruit(C.orange, { dots: C.yellow }),
    },
    {
      id: 'ehime-towel',
      name: '今治毛巾',
      slot: 'head',
      rarity: 2,
      icon: '56 22 128 72',
      svg:
        shape('M78 54 C78 40 98 34 120 34 C142 34 162 40 162 54 L160 64 L80 64Z', C.white) +
        `<path d="M84 40 L84 62 M156 40 L156 62 M80 46 L160 46" ${line(1.4, C.blue, 0.5)}/>` +
        `<path d="M90 52 L150 52 M92 58 L148 58" ${line(1, C.grey, 0.5)}/>` +
        `<path d="M144 36 C154 38 162 46 162 54 L160 64 L148 64Z" ${SH}/>`,
    },
    {
      id: 'ehime-botchan',
      name: '少爺糰子',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg: skewer((x, y, i) => `<circle cx="${x}" cy="${y}" r="9" fill="${[C.matcha, C.yellow, C.brown][i]}" ${E}/>`, [0.42, 0.64, 0.86]),
    },
  ],
  kochi: [
    {
      id: 'kochi-naruko',
      name: '夜來祭鳴子',
      slot: 'hand',
      rarity: 2,
      icon: '124 150 96 96',
      svg:
        `<path d="M156 234 L168 196" ${line(5, C.brown)}/>` +
        `<g transform="rotate(-18 176 180)">` +
        shape('M158 166 L196 166 L196 196 L158 196Z', C.yellow) +
        shape('M160 170 L194 170 L194 182 L160 182Z', C.red) +
        shape('M160 184 L194 184 L194 192 L160 192Z', C.ink) +
        `<path d="M168 168 L168 194 M186 168 L186 194" ${line(1.4, C.brown, 0.6)}/>` +
        shape('M164 160 L172 160 L172 168 L164 168Z M182 160 L190 160 L190 168 L182 168Z', C.ink) +
        `</g>`,
    },
    {
      id: 'kochi-katsuo',
      name: '土佐鰹魚',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        `<g transform="rotate(-12 58 272)">` +
        shape('M18 272 C26 256 60 252 82 262 C88 264 90 270 88 276 C64 290 30 288 18 272Z', C.navy) +
        shape('M86 268 L100 254 L96 268 L100 284Z', C.navy) +
        shape('M24 276 C40 286 66 286 86 274 C70 290 34 292 24 276Z', C.white) +
        `<path d="M40 276 L46 266 M52 278 L58 266 M64 278 L70 266" ${line(1.6, C.blue, 0.8)}/>` +
        shape('M54 256 L60 248 L66 258Z', C.navy) +
        eye(28, 268, 1.8) +
        `</g>`,
    },
    {
      id: 'kochi-yosakoi',
      name: '夜來祭法被',
      slot: 'body',
      rarity: 2,
      icon: ICON.body,
      svg: happi({ base: C.red, collar: C.yellow, pattern: 'doll-sakura', text: '高知', textColor: C.red, band: C.yellow, bottom: SHORTS, bottomColor: C.ink }),
    },
  ],
  fukuoka: [
    L('fukuoka-mentaiko'),
    {
      id: 'fukuoka-ramen',
      name: '博多豚骨拉麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({ bowl: C.ink, rim: C.red, soup: C.cream, noodle: C.white, top: chashu(152, 207) + `<path d="M170 206 L180 204" ${line(3, C.red)}/>` + negi([[164, 203], [176, 210], [186, 206], [160, 211]]) + nori(182) }),
    },
    {
      id: 'fukuoka-yamakasa',
      name: '博多祇園山笠法被',
      slot: 'body',
      rarity: 3,
      icon: ICON.body,
      svg: happi({ base: C.white, collar: C.navy, pattern: 'doll-kasuri', text: '山笠', textColor: C.white, band: C.navy, bottom: SHORTS, bottomColor: C.white }),
    },
  ],
  saga: [
    {
      id: 'saga-arita',
      name: '有田燒茶杯',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg: cup(
        C.white,
        C.matcha,
        `<path d="M148 212 C152 206 158 206 162 212 C166 218 172 218 176 212 C180 206 186 206 188 212" ${line(2, C.blue)}/>` +
          `<path d="M146 226 L188 226" ${line(2.4, C.blue)}/>` +
          dots(C.blue, 1.6, [[154, 220], [166, 218], [178, 220]]) +
          `<path d="M150 230 L184 230" ${line(1.2, C.red)}/>`,
      ),
    },
    {
      id: 'saga-shishi',
      name: '唐津赤獅子帽',
      slot: 'head',
      rarity: 3,
      icon: '40 -4 160 100',
      svg:
        shape('M66 84 C60 40 88 12 120 12 C152 12 180 40 174 84 C160 74 80 74 66 84Z', C.red) +
        `<path d="M146 18 C168 30 178 56 174 84 C168 80 160 77 150 76 C160 56 158 34 146 18Z" ${SH}/>` +
        `<circle cx="100" cy="42" r="10" fill="${C.gold}" ${E}/><circle cx="140" cy="42" r="10" fill="${C.gold}" ${E}/>` +
        eye(100, 42, 4) +
        eye(140, 42, 4) +
        shape('M90 60 C100 74 140 74 150 60 L144 72 C134 80 106 80 96 72Z', C.ink) +
        `<path d="M98 62 L102 70 M142 62 L138 70" ${line(3, C.white)}/>` +
        `<path d="M70 50 C62 46 58 38 60 30 M170 50 C178 46 182 38 180 30" ${line(4, C.gold)}/>` +
        `<path d="M110 22 C114 16 126 16 130 22" ${line(3, C.gold)}/>`,
    },
    {
      id: 'saga-ika',
      name: '呼子透明烏賊',
      slot: 'buddy',
      rarity: 2,
      icon: '14 206 92 96',
      svg:
        shape('M58 214 C70 214 78 226 78 244 L78 262 L38 262 L38 244 C38 226 46 214 58 214Z', C.white, 'fill-opacity=".75"') +
        shape('M38 222 L28 214 L36 232Z M78 222 L88 214 L80 232Z', C.white, 'fill-opacity=".75"') +
        `<path d="M42 262 C40 276 36 286 32 294 M50 262 C50 278 46 288 44 296 M58 262 L58 296 M66 262 C66 278 70 288 72 296 M74 262 C76 276 80 286 84 294" ${line(3, C.white, 0.85)}/>` +
        `<path d="M44 262 L72 262" ${line(1.4, C.pink, 0.6)}/>` +
        dots(C.pink, 1.4, [[50, 230], [64, 226], [58, 238], [68, 242], [48, 246]]) +
        eye(50, 254, 2.4) +
        eye(66, 254, 2.4),
    },
  ],
  nagasaki: [
    {
      id: 'nagasaki-castella',
      name: '長崎蛋糕',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        shape('M140 196 L192 196 L192 226 L140 226Z', C.yellow) +
        shape('M140 196 L192 196 L192 204 L140 204Z', C.brown) +
        shape('M140 222 L192 222 L192 226 L140 226Z', C.brown) +
        `<path d="M180 196 L192 196 L192 226 L180 226Z" ${SH}/>` +
        dots(C.white, 1, [[150, 214], [160, 210], [170, 216], [178, 212]]),
    },
    {
      id: 'nagasaki-champon',
      name: '長崎強棒麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({
        bowl: C.white,
        rim: C.blue,
        soup: C.cream,
        noodle: C.yellow,
        top:
          shape('M146 206 L154 202 L158 208 L150 211Z', C.pink) +
          `<path d="M160 204 C164 200 170 200 172 204" ${line(3, C.orange)}/>` +
          shape('M176 204 L188 202 L186 210 L176 210Z', C.green) +
          naruto(166, 210) +
          dots(C.matcha, 1.8, [[182, 210], [152, 204]]),
      }),
    },
    {
      id: 'nagasaki-ja',
      name: '長崎龍踊龍頭',
      slot: 'head',
      rarity: 3,
      icon: '28 -4 184 104',
      svg:
        shape('M64 84 C58 44 86 20 120 20 C154 20 182 44 176 84 C164 74 76 74 64 84Z', C.green) +
        `<path d="M148 24 C168 36 180 56 176 84 C170 80 162 77 152 76 C162 58 160 38 148 24Z" ${SH}/>` +
        shape('M80 30 L70 8 L92 24Z M160 30 L170 8 L148 24Z', C.gold) +
        `<circle cx="100" cy="46" r="9" fill="${C.white}" ${E}/><circle cx="140" cy="46" r="9" fill="${C.white}" ${E}/>` +
        eye(100, 46, 4) +
        eye(140, 46, 4) +
        shape('M96 62 C104 72 136 72 144 62 L140 74 C130 80 110 80 100 74Z', C.red) +
        `<path d="M92 64 C76 66 60 60 46 48 M148 64 C164 66 180 60 194 48" ${line(2.6, C.gold)}/>` +
        dots(C.gold, 2, [[110, 32], [120, 28], [130, 32]]) +
        `<path d="M66 70 C56 74 50 82 50 92 M174 70 C184 74 190 82 190 92" ${line(3, C.white)}/>`,
    },
  ],
  kumamoto: [
    {
      id: 'kumamoto-castle',
      name: '熊本城帽',
      slot: 'head',
      rarity: 3,
      icon: '40 -6 160 96',
      svg: castle({ wall: C.ink, roof: C.ink, trim: C.white }) + `<path d="M74 52 L166 52" ${line(2, C.white, 0.7)}/>`,
    },
    {
      id: 'kumamoto-ikinari',
      name: '一下子糰子',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        shape('M142 222 C138 206 150 194 166 194 C182 194 194 206 190 222Z', C.cream) +
        `<path d="M178 198 C188 204 192 214 190 222 L176 222 C182 214 182 204 178 198Z" ${SH}/>` +
        shape('M152 210 C152 202 180 202 180 210 C180 218 152 218 152 210Z', C.yellow) +
        shape('M150 214 C156 210 176 210 182 214 L178 218 L154 218Z', C.purple) +
        `<path d="M152 200 C156 197 160 196 164 196" ${line(2.4, C.white, 0.7)}/>`,
    },
    {
      id: 'kumamoto-temari',
      name: '肥後手毬',
      slot: 'buddy',
      rarity: 2,
      icon: ICON.buddy,
      svg:
        `<circle cx="58" cy="268" r="26" fill="${C.red}" ${E}/>` +
        `<path d="M32 268 C40 262 48 274 58 268 C68 262 76 274 84 268 M58 242 C52 250 64 258 58 268 C52 278 64 286 58 294" ${line(3, C.yellow)}/>` +
        `<path d="M40 250 C50 256 66 256 76 250 M40 286 C50 280 66 280 76 286" ${line(2.4, C.white)}/>` +
        `<path d="M40 252 L76 284 M76 252 L40 284" ${line(1.6, C.green, 0.8)}/>` +
        `<path d="M74 248 C80 254 84 262 84 270 C84 284 72 294 58 294 C70 286 78 262 74 248Z" ${SH}/>`,
    },
  ],
  oita: [
    {
      id: 'oita-oni',
      name: '修正鬼會鬼面',
      slot: 'face',
      rarity: 3,
      icon: '128 30 70 80',
      svg: sideMask(
        shape('M144 50 L140 34 L152 46Z M176 50 L180 34 L168 46Z', C.cream) +
          `<path d="M142 64 L156 70 M178 64 L164 70" ${line(3, C.ink)}/>` +
          `<circle cx="150" cy="74" r="5" fill="${C.gold}" ${E}/><circle cx="170" cy="74" r="5" fill="${C.gold}" ${E}/>` +
          eye(150, 74, 2.2) +
          eye(170, 74, 2.2) +
          shape('M146 90 C152 98 168 98 174 90 L170 100 C164 104 156 104 150 100Z', C.ink) +
          `<path d="M150 90 L150 98 M170 90 L170 98" ${line(2.4, C.white)}/>`,
        C.red,
      ),
    },
    {
      id: 'oita-toriten',
      name: '大分雞天',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        [
          [146, 216],
          [166, 210],
          [184, 218],
        ]
          .map(([x, y]) => shape(`M${x - 11} ${y + 2} C${x - 12} ${y - 8} ${x - 2} ${y - 12} ${x + 6} ${y - 10} C${x + 13} ${y - 6} ${x + 12} ${y + 6} ${x + 4} ${y + 9} C${x - 4} ${y + 11} ${x - 10} ${y + 8} ${x - 11} ${y + 2}Z`, C.yellow) + dots(C.orange, 1, [[x - 4, y - 2], [x + 4, y - 4], [x, y + 3]]))
          .join('') +
        shape('M188 228 C188 222 204 222 204 228 C204 234 188 234 188 228Z', C.white) +
        `<ellipse cx="196" cy="226" rx="6" ry="2" fill="${C.brown}" opacity=".7"/>`,
    },
    {
      id: 'oita-onsen',
      name: '溫泉木桶',
      slot: 'hand',
      rarity: 1,
      icon: '124 156 96 88',
      svg:
        shape('M142 198 L190 198 L186 238 L146 238Z', C.yellow) +
        `<path d="M144 210 L188 210 M146 228 L186 228" ${line(3, C.brown)}/>` +
        `<path d="M156 200 L156 236 M168 200 L168 238 M180 200 L178 236" ${line(1, C.brown, 0.4)}/>` +
        `<ellipse cx="166" cy="198" rx="24" ry="5" fill="${C.blue}" ${E}/>` +
        shape('M150 196 C152 188 172 186 178 192 L176 200 L152 200Z', C.white) +
        `<path d="M156 178 C160 172 154 166 158 160 M168 180 C172 174 166 168 170 162 M180 178 C184 172 178 166 182 160" ${line(1.8, C.white, 0.8)}/>`,
    },
  ],
  miyazaki: [
    {
      id: 'miyazaki-mango',
      name: '宮崎芒果',
      slot: 'hand',
      rarity: 2,
      icon: ICON.hand,
      svg:
        shape('M150 228 C138 214 144 192 162 186 C180 180 196 192 194 210 C192 226 176 240 160 238 C154 236 152 232 150 228Z', C.red) +
        shape('M150 228 C146 216 152 204 162 200 C158 214 160 228 166 236 C158 236 154 234 150 228Z', C.orange) +
        `<path d="M184 190 C194 198 196 212 190 222 C184 232 174 238 166 238 C182 228 188 206 184 190Z" ${SH}/>` +
        `<path d="M158 194 C164 190 172 188 178 190" ${line(2.6, C.white, 0.5)}/>` +
        `<path d="M170 186 L172 178" ${line(2.4, C.green)}/>`,
    },
    {
      id: 'miyazaki-nanban',
      name: '南蠻炸雞',
      slot: 'hand',
      rarity: 1,
      icon: ICON.hand,
      svg:
        plate() +
        [
          [146, 214],
          [166, 210],
          [186, 214],
        ]
          .map(([x, y]) => shape(`M${x - 10} ${y + 6} L${x - 8} ${y - 6} L${x + 8} ${y - 8} L${x + 10} ${y + 6}Z`, C.orange))
          .join('') +
        shape('M140 210 C146 200 186 198 192 208 C184 214 150 216 140 210Z', C.cream) +
        dots(C.green, 1.2, [[150, 206], [164, 204], [178, 206], [186, 208]]) +
        dots(C.yellow, 1.2, [[156, 208], [172, 203]]),
    },
    {
      id: 'miyazaki-hyottoko',
      name: '日向火男面',
      slot: 'face',
      rarity: 3,
      icon: '128 34 70 76',
      svg: sideMask(
        `<circle cx="150" cy="70" r="4" fill="${C.ink}"/>` +
          `<path d="M164 72 Q170 66 176 72" ${line(2.4, C.ink)}/>` +
          `<path d="M146 62 Q150 58 154 62 M166 62 Q170 58 174 62" ${line(1.6, C.ink)}/>` +
          `<circle cx="166" cy="92" r="6" fill="${C.red}" ${E}/><circle cx="166" cy="92" r="2.4" fill="${C.ink}"/>` +
          `<ellipse cx="146" cy="88" rx="5" ry="3" fill="${C.pink}" opacity=".8"/>` +
          `<path d="M156 46 C150 52 150 58 156 60" ${line(2, C.ink)}/>`,
        C.cream,
      ),
    },
  ],
  kagoshima: [
    {
      id: 'kagoshima-shirokuma',
      name: '白熊刨冰',
      slot: 'hand',
      rarity: 2,
      icon: '124 150 92 96',
      svg:
        shape('M140 210 L192 210 L186 238 L146 238Z', C.blue) +
        `<path d="M146 238 L186 238" ${line(3, C.navy)}/>` +
        shape('M138 212 C134 184 150 168 166 168 C182 168 198 184 194 212Z', C.white) +
        `<path d="M182 172 C194 182 198 196 194 212 L182 212 C188 198 188 184 182 172Z" ${SH}/>` +
        dots(C.red, 3, [[152, 190], [180, 190]], E) +
        dots(C.purple, 3.6, [[166, 198]], E) +
        shape('M160 182 L172 182 L170 188 L162 188Z', C.yellow) +
        dots(C.green, 2.4, [[148, 204], [184, 204]]) +
        dots(C.orange, 2.4, [[166, 208]]),
    },
    {
      id: 'kagoshima-daikon',
      name: '櫻島大根',
      slot: 'buddy',
      rarity: 2,
      icon: '12 200 96 100',
      svg:
        shape('M58 238 C82 238 96 256 94 274 C92 290 76 296 58 296 C40 296 24 290 22 274 C20 256 34 238 58 238Z', C.white) +
        `<path d="M74 242 C88 250 96 262 94 276 C92 290 78 296 66 296 C82 286 88 260 74 242Z" ${SH}/>` +
        `<path d="M36 262 L44 264 M74 270 L82 268 M44 282 L52 284" ${line(1.4, C.ink, 0.25)}/>` +
        shape('M58 240 C50 226 40 214 30 208 C44 210 54 220 58 232 C60 216 66 206 76 202 C70 212 66 226 62 240Z', C.green) +
        shape('M58 236 C58 222 54 210 50 202 C58 206 62 220 60 236Z', C.matcha),
    },
    {
      id: 'kagoshima-sakurajima',
      name: '櫻島火山帽',
      slot: 'head',
      rarity: 3,
      icon: '32 -10 176 104',
      svg:
        shape('M38 84 C70 74 92 40 106 26 L134 26 C150 42 170 74 202 84 C160 92 80 92 38 84Z', C.green) +
        shape('M106 26 L134 26 L146 42 C136 44 128 38 120 44 C112 38 104 44 94 42Z', C.brown) +
        `<path d="M134 26 C150 42 170 74 202 84 C180 88 160 90 142 90 C156 70 150 44 134 26Z" ${SH}/>` +
        shape('M112 24 C104 14 110 2 120 4 C122 -6 136 -6 138 2 C148 0 152 12 144 18 C140 24 124 26 112 24Z', C.grey) +
        `<path d="M118 14 C122 10 128 10 132 12" ${line(1.6, C.white, 0.6)}/>`,
    },
  ],
  okinawa: [
    L('okinawa-shisa'),
    {
      id: 'okinawa-soba',
      name: '沖繩麵',
      slot: 'hand',
      rarity: 1,
      icon: ICON.bowl,
      svg: bowl({
        bowl: C.blue,
        rim: C.yellow,
        soup: C.yellow,
        soupOp: 0.5,
        noodle: C.cream,
        top:
          shape('M146 208 C146 200 166 200 166 206 C162 212 150 212 146 208Z', C.brown) +
          shape('M168 204 L184 204 L182 210 L168 210Z', C.pink) +
          `<path d="M172 207 L180 207" ${line(1, C.white, 0.6)}/>` +
          negi([[160, 211], [178, 212], [188, 207]]),
      }),
    },
    {
      id: 'okinawa-kariyushi',
      name: '甘露衫',
      slot: 'body',
      rarity: 2,
      icon: ICON.body,
      svg:
        shape(PANTS, C.cream) +
        shape(TOP, C.blue) +
        `<path d="${TOP}" fill="url(#doll-hibiscus)"/>` +
        `<path d="M140 151 C153 153 161 158 165 167 L170 188 L151 192 L151 240 L138 240Z" ${SH}/>` +
        shape('M106 150 L120 166 L134 150 L130 150 L120 160 L110 150Z', C.white) +
        `<path d="M120 166 L120 240" ${line(1.4, C.ink, 0.3)}/>` +
        dots(C.white, 1.6, [[120, 180], [120, 198], [120, 216]]),
    },
  ],
}

/** 依都道府縣代碼順排好、第一件標成代表單品 */
export const PREF_OUTFITS: Outfit[] = Object.entries(BY_PREF).flatMap(([pref, list]) => list.map((o, i): Outfit => ({ ...o, pref, gift: i === 0 })))
