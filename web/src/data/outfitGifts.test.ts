import { expect, test } from 'vitest'

import { giftOf, OUTFITS } from './outfits'

// outfitGifts.ts 由這個測試從 outfits.ts 產生：服裝改了就跑 `npx vitest run -u` 重寫，不手改。
// CI 不會寫檔，兩邊不一致時測試失敗。
const HEADER = `// 各縣的代表單品（DESIGN.md §7.24）：第一次去那個縣就送。
// 由 outfitGifts.test.ts 從 outfits.ts 產生（\`npx vitest run -u\`），不要手改。
// 景點面板只要 id，不必為此載入全部服裝的 SVG（outfitsPref.ts）。
`

test('outfitGifts.ts 與 outfits.ts 的代表單品一致', async () => {
  const prefs = [...new Set(OUTFITS.flatMap((o) => (o.pref ? [o.pref] : [])))]
  expect(prefs.length).toBe(47)
  const rows = prefs.map((p) => {
    const g = giftOf(p)
    expect(g, p).toBeDefined()
    return `  ${p}: '${g!.id}',`
  })
  const src = `${HEADER}export const PREF_GIFT_IDS: Readonly<Record<string, string>> = {\n${rows.join('\n')}\n}\n`
  await expect(src).toMatchFileSnapshot('./outfitGifts.ts')
})
