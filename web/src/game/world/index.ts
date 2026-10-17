/**
 * 番外篇的世界生成（P2：京都＋沖繩）。入口：
 *   loadWorldData(['kyoto', 'okinawa']) → { prefs, errors, warnings }（讀不到不丟錯）
 *   createWorld(prefs) → { mapSource, start, towns, links, seasonOf, travel, attach, genVersion, … }
 * 資料介面（PrefData、Town、Link、實體的 data）在 types.ts；tile kit 在 kits/（import 這裡就註冊）。
 */
export { BUNDLES, type BundleApi, loadWorldData, municipalitiesOf, prefData, WorldDataError, type WorldDataErrorKind, type WorldLoad } from './data'
export { classify, type LandmarkKind, sizeOf } from './gen/classify'
export { ensureReachable, flood, generateTown, targetsOf, type TownGen } from './gen/town'
export { ROOM_MAT } from './gen/interiors'
export { kanaToRomaji, placeRomaji } from './romaji'
export { ARRIVE_SFX, DEPART_SFX, rideOverlay, type RideScene } from './ride'
export { bloomAt, type Climate, climateOf, dateLabel, type Flower, festivalsIn, seasonAt, weatherAt } from './season'
export { buildWorld, KIT_OF, kitOf, linksFrom, MAX_LANDMARKS, minutesOf, railKm, selectTowns, TOWN_RULES, type TownRule } from './towns'
export * from './types'
export { createWorld, GEN_VERSION, type GameWorld, type TravelOptions, type WorldOptions } from './world'
