import { readFileSync } from 'node:fs'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

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
      return `<circle class="dot" cx="${x}" cy="${y}" r="4.2" style="--c0:${r.color.base};--i:${i}" />`
    })
    .join('')
  // 年代主題（DESIGN.md §13）：index.html 開頭先設好 data-theme，開場畫面也換成那個年代的顏色
  const themes = JSON.parse(readFileSync(new URL('./src/styles/theme-colors.json', import.meta.url), 'utf-8')) as Record<
    string,
    { national: Record<string, string>; regions: Record<string, Record<string, string>> }
  >
  const themeCss = Object.entries(themes)
    .map(([key, t]) => {
      const sel = `html[data-theme="${key}"] #splash`
      const c = t.national
      const dotsCss = regions.regions
        .map((r, i) => `${sel} .dot:nth-child(${i + 1}){--c:${t.regions[r.prefecture]!.base}}`)
        .join('')
      return (
        `${sel}{background:${c.paper};color:${c.ink}}${sel} .ring-track{stroke:${c.line}}` +
        `${sel} .dot:not(.on){fill:${c.line}}${sel} .kana,${sel} .latin{color:${c.sub}}` +
        dotsCss
      )
    })
    .join('\n')
  return {
    name: 'splash-colors',
    // pre：在 inline CSS 壓縮之前換掉佔位字
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        return html.replace('%SPLASH_DOTS%', dots).replace('%SPLASH_THEMES%', themeCss).replace(/%REGION_([A-Z_]+)%/g, (_, key: string) => {
          const v = color[key.toLowerCase()]
          if (!v) throw new Error(`index.html：regions.json 的全國色沒有 ${key.toLowerCase()}`)
          return v
        })
      },
    },
  }
}

// 離線（PWA，DESIGN.md §7.20）：app 本身預先快取；資料、地圖圖磚、字型、照片在用到時存下來。
// 資料 bundle 的網址帶版本（?v=），存了就不必再問；_index.json 先問網路、離線時用存的。
const nationalColor = (
  JSON.parse(readFileSync(new URL('../data/regions.json', import.meta.url), 'utf-8')) as {
    national: { color: Record<string, string> }
  }
).national.color
const DAY = 24 * 60 * 60
function pwa() {
  return VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    manifest: {
      name: 'ひとめぐり',
      short_name: 'ひとめぐり',
      description: '來一趟日本，才知道它有多大。',
      lang: 'zh-Hant-TW',
      display: 'standalone',
      start_url: '.',
      scope: '.',
      theme_color: nationalColor.header,
      background_color: nationalColor.paper,
      icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      // bundles/ 由下方依需要快取，不預先下載（全部約 40 MB）
      globIgnores: ['bundles/**', 'geo/**'],
      navigateFallback: 'index.html',
      navigateFallbackDenylist: [/^\/__/],
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.pathname.endsWith('/bundles/_index.json'),
          handler: 'NetworkFirst',
          options: { cacheName: 'hm-index', networkTimeoutSeconds: 4 },
        },
        {
          urlPattern: ({ url }) => url.pathname.includes('/bundles/') && url.searchParams.has('v'),
          handler: 'CacheFirst',
          options: { cacheName: 'hm-data', expiration: { maxEntries: 600, maxAgeSeconds: 90 * DAY } },
        },
        {
          urlPattern: ({ url }) => url.pathname.includes('/bundles/') || url.pathname.includes('/geo/'),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'hm-data-latest' },
        },
        {
          urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org' && url.pathname.startsWith('/styles/'),
          handler: 'StaleWhileRevalidate',
          options: { cacheName: 'hm-map-style' },
        },
        {
          urlPattern: ({ url }) => url.hostname === 'tiles.openfreemap.org',
          handler: 'CacheFirst',
          options: {
            cacheName: 'hm-map-tiles',
            expiration: { maxEntries: 6000, maxAgeSeconds: 60 * DAY },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
          handler: 'CacheFirst',
          options: {
            cacheName: 'hm-fonts',
            expiration: { maxEntries: 120, maxAgeSeconds: 365 * DAY },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        {
          urlPattern: ({ url }) => url.hostname === 'upload.wikimedia.org' || url.hostname === 'thumb.wikimedia.org',
          handler: 'CacheFirst',
          options: {
            cacheName: 'hm-photos',
            expiration: { maxEntries: 1500, maxAgeSeconds: 90 * DAY },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    },
  })
}

// GitHub Pages 部署在 /hitomeguri/ 子路徑，由 workflow 設 VITE_BASE；本機與 Firebase Hosting 用 /。
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [splashColors(), vue(), tailwindcss(), pwa()],
  build: {
    rolldownOptions: {
      output: {
        // 地圖引擎（maplibre-gl，約 276 KB gzip）自成一檔：app 改版時它的檔名不變，瀏覽器不必重新下載
        codeSplitting: { groups: [{ name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ }] },
      },
    },
  },
  server: {
    port: 5173,
    // 前端直接 import repo 根目錄的 data/regions.json
    fs: { allow: ['..'] },
  },
})
