import { objectInfo } from '../kits/objects'
import type { Kit } from '../types'

import type { LandmarkKind, Size } from './classify'
import { type KitRoles, rolesOf } from './roles'

/**
 * 地標與店的藍圖（ASCII，一個字一格；都面向南，最下面兩列是告示牌＋拍攝點、接路的那一格）。
 * 共用的字：
 *   . 底（這個藍圖的地面）  , 草  = 步道（參道、石板）  : 廣場  ~ 水  # 物件佔的格子（只鋪底）
 *   空白：不屬於藍圖（保留給填空、路）
 *   s 告示牌  p 拍攝點  f 接路的格子  n 可以站人的地方
 *   w 圍牆（土塀、珊瑚石垣）  g 城的石垣  v 竹垣、花ブロック  b 灌木  r 石  h 長椅
 *   t 樹（藍圖指定的種類，1×2）  m 楓  l 石燈籠  k、K 狛犬（左、右）  P 松（沖繩是ガジュマル）  Q 櫻（沖繩是寒緋櫻）
 *   R 欄杆（下面是木板）  D 木板  O 望遠鏡  a 拱廊（石畳＋屋頂）
 * 大寫字（物件的左上角）由各藍圖的 legend 指定；interior 是門進去的室內（Grid 的 doors）。
 * 物件、樹可以依 kit 寫（{ kinki, okinawa, kanto, hokkaido }）；沒寫的 kit 用近畿的，樹再照 roles 的 treeSub 換成那一套的。
 */
export type InteriorKind = 'station' | 'airport' | 'juyosho' | 'castle' | 'inn' | 'shokudo' | 'shinise' | 'teahouse'

export interface CellDef {
  /** 地面：角色（@grass）或 tile 名字；沒寫用藍圖的底 */
  g?: string
  /** 下層 tile（角色或名字） */
  l?: string
  o?: string
  /** 物件（左上角在這一格）：名字、或依 kit 的名字 */
  obj?: string | Partial<Record<Kit, string>>
  /** 這個物件的門進去哪一種室內 */
  interior?: InteriorKind
  /** 拍照時算「地標本體」的物件 */
  main?: boolean
  mark?: 'sign' | 'photo' | 'front' | 'npc'
  /** 樹：從藍圖的 trees 挑 */
  tree?: boolean
  bush?: boolean
}

export interface Blueprint {
  rows: string[]
  /** '.' 的地面（角色或名字） */
  base: string
  legend?: Record<string, CellDef>
  /** 't' 的樹（kit → 物件名） */
  trees?: Partial<Record<Kit, string[]>>
}

const COMMON: Record<string, CellDef> = {
  '.': {},
  '#': {},
  ',': { g: '@grass' },
  '=': { g: '@path' },
  ':': { g: '@plaza' },
  '~': { g: '@pond' },
  s: { g: '@path', l: '@sign', mark: 'sign' },
  p: { g: '@path', l: 'basic/photo', mark: 'photo' },
  f: { g: '@path', mark: 'front' },
  n: { mark: 'npc' },
  w: { l: '@wall' },
  g: { l: '@castleWall' },
  v: { l: '@fence' },
  b: { bush: true },
  r: { l: '@rock' },
  h: { l: '@bench' },
  t: { tree: true },
  l: { obj: 'kinki/toro' },
  k: { l: 'kinki/komainu-l' },
  K: { l: 'kinki/komainu-r' },
  P: { obj: { kinki: 'kinki/pine', okinawa: 'okinawa/gajumaru' } },
  m: { obj: { kinki: 'kinki/kaede', okinawa: 'okinawa/gajumaru', hokkaido: 'hokkaido/kaede' } },
  Q: { obj: { kinki: 'kinki/sakura', okinawa: 'okinawa/kanhi', kanto: 'kanto/sakura', hokkaido: 'hokkaido/sakura' } },
  R: { g: '@deck', l: 'kinki/railing' },
  D: { g: '@deck' },
  O: { g: '@deck', l: 'kinki/telescope' },
  a: { g: '@street', o: 'kinki/arcade' },
}

// ---------- 地標 ----------
const SHRINE: Record<Size, Blueprint> = {
  S: {
    base: '@gravel',
    trees: { kinki: ['kinki/sugi'], okinawa: ['okinawa/fukugi'] },
    legend: { H: { obj: 'kinki/haiden', main: true }, J: { obj: 'kinki/juyosho', interior: 'juyosho' }, T: { obj: 'kinki/torii', main: true } },
    rows: [
      't.H####.t', //
      '#.#####.#',
      '..#####..',
      '..#####..',
      'J##k=K...',
      '###l=l...',
      '####=#...',
      '...T=#.n.',
      '...#=#...',
      '...#=#...',
      '   sp    ',
      '    f    ',
    ],
  },
  M: {
    base: '@gravel',
    trees: { kinki: ['kinki/sugi', 'kinki/tree'], okinawa: ['okinawa/fukugi'] },
    legend: {
      H: { obj: 'kinki/haiden', main: true },
      J: { obj: 'kinki/juyosho', interior: 'juyosho' },
      T: { obj: 'kinki/torii', main: true },
      C: { obj: 'kinki/chozuya' },
      E: { obj: 'kinki/ema' },
    },
    rows: [
      't..H####..t', //
      '#..#####..#',
      't..#####..t',
      '#..#####..#',
      '.C#.k=K.J##',
      '.##l.=.l###',
      '...#.=.####',
      '.E#..=...n.',
      '....T=#....',
      't...#=#...t',
      '#...#=#...#',
      '    sp     ',
      '     f     ',
    ],
  },
  L: {
    base: '@gravel',
    trees: { kinki: ['kinki/sugi', 'kinki/tree', 'kinki/sugi'], okinawa: ['okinawa/fukugi'] },
    legend: {
      H: { obj: 'kinki/haiden-l', main: true },
      J: { obj: 'kinki/juyosho', interior: 'juyosho' },
      T: { obj: 'kinki/torii', main: true },
      C: { obj: 'kinki/chozuya' },
      E: { obj: 'kinki/ema' },
    },
    rows: [
      't..H######..t', //
      '#..#######..#',
      't..#######..t',
      '#..#######..#',
      '...#######...',
      '.C#.k.=.K.J##',
      '.##l..=..l###',
      '...#..=..####',
      '.E#...=....n.',
      '...l..=..l...',
      '...#.T=#.#...',
      't....#=#....t',
      '#....#=#....#',
      '.....T=#.....',
      '.....#=#.....',
      '.....#=#.....',
      '     sp      ',
      '      f      ',
    ],
  },
}

const TEMPLE: Record<Size, Blueprint> = {
  S: {
    base: '@gravel',
    trees: { kinki: ['kinki/ume', 'kinki/tree'], okinawa: ['okinawa/tree'] },
    legend: { H: { obj: 'kinki/hondo', main: true }, J: { obj: 'kinki/juyosho', interior: 'juyosho' }, G: { obj: 'kinki/sanmon', main: true } },
    rows: [
      '.H######.', //
      '.#######.',
      '.#######.',
      't#######t',
      '#########',
      'J##.=.b..',
      '###.=..n.',
      '###.=....',
      '....=....',
      ',,G#=##,,',
      ',,##=##,,',
      'ww##=##ww',
      '  ##=##  ',
      '   sp    ',
      '    f    ',
    ],
  },
  M: {
    base: '@gravel',
    trees: { kinki: ['kinki/tree', 'kinki/ume'], okinawa: ['okinawa/tree'] },
    legend: {
      H: { obj: 'kinki/hondo', main: true },
      J: { obj: 'kinki/juyosho', interior: 'juyosho' },
      G: { obj: 'kinki/sanmon', main: true },
      B: { obj: 'kinki/shoro' },
    },
    rows: [
      't.H######..', //
      '#.#######.t',
      '..#######.#',
      '..#######..',
      '..#######..',
      'J##..=..B##',
      '###..=..###',
      '###..=..###',
      '.....=..n..',
      ',m#G#=##P#,',
      ',####=####,',
      'www##=##www',
      '   ##=##   ',
      '    sp     ',
      '     f     ',
    ],
  },
  L: {
    base: '@gravel',
    trees: { kinki: ['kinki/tree', 'kinki/ume'], okinawa: ['okinawa/tree'] },
    legend: {
      H: { obj: 'kinki/hondo-l', main: true },
      J: { obj: 'kinki/juyosho', interior: 'juyosho' },
      G: { obj: 'kinki/sanmon', main: true },
      B: { obj: 'kinki/shoro' },
    },
    rows: [
      't.H########.t', //
      '#.#########.#',
      '..#########..',
      '..#########..',
      '..#########..',
      '..#########..',
      'J##...=...B##',
      '###...=...###',
      '###...=...###',
      'b.....=..n..b',
      ',m#.G#=##.m#,',
      ',##.##=##.##,',
      'wwww##=##wwww',
      '    ##=##    ',
      '     sp      ',
      '      f      ',
    ],
  },
}

const MUSEUM: Blueprint = {
  base: '@grass',
  trees: { kinki: ['kinki/tree'], okinawa: ['okinawa/tree', 'okinawa/fukugi'] },
  legend: { M: { obj: { kinki: 'kinki/museum', okinawa: 'okinawa/museum' }, main: true } },
  rows: [
    't.M#####.t', //
    '#.######.#',
    '..######..',
    'b.######.b',
    '..::::::..',
    '...::::.n.',
    '   sp     ',
    '    f     ',
  ],
}

/**
 * 城：石垣圍起來、城門，裡面是城跡的空地（碎石、樹、礎石、步道）。不畫天守、御殿、櫓這類資料沒寫的建築
 * （元離宮二条城也一樣，二の丸御殿不畫）。名城的蓋章地點在城裡的（資料的 st，不在車站）才多一間小屋，門進去是那個地點。
 */
const CASTLE: Record<'stamp' | 'plain', Blueprint> = {
  stamp: {
    base: '@gravel',
    trees: { kinki: ['kinki/tree'] },
    legend: { H: { obj: 'kinki/castle-house', interior: 'castle' }, G: { obj: 'kinki/castle-gate', main: true } },
    rows: [
      'gggggggggggg', //
      'g,t,,,,,,,tg',
      'g,#.H####.#g',
      'g,..#####..g',
      'g,r.#####.rg',
      'g,....=....g',
      'g,r,..=..n,g',
      'g,,,G#=##,,g',
      'g,,,##=##,,g',
      'gggg##=##ggg',
      '    ##=##   ',
      '     sp     ',
      '      f     ',
    ],
  },
  plain: {
    base: '@gravel',
    trees: { kinki: ['kinki/tree'] },
    legend: { G: { obj: 'kinki/castle-gate', main: true } },
    rows: [
      'gggggggggggg', //
      'g,t,,P#,,t,g',
      'g,#,,##,,#,g',
      'g,,.r...r.,g',
      'g,,.......,g',
      'g,r...=..n,g',
      'g,,...=...,g',
      'g,,,G#=##,,g',
      'g,,,##=##,,g',
      'gggg##=##ggg',
      '    ##=##   ',
      '     sp     ',
      '      f     ',
    ],
  },
}

/** グスク：彎的石垣、石的拱門、城跡的平地（不畫正殿）；有蓋章地點的放一間房子（門進去是那個地點） */
const GUSUKU: Record<'stamp' | 'plain', Blueprint> = {
  stamp: {
    base: '@grass',
    legend: { H: { obj: 'okinawa/house-door', interior: 'castle' }, G: { obj: 'okinawa/gusuku-gate', main: true } },
    rows: [
      ',gggggggggg,', //
      'gg,,,,,,,,gg',
      'g,t,H###,t,g',
      'g,#,####,#,g',
      'g,,,####,,,g',
      'g,,,####,,,g',
      'g,,,,=,,,n,g',
      'gg,,,=,,,,gg',
      ',gggG=#gggg,',
      '    #=#     ',
      '    #=#     ',
      '    sp      ',
      '     f      ',
    ],
    trees: { okinawa: ['okinawa/fukugi'] },
  },
  plain: {
    base: '@grass',
    legend: { G: { obj: 'okinawa/gusuku-gate', main: true } },
    rows: [
      ',gggggggggg,', //
      'gg,,,,,,,,gg',
      'g,t,,r,,,t,g',
      'g,#,,,,,,#,g',
      'g,,,,,,,,,,g',
      'g,,r,,,,b,,g',
      'g,,,,=,,,n,g',
      'gg,,,=,,,,gg',
      ',gggG=#gggg,',
      '    #=#     ',
      '    #=#     ',
      '    sp      ',
      '     f      ',
    ],
    trees: { okinawa: ['okinawa/fukugi'] },
  },
}

/** 御所、離宮（京都御所、桂離宮…）：土塀、門、院子裡的殿舎。名字有「城」的（元離宮二条城）是城，不用這個 */
const PALACE: Blueprint = {
  base: '@gravel',
  trees: { kinki: ['kinki/tree', 'kinki/sugi'], okinawa: ['okinawa/fukugi'] },
  legend: { H: { obj: 'kinki/hall', main: true }, G: { obj: 'kinki/gate', main: true } },
  rows: [
    'wwwwwwwwwwwww', //
    'w,,,,,,,,,,,w',
    'w,,H######,,w',
    'w,,#######,,w',
    'wt,#######,tw',
    'w#,#######,#w',
    'w,,,,,=,,,n,w',
    'w,,,,,=,,,,,w',
    'wwwwwG=#wwwww',
    '     #=#     ',
    '     #=#     ',
    '     sp      ',
    '      f      ',
  ],
}

const GARDEN: Blueprint = {
  base: '@moss',
  trees: { kinki: ['kinki/ume', 'kinki/willow'], okinawa: ['okinawa/tree'] },
  legend: { L: { obj: 'kinki/toro' } },
  rows: [
    ',P#,,t,,P#,', //
    ',##,,#,,##,',
    ',,~~~~~,,L,',
    ',~~~~~~~,#,',
    ',,~~~~~r,n,',
    ',b,,,=,,,b,',
    ',,,,,=,,,,,',
    '    sp     ',
    '     f     ',
  ],
}

const PARK: Blueprint = {
  base: '@grass',
  trees: { kinki: ['kinki/tree', 'kinki/willow', 'kinki/ume'], okinawa: ['okinawa/tree', 'okinawa/fukugi'] },
  rows: [
    't,,t,Q#,,,t', //
    '#,,#,##,,,#',
    ',=========,',
    'h=~~~~~~~=,',
    ',=~~~~~~~=b',
    ',=========,',
    ',b,,,=,,n,,',
    '    sp     ',
    '     f     ',
  ],
}

const VIEW: Blueprint = {
  base: '@grass',
  trees: { kinki: ['kinki/tree'], okinawa: ['okinawa/fukugi'] },
  rows: [
    't,RRR,t', //
    '#,DOD,#',
    ',,DDD,,',
    ',,,=,n,',
    '  sp   ',
    '   f   ',
  ],
}

const TOWER: Blueprint = {
  base: '@plaza',
  legend: { T: { obj: 'kinki/tower', main: true } },
  rows: [
    ',T##,', //
    ',###,',
    ',###,',
    ',###,',
    ',###,',
    'b###b',
    ',###,',
    '.....',
    ' sp n',
    '  f  ',
  ],
}

const ZOO: Blueprint = {
  base: '@grass',
  trees: { kinki: ['kinki/tree'], okinawa: ['okinawa/tree'] },
  legend: { G: { obj: 'kinki/gate-big', main: true } },
  rows: [
    't,,t,,,t,', //
    '#,,#,,,#,',
    ',,,,=,,,,',
    'vvG#=##vv',
    ',,##=##,n',
    ',,##=##,,',
    '   sp    ',
    '    f    ',
  ],
}

const MARKET: Blueprint = {
  base: '@street',
  legend: { F: { obj: { kinki: 'kinki/shop-front', kanto: 'kanto/shop-front-a', hokkaido: 'hokkaido/shop-front' }, main: true } },
  rows: [
    'F#F#F#F#', //
    '########',
    'aaaaaaaa',
    'aaaaaaaa',
    '...==.n.',
    '  sp    ',
    '   f    ',
  ],
}

const STREET: Blueprint = {
  base: '@street',
  legend: { S: { obj: { kinki: 'kinki/machiya-shop', okinawa: 'okinawa/house-shop', kanto: 'kanto/mixed-a', hokkaido: 'hokkaido/mixed' }, main: true } },
  rows: [
    'S###S###S###', //
    '############',
    '############',
    '############',
    '............',
    '...sp...n...',
    '    f       ',
  ],
}

const MONUMENT: Blueprint = {
  base: '@grass',
  trees: { kinki: ['kinki/tree', 'kinki/sugi'], okinawa: ['okinawa/fukugi'] },
  legend: { M: { obj: 'kinki/monument', main: true } },
  rows: [
    't,M,t', //
    '#,#,#',
    ',,=n,',
    ' sp  ',
    '  f  ',
  ],
}

const GROVE: Blueprint = {
  base: '@moss',
  trees: { kinki: ['kinki/sugi', 'kinki/tree', 'kinki/bamboo'], okinawa: ['okinawa/fukugi', 'okinawa/tree'] },
  rows: [
    't,t,t,t', //
    '#,#,#,#',
    ',t,=,t,',
    't#,=,#t',
    '#,,=,n#',
    '  sp   ',
    '   f   ',
  ],
}

const GATE: Blueprint = {
  base: '@grass',
  legend: { G: { obj: { kinki: 'kinki/gate', okinawa: 'okinawa/gate' }, main: true } },
  rows: [
    ',,G=#,,', //
    'ww#=#ww',
    ',,#=#,,',
    ',,,=,n,',
    '  sp   ',
    '   f   ',
  ],
}

const GENERIC: Partial<Record<Kit, Blueprint>> = {
  kanto: { base: '@grass', trees: { kanto: ['kanto/tree', 'kanto/street-tree'] }, legend: { H: { obj: 'kanto/hall', main: true } }, rows: [',H#####,', ',######,', 't######t', '########', ',,::::n,', '   sp   ', '    f   '] },
  kinki: {
    base: '@grass',
    trees: { kinki: ['kinki/tree'] },
    legend: { H: { obj: 'kinki/hall', main: true } },
    rows: [
      ',H######,', //
      ',#######,',
      't#######t',
      '#########',
      ',,,,=,,n,',
      '   sp    ',
      '    f    ',
    ],
  },
  okinawa: {
    base: '@grass',
    legend: { H: { obj: 'okinawa/house-a', main: true }, Y: { obj: 'okinawa/hinpun' }, c: { l: 'okinawa/coralwall' } },
    rows: [
      'c,H###,c', //
      'c,####,c',
      'c,####,c',
      'c,####,c',
      'c,,,,,nc',
      'cb,Y#,bc',
      'ccc==ccc',
      '  sp    ',
      '   f    ',
    ],
  },
}

const AIRPORT: Blueprint = {
  base: '@plaza',
  trees: { kinki: ['kinki/tree'], okinawa: ['okinawa/tree'] },
  legend: { A: { obj: 'okinawa/airport', interior: 'airport', main: true } },
  rows: [
    'tA########t', //
    '###########',
    ',#########,',
    ',#########,',
    ',:::::::::,',
    ',,,,:::,,n,',
    '    sp     ',
    '     f     ',
  ],
}

const UTAKI: Blueprint = {
  base: '@grass',
  trees: { okinawa: ['okinawa/fukugi', 'okinawa/tree'] },
  legend: { U: { obj: 'okinawa/utaki', main: true } },
  rows: [
    't,U#U#,t', //
    '#,####,#',
    ',P#,,P#,',
    ',##=,##,',
    ',,,=,,n,',
    '  sp    ',
    '   f    ',
  ],
}

const TREE: Blueprint = {
  base: '@grass',
  legend: { G: { obj: 'okinawa/gajumaru', main: true } },
  rows: [
    ',G#,', //
    ',##,',
    'h,=n',
    ' sp ',
    '  f ',
  ],
}

// ---------- P3：關東、北海道 ----------
/** 塔（名字有「塔」的才用）：細長的塔或格子的鐵塔，前面是廣場 */
const towerOf = (obj: Partial<Record<Kit, string>>): Blueprint => ({
  base: '@plaza',
  legend: { T: { obj, main: true } },
  rows: [
    ',T##,', //
    ',###,',
    ',###,',
    ',###,',
    ',###,',
    'b###b',
    ',###,',
    '.....',
    ' sp n',
    '  f  ',
  ],
})
const TOWER_TALL = towerOf({ kinki: 'kanto/tower-tall', kanto: 'kanto/tower-tall', hokkaido: 'hokkaido/tower-tall' })
const TOWER_LATTICE = towerOf({ kinki: 'kanto/tower-lattice', kanto: 'kanto/tower-lattice', hokkaido: 'hokkaido/tower-lattice' })

/** 高樓（名字是「…タワー」「…ビル」「…ヒルズ」這類） */
const BUILDING: Blueprint = {
  base: '@plaza',
  trees: { kanto: ['kanto/street-tree'], hokkaido: ['hokkaido/tree'] },
  legend: { H: { obj: { kinki: 'kanto/highrise', kanto: 'kanto/highrise', hokkaido: 'hokkaido/highrise' }, main: true } },
  rows: [
    '.H###.', //
    '.####.',
    '.####.',
    't####t',
    '######',
    '.####.',
    '::::::',
    ' sp n ',
    '  f   ',
  ],
}

/** 十字路口（名字有「交差点」，關東）：大螢幕的大樓、住商混合、斑馬線、四角的紅綠燈 */
const CROSSING: Blueprint = {
  base: '@path',
  legend: {
    S: { obj: 'kanto/screen', main: true },
    M: { obj: 'kanto/mixed-b', main: true },
    q: { obj: 'kanto/signal' },
    A: { g: 'kanto/street' },
    Z: { g: 'kanto/zebra-h' },
  },
  rows: [
    'S###.M###', //
    '####.####',
    '####.####',
    '####.####',
    'q=======q',
    '#AAZZZAA#',
    'AAAZZZAAA',
    'AAAZZZAAA',
    'q=======q',
    '#=====n=#',
    '   sp    ',
    '    f    ',
  ],
}

/** 教堂（名字有「教会」「聖堂」「修道院」） */
const CHURCH: Blueprint = {
  base: '@grass',
  trees: { kanto: ['kanto/tree'], hokkaido: ['hokkaido/shirakaba', 'hokkaido/ezomatsu'] },
  legend: { C: { obj: { kinki: 'kanto/church', kanto: 'kanto/church', hokkaido: 'hokkaido/church' }, main: true } },
  rows: [
    't.C###.t', //
    '#.####.#',
    '..####..',
    'b.####.b',
    '..####..',
    '...==.n.',
    '   sp   ',
    '    f   ',
  ],
}

/** 時計台（名字有「時計台」） */
const CLOCKTOWER: Blueprint = {
  base: '@path',
  trees: { hokkaido: ['hokkaido/ichou', 'hokkaido/tree'], kanto: ['kanto/tree'] },
  legend: { C: { obj: 'hokkaido/clocktower', main: true } },
  rows: [
    't.C####.t', //
    '#.#####.#',
    ',.#####.,',
    ',.#####.,',
    'b.#####.b',
    ',.#####.,',
    ':::===:n:',
    '   sp    ',
    '    f    ',
  ],
}

/** 紅磚倉庫（名字有「倉庫」）：兩棟並排、前面是紅磚的鋪面與煤氣燈 */
const WAREHOUSE: Blueprint = {
  base: '@path',
  legend: { W: { obj: 'hokkaido/warehouse', main: true }, L: { obj: 'hokkaido/lamp' } },
  rows: [
    'W####W####', //
    '##########',
    '##########',
    '====L=====',
    '====#===n=',
    '   sp     ',
    '    f     ',
  ],
}

/** 運河（名字有「運河」）：石砌的護岸、兩邊的步道、煤氣燈（倉庫只在資料有「倉庫」的地標才畫） */
const CANAL: Blueprint = {
  base: '@path',
  trees: { hokkaido: ['hokkaido/tree', 'hokkaido/shirakaba'], kanto: ['kanto/tree'] },
  // 運河是流動的水（北海道的冬天也不畫成結冰的湖）
  legend: { L: { obj: { kinki: 'hokkaido/lamp', kanto: 'kanto/lamp', hokkaido: 'hokkaido/lamp' } }, '~': { g: '@water' } },
  rows: [
    ',t,,t,,,t,,,', //
    ',#,,#,,,#,,,',
    '============',
    '~~~~~~~~~~~~',
    '~~~~~~~~~~~~',
    '~~~~~~~~~~~~',
    'L===L===L===',
    '#===#===#=n=',
    '   sp       ',
    '    f       ',
  ],
}

/** 湖、沼（名字是「…湖」「…沼」；北海道的「…池」）：自然的岸、伸進湖裡的木棧道 */
const LAKE: Blueprint = {
  base: '@grass',
  trees: { hokkaido: ['hokkaido/shirakaba', 'hokkaido/ezomatsu', 'hokkaido/shirakaba'], kanto: ['kanto/tree', 'kanto/keyaki'] },
  legend: { y: { g: '@lake' } },
  rows: [
    ',t,,t,,t,,', //
    ',#,,#,,#,,',
    ',,yyyyyy,,',
    ',yyyyyyyy,',
    ',yyyDyyyy,',
    ',,yyDyyy,,',
    ',,,,=,,n,,',
    '    sp    ',
    '     f    ',
  ],
}

/** 山、岳（類型沒寫、名字是「…山」「…岳」）：山體、山腳的登山口 */
const MOUNTAIN: Blueprint = {
  base: '@grass',
  trees: { hokkaido: ['hokkaido/ezomatsu', 'hokkaido/shirakaba'], kanto: ['kanto/tree', 'kinki/sugi'] },
  legend: { M: { obj: { kinki: 'kanto/peak', kanto: 'kanto/peak', hokkaido: 'hokkaido/peak' }, main: true } },
  rows: [
    't.M#####.t', //
    '#.######.#',
    '..######..',
    'r.######.r',
    ',,,,==,,n,',
    '    sp    ',
    '     f    ',
  ],
}

/** 瀑布（名字有「滝」）：崖、瀑布、下面的潭 */
const FALLS: Blueprint = {
  base: '@grass',
  trees: { hokkaido: ['hokkaido/ezomatsu', 'hokkaido/tree'], kanto: ['kanto/tree', 'kinki/sugi'] },
  legend: { F: { obj: { kinki: 'kanto/falls', kanto: 'kanto/falls', hokkaido: 'hokkaido/falls' }, main: true }, y: { g: '@lake' } },
  rows: [
    't,F##,t', //
    '#,###,#',
    'r,###,r',
    ',,###,,',
    ',yyyyy,',
    ',,,=,n,',
    '  sp   ',
    '   f   ',
  ],
}

/** 溫泉（名字有「温泉」）：露天的湯、周圍的樹 */
const ONSEN: Blueprint = {
  base: '@gravel',
  trees: { hokkaido: ['hokkaido/ezomatsu', 'hokkaido/shirakaba'], kanto: ['kanto/tree'] },
  legend: { E: { obj: { kinki: 'kanto/onsen', kanto: 'kanto/onsen', hokkaido: 'hokkaido/onsen' }, main: true } },
  rows: [
    't,E###,t', //
    '#,####,#',
    ',,####,,',
    'b,,==,,b',
    ',,,==,n,',
    '   sp   ',
    '    f   ',
  ],
}

/** 燈塔（名字有「灯台」） */
const LIGHTHOUSE: Blueprint = {
  base: '@grass',
  legend: { H: { obj: { kinki: 'kanto/lighthouse', kanto: 'kanto/lighthouse', hokkaido: 'hokkaido/lighthouse' }, main: true } },
  rows: [
    ',,H#,,', //
    ',,##,,',
    'r,##,r',
    ',,##,,',
    ',,==n,',
    ' sp   ',
    '  f   ',
  ],
}

/** 花田（北海道，名字有ラベンダー、ファーム、ガーデン、花畑…）：一畦一種顏色，薰衣草只有夏天是紫的 */
const FLOWERFIELD: Blueprint = {
  base: '@grass',
  trees: { hokkaido: ['hokkaido/shirakaba', 'hokkaido/poplar'] },
  legend: { x: { g: 'hokkaido/lavender' }, '1': { g: 'hokkaido/flowers-a' }, '2': { g: 'hokkaido/flowers-b' }, '3': { g: 'hokkaido/flowers-c' }, '4': { g: 'hokkaido/flowers-d' } },
  rows: [
    't,xxxxxxxx,t', //
    '#,11111111,#',
    ',,xxxxxxxx,,',
    ',,22222222,,',
    ',,xxxxxxxx,,',
    ',,44444444,,',
    ',,33333333,,',
    ',,,,,==,,n,,',
    '    sp      ',
    '     f      ',
  ],
}

/** 一般的大建築（關東、北海道：類型不明確的地標）：現代的會館 */
const HALL: Blueprint = {
  base: '@grass',
  trees: { kanto: ['kanto/tree', 'kanto/street-tree'], hokkaido: ['hokkaido/tree', 'hokkaido/shirakaba'] },
  legend: { H: { obj: { kinki: 'kanto/hall', kanto: 'kanto/hall', hokkaido: 'hokkaido/hall' }, main: true } },
  rows: [
    ',H#####,', //
    ',######,',
    't######t',
    '########',
    ',,::::n,',
    '   sp   ',
    '    f   ',
  ],
}

/**
 * 地標的藍圖：kind × 大小；castle 看有沒有蓋章地點（小屋）。
 * o.p3（P3 的縣：奈良、大阪、兵庫…）：近畿的塔不是京都塔的樣子（細長的塔）；分不出來的（generic）不畫一棟和風大殿，
 * 是小小的石碑＋樹（跟北海道一樣）。京都、沖繩照舊。
 */
export function landmarkBlueprint(kind: LandmarkKind, size: Size, kit: Kit, o: { stamp?: boolean; variant?: number; p3?: boolean } = {}): Blueprint {
  switch (kind) {
    case 'shrine':
      return SHRINE[size]
    case 'temple': {
      // 寺的另一種樣子（檜皮葺風的本堂、一層的山門）：variant 的第 1 位換本堂、第 2 位換山門；
      // 同一鎮的寺依序換（generateTown），不代表哪一座
      const bp = TEMPLE[size]
      const v = o.variant ?? 0
      if (!v) return bp
      const legend = { ...bp.legend }
      if (v & 1) legend.H = { ...legend.H!, obj: legend.H!.obj === 'kinki/hondo-l' ? 'kinki/hondo-l-b' : 'kinki/hondo-b' }
      if (v & 2) legend.G = { ...legend.G!, obj: 'kinki/sanmon-b' }
      return { ...bp, legend }
    }
    case 'museum':
      // 關東：美術館、博物館很多，一半畫成現代的會館（同一鎮不要都長一樣）
      return kit === 'kanto' && o.variant ? HALL : MUSEUM
    case 'castle':
      return (kit === 'okinawa' ? GUSUKU : CASTLE)[o.stamp ? 'stamp' : 'plain']
    case 'palace':
      // 名城的蓋章地點只在城（classify 把名字有「城」的離宮當城）；萬一御所有，也用城的藍圖，不在殿舎旁邊加房子
      return o.stamp ? CASTLE.stamp : PALACE
    case 'garden':
      return GARDEN
    case 'park':
      return PARK
    case 'view':
      return VIEW
    case 'tower':
      return kit === 'kanto' || kit === 'hokkaido' || o.p3 ? TOWER_TALL : TOWER
    case 'zoo':
      return ZOO
    case 'market':
      return MARKET
    case 'street':
      return STREET
    case 'airport':
      return AIRPORT
    case 'utaki':
      return UTAKI
    case 'monument':
      return MONUMENT
    case 'grove':
      return GROVE
    case 'gate':
      return GATE
    case 'tree':
      return kit === 'okinawa' ? TREE : MONUMENT
    case 'lattice':
      return TOWER_LATTICE
    case 'building':
      return BUILDING
    case 'crossing':
      return CROSSING
    case 'church':
      return CHURCH
    case 'clocktower':
      return CLOCKTOWER
    case 'warehouse':
      return kit === 'hokkaido' ? WAREHOUSE : HALL
    case 'canal':
      return CANAL
    case 'lake':
      return LAKE
    case 'mountain':
      return MOUNTAIN
    case 'falls':
      return FALLS
    case 'onsen':
      return ONSEN
    case 'lighthouse':
      return LIGHTHOUSE
    case 'flowerfield':
      return FLOWERFIELD
    default:
      // 北海道：類型不明確的多是自然的地方（湿原、峡、ロープウェイ…），不畫一棟建築：石碑＋樹
      return kit === 'hokkaido' || (o.p3 && kit === 'kinki') ? MONUMENT : (GENERIC[kit] ?? GENERIC.kinki!)
  }
}

// ---------- 車站、店 ----------
export const POI: Record<string, Partial<Record<Kit, Blueprint>>> = {
  station: {
    kinki: {
      base: '@plaza',
      trees: { kinki: ['kinki/tree'] },
      legend: { S: { obj: 'kinki/station', interior: 'station', main: true } },
      rows: [
        't,S#######,t', //
        '#,########,#',
        'b,########,b',
        ',,########,,',
        '::s:::::n:::',
        '::::::::::::',
        '     f      ',
      ],
    },
    okinawa: {
      base: '@plaza',
      legend: { S: { obj: 'okinawa/monorail', interior: 'station', main: true } },
      rows: [
        ',S####,', //
        ',#####,',
        ',#####,',
        'b#####b',
        ':s:::n:',
        '   f   ',
      ],
    },
    kanto: {
      base: '@plaza',
      trees: { kanto: ['kanto/street-tree'] },
      legend: { S: { obj: 'kanto/station', interior: 'station', main: true } },
      rows: [
        't,S#######,t', //
        '#,########,#',
        'b,########,b',
        ',,########,,',
        '::s:::::n:::',
        '::::::::::::',
        '     f      ',
      ],
    },
    hokkaido: {
      base: '@plaza',
      trees: { hokkaido: ['hokkaido/shirakaba', 'hokkaido/ezomatsu'] },
      legend: { S: { obj: 'hokkaido/station', interior: 'station', main: true } },
      rows: [
        't,S#######,t', //
        '#,########,#',
        'b,########,b',
        ',,########,,',
        '::s:::::n:::',
        '::::::::::::',
        '     f      ',
      ],
    },
  },
  monorail: {
    okinawa: {
      base: '@plaza',
      legend: { S: { obj: 'okinawa/monorail', interior: 'station', main: true } },
      rows: [
        ',S####,', //
        ',#####,',
        ',#####,',
        'b#####b',
        ':s:::::',
        '   f   ',
      ],
    },
  },
  bus: {
    kinki: {
      base: '@plaza',
      legend: { B: { obj: 'okinawa/busstop', main: true } },
      rows: [
        ',B,,,', //
        ',#,h,',
        ':::::',
        ' f   ',
      ],
    },
  },
  inn: {
    kinki: { base: '@path', legend: { I: { obj: 'kinki/inn', interior: 'inn', main: true } }, rows: ['I#####', '######', '######', '######', 'b.=..b', '  f   '] },
    kanto: { base: '@path', legend: { I: { obj: 'kanto/inn', interior: 'inn', main: true } }, rows: ['I#####', '######', '######', '######', 'b.=..b', '  f   '] },
    hokkaido: { base: '@path', legend: { I: { obj: 'hokkaido/inn', interior: 'inn', main: true } }, rows: ['I#####', '######', '######', '######', 'b.=..b', '  f   '] },
    okinawa: { base: '@path', legend: { I: { obj: 'okinawa/minshuku', interior: 'inn', main: true } }, rows: ['I#####', '######', '######', '######', 'b.=..b', '  f   '] },
  },
  shokudo: {
    kinki: { base: '@path', legend: { I: { obj: 'kinki/shokudo', interior: 'shokudo', main: true } }, rows: ['I####', '#####', '#####', '#####', '..=..', '  f  '] },
    kanto: { base: '@path', legend: { I: { obj: 'kanto/shokudo', interior: 'shokudo', main: true } }, rows: ['I####', '#####', '#####', '#####', '..=..', '  f  '] },
    hokkaido: { base: '@path', legend: { I: { obj: 'hokkaido/shokudo', interior: 'shokudo', main: true } }, rows: ['I####', '#####', '#####', '#####', '..=..', '  f  '] },
    okinawa: { base: '@path', legend: { I: { obj: 'okinawa/shokudo', interior: 'shokudo', main: true } }, rows: ['I####', '#####', '#####', '#####', '..=..', '  f  '] },
  },
  shinise: {
    kinki: { base: '@path', legend: { I: { obj: 'kinki/shinise', interior: 'shinise', main: true } }, rows: ['I####', '#####', '#####', '#####', '.s=..', '  f  '] },
    kanto: { base: '@path', legend: { I: { obj: 'kanto/shinise', interior: 'shinise', main: true } }, rows: ['I####', '#####', '#####', '#####', '.s=..', '  f  '] },
    hokkaido: { base: '@path', legend: { I: { obj: 'hokkaido/shinise', interior: 'shinise', main: true } }, rows: ['I####', '#####', '#####', '#####', '.s=..', '  f  '] },
    okinawa: { base: '@path', legend: { I: { obj: 'okinawa/house-shop', interior: 'shinise', main: true } }, rows: ['I###', '####', '####', '####', 's=..', ' f  '] },
  },
  teahouse: {
    kinki: { base: '@path', legend: { I: { obj: 'kinki/teahouse', interior: 'teahouse', main: true }, U: { obj: 'kinki/umbrella' }, e: { l: 'kinki/bench-red' } }, rows: ['I####U', '#####,', '######', '#####e', '.s=...', '  f   '] },
    okinawa: { base: '@path', legend: { I: { obj: 'okinawa/teahouse', interior: 'teahouse', main: true } }, rows: ['I####', '#####', '#####', '#####', '.s=..', '  f  '] },
  },
}

export function poiBlueprint(kind: string, kit: Kit): Blueprint {
  const b = POI[kind]!
  return b[kit] ?? b.kinki!
}

// ---------- 編譯 ----------
export interface CompiledCell {
  ch: string
  /** 空白（不屬於藍圖） */
  void: boolean
  g: string
  l?: string
  o?: string
  mark?: CellDef['mark']
  tree?: boolean
  bush?: boolean
}

export interface CompiledObject {
  name: string
  x: number
  y: number
  w: number
  h: number
  interior?: InteriorKind
  main: boolean
}

export interface Compiled {
  w: number
  h: number
  cells: CompiledCell[]
  objects: CompiledObject[]
  front: { x: number; y: number }
  /** 拍攝點、告示牌、可以站人的地方 */
  marks: Record<'sign' | 'photo' | 'front' | 'npc', Array<{ x: number; y: number }>>
  trees: string[]
}

const resolve = (v: string, roles: KitRoles) => (v.startsWith('@') ? (roles[v.slice(1) as keyof KitRoles] as string) : v)

/** 藍圖 → 每一格的地面、下層、上層、物件；檢查列長一樣、物件不出界、不重疊 */
export function compile(bp: Blueprint, kit: Kit): Compiled {
  const roles = rolesOf(kit)
  const h = bp.rows.length
  const w = bp.rows[0]!.length
  if (bp.rows.some((r) => r.length !== w)) throw new Error(`world blueprint：每一列要一樣長（${bp.rows[0]}）`)
  const base = resolve(bp.base, roles)
  const legend = { ...COMMON, ...bp.legend }
  const cells: CompiledCell[] = []
  const objects: CompiledObject[] = []
  const marks: Compiled['marks'] = { sign: [], photo: [], front: [], npc: [] }
  const taken = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const ch = bp.rows[y]![x]!
      if (ch === ' ') {
        cells.push({ ch, void: true, g: base })
        continue
      }
      const d = legend[ch]
      if (!d) throw new Error(`world blueprint：「${ch}」沒有定義`)
      const sub = (n: string | undefined) => (n && roles.objSub?.[n]) ?? n
      cells.push({ ch, void: false, g: d.g ? resolve(d.g, roles) : base, l: d.l ? sub(resolve(d.l, roles)) : undefined, o: d.o ? sub(resolve(d.o, roles)) : undefined, mark: d.mark, tree: d.tree, bush: d.bush })
      if (d.mark) marks[d.mark].push({ x, y })
      if (d.obj) {
        const name = sub(typeof d.obj === 'string' ? d.obj : (d.obj[kit] ?? d.obj.kinki!))!
        const info = objectInfo(name)
        if (!info) throw new Error(`world blueprint：沒有物件 ${name}`)
        if (x + info.w > w || y + info.h > h) throw new Error(`world blueprint：${name} 超出藍圖（${x}, ${y}）`)
        for (let cy = 0; cy < info.h; cy++)
          for (let cx = 0; cx < info.w; cx++) {
            if (info.cells[cy]![cx] === '.') continue
            const i = (y + cy) * w + x + cx
            if (taken[i]) throw new Error(`world blueprint：${name} 跟別的物件重疊（${x + cx}, ${y + cy}）`)
            taken[i] = 1
          }
        objects.push({ name, x, y, w: info.w, h: info.h, interior: d.interior, main: !!d.main })
      }
    }
  const front = marks.front[0]
  if (!front) throw new Error('world blueprint：沒有接路的格子（f）')
  const trees = bp.trees?.[kit] ?? bp.trees?.kinki?.map((n) => roles.treeSub?.[n] ?? n) ?? roles.trees.map(([n]) => n)
  return { w, h, cells, objects, front, marks, trees }
}
