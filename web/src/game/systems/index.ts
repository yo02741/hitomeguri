/**
 * 番外篇的系統（P2）：拍照、相簿、行李、店、印帳、房間、委託、台詞與地圖上的互動。入口是 installSystems（或 useGameSystems）。
 */
export { GameSystems, installSystems, type SystemsDeps } from './install'
export { useGameSystems } from './useGameSystems'
export { systemsFor } from './kinds'
export { DataIndex, bloomOf, distanceKm, kitOfPref, prefName, townCodeOfMap } from './data'
export { itemCard, type ItemCardData, itemKey } from './inventory'
export { scoreShot, slotOf, type ShotInput, type ShotScore } from './photo'
export { memoryPhotos, photoStore, setPhotoStore, loadThumb, downloadPhoto, type PhotoStore } from './photoStore'
export { stockOf, rotate, type Stock, type StockEntry } from './shop'
export { questFor, type QuestEnv } from './quests'
export { parseSystems, emptySystems, systemsOf, roomOf, SYSTEMS_VERSION, type SystemsSave, type PhotoSlot, SLOT_LABEL } from './state'
export type { Panel, PanelResult, PhotoResult, SystemsUi } from './ui'
export type * from './types'
