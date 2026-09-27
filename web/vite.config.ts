import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// GitHub Pages 部署在 /hitomeguri/ 子路徑，由 workflow 設 VITE_BASE；本機與 Firebase Hosting 用 /。
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
  },
})
