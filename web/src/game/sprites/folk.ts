/**
 * 手畫的路人的 look id（sprites/index.ts 的 FOLK_STYLES）：世界生成、systems 挑路人的外觀都用這一份。
 * 不 import 畫圖的程式（世界生成只要名字）。
 */
export const FOLK_IDS = ['folk-a', 'folk-b', 'folk-c', 'folk-d', 'folk-e', 'folk-f', 'folk-g', 'folk-h', 'folk-i', 'folk-j', 'folk-k', 'folk-l'] as const
export type FolkId = (typeof FOLK_IDS)[number]

/** 種子 → 路人的外觀 */
export const folkOf = (seed: number): FolkId => FOLK_IDS[(seed >>> 0) % FOLK_IDS.length]!
