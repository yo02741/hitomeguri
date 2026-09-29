import { prefectureFullName } from '../data/regions'

/**
 * 在 Google Maps 開啟一個景點：名稱＋縣名搜尋，讓 Google Maps 對到地點頁
 * （附座標反而只會落在座標點上）。Maps URLs：https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsUrl(name: string, pref: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${prefectureFullName(pref)}`)}`
}
