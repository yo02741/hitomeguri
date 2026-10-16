import { defineConfig } from 'vitest/config'

// 純函式的測試（services/*.test.ts、建置時畫圖示的 build/*.test.ts）：不載入 Vue、PWA plugin。
// theme.css 讓測試用 ?raw 讀得到（像素散步的調色盤檢查）
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts', 'build/**/*.test.ts'], css: { include: [/theme\.css/] } },
})
