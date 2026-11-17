// 天氣（components/ClimateTable.vue）的小計算

/** 平年的每月天數（2 月取 28.25：10 年裡有閏年） */
const DAYS = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** 這個月有幾成的日子下雨（下雨天數 ÷ 當月天數，0–1） */
export function rainShare(month: number, rainDays: number): number {
  const d = DAYS[month - 1] ?? 30
  return Math.max(0, Math.min(1, rainDays / d))
}
