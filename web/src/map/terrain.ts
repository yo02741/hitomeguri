import maplibregl from 'maplibre-gl'

/**
 * 立體地形（DESIGN.md §8）：国土地理院の標高タイル（DEM10B、PNG、縮放 1–14）。
 * 地理院的 PNG 編碼（x = R·2¹⁶ + G·2⁸ + B；x < 2²³ 時 h = 0.01x，2²³ 為無資料，以上為負值）
 * MapLibre 讀不了，用自訂的 gsidem:// protocol 換成 terrarium 編碼（h + 32768 = R·256 + G + B/256）。
 * 海上沒有圖磚（404）或無資料的點當成 0 m。
 */
export const GSI_DEM_URL = 'https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'
export const GSI_ATTRIBUTION = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">標高：国土地理院</a>'
export const DEM_SOURCE = 'gsi-dem'

const SIZE = 256
let registered = false
let flat: ArrayBuffer | null = null

async function encode(img: ImageData): Promise<ArrayBuffer> {
  const canvas = new OffscreenCanvas(SIZE, SIZE)
  canvas.getContext('2d')!.putImageData(img, 0, 0)
  return (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()
}

/** 地理院的一格 → terrarium 的一格（就地改寫 RGBA） */
export function gsiToTerrarium(px: Uint8ClampedArray) {
  for (let i = 0; i < px.length; i += 4) {
    const x = px[i]! * 65536 + px[i + 1]! * 256 + px[i + 2]!
    const h = x < 8388608 ? x * 0.01 : x === 8388608 ? 0 : (x - 16777216) * 0.01
    const v = h + 32768
    px[i] = Math.floor(v / 256)
    px[i + 1] = Math.floor(v) % 256
    px[i + 2] = Math.floor((v - Math.floor(v)) * 256)
    px[i + 3] = 255
  }
}

async function flatTile(): Promise<ArrayBuffer> {
  if (flat) return flat
  const img = new ImageData(SIZE, SIZE)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128
    img.data[i + 3] = 255
  }
  flat = await encode(img)
  return flat
}

export function registerGsiDem() {
  if (registered) return
  registered = true
  maplibregl.addProtocol('gsidem', async (params, abort) => {
    const url = params.url.replace('gsidem://', 'https://')
    const res = await fetch(url, { signal: abort.signal }).catch(() => null)
    if (!res || !res.ok) return { data: await flatTile() }
    const bitmap = await createImageBitmap(await res.blob())
    const canvas = new OffscreenCanvas(SIZE, SIZE)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bitmap, 0, 0, SIZE, SIZE)
    const img = ctx.getImageData(0, 0, SIZE, SIZE)
    gsiToTerrarium(img.data)
    return { data: await encode(img) }
  })
}

const KEY = 'hm-terrain'
export function terrainPreferred(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
export function setTerrainPreferred(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    // 記不住只是下次要再按一次
  }
}
