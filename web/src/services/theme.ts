import { ref } from 'vue'

/**
 * 主題（DESIGN.md §13）：現代（預設）與昭和。<html data-theme="showa"> 切換 token，
 * 地區色的昭和版本由 regions.css 產生。選擇存在這台裝置（localStorage）；
 * 網址加 ?theme=showa 可以直接預覽。index.html 的開頭在繪製前就先設好 data-theme，避免閃一下。
 */
export type Theme = 'modern' | 'showa'

export const THEMES: Array<{ key: Theme; label: string }> = [
  { key: 'modern', label: '現代' },
  { key: 'showa', label: '昭和' },
]

const KEY = 'hitomeguri:theme'
// 昭和用的字型：只有選了才載入
const SHOWA_FONTS =
  'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=DotGothic16&family=Huninn&family=Zen+Maru+Gothic:wght@500;700;900&display=swap'

function initial(): Theme {
  try {
    const q = new URLSearchParams(location.search).get('theme')
    if (q === 'showa' || q === 'modern') return q
    return localStorage.getItem(KEY) === 'showa' ? 'showa' : 'modern'
  } catch {
    return 'modern'
  }
}

export const theme = ref<Theme>(initial())

function loadFonts(t: Theme) {
  if (t !== 'showa' || document.getElementById('webfonts-showa')) return
  const link = document.createElement('link')
  link.id = 'webfonts-showa'
  link.rel = 'stylesheet'
  link.href = SHOWA_FONTS
  document.head.append(link)
}

function apply(t: Theme) {
  const root = document.documentElement
  if (t === 'modern') delete root.dataset.theme
  else root.dataset.theme = t
  loadFonts(t)
}

export function setTheme(t: Theme) {
  theme.value = t
  apply(t)
  try {
    if (t === 'modern') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, t)
  } catch {
    // 私密瀏覽等存不了：這次有效就好
  }
}

apply(theme.value)
