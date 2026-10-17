import type { Facing } from './types'

/**
 * 單品規則表（規格 §7）：手上的東西在像素畫裡怎麼拿。沒寫的就是「拿在右手」（照紙娃娃畫在手上）。
 * - overhead：傘類。紙娃娃的傘斜斜舉在頭旁邊，縮小後會變成臉旁邊一塊色塊，改成頭頂的疊加 sprite（像 pixelwalk 的 UMBRELLA），
 *   顏色取這把傘自己的顏色。正面、背面、側面都是同一把傘蓋在頭上。
 * - behind：舉得比肩膀高的東西（羽子板、風車、杖、燈籠…）。chibi 的頭放大了，照原本的順序會擋住臉，改畫在頭的後面。
 * 新增手上的單品時：舉過肩膀（圖示範圍的上緣 y < 150）的要寫進來，名字有「傘」的要是 overhead（held.test.ts 會檢查）。
 */
export type HeldRule = 'hand' | 'behind' | 'overhead'

export const HELD: Readonly<Record<string, HeldRule>> = {
  // 傘
  wagasa: 'overhead',
  'clear-umbrella': 'overhead',
  'tottori-shanshan': 'overhead',
  // 舉過肩膀的
  hagoita: 'behind',
  kazaguruma: 'behind',
  'achv-shiki-sensu': 'behind',
  'achv-kongozue': 'behind',
  'aomori-kingyo': 'behind',
  'gunma-yumomi': 'behind',
  'gunma-yakimanju': 'behind',
  'gunma-shimonita': 'behind',
  'niigata-sake': 'behind',
  'hiroshima-shamoji': 'behind',
  'hiroshima-kumanofude': 'behind',
  'yamaguchi-fukuchochin': 'behind',
  'hokkaido-corn': 'behind',
  'yamagata-tamakon': 'behind',
  'fukushima-negisoba': 'behind',
  'shiga-otsue': 'behind',
  'osaka-kushikatsu': 'behind',
  'wakayama-herazao': 'behind',
  'tokushima-ningyo': 'behind',
  'tokushima-takechikuwa': 'behind',
  'okinawa-sanshin': 'behind',
  'aichi-tezutsu': 'behind',
  'shizuoka-wasabi': 'behind',
  'kumamoto-banpeiyu': 'behind',
}

export const heldRule = (id: string | undefined): HeldRule => (id ? (HELD[id] ?? 'hand') : 'hand')

/**
 * 夥伴的 2D 圖朝哪邊（走路時左右翻用）。沒寫的是 front（正面、左右對稱的：招財貓、達摩…），
 * 往左走的時候照樣翻一次，看起來是轉了身。朝左畫的寫 left、朝右畫的寫 right。
 */
export const BUDDY_FACING: Readonly<Record<string, Facing>> = {
  // 頭朝左畫的
  koinobori: 'left',
  tancho: 'left',
  'hokkaido-bear': 'left',
  'fukushima-akabeko': 'left',
  'ibaraki-anko': 'left',
  'niigata-koi': 'left',
  'toyama-raicho': 'left',
  'fukui-dino': 'left',
  'mie-ebi': 'left',
  'hyogo-kounotori': 'left',
  'nara-deer': 'left',
  'wakayama-yatagarasu': 'left',
  'yamaguchi-fugu': 'left',
  'kochi-katsuo': 'left',
  sparrow: 'left',
  turtle: 'left',
  duck: 'left',
  hedgehog: 'left',
  'inu-hariko': 'left',
  'katori-buta': 'left',
  'sea-otter': 'left',
  // 頭朝右畫的
  'aomori-yawata': 'right',
  pigeon: 'right',
  snail: 'right',
  'sea-bream': 'right',
}

export const buddyFacing = (id: string | undefined): Facing => (id ? (BUDDY_FACING[id] ?? 'front') : 'front')
