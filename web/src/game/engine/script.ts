import type { Actor } from './actor'
import type { Game } from './game'
import type { Dir, MapEntity, Script, ScriptFn, SourceRef, Wait } from './types'
import type { FlagValue } from './save'

/**
 * 腳本：generator（同 services/pixelwalk/script.ts 的概念）。yield 秒數等那麼久、yield null 等一格、
 * yield 函式等到它回傳 true；指令都是 generator，用 yield* 呼叫，例：
 *   function* (s) { yield* s.say('今天的風很舒服。'); const i = yield* s.ask('要嗎？', ['要', '不要']) }
 * 指令可以註冊（P2 加 stamp、shop、photo…）：先擴充 ScriptCommands 的型別，再 registerCommand。
 * blocking 的腳本執行中玩家不能動、NPC 不自己走。
 */

/** 誰：'player'、'follower'、NPC 的實體 id、或 Actor */
export type ActorRef = string | Actor

export interface SayOpts {
  who?: string
  source?: SourceRef
}

/** 內建指令（P2 用 declare module 擴充這個介面，再 registerCommand） */
export interface ScriptCommands {
  say(text: string, opts?: SayOpts): Script
  ask(text: string, options: string[], opts?: SayOpts & { cancel?: number }): Script<number>
  walk(who: ActorRef, path: string | Dir[], opts?: { run?: boolean }): Script
  face(who: ActorRef, to: Dir | ActorRef): Script
  wait(sec: number): Script
  give(item: string, n?: number): Script
  take(item: string, n?: number): Script<boolean>
  money(delta: number): Script<boolean>
  flag(name: string, value?: FlagValue | null): Script<FlagValue | undefined>
  fade(dir: 'out' | 'in'): Script
  warp(map: string, x: number, y: number, dir?: Dir): Script
  sfx(name: string): Script
  bgm(name: string | null): Script
  hop(who: ActorRef): Script
}

export interface CommandCtx {
  game: Game
  /** 觸發這段腳本的實體（查看的 NPC、告示牌） */
  self: MapEntity | null
  /** 那個實體的角色（NPC） */
  actor: Actor | null
}

export type ScriptApi = ScriptCommands &
  CommandCtx & {
    /** 讀旗標（if flag） */
    get(name: string): FlagValue | undefined
    has(name: string): boolean
  }

type Impl = (ctx: CommandCtx, ...args: never[]) => Script<unknown>
const commands = new Map<string, Impl>()

export function registerCommand<K extends keyof ScriptCommands>(
  name: K,
  impl: (ctx: CommandCtx, ...args: Parameters<ScriptCommands[K]>) => ReturnType<ScriptCommands[K]>,
) {
  commands.set(name as string, impl as unknown as Impl)
}
export const commandNames = () => [...commands.keys()]

const scripts = new Map<string, ScriptFn>()
/** 全域的腳本（地圖的實體用 data.script 指到這裡） */
export function registerScript(id: string, fn: ScriptFn) {
  scripts.set(id, fn)
}
export const scriptById = (id: string) => scripts.get(id)

/** 做一份腳本拿到的指令：每個註冊的指令都綁上這段腳本的 ctx */
export function makeApi(ctx: CommandCtx): ScriptApi {
  const api: Record<string, unknown> = {
    ...ctx,
    get: (name: string) => ctx.game.state.flags[name],
    has: (name: string) => !!ctx.game.state.flags[name],
  }
  for (const [name, impl] of commands) api[name] = (...args: never[]) => impl(ctx, ...args)
  return api as unknown as ScriptApi
}

/**
 * 跑一段腳本：每次更新 step(dt)。腳本丟錯就停掉那一段（開發時印出來），不影響遊戲。
 */
export class Runner {
  done = false
  readonly id: string
  /** 執行中玩家不能動 */
  readonly blocking: boolean
  private wait = 0
  private until: (() => boolean) | null = null
  private readonly gen: Script<unknown>
  private readonly onEnd?: () => void

  constructor(gen: Script<unknown>, id: string, blocking: boolean, onEnd?: () => void) {
    this.gen = gen
    this.id = id
    this.blocking = blocking
    this.onEnd = onEnd
  }

  step(dt: number) {
    if (this.done) return
    try {
      if (this.wait > 0) {
        this.wait -= dt
        if (this.wait > 1e-9) return
        this.wait = 0
      }
      if (this.until) {
        if (!this.until()) return
        this.until = null
      }
      for (let guard = 0; guard < 256; guard++) {
        const r = this.gen.next()
        if (r.done) return this.finish()
        const v: Wait = r.value
        if (typeof v === 'number') {
          if (v > 0) {
            this.wait = v
            return
          }
          continue
        }
        if (typeof v === 'function') {
          if (v()) continue
          this.until = v
          return
        }
        return
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.warn(`game：腳本 ${this.id} 停了`, e)
      this.finish()
    }
  }

  stop() {
    if (this.done) return
    try {
      this.gen.return(undefined)
    } catch {
      // 停的時候腳本自己丟錯就算了
    }
    this.finish()
  }

  private finish() {
    if (this.done) return
    this.done = true
    this.onEnd?.()
  }
}
