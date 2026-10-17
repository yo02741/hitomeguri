/**
 * 你的旅人變像素人（規格 §7）。遊戲用 useTravellerSprites()；其他的給測試、預覽與 P2 的路人。
 * 流程與各步驟見 generate.ts；快取與 /about 的指標見 cache.ts。
 */
export { useTravellerSprites, type LookTarget, type TravellerInfo, type TravellerOptions, type TravellerSprites, type TravellerStatus } from './useTravellerSprites'
// generate.ts 用動態 import 拿（避開靜態的循環相依、import 時不碰 DOM）：這裡只匯出型別。
// 它跟遊戲其他的程式在同一個 game 分檔裡（第一次進 /play 就要用到，分開的話第一次多等一趟），載入時就在了。
export type { GenerateOptions, Generated } from './generate'
export { GEN_VERSION } from './version'
export { cacheKey, colourFingerprint, lookSignature, readPointer, travellerCache, writePointer, POINTER_PREFIX, DB_NAME, DB_STORE } from './cache'
export { travellerLook, buddyLook } from './looks'
// 路人的產生器（npc.ts）：systems 用動態 import 拿（generatedNpcs 預設關著），這裡不靜態匯出
export { ABOUT_SIZE, GAME_SIZE } from './geometry'
export { HELD, heldRule, BUDDY_FACING } from './held'
export type { GameRecord, WalkerRecord, RgbFrame, TravellerLook } from './types'
