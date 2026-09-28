// MapLibre 底圖。OpenFreeMap 免 key、免費；正式的自訂 style.json（DESIGN.md §8）於 Phase 1 處理。
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

// 日本全域的預設視野（UX-FLOW.md §1.3：無 activePref 時顯示日本地圖）。
export const JAPAN_CENTER: [number, number] = [137.5, 36.5]
export const JAPAN_ZOOM = 4.6

// 回到首頁時整個日本版圖（含沖繩）入鏡的範圍 [west, south, east, north]
export const JAPAN_BOUNDS: [number, number, number, number] = [123.0, 24.0, 146.0, 45.6]
