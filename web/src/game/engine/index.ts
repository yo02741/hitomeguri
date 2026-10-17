/**
 * 番外篇（像素遊戲）的引擎。入口是 Game（game.ts）；地圖、tile、角色外觀、實體種類、腳本指令都可以註冊。
 */
export { Actor, BUMP, JUMP, RUN, TURN, WALK } from './actor'
export { addDays, type CalendarDate, GameClock, monthSeason, periodOf, todayJst } from './clock'
export { Emitter } from './emitter'
export { entityKind, entityKinds, type EntityKind, linesOf, registerEntityKind, scriptOf } from './entities'
export { Follower } from './follower'
export { type AskEvent, Game, type GameEvents, type GameOptions, GameState, type MapSource, type SayEvent } from './game'
export { attachKeyboard, type Button, GamepadSource, InputState, KEYMAP } from './input'
export { lookIds, lookOf, registerLook, type Sheet, sheetLook } from './looks'
export { asciiMap, type AsciiMapDef, type CellSpec, cellHash, emptyMap, MapView, placeBig, setBehavior, setTile } from './map'
export { buildMinimap, drawMinimap, MINI_INK, MINI_KINDS, type MiniKind, type Minimap, miniWindow } from './minimap'
export { Npc, type NpcMove } from './npc'
export { type Cell, findPath } from './path'
export { nearestPlace, type Place, type PlaceName, placesOf, placeSub } from './places'
export { blitTile, drawRgb, Renderer, type Weather } from './render'
export {
  DEFAULT_SETTINGS,
  type FlagValue,
  type GameSettings,
  localStore,
  memoryStore,
  parseSave,
  readSave,
  SAVE_VERSION,
  type SaveData,
  saveKey,
  type SaveStorage,
  writeSave,
} from './save'
export { type ActorRef, type CommandCtx, commandNames, makeApi, registerCommand, registerScript, Runner, type ScriptApi, type ScriptCommands } from './script'
export { allTiles, bigTiles, hasTile, registerTileset, SEASONS, TileCache, tileDef, tileId, TIMES } from './tiles'
export * from './types'
