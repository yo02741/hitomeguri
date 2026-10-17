import '../tiles/basic'

import { asciiMap, type CellSpec } from '../engine/map'
import type { ScriptApi } from '../engine/script'
import type { GameMap, Script } from '../engine/types'

/**
 * 小鎮的店（室內，10×8，比畫面小：置中、外面鋪黑）：架子、櫃台（隔著櫃台跟店員說話）、桌子、門墊。
 * 站在門墊上往下走就出去。
 */
const legend: Record<string, CellSpec> = {
  '^': { g: 'basic/wall-in-top' },
  '|': { g: 'basic/wall-in' },
  _: {},
  B: { l: 'basic/shelf' },
  o: { l: 'basic/pot' },
  C: { l: 'basic/counter' },
  t: { l: 'basic/table' },
  X: { g: 'basic/void' },
  m: { l: 'basic/mat', mark: 'exit' },
  '2': { mark: 'clerk' },
}

export const SHOP_ROWS = [
  '^^^^^^^^^^', //
  '||||||||||',
  '_BB____BBo',
  '__2_______',
  '_CCCC_____',
  '_______t__',
  '__________',
  'XXXXmXXXXX',
]

const WHO = '店員'
function* clerk(s: ScriptApi): Script {
  yield* s.say('歡迎光臨。', { who: WHO })
  const i = yield* s.ask('要看看架上的東西嗎？', ['看看', '不用了'], { who: WHO })
  yield* s.say(i === 0 ? '還在整理，過幾天再來。' : '慢慢逛。', { who: WHO })
}

export function buildShop(): GameMap {
  const { map, marks } = asciiMap({
    id: 'shop',
    name: { ja: '町の店', romaji: 'MACHI NO MISE', zh: '小鎮的店' },
    outdoor: false,
    rows: SHOP_ROWS,
    legend,
    ground: 'basic/floor',
    border: { ground: 'basic/void' },
    bgm: 'indoor',
    start: { x: 4, y: 6, dir: 'up' },
    scripts: { clerk },
  })
  const exit = marks.exit![0]!
  map.warps.push({ x: exit.x, y: exit.y, to: 'town', tx: 6, ty: 7, dir: 'down', on: 'push', push: 'down' })
  map.entities.push({ id: 'clerk', kind: 'npc', ...marks.clerk![0]!, facing: 'down', data: { look: 'clerk', move: 'stand', script: 'clerk' } })
  return map
}
