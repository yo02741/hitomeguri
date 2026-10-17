import { type Measure, unitMeasure } from './text'

/**
 * 遊戲介面的字：Google Fonts 的 DotGothic16，只在 /play 載入（跟 services/theme.ts 載年代字型一樣用 <link>）。
 * 中文缺字會落到 --font-sans（Noto Sans TC），沒關係。
 */
export const GAME_FONT = 'DotGothic16'
export const GAME_FONT_URL = 'https://fonts.googleapis.com/css2?display=swap&family=DotGothic16'
const LINK_ID = 'webfonts-game'

/** 加上 <link>（已經有就不加）；字型抓到或 1.5 秒後 resolve，永遠不 reject */
export function loadGameFont(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (!document.getElementById(LINK_ID)) {
    const link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    link.href = GAME_FONT_URL
    document.head.append(link)
  }
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts?.load) return Promise.resolve()
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 1500)
    fonts.load(`16px "${GAME_FONT}"`, 'あ').then(
      () => (clearTimeout(t), resolve()),
      () => (clearTimeout(t), resolve()),
    )
  })
}

/** canvas 用的字族：DotGothic16，後備是 --font-sans */
export function gameFontFamily(): string {
  let sans = ''
  try {
    sans = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim()
  } catch {
    // 讀不到就用系統的
  }
  return `"${GAME_FONT}", ${sans || 'sans-serif'}`
}

let ctx: CanvasRenderingContext2D | null | undefined

/** 量字寬（px）：canvas 的 measureText，跟畫面上同一套字型與後備；沒有 canvas 時估寬 */
export function canvasMeasure(fontPx: number): Measure {
  if (ctx === undefined) {
    try {
      ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
    } catch {
      ctx = null
    }
  }
  const c = ctx
  if (!c) return unitMeasure(fontPx)
  const font = `${fontPx}px ${gameFontFamily()}`
  const memo = new Map<string, number>()
  return (s) => {
    let w = memo.get(s)
    if (w === undefined) {
      c.font = font
      w = c.measureText(s).width
      memo.set(s, w)
    }
    return w
  }
}
