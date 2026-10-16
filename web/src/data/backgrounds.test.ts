import { expect, test } from 'vitest'

import { BG_OUTFITS } from './backgrounds'
import { BG_META } from './backgrounds/meta'
import { regions } from './regions'

// backgrounds/meta.ts 由這個測試從各區的背景產生：背景改了就跑 `npx vitest run -u` 重寫，不手改。
// CI 不會寫檔，兩邊不一致時測試失敗。
const HEADER = `// 地區背景的目錄（DESIGN.md §7.24b）：id、名稱、縣、稀有度。
// 由 backgrounds.test.ts 從 backgrounds/*.ts 產生（\`npx vitest run -u\`），不要手改。
// 扭蛋、衣櫃、規則只要這些；畫（SVG，原始碼約 600 KB）只在旅人頁要顯示背景時才載入（composables/bgArt.ts）。
`

test('backgrounds/meta.ts 與各區的背景一致', async () => {
  const rows = BG_OUTFITS.map((o) => `  { id: '${o.id}', name: '${o.name}', pref: '${o.pref}', rarity: ${o.rarity} },`)
  const src = `${HEADER}export const BG_META: ReadonlyArray<{ id: string; name: string; pref: string; rarity: 1 | 2 | 3 }> = [\n${rows.join('\n')}\n]\n`
  await expect(src).toMatchFileSnapshot('./backgrounds/meta.ts')
  expect(BG_META.map((m) => m.id)).toEqual(BG_OUTFITS.map((o) => o.id))
})

test('47 縣各 3 張，稀有度 1、2、3 各一張，id 是 bg-<縣>-…、不重複', () => {
  expect(new Set(BG_OUTFITS.map((o) => o.id)).size).toBe(BG_OUTFITS.length)
  for (const r of regions) {
    const mine = BG_OUTFITS.filter((o) => o.pref === r.prefecture)
    expect(mine.length, r.prefecture).toBe(3)
    expect(mine.map((o) => o.rarity).sort(), r.prefecture).toEqual([1, 2, 3])
    for (const o of mine) {
      expect(o.id.startsWith(`bg-${r.prefecture}-`), o.id).toBe(true)
      expect(o.slot).toBe('bg')
      expect(o.gift).toBeUndefined()
      expect(o.name.length, o.id).toBeGreaterThanOrEqual(2)
      expect(o.name, o.id).not.toMatch(/[!！]/)
    }
  }
  expect(BG_OUTFITS.length).toBe(regions.length * 3)
})

test('畫法：只用 token 顏色；不用漸層、defs、id、text、image（一頁同時有很多張）', () => {
  for (const o of BG_OUTFITS) {
    expect(o.svg, o.id).not.toMatch(/#[0-9a-fA-F]{3,8}\b(?!-)/)
    expect(o.svg, o.id).not.toMatch(/rgb\(|hsl\(|Gradient|<defs|\sid="|<text|<image|<use|<filter/)
    expect(o.svg.startsWith('<svg x="0" y="0" width="300" height="400" viewBox="0 0 300 400" overflow="hidden">'), o.id).toBe(true)
    // url() 只能是 DollDefs 的花紋
    for (const m of o.svg.matchAll(/url\(([^)]*)\)/g)) expect(m[1], o.id).toMatch(/^#doll-/)
  }
})
