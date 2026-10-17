import type { Kit } from '../types'

/**
 * 地標的模板（規格 §8.2 第 2 步）：先看類型 c，類型不明確（沒有、展望、名勝、史跡、遺跡）時看名字。
 * 只畫資料寫得出來的東西：城不畫天守、グスク不畫正殿，御嶽只有岩石與樹林；名字有「塔」「門」「森」才畫塔、門、林。
 */
export type LandmarkKind =
  | 'shrine'
  | 'temple'
  | 'museum'
  | 'castle'
  | 'palace'
  | 'garden'
  | 'park'
  | 'view'
  | 'tower'
  | 'bridge'
  | 'island'
  | 'beach'
  | 'cape'
  | 'zoo'
  | 'market'
  | 'street'
  | 'airport'
  | 'utaki'
  | 'monument'
  | 'grove'
  | 'gate'
  | 'tree'
  | 'generic'

const BY_TYPE: Record<string, LandmarkKind> = {
  寺院: 'temple',
  神社: 'shrine',
  城: 'castle',
  博物館: 'museum',
  美術館: 'museum',
  公園: 'park',
  庭園: 'garden',
  名勝: 'garden',
  展望: 'view',
  橋: 'bridge',
  島: 'island',
  海灘: 'beach',
  岬: 'cape',
  動物園: 'zoo',
  水族館: 'zoo',
  主題樂園: 'zoo',
  市場: 'market',
  購物: 'market',
  街區: 'street',
  機場: 'airport',
  史跡: 'monument',
  遺跡: 'monument',
}

/** 類型不明確（看名字比較準）的 */
const WEAK = new Set([undefined, '', '展望', '名勝', '史跡', '遺跡'])

const NAME_RULES: Array<[RegExp, LandmarkKind]> = [
  [/御嶽|うたき/, 'utaki'],
  [/神社|大社|神宮|天満宮|八幡宮|稲荷|宮$/, 'shrine'],
  [/寺$|院$|寺|堂$/, 'temple'],
  // 城跡的展館（世界遺産座喜味城跡ユンタンザミュージアム）是展館，不是第二座城
  [/博物館|美術館|ミュージアム|資料館|記念館/, 'museum'],
  // 名字有「城」的離宮（元離宮二条城）是城：先看城
  [/城$|城跡|グスク/, 'castle'],
  [/御所|離宮/, 'palace'],
  [/タワー|塔$/, 'tower'],
  [/橋$|大橋/, 'bridge'],
  [/ビーチ|浜$|海岸/, 'beach'],
  [/岬$/, 'cape'],
  [/島$/, 'island'],
  [/動物園|水族館/, 'zoo'],
  [/市場/, 'market'],
  [/通り$|商店街/, 'street'],
  [/庭園|園$|池$|潭$/, 'garden'],
  [/公園$/, 'park'],
  [/森$|谷$|林$/, 'grove'],
  [/門$/, 'gate'],
  [/ガジュマル/, 'tree'],
]

export function classify(spot: { n: string; c?: string }, kit: Kit): LandmarkKind {
  const n = spot.n
  let kind: LandmarkKind | undefined
  if (!WEAK.has(spot.c)) {
    kind = BY_TYPE[spot.c!]
    // 類型是城、名字是御所、離宮 → 御所的圍牆與門（不是城）；名字有「城」的（元離宮二条城）還是城：只畫石垣、城門、城跡
    if (kind === 'castle' && /御所|離宮/.test(n) && !/城/.test(n)) kind = 'palace'
  }
  if (!kind) kind = NAME_RULES.find(([re]) => re.test(n))?.[1]
  if (!kind && spot.c) kind = BY_TYPE[spot.c]
  kind ??= 'generic'
  // 地方的差別：御嶽只在沖繩；近畿沒有海（島、海灘、岬畫成看台）
  if (kind === 'utaki' && kit !== 'okinawa') kind = 'grove'
  if (kit === 'kinki' && (kind === 'island' || kind === 'beach' || kind === 'cape')) kind = 'view'
  return kind
}

export type Size = 'S' | 'M' | 'L'

/** 大小：文化指定是國寶、世界遺產時大一號（規格 §8.2）；其他看分數 */
export function sizeOf(spot: { s: number; d?: string }): Size {
  const big = spot.d === '世界遺產' || spot.d === '國寶' || spot.d === '世界遺産' || spot.d === '国宝'
  const base: Size = spot.s >= 120 ? 'M' : 'S'
  if (!big) return base
  return base === 'S' ? 'M' : 'L'
}
