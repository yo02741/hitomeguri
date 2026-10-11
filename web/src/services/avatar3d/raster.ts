/**
 * 3D 旅人（DESIGN.md §7.24a）：把紙娃娃的 SVG 畫成點陣，當作 3D 模型的貼圖與形狀來源。
 * SVG 當圖片畫的時候讀不到頁面的 CSS：var(--…) 先換成算好的顏色，花紋（DollDefs 的 <pattern>）把 class 的樣式寫回屬性。
 */

/** 把 var(--x) 換成頁面上算好的值；local 是這隻娃娃自己的變數（--skin、--hair） */
export function resolveVars(svg: string, local: Record<string, string> = {}, depth = 0): string {
  const root = getComputedStyle(document.documentElement)
  return svg.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_m, name: string, fallback?: string) => {
    if (depth < 4 && local[name]) return resolveVars(local[name], local, depth + 1)
    // 字型清單的雙引號會把屬性截斷，換成單引號
    const v = root.getPropertyValue(name).trim().replace(/"/g, "'")
    return v || fallback?.trim() || 'currentColor'
  })
}

const STYLE_PROPS = ['fill', 'stroke', 'stroke-width', 'opacity', 'fill-opacity', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin']

/** DollDefs 的花紋（id 以 doll- 開頭），樣式寫回屬性後的字串；頁面上沒有 DollDefs 就是空的 */
export function patternDefs(): string {
  const out: string[] = []
  const seen = new Set<string>()
  document.querySelectorAll<SVGPatternElement>('pattern[id^="doll-"]').forEach((p) => {
    if (seen.has(p.id)) return
    seen.add(p.id)
    const clone = p.cloneNode(true) as SVGPatternElement
    const live = Array.from(p.querySelectorAll('*'))
    const copies = Array.from(clone.querySelectorAll('*'))
    live.forEach((el, i) => {
      const cs = getComputedStyle(el)
      const c = copies[i]!
      for (const prop of STYLE_PROPS) {
        const v = cs.getPropertyValue(prop)
        if (v) c.setAttribute(prop, v)
      }
      c.removeAttribute('class')
    })
    out.push(clone.outerHTML)
  })
  return out.join('')
}

export type ViewBox = [x: number, y: number, w: number, h: number]

/** SVG 片段畫成 canvas：viewBox 是紙娃娃的座標（240×320 的畫布），scale 是每個座標單位幾個像素 */
export async function rasterize(inner: string, vb: ViewBox, scale: number, defs = ''): Promise<HTMLCanvasElement> {
  const [x, y, w, h] = vb
  const W = Math.ceil(w * scale)
  const H = Math.ceil(h * scale)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${W}" height="${H}"><defs>${defs}</defs>${inner}</svg>`
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    // 之後要讀 alpha 算形狀：放在 CPU 上，getImageData 才快
    canvas.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, W, H)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}
