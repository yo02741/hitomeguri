/**
 * 番外篇的世界生成（P2：京都＋沖繩；P3：再加奈良、大阪、兵庫、東京、北海道，延遲載入）。入口：
 *   loadWorldData(['kyoto', 'okinawa']) → { prefs, errors, warnings }（讀不到不丟錯）
 *   createWorld(prefs) → { mapSource, start, towns, links, seasonOf, travel, attach, genVersion, … }
 *   P3：loadWorldIndex（game/_world.json）＋prefLoader → createWorld([京都], { index, loadPref, loadKit })，其他縣 ensurePref／坐車時才讀
 * 資料介面（PrefData、Town、Link、實體的 data）在 types.ts；tile kit 在 kits/：import 這裡註冊基本、室內、近畿、沖繩（kits/core.ts），
 * 關東、北海道的 kit 是另一檔（game-kits），由 loadKit（play/world.ts 的 loadKitModule）到那一縣才讀；測試 import './kits' 就全部都有。
 */
export { BUNDLES, type BundleApi, loadWorldData, loadWorldIndex, municipalitiesOf, parseWorldIndex, prefData, prefLoader, WORLD_KEY, WorldDataError, type WorldDataErrorKind, type WorldLoad } from './data'
export { classify, type LandmarkKind, sizeOf } from './gen/classify'
export { ensureReachable, flood, generateTown, targetsOf, type TownGen } from './gen/town'
export { ROOM_MAT } from './gen/interiors'
export { kanaToRomaji, placeRomaji } from './romaji'
export { ARRIVE_SFX, DEPART_SFX, rideOverlay, type RideScene } from './ride'
export { bloomAt, type Climate, climateOf, dateLabel, type Flower, festivalsIn, seasonAt, weatherAt } from './season'
export { atlasOf, buildWorld, indexLinks, KIT_OF, kitOf, linksFrom, MAX_LANDMARKS, minutesOf, orderOf, prefWorld, railKm, selectTowns, TOWN_RULES, type TownRule } from './towns'
export * from './types'
export { CANNOT_GO, createWorld, GEN_VERSION, RELOAD_FIRST, type GameWorld, type TravelOptions, type WorldOptions } from './world'
