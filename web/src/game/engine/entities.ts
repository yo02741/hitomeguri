import type { Actor } from './actor'
import type { Game } from './game'
import { lookOf } from './looks'
import { Npc } from './npc'
import type { ScriptApi } from './script'
import { scriptById } from './script'
import type { MapEntity, Script, ScriptFn } from './types'

/**
 * 實體的種類：怎麼生成（NPC 生一個角色）、被查看（A）、被撞到、被踩到時跑什麼腳本。
 * P0 內建 npc、sign、photoSpot、trigger；P2 用 registerEntityKind 加 shop、stamp、ticket…
 */
export interface EntityKind {
  /** 生成角色（NPC）；不會動的東西（告示牌）不用寫 */
  spawn?(e: MapEntity, game: Game): Actor | null
  /** 被查看（A）：回傳腳本；回 null 就沒反應 */
  interact?(e: MapEntity, game: Game, actor: Actor | null): ScriptFn | null
  /** 往它走、撞到（例：鎖著的門） */
  bump?(e: MapEntity, game: Game): ScriptFn | null
  /** 走上這一格（觸發點） */
  step?(e: MapEntity, game: Game): ScriptFn | null
}

const kinds = new Map<string, EntityKind>()

export function registerEntityKind(kind: string, def: EntityKind) {
  kinds.set(kind, def)
}
export const entityKind = (kind: string) => kinds.get(kind)
export const entityKinds = () => [...kinds.keys()]

/** data.text：一句或好幾句 */
export function linesOf(e: MapEntity): string[] {
  const t = e.data?.text
  if (typeof t === 'string') return [t]
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string')
  return []
}

/** data.script 指的腳本：先找地圖自己的，再找全域的 */
export function scriptOf(e: MapEntity, game: Game): ScriptFn | null {
  const id = e.data?.script
  if (typeof id !== 'string') return null
  return game.map?.scripts?.[id] ?? scriptById(id) ?? null
}

const who = (e: MapEntity) => (typeof e.data?.who === 'string' ? e.data.who : undefined)

/** 照 data.text 一句一句說 */
function sayLines(e: MapEntity): ScriptFn | null {
  const lines = linesOf(e)
  if (!lines.length) return null
  return function* (s: ScriptApi): Script {
    for (const line of lines) yield* s.say(line, { who: who(e) })
  }
}

registerEntityKind('npc', {
  spawn: (e) => new Npc(e, lookOf(typeof e.data?.look === 'string' ? e.data.look : undefined)),
  interact: (e, game) => scriptOf(e, game) ?? sayLines(e),
})

registerEntityKind('sign', {
  interact: (e, game) => {
    const say = scriptOf(e, game) ?? sayLines(e)
    if (!say) return null
    return function* (s: ScriptApi) {
      game.state.seen.add(e.id)
      yield* say(s)
    }
  },
  // data.bump：撞到也會讀（鎖著的門）
  bump: (e, game) => (e.data?.bump ? (scriptOf(e, game) ?? sayLines(e)) : null),
})

// 拍攝點：地上有記號；站在上面按相機時 Game 的 camera 事件帶著它（P2 的取景框）
registerEntityKind('photoSpot', {})

registerEntityKind('trigger', {
  step: (e, game) => {
    const fn = scriptOf(e, game) ?? sayLines(e)
    if (!fn) return null
    const flag = `trigger:${game.map?.id}:${e.id}`
    if (e.data?.once && game.state.flags[flag]) return null
    return function* (s: ScriptApi) {
      if (e.data?.once) game.state.flags[flag] = true
      yield* fn(s)
    }
  },
})
