import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'

// index.html 的開場畫面在 CSS bundle 載入前就要顯示，不能用 token：
// 建置時把 %REGION_PAPER% 這類佔位字換成 data/regions.json 的全國色（不在原始碼寫死色碼）。
function splashColors(): Plugin {
  const regions = JSON.parse(readFileSync(new URL('../data/regions.json', import.meta.url), 'utf-8')) as {
    national: { color: Record<string, string> }
  }
  const color = regions.national.color
  return {
    name: 'splash-colors',
    transformIndexHtml(html) {
      return html.replace(/%REGION_([A-Z_]+)%/g, (_, key: string) => {
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
