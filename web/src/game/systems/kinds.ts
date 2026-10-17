import { entityKind, type EntityKind, registerEntityKind } from '../engine/entities'
import type { Game } from '../engine/game'
import { makeApi, registerCommand, registerScript } from '../engine/script'
import type { Script } from '../engine/types'

import type { GameSystems } from './install'
import * as talk from './talk'
import type { FactRef } from './types'

/**
 * 實體種類與腳本指令（規格 §11）：註冊是全域的（一次），處理的時候找這個 Game 的 systems（installSystems 接上的）。
 * 沒有接上 systems 的 Game（P0 的測試小鎮、引擎的測試）照引擎內建的 npc、sign 做。
 *
 * - npc：data.role 有寫就照 role 說話（fact 事實樣板、passer 虛構台詞＋收委託的東西、quest 給委託、clerk 開店、
 *   festival 祭典、inn 旅館的櫃台）；data.look 是數字（種子）時用手畫的路人（或產生器）。沒有 role 照內建。
 * - sign：有 spotId／festivalId／title 就讀告示牌（地名、念法、簡介第一句、出處，記進「聽來的」）；沒有照內建的 data.text。
 * - photoSpot：站上去出現「拍照」，相機鍵帶著它（引擎的 camera 事件）。
 * - shop、stamp、travel、inn：店、蓋章、目的地、旅館。
 * - shelfSlot、frameSlot、desk、roomDoor：房間的架子、相框、桌上的印帳、出口。
 */
const bound = new WeakMap<Game, GameSystems>()
export const systemsFor = (g: Game): GameSystems | undefined => bound.get(g)
export function setSystemsFor(g: Game, s: GameSystems | null) {
  if (s) bound.set(g, s)
  else bound.delete(g)
}

declare module '../engine/script' {
  interface ScriptCommands {
    /** 蓋章（stamp 實體的 stampId；這張地圖上找） */
    stamp(id: string): Script<boolean>
    /** 打開店（shop 實體的 id；這張地圖上找） */
    shop(id: string): Script
    /** 說一句事實（樣板 id、資料參照）；沒有出處就不說，回 false */
    fact(template: string, ref: FactRef, params?: Record<string, string | number>): Script<boolean>
    /** 請玩家拍某個地標（委託）：接了回 true */
    photoRequest(spotId: string, night?: boolean): Script<boolean>
    /** 睡到隔天早上 */
    sleep(): Script
  }
}

let done = false

export function registerKinds() {
  if (done) return
  done = true
  const builtinNpc: EntityKind = entityKind('npc') ?? {}
  const builtinSign: EntityKind = entityKind('sign') ?? {}

  registerEntityKind('npc', {
    spawn: (e, game) => {
      const s = systemsFor(game)
      return s ? s.spawnNpc(e) : (builtinNpc.spawn?.(e, game) ?? null)
    },
    interact: (e, game, actor) => {
      const s = systemsFor(game)
      const fn = s ? talk.npc(s, e) : null
      return fn ?? builtinNpc.interact?.(e, game, actor) ?? null
    },
  })

  registerEntityKind('sign', {
    interact: (e, game, actor) => {
      const s = systemsFor(game)
      const fn = s ? talk.sign(s, e) : null
      return fn ?? builtinSign.interact?.(e, game, actor) ?? null
    },
    bump: (e, game) => builtinSign.bump?.(e, game) ?? null,
  })

  const sys =
    (fn: (s: GameSystems, e: Parameters<NonNullable<EntityKind['interact']>>[0]) => ReturnType<NonNullable<EntityKind['interact']>>): NonNullable<EntityKind['interact']> =>
    (e, game) => {
      const s = systemsFor(game)
      return s ? fn(s, e) : null
    }

  // 店、剪票口、旅館、授与所：data 有 look／lookSeed 就在那一格生一個站櫃台的人（車站的站章台、城的蓋章處沒有）
  const staff = (e: Parameters<NonNullable<EntityKind['spawn']>>[0], game: Game) => systemsFor(game)?.spawnStaff(e) ?? null
  registerEntityKind('shop', { spawn: staff, interact: sys(talk.shop) })
  registerEntityKind('stamp', { spawn: staff, interact: sys(talk.stamp) })
  registerEntityKind('travel', { spawn: staff, interact: sys(talk.travel) })
  registerEntityKind('inn', { spawn: staff, interact: sys(talk.inn) })
  registerEntityKind('desk', { interact: sys(talk.desk) })
  registerEntityKind('shelfSlot', {
    spawn: (e, game) => systemsFor(game)?.spawnSlot(e, 'shelf') ?? null,
    interact: sys((s, e) => talk.room(s, e, 'shelf')),
  })
  registerEntityKind('frameSlot', {
    spawn: (e, game) => systemsFor(game)?.spawnSlot(e, 'frame') ?? null,
    interact: sys((s, e) => talk.room(s, e, 'frame')),
  })
  registerEntityKind('roomDoor', {
    step: (_e, game) => {
      const s = systemsFor(game)
      return s ? talk.leaveRoom(s) : null
    },
  })
  // 房間的出口也可以用腳本：data.script = 'systems.roomExit'
  registerScript('systems.roomExit', (api) => {
    const s = systemsFor(api.game)
    return (s ? talk.leaveRoom(s) : null)?.(api) ?? (function* () {})()
  })

  registerCommand('stamp', function* (ctx, id): Script<boolean> {
    const s = systemsFor(ctx.game)
    const e = ctx.game.map?.entities.find((x) => x.kind === 'stamp' && (x.data as { stampId?: string } | undefined)?.stampId === id)
    if (!s || !e) return false
    return yield* talk.stampFlow(s, makeApi({ game: ctx.game, self: e, actor: null }), e)
  })
  registerCommand('shop', function* (ctx, id): Script {
    const s = systemsFor(ctx.game)
    const e = ctx.game.map?.entities.find((x) => x.kind === 'shop' && x.id === id)
    if (!s || !e) return
    const fn = talk.shop(s, e)
    if (fn) yield* fn(makeApi({ game: ctx.game, self: e, actor: null }))
  })
  registerCommand('fact', function* (ctx, template, ref, params = {}): Script<boolean> {
    const s = systemsFor(ctx.game)
    const f = s?.fact(template, ref, params)
    if (!s || !f) return false
    yield ctx.game.openSay(f.text, { source: f.source })
    s.hear({ k: 'fact', id: template, ref, p: Object.keys(params).length ? params : undefined })
    return true
  })
  registerCommand('photoRequest', function* (ctx, spotId, night = false): Script<boolean> {
    const s = systemsFor(ctx.game)
    if (!s) return false
    return talk.requestPhoto(s, ctx.self?.id ?? 'script', spotId, night)
  })
  registerCommand('sleep', function* (ctx): Script {
    const s = systemsFor(ctx.game)
    if (s) yield* talk.sleepFlow(s, makeApi(ctx))
  })
}
