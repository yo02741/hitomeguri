// MapLibre 底圖。OpenFreeMap 免 key、免費；正式的自訂 style.json（DESIGN.md §8）於 Phase 1 處理。
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

// 地圖上的出處（DESIGN.md §8）：只留授權要求在地圖上標示的 OpenStreetMap（ODbL）與 OpenMapTiles（CC BY 4.0），
// 其他資料來源與授權在「資料來源」頁（/credits）。底圖 style 裡各 source 自帶的出處字串拿掉（MapView 的 transformStyle）。
export const MAP_ATTRIBUTION = [
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>',
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a>',
]

// 日本全域的預設視野（UX-FLOW.md §1.3：無 activePref 時顯示日本地圖）。
export const JAPAN_CENTER: [number, number] = [137.5, 36.5]
export const JAPAN_ZOOM = 4.6

// 回到首頁時整個日本版圖（含沖繩）入鏡的範圍 [west, south, east, north]
export const JAPAN_BOUNDS: [number, number, number, number] = [123.0, 24.0, 146.0, 45.6]

// 市区町村界（縣地圖的區界、清單的地區）：国土数値情報 N03（CC BY 4.0／公共データ利用規約 第1.0版）要標示出處。
// 只在畫了區界的地圖（縣地圖）加進出處；完整的出典標示在「資料來源」頁（CreditsView.vue）。網址跟著資料的年度（N03-2026）
export const N03_URL = 'https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html'
export const N03_ATTRIBUTION = `<a href="${N03_URL}" target="_blank" rel="noopener" lang="ja">「国土数値情報（行政区域データ）」（国土交通省）</a>`
