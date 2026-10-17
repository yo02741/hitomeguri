import type { Kit } from '../types'

/**
 * 地方 kit 的「角色」：生成器與藍圖只寫角色（@grass、@road、@house…），這裡對到那一套 kit 的 tile 名字。
 * P3 加新的地方 kit：在 ROLES 加一份（缺的角色用近畿的）。
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

export const ROLES: Record<Kit, KitRoles> = { kinki: KINKI, okinawa: OKINAWA }
export const rolesOf = (kit: Kit): KitRoles => ROLES[kit] ?? KINKI
