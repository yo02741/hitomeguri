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
  // P3（只有關東、北海道的 kit 會分到）
  | 'lattice'
  | 'building'
  | 'crossing'
  | 'church'
  | 'clocktower'
  | 'warehouse'
  | 'canal'
  | 'lake'
  | 'mountain'
  | 'falls'
  | 'onsen'
  | 'lighthouse'
  | 'flowerfield'
  | 'river'

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
const WEAK = new Set<string | undefined>([undefined, '', '展望', '名勝', '史跡', '遺跡'])

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

/**
 * 已經上線的縣（P2）：京都、沖繩的分類不能變（GEN_VERSION 不改）。P3 的縣（奈良、大阪、兵庫、東京、北海道…）
 * 用改過的規則：名字的消歧義括號拿掉再比、寺社的名字規則收緊、近畿也認山、河、教堂、高樓…（見下面）。
 */
const P2_PREFS = new Set(['kyoto', 'okinawa'])
export const isP3Pref = (pref: string | undefined) => !!pref && !P2_PREFS.has(pref)

/** 分類看的景點欄位（PrefSpot 的一部分）：m 市区町村碼、summary 簡介（北海道的花田要看） */
export interface ClassifySpot {
  n: string
  z?: string
  c?: string
  m?: string
  summary?: { text?: string; text_zh?: string } | null
}

/** 名字後面的消歧義括號（「小泉城 (大和国)」「慈光院 (大和郡山市)」）：拿掉再比名字 */
export const stripDisambig = (n: string) => n.replace(/\s*[（(][^）)]*[）)]\s*$/, '').trim() || n

/**
 * 關東、北海道（P3）：名字寫得很清楚的東西先看名字（類型有時候不對：時計台是博物館、修道院是寺院）。
 * 資料沒寫的不畫：
 *  - 塔：日文名有「塔」、或中文名有「塔」而日文名不是「…タワー」（東京スカイツリー／東京晴空塔），才畫塔（五重塔這類的佛塔不算）；
 *    日文或中文名有「鉄塔／鐵塔／テレビ塔／電視塔」是格子的鐵塔，其他是細長的塔。類型是展望、名字有「タワー」的也是塔。
 *    名字只有「タワー」（中文翻成「塔」的也一樣：新宿パークタワー／新宿公園塔）、「ビル」「ヒルズ」的是高樓。
 *  - 運河只有名字有「運河」；紅磚倉庫只有名字有「倉庫」；時計台照名字；教堂、燈塔、溫泉、瀑布照名字。
 *  - 山、湖、沼只在類型沒寫或不明確時照名字（類型是公園的「…山公園」還是公園）。
 *  - 花田只在北海道：名字有ラベンダー、花畑、彩の丘、花の丘…；名字只有「ファーム」「ガーデン」「フラワー」的，
 *    要在富良野、美瑛一帶（市区町村碼）或簡介寫了花田、花畑、ラベンダー才算（上野ファーム是旭川的庭園）。
 *  - 「…離宮」結尾的建築（迎賓館赤坂離宮）是一般的大建築；名字中間有「離宮」的庭園（浜離宮恩賜庭園）照類型。
 */
const PAGODA = /五重塔|三重塔|多宝塔|多寶塔|仏塔|佛塔|宝塔|寶塔/
const LATTICE = /鉄塔|鐵塔|テレビ塔|電視塔|電波塔/
const FLOWER = /ラベンダー|花畑|花畠|彩の丘|花の丘|花人の/
const FLOWER_WEAK = /フラワー|ファーム|ガーデン/
/** 富良野、美瑛一帶（上富良野、中富良野、南富良野）：名字只有「ファーム」的花田 */
const FLOWER_TOWNS = new Set(['012297', '014591', '014605', '014613', '014621'])
const FLOWER_TEXT = /花田|花畑|ラベンダー|薰衣草|薫衣草/
const P3_STRONG: Array<[RegExp, LandmarkKind]> = [
  [/交差点/, 'crossing'],
  [/時計台/, 'clocktower'],
  [/運河/, 'canal'],
  [/倉庫/, 'warehouse'],
  [/教会|修道院|大聖堂|聖堂|カテドラル|チャペル/, 'church'],
  [/灯台/, 'lighthouse'],
  [/オルゴール/, 'museum'],
  // 名字的字尾會被當成寺社的（「…議事堂」「…公会堂」「…離宮」）：一般的大建築
  [/議事堂|公会堂|会館|迎賓館|離宮$/, 'generic'],
  // 「明治神宮外苑」不是神社：外苑是庭園、球場的一帶
  [/外苑/, 'park'],
  [/霊園|墓地/, 'grove'],
]
const P3_WEAK: Array<[RegExp, LandmarkKind]> = [
  [/温泉/, 'onsen'],
  [/滝$|の滝|瀑布/, 'falls'],
  [/湖$|沼$|五湖$/, 'lake'],
  [/(山|岳|嶽)$/, 'mountain'],
]

/**
 * 名字是「…山」「…岳」的是不是山：名字有片假名的不是（イオンモール大和郡山）；有簡介的，簡介要寫得出是山
 * （標高、海拔、山地、火山、「…にある山」「…的山」…）。富岳（超級電腦）、松山（宇陀的地名）不是山。
 */
const MOUNTAIN_TEXT = /標高|海拔|山峰|山稜|山地|山脈|火山|mountain|volcano|にある山|に位置する山|の山|的山|座山|である山|山。/i
function mountainOk(spot: ClassifySpot): boolean {
  if (/[ァ-ヺ]/.test(spot.n)) return false
  const sum = `${spot.summary?.text ?? ''} ${spot.summary?.text_zh ?? ''}`.trim()
  return !sum || MOUNTAIN_TEXT.test(sum)
}
/** 類型不明確時看名字（溫泉、瀑布、湖、山）；山要過 mountainOk */
function weakKind(spot: ClassifySpot): LandmarkKind | undefined {
  for (const [re, k] of P3_WEAK) if (re.test(spot.n) && (k !== 'mountain' || mountainOk(spot))) return k
  return undefined
}

/** 塔（關東、北海道、P3 的近畿共用）：見上面的說明 */
function towerKind(n: string, z: string, c: string | undefined): LandmarkKind | undefined {
  const pagoda = PAGODA.test(n) || PAGODA.test(z)
  if (pagoda) return undefined
  if (LATTICE.test(n) || LATTICE.test(z)) return 'lattice'
  if (/塔/.test(n)) return 'tower'
  if (/塔/.test(z) && (!/タワー/.test(n) || c === '展望')) return 'tower'
  if (c === '展望' && /タワー/.test(n)) return 'tower'
  return undefined
}

/**
 * 名字沒有「塔」「タワー」的展望台（通天閣）：類型是展望、簡介寫的是展望塔／瞭望塔／觀光塔／電波塔，才畫塔。
 * 只看類型是展望的（展望台、看台的簡介不會寫「塔」）；佛塔不算。
 */
const TOWER_TEXT = /展望塔|瞭望塔|観光塔|觀光塔|電波塔|observation tower/i
function observationTower(spot: ClassifySpot): boolean {
  if (spot.c !== '展望' || PAGODA.test(spot.n)) return false
  return TOWER_TEXT.test(`${spot.summary?.text ?? ''} ${spot.summary?.text_zh ?? ''}`)
}

function flowerField(spot: ClassifySpot): boolean {
  const n = spot.n
  if (FLOWER.test(n)) return true
  if (!FLOWER_WEAK.test(n)) return false
  const sum = `${spot.summary?.text ?? ''} ${spot.summary?.text_zh ?? ''}`
  return (!!spot.m && FLOWER_TOWNS.has(spot.m)) || FLOWER_TEXT.test(sum)
}

function classifyP3(spot: ClassifySpot, kit: 'kanto' | 'hokkaido'): LandmarkKind | undefined {
  const n = spot.n
  if (kit === 'hokkaido' && flowerField(spot)) return 'flowerfield'
  for (const [re, k] of P3_STRONG) if (re.test(n)) return k === 'crossing' && kit !== 'kanto' ? undefined : k
  const tower = towerKind(n, spot.z ?? '', spot.c)
  if (tower) return tower
  if (observationTower(spot)) return 'tower'
  if (WEAK.has(spot.c)) {
    const w = weakKind(spot)
    if (w) return w
    if (kit === 'hokkaido' && /池$/.test(n)) return 'lake'
    // 名字是「…川」的地標本身：河（生成器畫河，告示牌與拍攝點在岸邊）
    if (/川$/.test(n)) return 'river'
    if (/峠$|丘$/.test(n)) return 'view'
    if (kit === 'kanto' && /タワー|ビル$|ビルディング|ヒルズ|ミッドタウン|庁舎/.test(n)) return 'building'
  }
  return undefined
}

/**
 * 近畿 kit 的 P3 的縣（奈良、大阪、兵庫）：京都的規則（P2）沒有山、河、教堂、高樓，分不出來的會變成一樣的和風大殿。
 *  - 教堂、燈塔、墓地照名字；「…公会堂」「…会館」「…議事堂」不是寺院；「外苑」是庭園那一帶。
 *  - 塔：同上（太陽の塔這種名字是「…の塔」、類型不是展望的不畫塔：石碑）；「…タワー」類型不是展望的是高樓。
 *  - 類型不明確時：溫泉、瀑布、湖、山、「…川」（河）、峠、丘、「…ビル」「…ヒルズ」（高樓）。
 *  分不出來的（generic）不畫一棟建築，是小小的石碑＋樹（landmarkBlueprint）。
 */
function classifyKinkiP3(spot: ClassifySpot): LandmarkKind | undefined {
  const n = spot.n
  const z = spot.z ?? ''
  for (const [re, k] of P3_STRONG) if (re.test(n) && k !== 'crossing' && k !== 'clocktower' && k !== 'canal' && k !== 'warehouse') return k
  const tower = towerKind(n, z, spot.c)
  if (tower === 'lattice') return tower
  if (/タワー/.test(n) && spot.c !== '展望') return 'building'
  if (tower) return spot.c === '展望' ? 'tower' : 'monument'
  if (observationTower(spot)) return 'tower'
  if (WEAK.has(spot.c)) {
    const w = weakKind(spot)
    if (w) return w
    if (/川$/.test(n)) return 'river'
    if (/峠$|丘$/.test(n)) return 'view'
    if (/ビル$|ビルディング|ヒルズ/.test(n)) return 'building'
  }
  return undefined
}

/**
 * P3 的名字規則（京都、沖繩的 NAME_RULES 收緊）：
 *  - 神社：「神社、大社、神宮、天満宮、八幡宮、稲荷」；「…宮」結尾的只有「…之宮」「…の宮」（三宮是街、平城宮是宮殿的遺跡）。
 *  - 寺：「寺」「…院」；「…堂」結尾的要名字也有寺、院（公会堂、会館不是）。
 *  - 宮殿、京的遺跡（「…宮跡」「…京跡」）是史跡。
 *  - 庭園：「園」結尾的只有名字沒有片假名的（キッザニア甲子園不是庭園）。
 */
const NAME_RULES_P3: Array<[RegExp, LandmarkKind]> = [
  [/御嶽|うたき/, 'utaki'],
  [/神社|大社|神宮|天満宮|八幡宮|稲荷|[之の]宮$/, 'shrine'],
  [/寺$|院$|寺/, 'temple'],
  [/博物館|美術館|ミュージアム|資料館|記念館/, 'museum'],
  [/城$|城跡|グスク/, 'castle'],
  [/宮跡$|京跡$/, 'monument'],
  [/御所|離宮/, 'palace'],
  // 佛塔是寺院的一部分（不畫塔，也不自己加五重塔）
  [PAGODA, 'temple'],
  [/タワー|塔$/, 'tower'],
  [/橋$|大橋/, 'bridge'],
  [/ビーチ|浜$|海岸/, 'beach'],
  [/岬$/, 'cape'],
  [/島$/, 'island'],
  [/動物園|水族館/, 'zoo'],
  [/市場/, 'market'],
  [/通り$|商店街/, 'street'],
  [/庭園|池$|潭$/, 'garden'],
  [/^[^ァ-ヺー]*園$/, 'garden'],
  [/公園$/, 'park'],
  [/森$|谷$|林$/, 'grove'],
  [/門$/, 'gate'],
  [/ガジュマル/, 'tree'],
]

export function classify(spot: ClassifySpot, kit: Kit, pref?: string): LandmarkKind {
  const p3 = kit === 'kanto' || kit === 'hokkaido' || isP3Pref(pref)
  const n = p3 ? stripDisambig(spot.n) : spot.n
  const s: ClassifySpot = p3 ? { ...spot, n } : spot
  if (kit === 'kanto' || kit === 'hokkaido') {
    const k = classifyP3(s, kit)
    if (k) return k
  } else if (p3 && kit === 'kinki') {
    const k = classifyKinkiP3(s)
    if (k) return k
  }
  let kind: LandmarkKind | undefined
  if (!WEAK.has(spot.c)) {
    kind = BY_TYPE[spot.c!]
    // 類型是城、名字是御所、離宮 → 御所的圍牆與門（不是城）；名字有「城」的（元離宮二条城）還是城：只畫石垣、城門、城跡
    if (kind === 'castle' && /御所|離宮/.test(n) && !/城/.test(n)) kind = 'palace'
  }
  if (!kind) kind = (p3 ? NAME_RULES_P3 : NAME_RULES).find(([re]) => re.test(n))?.[1]
  if (!kind && spot.c) kind = BY_TYPE[spot.c]
  kind ??= 'generic'
  // 地方的差別：御嶽只在沖繩；近畿沒有海（島、海灘、岬畫成看台）
  if (kind === 'utaki' && kit !== 'okinawa') kind = 'grove'
  if (kit === 'kinki' && (kind === 'island' || kind === 'beach' || kind === 'cape')) kind = 'view'
  if (kit === 'kanto' || kit === 'hokkaido') {
    // 關東、北海道的鎮沒有畫海：島、海灘、岬是看台；塔類只有上面的規則（名字有「塔」）才畫，名字只有「タワー」的是高樓
    if (kind === 'island' || kind === 'beach' || kind === 'cape') kind = 'view'
    if (kind === 'tower') kind = 'building'
    // 離宮（迎賓館這類）不畫成御所的土塀與殿舎：資料沒寫樣子，畫一般的大建築
    if (kind === 'palace' && !/御所/.test(n)) kind = 'generic'
  }
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
