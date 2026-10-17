import { describe, expect, it } from 'vitest'

import css from '../../styles/theme.css?raw'
import { packRgb, PX, tintRgb, type Tokens } from '../../services/pixelwalk/palette'

import { testMaps, TEST_START } from '../maps'
import { registerDefaultLooks } from '../sprites'
import type { Actor } from './actor'
import { Game, type GameOptions, NEW_GAME_MONEY } from './game'
import { InputState, type Button } from './input'
import { asciiMap } from './map'
import { Npc } from './npc'
import { findPath } from './path'
import { tileDef } from './tiles'
import { memoryStore, parseSave, saveKey, writeSave } from './save'
import { registerCommand, Runner } from './script'
import { B, type Dir, DX, DY, passable, type RgbSprite, type Script } from './types'

declare module './script' {
  interface ScriptCommands {
    testStamp(id: string): Script
  }
}

// 番外篇引擎（規格 §2–§5、§9）：移動、轉身、跑步、台階、撞牆、傳送、NPC、夥伴、A*、腳本、存檔

const tokens = Object.fromEntries(PX.map((k) => [k, css.match(new RegExp(`--color-px-${k}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? ''])) as Tokens
registerDefaultLooks()

function makeGame(o: Partial<GameOptions> = {}) {
  const store = memoryStore()
  const game = new Game({ tokens, maps: testMaps, start: TEST_START, storage: store, seed: 1, now: new Date('2026-04-05T01:00:00Z'), ...o })
  game.newGame()
  // 開場淡入
  run(game, 20)
  return { game, store }
}
const run = (g: Game, n: number) => {
  for (let i = 0; i < n; i++) g.update(1 / 60)
}
/** 按住 b 幾次更新再放開 */
function hold(g: Game, b: Button, n: number, also: Button[] = []) {
  for (const x of [b, ...also]) g.input.press(x, 'test')
  run(g, n)
  for (const x of [b, ...also]) g.input.release(x, 'test')
}
const pos = (a: Actor) => [a.x, a.y]
/** 把玩家放到某一格（不經過傳送） */
function put(g: Game, x: number, y: number, dir: Dir) {
  g.player.place(x, y, dir)
  g.follower?.reset(x, y, dir)
}

describe('移動與操作', () => {
  it('輕點只轉身，按住才走', () => {
    const { game } = makeGame()
    expect(pos(game.player)).toEqual([14, 20])
    expect(game.player.dir).toBe('up')
    hold(game, 'left', 3)
    run(game, 20)
    expect(pos(game.player)).toEqual([14, 20])
    expect(game.player.dir).toBe('left')
    // 已經朝這邊：馬上走
    hold(game, 'up', 1)
    run(game, 20)
    expect(pos(game.player)).toEqual([14, 20])
    expect(game.player.dir).toBe('up')
  })

  it('按住方向：一步 16 次更新、一格 16px，連著走不停頓', () => {
    const { game } = makeGame()
    game.input.press('up', 'test')
    // 朝上了：第一次就開始走
    run(game, 1)
    expect(game.player.moving).toBe(true)
    const ys: number[] = []
    // 第三步走到一半放開：那一步會走完
    for (let i = 0; i < 47; i++) {
      game.update(1 / 60)
      ys.push(game.player.py)
    }
    game.input.release('up', 'test')
    run(game, 20)
    expect(pos(game.player)).toEqual([14, 17])
    // 每次更新剛好 1px，沒有停下來的那一格
    for (let i = 1; i < ys.length; i++) expect(ys[i - 1]! - ys[i]!).toBe(1)
  })

  it('按住 B 跑步：一步 8 次更新', () => {
    const { game } = makeGame()
    game.input.press('B', 'test')
    hold(game, 'up', 1 + 8 * 3 - 1)
    game.input.release('B', 'test')
    run(game, 10)
    expect(pos(game.player)).toEqual([14, 17])
  })

  it('預存輸入：走的中途輕點別的方向，到了就往那邊走一步', () => {
    const { game } = makeGame()
    game.input.press('up', 'test')
    run(game, 6)
    game.input.release('up', 'test')
    game.input.tap('right', 'test')
    run(game, 40)
    expect(pos(game.player)).toEqual([15, 19])
  })

  it('撞牆：原地踏步、咚', () => {
    const { game } = makeGame()
    const sfx: string[] = []
    game.on('sfx', (e) => sfx.push(e.name))
    // 樹（x 11, y 21）
    put(game, 12, 21, 'left')
    hold(game, 'left', 40)
    expect(pos(game.player)).toEqual([12, 21])
    expect(sfx.filter((s) => s === 'bump').length).toBeGreaterThanOrEqual(2)
  })

  it('台階只能往下跳（兩格、有高度），不能往上', () => {
    const { game } = makeGame()
    put(game, 5, 12, 'down')
    game.input.press('down', 'test')
    run(game, 16)
    expect(game.player.move?.kind).toBe('jump')
    expect(game.player.z).toBeGreaterThan(4)
    run(game, 16)
    game.input.release('down', 'test')
    run(game, 4)
    expect(pos(game.player)).toEqual([5, 14])
    hold(game, 'up', 40)
    expect(pos(game.player)).toEqual([5, 14])
  })

  it('進門、在門墊往下走出來', () => {
    const { game } = makeGame()
    const enters: string[] = []
    game.on('mapEnter', (e) => enters.push(e.id))
    put(game, 6, 7, 'up')
    hold(game, 'up', 20)
    run(game, 80)
    expect(game.map?.id).toBe('shop')
    expect(pos(game.player)).toEqual([4, 7])
    expect(game.player.dir).toBe('up')
    // 夥伴也跟著進來（門墊下面是牆外：在同一格）
    expect(pos(game.follower!.actor)).toEqual([4, 7])
    hold(game, 'down', 20)
    run(game, 80)
    expect(game.map?.id).toBe('town')
    expect(pos(game.player)).toEqual([6, 7])
    expect(enters).toEqual(['shop', 'town'])
  })

  it('鎖著的門：撞到會說話，不會進去', () => {
    const { game } = makeGame()
    const said: string[] = []
    game.on('say', (e) => {
      said.push(e.text)
      e.resolve()
    })
    put(game, 21, 7, 'up')
    // 按住不放：只說一次，之後原地踏步
    hold(game, 'up', 90)
    run(game, 10)
    expect(said).toEqual(['門鎖著。'])
    expect(game.map?.id).toBe('town')
    expect(pos(game.player)).toEqual([21, 7])
  })

  it('A 查看：櫃台隔一格也說得到話', () => {
    const { game } = makeGame()
    game.warpNow('shop', 2, 5, 'up')
    const said: string[] = []
    game.on('say', (e) => {
      said.push(e.text)
      e.resolve()
    })
    game.on('ask', (e) => e.resolve(0))
    game.input.tap('A', 'test')
    run(game, 10)
    expect(said).toEqual(['歡迎光臨。', '還在整理，過幾天再來。'])
  })
})

describe('NPC', () => {
  it('亂走的不出範圍、不站在擋住的格子；照路線的繞池子；站著的不動', () => {
    const { game } = makeGame()
    // 玩家站到旁邊去，不擋路
    put(game, 3, 2, 'down')
    const kid = game.npcs.find((n) => n.id === 'kid') as Npc
    const walker = game.npcs.find((n) => n.id === 'walker') as Npc
    const oldman = game.npcs.find((n) => n.id === 'oldman') as Npc
    const seen = new Set<string>()
    let maxDist = 0
    for (let i = 0; i < 60 * 120; i++) {
      game.update(1 / 60)
      expect(kid.inRange(kid.x, kid.y)).toBe(true)
      for (const n of game.npcs) expect(passable(game.view!.beh(n.x, n.y)), `${n.id} ${n.x},${n.y}`).toBe(true)
      seen.add(`${walker.x},${walker.y}`)
      maxDist = Math.max(maxDist, Math.abs(kid.x - 6) + Math.abs(kid.y - 16))
    }
    expect(maxDist).toBeGreaterThan(0)
    // 繞池子一圈 28 格
    expect(seen.size).toBe(28)
    expect(pos(oldman)).toEqual([10, 9])
  })

  it('被搭話時轉向玩家', () => {
    const { game } = makeGame()
    game.on('say', (e) => e.resolve())
    put(game, 9, 9, 'right')
    const oldman = game.npcs.find((n) => n.id === 'oldman')!
    expect(oldman.dir).toBe('down')
    game.input.tap('A', 'test')
    run(game, 3)
    expect(oldman.dir).toBe('left')
  })
})

describe('夥伴', () => {
  it('走玩家剛離開的格子，停下來時小跳；回頭撞到就交換', () => {
    const { game } = makeGame()
    const f = game.follower!.actor
    put(game, 14, 10, 'up')
    // 往上走三步：夥伴在後面一格
    game.input.press('up', 'test')
    const trail: string[] = []
    for (let i = 0; i < 16 * 3 - 1; i++) {
      game.update(1 / 60)
      if (!f.moving) trail.push(`${f.x},${f.y}`)
    }
    game.input.release('up', 'test')
    run(game, 20)
    expect(pos(game.player)).toEqual([14, 7])
    expect(pos(f)).toEqual([14, 8])
    expect(f.dir).toBe('up')
    // 停下來小跳過（hop 跑完了）
    expect(f.hop).toBe(0)
    // 回頭往下（先轉身，按住就走）：交換
    hold(game, 'down', 8)
    expect(f.moving).toBe(true)
    run(game, 30)
    expect(pos(game.player)).toEqual([14, 8])
    expect(pos(f)).toEqual([14, 7])
  })

  it('跳台階：夥伴也跳過去', () => {
    const { game } = makeGame()
    const f = game.follower!.actor
    put(game, 5, 11, 'down')
    game.follower!.reset(5, 10, 'down')
    game.input.press('down', 'test')
    let jumped = false
    for (let i = 0; i < 120; i++) {
      game.update(1 / 60)
      if (f.move?.kind === 'jump') jumped = true
      if (game.player.y >= 15) game.input.release('down', 'test')
    }
    expect(jumped).toBe(true)
    expect(game.player.y).toBeGreaterThanOrEqual(15)
    expect(f.y).toBe(game.player.y - 1)
  })
})

describe('A*', () => {
  const grid = ['.....', '.###.', '...#.', '.#...', '.....']
  const open = (x: number, y: number) => grid[y]?.[x] === '.'
  const nb = (x: number, y: number, d: Dir) => (open(x + DX[d], y + DY[d]) ? { x: x + DX[d], y: y + DY[d] } : null)
  it('找到最短路、走不到回 null、在目標上回 []', () => {
    const p = findPath({ x: 0, y: 0 }, [{ x: 4, y: 2 }], nb, { w: 5, h: 5 })!
    expect(p.length).toBe(6)
    let x = 0
    let y = 0
    for (const d of p) {
      x += DX[d]
      y += DY[d]
      expect(open(x, y)).toBe(true)
    }
    expect([x, y]).toEqual([4, 2])
    expect(findPath({ x: 0, y: 0 }, [{ x: 2, y: 1 }], nb, { w: 5, h: 5 })).toBeNull()
    expect(findPath({ x: 1, y: 2 }, [{ x: 1, y: 2 }], nb, { w: 5, h: 5 })).toEqual([])
  })

  it('點畫面：走過去；點 NPC：走到旁邊面向它，再點一次就說話', () => {
    const { game } = makeGame()
    const said: string[] = []
    game.on('say', (e) => {
      said.push(e.text)
      e.resolve()
    })
    expect(game.walkTo(14, 10)).toBe(true)
    run(game, 16 * 14)
    expect(pos(game.player)).toEqual([14, 10])
    // 站著的路人（10, 9）
    game.walkTo(10, 9)
    run(game, 16 * 10)
    const p = game.player
    expect(Math.abs(p.x - 10) + Math.abs(p.y - 9)).toBe(1)
    const f = p.front()
    expect([f.x, f.y]).toEqual([10, 9])
    game.walkTo(10, 9)
    run(game, 5)
    expect(said).toEqual(['今天的風很舒服。'])
  })

  it('跳台階也算進路線（只能往下）', () => {
    const { game } = makeGame()
    put(game, 5, 12, 'down')
    game.walkTo(10, 15)
    run(game, 300)
    expect(pos(game.player)).toEqual([10, 15])
  })
})

describe('腳本', () => {
  it('say／ask 交給介面，resolve 之後才往下；執行中玩家不能動', () => {
    const { game } = makeGame()
    put(game, 23, 9, 'right')
    const log: string[] = []
    let pendingAsk: ((i: number) => void) | null = null
    let pendingSay: (() => void) | null = null
    game.on('ask', (e) => {
      log.push(`ask:${e.text}:${e.options.join('/')}`)
      pendingAsk = e.resolve
    })
    game.on('say', (e) => {
      log.push(`say:${e.text}`)
      pendingSay = e.resolve
    })
    game.input.tap('A', 'test')
    run(game, 5)
    expect(log).toEqual(['ask:要不要聽一件小事？:要/不要'])
    // 還沒回答：按方向不會走
    hold(game, 'left', 30)
    expect(pos(game.player)).toEqual([23, 9])
    pendingAsk!(0)
    run(game, 2)
    expect(log.at(-1)).toBe('say:池子邊的花，晚上會合起來。')
    pendingSay!()
    run(game, 2)
    expect(log.at(-1)).toBe('say:天亮了再打開。')
    expect(game.state.flags['town.story']).toBeUndefined()
    pendingSay!()
    run(game, 2)
    expect(game.state.flags['town.story']).toBe(true)
    expect(game.busy).toBe(false)
  })

  it('Runner：秒數、等一格、等到條件；丟錯只停那一段', () => {
    let flag = false
    const out: number[] = []
    const r = new Runner(
      (function* (): Script {
        out.push(1)
        yield 0.5
        out.push(2)
        yield null
        out.push(3)
        yield () => flag
        out.push(4)
      })(),
      't',
      true,
    )
    // 第 1 次跑到 yield 0.5；之後 30 次（0.5 秒）才往下
    for (let i = 0; i < 30; i++) r.step(1 / 60)
    expect(out).toEqual([1])
    r.step(1 / 60)
    expect(out).toEqual([1, 2])
    r.step(1 / 60)
    r.step(1 / 60)
    expect(out).toEqual([1, 2, 3])
    flag = true
    r.step(1 / 60)
    expect(out).toEqual([1, 2, 3, 4])
    expect(r.done).toBe(true)
    const bad = new Runner(
      (function* (): Script {
        yield null
        throw new Error('壞了')
      })(),
      'bad',
      true,
    )
    const warn = console.warn
    console.warn = () => {}
    try {
      bad.step(0)
      bad.step(0)
    } finally {
      console.warn = warn
    }
    expect(bad.done).toBe(true)
  })

  it('可以註冊新的指令（P2 的 stamp 這樣加）', () => {
    const { game } = makeGame()
    const stamps: string[] = []
    registerCommand('testStamp', function* (ctx, id) {
      stamps.push(id)
      ctx.game.state.stamps.push(id)
      yield 0.1
    })
    game.run(function* (s) {
      yield* s.testStamp('stamp')
      yield* s.give('postcard', 2)
      const ok = yield* s.money(-500)
      const no = yield* s.money(-999999)
      yield* s.flag('paid', ok && !no)
    })
    run(game, 12)
    expect(stamps).toEqual(['stamp'])
    expect(game.state.stamps).toEqual(['stamp'])
    expect(game.state.items.postcard).toBe(2)
    expect(game.state.money).toBe(NEW_GAME_MONEY - 500)
    expect(game.state.flags.paid).toBe(true)
  })
})

describe('存檔', () => {
  it('存了再讀回來：位置、方向、旗標、旅費、日曆一樣', () => {
    const { game, store } = makeGame()
    put(game, 20, 9, 'left')
    game.state.flags.a = 1
    game.state.money = 1234
    game.state.items.tea = 3
    game.state.seen.add('town-sign')
    game.clock.setDate(2026, 12, 24)
    game.clock.setTime(18, 30)
    expect(game.save().ok).toBe(true)
    const g2 = new Game({ tokens, maps: testMaps, start: TEST_START, storage: store, seed: 2 })
    expect(g2.hasSave()).toBe(true)
    expect(g2.continueGame()).toBe(true)
    expect(g2.map?.id).toBe('town')
    expect(pos(g2.player)).toEqual([20, 9])
    expect(g2.player.dir).toBe('left')
    expect(g2.state.flags.a).toBe(1)
    expect(g2.state.money).toBe(1234)
    expect(g2.state.items.tea).toBe(3)
    expect(g2.state.seen.has('town-sign')).toBe(true)
    expect(g2.clock.date).toEqual({ y: 2026, m: 12, d: 24 })
    expect(g2.clock.time).toBe('dusk')
    expect(JSON.stringify(g2.serialize()).length).toBeLessThan(50 * 1024)
  })

  it('壞檔不會當掉：當作沒有存檔', () => {
    for (const raw of ['{', 'null', '[]', '"x"', '{"v":"1"}', '{"v":99}', '']) expect(parseSave(raw), raw).toBeNull()
    const store = memoryStore({ [saveKey(null)]: '{壞掉了' })
    const g = new Game({ tokens, maps: testMaps, start: TEST_START, storage: store })
    expect(g.continueGame()).toBe(false)
    expect(g.map?.id).toBe('town')
    expect(pos(g.player)).toEqual([14, 20])
  })

  it('欄位型別不對的換成預設；找不到地圖、生成器版本變了：放回起點，東西保留', () => {
    const d = parseSave(JSON.stringify({ v: 1, map: 'nowhere', x: 'a', y: 3, dir: 'sideways', money: -5, items: { a: 2, b: 'x' }, flags: { ok: true, bad: {} }, calendar: { y: 2026, m: 7, d: 1, min: 600 } }))!
    expect(d.dir).toBe('down')
    expect(d.money).toBe(0)
    expect(d.items).toEqual({ a: 2 })
    expect(d.flags).toEqual({ ok: true })
    const store = memoryStore()
    writeSave(store, saveKey('u1'), d)
    const g = new Game({ tokens, maps: testMaps, start: TEST_START, storage: store, saveKey: saveKey('u1') })
    expect(g.continueGame()).toBe(true)
    expect(g.map?.id).toBe('town')
    expect(pos(g.player)).toEqual([14, 20])
    expect(g.state.items).toEqual({ a: 2 })
    expect(g.clock.date).toEqual({ y: 2026, m: 7, d: 1 })
    // 生成器版本變了：放回那張地圖的起點（鎮的車站）
    const store2 = memoryStore()
    writeSave(store2, saveKey(null), { ...d, map: 'shop', x: 2, y: 5, gen: 1 })
    const g2 = new Game({ tokens, maps: testMaps, start: TEST_START, storage: store2, genVersion: 2 })
    g2.continueGame()
    expect(g2.map?.id).toBe('shop')
    expect(pos(g2.player)).toEqual([4, 6])
    expect(g2.state.items).toEqual({ a: 2 })
  })

  it('換地圖時自動存', () => {
    const { game, store } = makeGame()
    game.warpNow('shop', 4, 6, 'up')
    const d = parseSave(store.data[saveKey(null)])!
    expect([d.map, d.x, d.y]).toEqual(['shop', 4, 6])
  })
})

describe('時鐘', () => {
  it('戶外走路時時間往前；室內不走', () => {
    const { game } = makeGame()
    const m0 = game.clock.minutes
    hold(game, 'up', 60 * 2)
    expect(game.clock.minutes - m0).toBeGreaterThan(1)
    game.warpNow('shop', 4, 6, 'up')
    const m1 = game.clock.minutes
    hold(game, 'left', 60)
    expect(game.clock.minutes).toBe(m1)
  })

  it('睡一晚：晚上睡到隔天早上；過了午夜才睡是今天早上（不跳過一天）', () => {
    const { game } = makeGame()
    game.clock.setDate(2026, 10, 17)
    game.clock.setTime(22, 0)
    game.clock.nextMorning(7)
    expect([game.clock.date, game.clock.minutes]).toEqual([{ y: 2026, m: 10, d: 18 }, 7 * 60])
    game.clock.setTime(1, 30)
    game.clock.nextMorning(7)
    expect([game.clock.date, game.clock.minutes]).toEqual([{ y: 2026, m: 10, d: 18 }, 7 * 60])
  })
})

describe('地圖', () => {
  it('ASCII 地圖：每一列一樣長、字都在 legend 裡', () => {
    expect(() => asciiMap({ id: 'x', name: { ja: 'x', romaji: 'X', zh: 'x' }, outdoor: true, rows: ['..', '...'], legend: { '.': {} }, ground: 'basic/grass', border: { ground: 'basic/grass' } })).toThrow()
    expect(() => asciiMap({ id: 'x', name: { ja: 'x', romaji: 'X', zh: 'x' }, outdoor: true, rows: ['.?'], legend: { '.': {} }, ground: 'basic/grass', border: { ground: 'basic/grass' } })).toThrow()
  })

  it('測試小鎮：門、拍攝點、NPC、告示牌都從起點走得到', () => {
    const { game } = makeGame()
    const v = game.view!
    const map = v.map
    // flood fill（含往下跳台階）
    const seen = new Set<string>()
    const q = [[map.start!.x, map.start!.y]]
    seen.add(q[0]!.join(','))
    while (q.length) {
      const [x, y] = q.shift()!
      for (const d of ['up', 'down', 'left', 'right'] as Dir[]) {
        let nx = x! + DX[d]
        let ny = y! + DY[d]
        const b = v.beh(nx, ny)
        if (b === B['ledge-down'] && d === 'down') ny += 1
        else if (!passable(b)) continue
        nx = Math.max(0, nx)
        const k = `${nx},${ny}`
        if (!seen.has(k) && passable(v.beh(nx, ny))) {
          seen.add(k)
          q.push([nx, ny])
        }
      }
    }
    const near = (x: number, y: number) => [[0, 1], [0, -1], [1, 0], [-1, 0], [0, 2]].some(([dx, dy]) => seen.has(`${x + dx!},${y + dy!}`))
    for (const w of map.warps) expect(seen.has(`${w.x},${w.y}`), `門 ${w.x},${w.y}`).toBe(true)
    for (const e of map.entities) expect(e.kind === 'photoSpot' ? seen.has(`${e.x},${e.y}`) : near(e.x, e.y), e.id).toBe(true)
  })

  it('台詞沒有驚嘆號、數字＋年／月／km', () => {
    for (const id of ['town', 'shop']) {
      const m = testMaps(id)!
      const texts = m.entities.flatMap((e) => [e.data?.text].flat()).filter((t): t is string => typeof t === 'string')
      const src = Object.values(m.scripts ?? {}).map((f) => f.toString())
      for (const t of [...texts, ...src]) {
        expect(t).not.toMatch(/[!！]/)
        expect(t).not.toMatch(/\d+\s*(年|月|km)/)
      }
    }
  })
})

describe('畫面', () => {
  it('RGB 調色盤的 sprite（P1 的旅人）照時段換色，跟 makePalette 同一套', () => {
    const { game } = makeGame()
    const rgb: RgbSprite = { w: 4, h: 4, idx: new Uint8Array(16).fill(1), rgb: [[200, 100, 50]] }
    game.setLook({ frame: () => ({ sprite: rgb, ax: 2, ay: 4 }) })
    game.follower!.reset(3, 2, 'down')
    const at = () => {
      const g = game.render()
      const cam = game.camera()
      const x = game.player.px + 8 - cam.x
      const y = game.player.py + 16 - cam.y - 2
      return g.buf[y * g.w + x]!
    }
    game.clock.setTime(12)
    run(game, 1)
    expect(at()).toBe(packRgb([200, 100, 50]))
    game.clock.setTime(21)
    run(game, 90)
    expect(at()).toBe(packRgb(tintRgb([200, 100, 50], tokens, 'night')))
  })

  it('snapshot 不含淡出；淡出時畫面是墨色', () => {
    const { game } = makeGame()
    game.fadeTo('out')
    run(game, 20)
    expect(game.fadeDone).toBe(true)
    const g = game.render()
    const ink = g.pal.u32.ink
    expect(g.buf.every((v) => v === ink)).toBe(true)
    const snap = game.snapshot()
    expect(snap.buf.some((v) => v !== ink)).toBe(true)
    expect(snap.w).toBe(game.W)
  })

  it('換時段會發 clock 事件；雨、雪畫得出來；寬度夾在 176–240', () => {
    const { game } = makeGame()
    const times: string[] = []
    game.on('clock', (e) => times.push(e.time))
    game.clock.setTime(17, 10)
    run(game, 2)
    game.clock.setTime(20)
    run(game, 2)
    expect(times).toEqual(['dusk', 'night'])
    for (const w of ['rain', 'snow', 'clear'] as const) {
      game.setWeather(w)
      run(game, 3)
      expect(() => game.render()).not.toThrow()
    }
    game.resize(100)
    expect(game.W).toBe(176)
    game.resize(999)
    expect(game.W).toBe(240)
    game.resize(200)
    expect(game.render().w).toBe(200)
  })

  it('overlay 疊在世界上（不進 snapshot）；外觀可以多疊幾個 sprite', () => {
    const { game } = makeGame()
    game.setOverlay((g) => g.rect(0, 0, 4, 4, 'shu-1'))
    const shu = game.render().pal.u32['shu-1']
    expect(game.render().buf[0]).toBe(shu)
    expect(game.snapshot().buf[0]).not.toBe(shu)
    game.setOverlay(null)
    const dot: RgbSprite = { w: 2, h: 2, idx: new Uint8Array(4).fill(1), rgb: [[10, 20, 30]] }
    const hat: RgbSprite = { w: 2, h: 2, idx: new Uint8Array(4).fill(1), rgb: [[40, 50, 60]] }
    game.setLook({ frame: () => ({ sprite: dot, ax: 1, ay: 2, extra: [{ sprite: hat, x: 0, y: -2 }] }) })
    game.follower!.reset(3, 2, 'down')
    const g = game.render()
    const cam = game.camera()
    const x = game.player.px + 8 - cam.x
    const y = game.player.py + 16 - cam.y
    expect(g.buf[(y - 1) * g.w + x]).toBe(packRgb([10, 20, 30]))
    expect(g.buf[(y - 3) * g.w + x]).toBe(packRgb([40, 50, 60]))
  })

  it('快換時段時，新時段的 tile 先慢慢畫進快取：換的那一格幾乎不用畫新的 tile（審查 #57）', () => {
    const { game } = makeGame()
    const cache = (game as unknown as { cache: { cache: Map<number, unknown> } }).cache.cache
    // TileCache.key：((((id*4+季節)*3+時段)*8+格)*4+變化)*16+遮罩
    const dusk = () => [...cache.keys()].filter((k) => Math.floor(k / (16 * 4 * 8)) % 3 === 1).length
    game.clock.setTime(16, 0)
    run(game, 2)
    for (let i = 0; i < 20; i++) game.render()
    expect(dusk()).toBe(0)
    // 換時段前 20 分鐘內：每格畫兩列
    game.clock.setTime(16, 45)
    run(game, 2)
    for (let i = 0; i < 20; i++) game.render()
    const warmed = dusk()
    expect(warmed).toBeGreaterThan(0)
    const before = new Set(cache.keys())
    game.clock.setTime(17, 0)
    run(game, 1)
    game.render()
    // 新畫的只有會動的 tile（水面等：畫進快取時是另一格動畫）
    const fresh = [...cache.keys()].filter((k) => !before.has(k)).map((k) => tileDef(Math.floor(k / (16 * 4 * 8 * 3 * 4))))
    expect(fresh.filter((d) => (d?.frames ?? 1) <= 1)).toEqual([])
    // 室內、減少動態：不畫
    const r = makeGame({ reducedMotion: true }).game
    const rc = (r as unknown as { cache: { cache: Map<number, unknown> } }).cache.cache
    r.clock.setTime(16, 45)
    run(r, 2)
    for (let i = 0; i < 20; i++) r.render()
    expect([...rc.keys()].filter((k) => Math.floor(k / (16 * 4 * 8)) % 3 === 1).length).toBe(0)
  })

  it('一直跑：不按 B 就是跑', () => {
    const { game } = makeGame()
    game.settings.alwaysRun = true
    hold(game, 'up', 1 + 8 * 2 - 1)
    run(game, 10)
    expect(pos(game.player)).toEqual([14, 18])
  })
})

describe('輸入', () => {
  it('最後按的方向優先；不同來源分開記；十字鍵滑動換方向', () => {
    const i = new InputState()
    i.press('up', 'key')
    i.press('left', 'key')
    expect(i.dir).toBe('left')
    i.release('left', 'key')
    expect(i.dir).toBe('up')
    i.press('up', 'touch')
    i.release('up', 'key')
    expect(i.held('up')).toBe(true)
    i.setDir('right', 'touch')
    expect(i.held('up')).toBe(false)
    expect(i.dir).toBe('right')
    i.setDir(null, 'touch')
    expect(i.dir).toBeNull()
    i.tap('A')
    expect(i.take()).toEqual(['up', 'left', 'right', 'A'])
    expect(i.take()).toEqual([])
  })

  it('暫停時世界不動，按鍵交給介面；START 打開手帳', () => {
    const { game } = makeGame()
    const buttons: string[] = []
    let menu = 0
    game.on('button', (e) => buttons.push(e.button))
    game.on('menu', (e) => (menu += e.open ? 1 : -1))
    game.input.tap('START', 'test')
    run(game, 1)
    expect(menu).toBe(1)
    expect(game.paused).toBe(true)
    hold(game, 'up', 30)
    expect(pos(game.player)).toEqual([14, 20])
    expect(buttons).toContain('up')
    game.closeMenu()
    expect(menu).toBe(0)
    expect(game.paused).toBe(false)
  })
})

describe('效能', () => {
  it('寬 240：每格（更新＋畫）平均 < 4ms', () => {
    const { game } = makeGame()
    game.input.press('right', 'test')
    for (let i = 0; i < 60; i++) {
      game.update(1 / 60)
      game.render()
    }
    const t0 = performance.now()
    const N = 300
    for (let i = 0; i < N; i++) {
      game.update(1 / 60)
      game.render()
    }
    const ms = (performance.now() - t0) / N
    console.info(`game：每格 ${ms.toFixed(3)} ms`)
    expect(ms).toBeLessThan(4)
  })
})
