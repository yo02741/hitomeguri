import '../tiles/basic'

import { asciiMap, type CellSpec } from '../engine/map'
import type { GameMap, Script } from '../engine/types'
import type { ScriptApi } from '../engine/script'

/**
 * 測試用的小鎮（P0，虛構的地方）：30×24，路、草、草叢、水、花、樹、台階、兩間房子
 * （一間是可以進去的店，另一間門鎖著，P2 再做成你的房間）、告示牌、拍攝點、四個 NPC
 * （站著說一句、左右看＋是／否的對話、在草叢裡亂走、繞池子走），四周用樹封起來。
 * 台詞是虛構的閒聊：不寫真實地名、數字、驚嘆號。
 */
const T = 'basic/tree'
const legend: Record<string, CellSpec> = {
  '.': {},
  T: { big: T, bigAt: [0, 1] },
  '"': { g: 'basic/tallgrass', o: 'basic/tallgrass-top' },
  '#': { g: 'basic/path' },
  '=': { g: 'basic/stone' },
  '~': { g: 'basic/water' },
  '*': { g: 'basic/flowers' },
  v: { g: 'basic/ledge-down' },
  w: { l: 'basic/wall' },
  f: { l: 'basic/fence' },
  S: { l: 'basic/sign', mark: 'sign' },
  P: { l: 'basic/photo', mark: 'photo' },
  M: { big: 'basic/shop' },
  H: { big: 'basic/house' },
  h: {},
  D: { mark: 'shopDoor' },
  L: { b: 'block', mark: 'locked' },
  '@': { g: 'basic/path', mark: 'start' },
  '1': { mark: 'npc1' },
  '2': { mark: 'npc2' },
  '3': { g: 'basic/tallgrass', o: 'basic/tallgrass-top', mark: 'npc3' },
  '4': { g: 'basic/stone', mark: 'npc4' },
}

export const TOWN_ROWS = [
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TT..........................TT',
  'TT..Mhhhh..........Hhhhh....TT',
  'TT..hhhhh....T.....hhhhh..*.TT',
  'TT..hhhhh.*.....T..hhhhh.**.TT',
  'TT..hhDhh..........hhLhh....TT',
  'TT....#..............#......TT',
  'TT.########################.TT',
  'TT........1...#.........2...TT',
  'TT............#.............TT',
  'TT.T..........#..4========..TT',
  'TT............#..=~~~~~~~=..TT',
  'TTvvvvvvvvvv..#..=~~~~~~~=T.TT',
  'TT............#..=~~~~~~~=..TT',
  'TT."""""""....#..=~~~~~~~=T.TT',
  'TT."""3"""....#..=~~~~~~~=..TT',
  'TT."""""""....#..=========..TT',
  'TT."""""""....#*...**P**....TT',
  'TTfffffffff..S#...wwwwwww...TT',
  'TT..........*.@.*...........TT',
  'TT.........T..#.............TT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
]

const STORY = '路人'
function* story(s: ScriptApi): Script {
  const i = yield* s.ask('要不要聽一件小事？', ['要', '不要'], { who: STORY })
  if (i === 0) {
    yield* s.say('池子邊的花，晚上會合起來。', { who: STORY })
    yield* s.say('天亮了再打開。', { who: STORY })
    yield* s.flag('town.story', true)
  } else yield* s.say('那下次吧。', { who: STORY })
}

export function buildTown(): { map: GameMap; marks: Record<string, Array<{ x: number; y: number }>> } {
  const { map, marks } = asciiMap({
    id: 'town',
    name: { ja: 'ひだまりの町', romaji: 'HIDAMARI', zh: '向陽小鎮' },
    outdoor: true,
    rows: TOWN_ROWS,
    legend,
    ground: 'basic/grass',
    border: { ground: 'basic/grass', lower: 'basic/tree/0,1', over: 'basic/tree/0,0' },
    bgm: 'town',
    scripts: { story },
  })
  const at = (k: string) => marks[k]![0]!
  const start = at('start')
  map.start = { x: start.x, y: start.y, dir: 'up' }
  const door = at('shopDoor')
  map.warps.push({ x: door.x, y: door.y, to: 'shop', tx: 4, ty: 7, dir: 'up' })
  map.entities.push(
    { id: 'town-sign', kind: 'sign', ...at('sign'), data: { text: 'ひだまりの町　商店在北邊。' } },
    { id: 'locked-door', kind: 'sign', ...at('locked'), data: { text: '門鎖著。', bump: true } },
    { id: 'pond-photo', kind: 'photoSpot', ...at('photo'), facing: 'up', data: { target: 'pond' } },
    { id: 'oldman', kind: 'npc', ...at('npc1'), facing: 'down', data: { look: 'folk-a', move: 'stand', who: '路人', text: '今天的風很舒服。' } },
    { id: 'storyteller', kind: 'npc', ...at('npc2'), facing: 'down', data: { look: 'folk-b', move: 'look', dirs: ['left', 'down', 'right'], script: 'story' } },
    { id: 'kid', kind: 'npc', ...at('npc3'), facing: 'right', data: { look: 'folk-c', move: 'wander', range: 2, who: '小孩', text: '草長得比我還高。' } },
    { id: 'walker', kind: 'npc', ...at('npc4'), facing: 'right', data: { look: 'folk-d', move: 'route', route: 'R8D6L8U6', who: '路人', text: '繞著池子走一圈，腳步就輕了。' } },
  )
  return { map, marks }
}
