import { defineConfig } from 'vitest/config'

// 純函式的測試（services/*.test.ts）：不載入 Vue、PWA plugin
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
