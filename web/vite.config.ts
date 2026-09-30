import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

// index.html 的開場畫面在 CSS bundle 載入前就要顯示，不能用 token：
// 建置時把 %REGION_PAPER% 這類佔位字換成 data/regions.json 的全國色（不在原始碼寫死色碼），
// %SPLASH_DOTS% 換成 47 都道府縣的圓點（JIS 順、從正上方順時針排一圈，各縣的地區色）。
function splashColors(): Plugin {
  const regions = JSON.parse(readFileSync(new URL('../data/regions.json', import.meta.url), 'utf-8')) as {
    national: { color: Record<string, string> }
    regions: { prefecture: string; color: Record<string, string> }[]
  }
  const color = regions.national.color
  const n = regions.regions.length
  // 圓心 (92, 92)、半徑 86，與 index.html 的 svg 一致；svg 整個轉 -90°，角度 0 在正上方
  const dots = regions.regions
    .map((r, i) => {
      const a = (i / n) * 2 * Math.PI
      const x = (92 + 86 * Math.cos(a)).toFixed(2)
      const y = (92 + 86 * Math.sin(a)).toFixed(2)
      return `<circle class="dot" cx="${x}" cy="${y}" r="4.2" style="--c:${r.color.base};--i:${i}" />`
    })
    .join('')
  return {
    name: 'splash-colors',
    transformIndexHtml(html) {
      return html.replace('%SPLASH_DOTS%', dots).replace(/%REGION_([A-Z_]+)%/g, (_, key: string) => {
        const v = color[key.toLowerCase()]
        if (!v) throw new Error(`index.html：regions.json 的全國色沒有 ${key.toLowerCase()}`)
        return v
      })
    },
  }
}

// GitHub Pages 部署在 /hitomeguri/ 子路徑，由 workflow 設 VITE_BASE；本機與 Firebase Hosting 用 /。
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [splashColors(), vue(), tailwindcss()],
  server: {
    port: 5173,
    // 前端直接 import repo 根目錄的 data/regions.json
    fs: { allow: ['..'] },
  },
})
