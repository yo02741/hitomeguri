import { ref } from 'vue'

/**
 * 年代主題（DESIGN.md §13）：江戶、明治、大正、昭和、平成與令和（預設，<html> 不加 data-theme）。
 * <html data-theme="showa"> 換 token，各年代的地區色由 regions.css 產生。選擇存在這台裝置（localStorage）；
 * 網址加 ?theme=showa 也會切換並記住。index.html 的開頭在繪製前就先設好 data-theme，避免閃一下。
 */
export type Theme = 'edo' | 'meiji' | 'taisho' | 'showa' | 'heisei' | 'modern'

export interface Era {
  key: Theme
  label: string
  /** 西元年（約略） */
  years: string
  /** Google Fonts（只有選了才載入）；令和用 index.html 原本的字型。可變字型（Noto Serif TC、Chiron GoRound TC）寫字重範圍 `a..b`，CSS 比逐一列字重小三分之二，字型檔相同 */
  fonts?: string
}

const GF = 'https://fonts.googleapis.com/css2?display=swap&family='
export const ERAS: Era[] = [
  { key: 'edo', label: '江戶', years: '1603–1868', fonts: `${GF}LXGW+WenKai+TC:wght@400;700&family=Klee+One:wght@400;600&family=Yuji+Syuku` },
  {
    key: 'meiji',
    label: '明治',
    years: '1868–1912',
    fonts: `${GF}Noto+Serif+TC:wght@400..900&family=Shippori+Mincho:wght@400;700&family=Shippori+Mincho+B1:wght@800&family=IM+Fell+English+SC`,
  },
  {
    key: 'taisho',
    label: '大正',
    years: '1912–1926',
    fonts: `${GF}Noto+Serif+TC:wght@400..700&family=Zen+Old+Mincho:wght@400;700&family=Kaisei+Decol:wght@700&family=Chiron+Sung+HK:wght@900&family=Cormorant+SC:wght@600`,
  },
  {
    key: 'showa',
    label: '昭和',
    years: '1926–1989',
    fonts: `${GF}Dela+Gothic+One&family=DotGothic16&family=Huninn&family=Zen+Maru+Gothic:wght@500;700;900&family=Chiron+GoRound+TC:wght@900`,
  },
  {
    key: 'heisei',
    label: '平成',
    years: '1989–2019',
    fonts: `${GF}Chiron+GoRound+TC:wght@500..900&family=M+PLUS+Rounded+1c:wght@500;700;800&family=Mochiy+Pop+One&family=VT323`,
  },
  { key: 'modern', label: '令和', years: '2019–' },
]
const KEYS = new Set<string>(ERAS.map((e) => e.key))
export const eraOf = (t: Theme): Era => ERAS.find((e) => e.key === t) ?? ERAS[ERAS.length - 1]!

const KEY = 'hitomeguri:theme'

function initial(): Theme {
  try {
    const q = new URLSearchParams(location.search).get('theme')
    if (q && KEYS.has(q)) return q as Theme
    const s = localStorage.getItem(KEY)
    return s && KEYS.has(s) ? (s as Theme) : 'modern'
  } catch {
    return 'modern'
  }
}

export const theme = ref<Theme>(initial())

function loadFonts(t: Theme) {
  const url = eraOf(t).fonts
  const id = `webfonts-${t}`
  if (!url || document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = url
  document.head.append(link)
}

/** 時間軸打開時先把各年代的字型抓下來，拖過去時才不會先閃一下別的字 */
export function preloadThemeFonts() {
  for (const e of ERAS) loadFonts(e.key)
}

function apply(t: Theme) {
  const root = document.documentElement
  if (t === 'modern') delete root.dataset.theme
  else root.dataset.theme = t
  loadFonts(t)
}

function save(t: Theme) {
  try {
    if (t === 'modern') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    // 私密瀏覽等存不了：這次有效就好
  }
}

export function setTheme(t: Theme) {
  if (theme.value === t) return
  theme.value = t
  apply(t)
  save(t)
}

// 網址帶 ?theme= 打開的也記住
apply(theme.value)
save(theme.value)
