import { HOKKAIDO_SNOW_OBJECTS, HOKKAIDO_SNOW_TILES, snowObjectName } from '../kits/snowcover'
import type { Kit } from '../types'

/**
 * 地方 kit 的「角色」：生成器與藍圖只寫角色（@grass、@road、@house…），這裡對到那一套 kit 的 tile 名字。
 * P3 加了關東、北海道（缺的角色用近畿的）。
 */
export interface KitRoles {
  grass: string
  /** 郊外的路（土路、珊瑚砂） */
  road: string
  /** 街上的路（石畳、柏油） */
  street: string
  /** 寺社、城裡的碎石、廣場 */
  gravel: string
  /** 參道、步道的石板 */
  path: string
  plaza: string
  moss: string
  water: string
  /** 湖、池（自然的岸）：湖的藍圖用 */
  lake: string
  /** 庭園、公園裡的池（藍圖的 ~）：近畿、沖繩、關東跟 water 一樣；北海道冬天結冰（湖的 tile） */
  pond: string
  sand: string
  field: string
  deck: string
  sign: string
  wall: string
  /** 城的石垣 */
  castleWall: string
  fence: string
  hedge: string
  rock: string
  bench: string
  bridgeH: string
  bridgeV: string
  /** 地圖外面的樹（邊界）：[下層, 上層] */
  borderTree: [string, string]
  /** 填空的樹（物件名 → 權重） */
  trees: Array<[string, number]>
  /** 邊界那一圈的樹 */
  edgeTrees: string[]
  bushes: Array<[string, number]>
  /** 街上、郊外的房子（物件名 → 權重） */
  urbanHouses: Array<[string, number]>
  ruralHouses: Array<[string, number]>
  /** 3 列高的房子（空地不夠時、填空） */
  smallHouses: string[]
  station: string
  stall: string
  string: string
  /** 藍圖只寫了近畿的樹時，換成這一套 kit 的（P3：北海道的杉換成蝦夷松…）；沒寫的照用 */
  treeSub?: Record<string, string>
  /** 藍圖裡的近畿物件、tile 換成這一套 kit 的（P3：北海道冬天屋頂是厚雪的寺社、茶屋、展館）；沒寫的照用 */
  objSub?: Record<string, string>
  /** 路人的外觀（手畫的路人裡挑這幾種；沒寫就是全部 12 種） */
  folks?: readonly string[]
  /** 不是政令指定都市的區、但有鐵路的市（北海道：函館、小樽…）的街上：房子（沒寫就用 urbanHouses） */
  townHouses?: Array<[string, number]>
  /** 郊外的鎮的步道（沒寫就是 path）：北海道的郊外是土的步道，紅磚只在街上 */
  ruralPath?: string
}

const KINKI: KitRoles = {
  grass: 'kinki/grass',
  road: 'kinki/road',
  street: 'kinki/stone',
  gravel: 'kinki/gravel',
  path: 'kinki/sando',
  plaza: 'kinki/plaza',
  moss: 'kinki/moss',
  water: 'kinki/water',
  lake: 'kinki/water',
  pond: 'kinki/water',
  sand: 'kinki/sand',
  field: 'kinki/field',
  deck: 'kinki/deck',
  sign: 'kinki/sign',
  wall: 'kinki/dobe',
  castleWall: 'kinki/ishigaki',
  fence: 'kinki/fence',
  hedge: 'kinki/hedge',
  rock: 'kinki/rock',
  bench: 'kinki/bench',
  bridgeH: 'kinki/bridge-h',
  bridgeV: 'kinki/bridge-v',
  borderTree: ['kinki/sugi/0,1', 'kinki/sugi/0,0'],
  trees: [
    ['kinki/tree', 5],
    ['kinki/pine', 2],
    ['kinki/sakura', 2],
    ['kinki/kaede', 2],
    ['kinki/ichou', 1],
    ['kinki/ume', 1],
    ['kinki/sugi', 2],
    ['kinki/bamboo', 2],
    ['kinki/willow', 1],
  ],
  edgeTrees: ['kinki/sugi', 'kinki/tree', 'kinki/bamboo'],
  bushes: [
    ['kinki/bush', 4],
    ['kinki/ajisai', 2],
    ['kinki/rock', 1],
  ],
  urbanHouses: [
    ['kinki/machiya-a', 4],
    ['kinki/machiya-b', 3],
    ['kinki/machiya-c', 3],
    ['kinki/nagaya-a', 2],
    ['kinki/nagaya-b', 2],
  ],
  ruralHouses: [
    ['kinki/minka-a', 4],
    ['kinki/minka-b', 3],
    ['kinki/nagaya-b', 1],
  ],
  smallHouses: ['kinki/nagaya-a', 'kinki/nagaya-b', 'kinki/kura'],
  station: 'kinki/station',
  stall: 'kinki/stall',
  string: 'kinki/chochin',
}

const OKINAWA: KitRoles = {
  ...KINKI,
  grass: 'okinawa/grass',
  road: 'okinawa/road',
  street: 'okinawa/street',
  gravel: 'okinawa/road',
  path: 'okinawa/stone',
  plaza: 'okinawa/stone',
  moss: 'okinawa/grass',
  water: 'okinawa/shallow',
  lake: 'okinawa/shallow',
  pond: 'okinawa/shallow',
  sand: 'okinawa/sand',
  field: 'okinawa/cane',
  sign: 'okinawa/sign',
  wall: 'okinawa/coralwall',
  castleWall: 'okinawa/gusuku',
  fence: 'okinawa/blockwall',
  hedge: 'okinawa/coralwall',
  rock: 'okinawa/rock',
  bench: 'okinawa/bench',
  bridgeH: 'okinawa/bridge-h',
  bridgeV: 'okinawa/bridge-v',
  borderTree: ['okinawa/fukugi/0,1', 'okinawa/fukugi/0,0'],
  trees: [
    ['okinawa/fukugi', 5],
    ['okinawa/tree', 3],
    ['okinawa/palm', 2],
    ['okinawa/gajumaru', 1],
    ['okinawa/kanhi', 1],
  ],
  edgeTrees: ['okinawa/fukugi', 'okinawa/tree'],
  bushes: [
    ['okinawa/hibiscus', 3],
    ['okinawa/bougain', 2],
    ['okinawa/rock', 1],
  ],
  urbanHouses: [
    ['okinawa/concrete-a', 3],
    ['okinawa/concrete-b', 3],
    ['okinawa/house-a', 2],
    ['okinawa/house-low-a', 2],
  ],
  ruralHouses: [
    ['okinawa/house-a', 4],
    ['okinawa/house-b', 3],
    ['okinawa/house-low-b', 2],
  ],
  smallHouses: ['okinawa/house-low-a', 'okinawa/house-low-b'],
  station: 'okinawa/monorail',
  stall: 'okinawa/stall',
  string: 'kinki/chochin',
}

/**
 * 關東（東京）：柏油路與人行道、花崗岩的鋪石、水泥護岸的河；街上是辦公大樓、住商混合、公寓、便利商店，
 * 郊外是灰瓦或平屋頂的獨棟。寺社、城、石垣、碎石沿用近畿。路人多是上班族、學生（手畫的路人裡挑）。
 */
const KANTO: KitRoles = {
  ...KINKI,
  grass: 'kanto/grass',
  road: 'kanto/road',
  street: 'kanto/street',
  gravel: 'kinki/gravel',
  path: 'kanto/paving',
  plaza: 'kanto/plaza',
  moss: 'kinki/moss',
  water: 'kanto/water',
  lake: 'kanto/water',
  pond: 'kanto/water',
  field: 'kanto/field',
  sign: 'kanto/sign',
  wall: 'kanto/wall',
  fence: 'kanto/fence',
  hedge: 'kanto/hedge',
  bench: 'kanto/bench',
  bridgeH: 'kanto/bridge-h',
  bridgeV: 'kanto/bridge-v',
  borderTree: ['kanto/tree/0,1', 'kanto/tree/0,0'],
  trees: [
    ['kanto/tree', 4],
    ['kanto/keyaki', 3],
    ['kanto/sakura', 2],
    ['kanto/ichou', 2],
    ['kanto/street-tree', 2],
    ['kinki/pine', 1],
  ],
  edgeTrees: ['kanto/tree', 'kanto/street-tree', 'kanto/tree'],
  bushes: [
    ['kanto/bush', 4],
    ['kanto/planter', 1],
  ],
  urbanHouses: [
    ['kanto/office-a', 2],
    ['kanto/office-b', 2],
    ['kanto/mixed-a', 3],
    ['kanto/mixed-b', 2],
    ['kanto/apartment', 2],
    ['kanto/house-b', 1],
  ],
  ruralHouses: [
    ['kanto/house-a', 4],
    ['kanto/house-b', 3],
    ['kanto/apartment', 1],
  ],
  smallHouses: ['kanto/house-low-a', 'kanto/house-low-b', 'kanto/konbini'],
  station: 'kanto/station',
  stall: 'kinki/stall',
  string: 'kinki/chochin',
  treeSub: { 'kinki/tree': 'kanto/tree', 'kinki/bamboo': 'kanto/tree' },
  // 深藍外套（上班的人）、白上衣深藍裙（學生）、黃帽子（小學生）、其他平常的路人
  folks: ['folk-e', 'folk-k', 'folk-c', 'folk-h', 'folk-f', 'folk-b', 'folk-d', 'folk-j'],
}

/**
 * 北海道：草地冬天是雪原、郊外的路冬天是壓實的雪；彩色鐵皮屋頂的平房、牧舍、紅磚倉庫；麥田、馬鈴薯田
 * （有花田的鎮另外有薰衣草、花田，由生成器決定）；白樺、蝦夷松。路人多是農家、觀光客（手畫的路人裡挑）。
 */
const HOKKAIDO: KitRoles = {
  ...KINKI,
  grass: 'hokkaido/grass',
  road: 'hokkaido/road',
  street: 'hokkaido/street',
  gravel: 'hokkaido/gravel',
  path: 'hokkaido/paving',
  plaza: 'hokkaido/plaza',
  moss: 'hokkaido/grass',
  water: 'hokkaido/water',
  lake: 'hokkaido/lake',
  pond: 'hokkaido/lake',
  field: 'hokkaido/wheat',
  sign: 'hokkaido/sign',
  wall: 'hokkaido/wall',
  fence: 'hokkaido/fence',
  hedge: 'hokkaido/hedge',
  rock: 'hokkaido/rock',
  bench: 'hokkaido/bench',
  bridgeH: 'hokkaido/bridge-h',
  bridgeV: 'hokkaido/bridge-v',
  borderTree: ['hokkaido/ezomatsu/0,1', 'hokkaido/ezomatsu/0,0'],
  trees: [
    ['hokkaido/shirakaba', 4],
    ['hokkaido/ezomatsu', 3],
    ['hokkaido/tree', 3],
    ['hokkaido/poplar', 1],
    ['hokkaido/sakura', 1],
    ['hokkaido/kaede', 1],
  ],
  edgeTrees: ['hokkaido/ezomatsu', 'hokkaido/shirakaba', 'hokkaido/ezomatsu', 'hokkaido/tree'],
  bushes: [
    ['hokkaido/bush', 4],
    ['hokkaido/rock', 1],
  ],
  urbanHouses: [
    ['hokkaido/office-a', 2],
    ['hokkaido/office-b', 1],
    ['hokkaido/mixed', 2],
    ['hokkaido/apartment', 2],
    ['hokkaido/house-a', 1],
    ['hokkaido/house-flat', 1],
  ],
  ruralHouses: [
    ['hokkaido/house-a', 3],
    ['hokkaido/house-b', 3],
    ['hokkaido/house-c', 3],
    ['hokkaido/barn', 1],
  ],
  smallHouses: ['hokkaido/house-low-a', 'hokkaido/house-low-b', 'hokkaido/konbini'],
  townHouses: [
    ['hokkaido/house-a', 3],
    ['hokkaido/house-b', 3],
    ['hokkaido/house-c', 3],
    ['hokkaido/mixed', 2],
    ['hokkaido/apartment', 1],
    ['hokkaido/house-flat', 1],
  ],
  ruralPath: 'hokkaido/trail',
  objSub: {
    ...Object.fromEntries(Object.keys(HOKKAIDO_SNOW_OBJECTS).map((n) => [n, snowObjectName(n)])),
    ...HOKKAIDO_SNOW_TILES,
  },
  station: 'hokkaido/station',
  stall: 'kinki/stall',
  string: 'kinki/chochin',
  treeSub: {
    'kinki/sugi': 'hokkaido/ezomatsu',
    'kinki/tree': 'hokkaido/tree',
    'kinki/ume': 'hokkaido/shirakaba',
    'kinki/willow': 'hokkaido/shirakaba',
    'kinki/bamboo': 'hokkaido/ezomatsu',
  },
  // 棕外套的長輩、紅帽子、紅葉色外套（田裡的人）；水桶帽、米色帽子（觀光客）；黃帽子的小孩
  folks: ['folk-a', 'folk-i', 'folk-l', 'folk-g', 'folk-k', 'folk-c', 'folk-e', 'folk-j'],
}

export const ROLES: Record<Kit, KitRoles> = { kinki: KINKI, okinawa: OKINAWA, kanto: KANTO, hokkaido: HOKKAIDO }
export const rolesOf = (kit: Kit): KitRoles => ROLES[kit] ?? KINKI
