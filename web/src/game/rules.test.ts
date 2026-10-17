import { describe, expect, it } from 'vitest'

// 番外篇的規則（規格 §0）：程式裡不寫色碼（canvas 只用 --color-px-* token，DOM 用 token 或 var(--color-px-*)）

/** 色碼（3–8 位）、rgb()、hsl()、oklch() */
const COLOR = /#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/
/** 具名的顏色（只看 CSS 的 color、background、border、fill、stroke 這些屬性的值；white-space 之類、var(--color-px-white) 不算） */
const NAMED = /(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-[a-z]+)?-?color|border|outline|fill|stroke|box-shadow|text-shadow)\s*:\s*[^;}]*\b(?:white|black|red|blue|green|gray|grey|yellow|orange|pink|purple)\b/
/** CSS 的部分：.css 整個、.vue 的 <style>；var(…) 拿掉（token 的名字裡有 white） */
const cssOf = (f: string, src: string) =>
  (f.endsWith('.css') ? src : f.endsWith('.vue') ? [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n') : '').replace(/var\([^)]*\)/g, '')

describe('番外篇不寫死色碼', () => {
  const files = {
    ...(import.meta.glob(['./**/*.ts', './**/*.vue', '!./**/*.test.ts', '!./fixtures/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
    ...(import.meta.glob(['../views/PlayView.vue', '../components/game/**/*.{vue,ts,css}', '!../components/game/**/*.test.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  }

  it('web/src/game、PlayView、components/game（.ts、.vue、.css）沒有色碼、rgb()、hsl()、具名的顏色', () => {
    expect(Object.keys(files).length).toBeGreaterThan(10)
    expect(Object.keys(files).some((f) => f.endsWith('gba.css'))).toBe(true)
    expect(Object.keys(files).some((f) => f.endsWith('systems/pixel.ts'))).toBe(true)
    for (const [f, src] of Object.entries(files)) {
      expect(src, f).not.toMatch(COLOR)
      expect(cssOf(f, src), f).not.toMatch(NAMED)
    }
  })

  it('檢查本身擋得到（三位數色碼、具名的顏色）', () => {
    expect('.a { color: #fff; }').toMatch(COLOR)
    expect('.a { background: #0008 }').toMatch(COLOR)
    expect('.a { color: white; }').toMatch(NAMED)
    expect('.a { white-space: nowrap; }').not.toMatch(NAMED)
    expect(cssOf('a.css', '.a { color: var(--color-px-white); }')).not.toMatch(NAMED)
    expect(cssOf('a.vue', '<style>.a { border: 1px solid black }</style>')).toMatch(NAMED)
  })
})

// 規格 §1：整個遊戲進 /play 才下載，PWA 不預先快取（遊戲、畫面、3D 旅人的 three.js）。
// 讀 vite.config.ts 的原文檢查分檔與 globIgnores（改設定時這裡會擋下來）
describe('番外篇的分檔與預先快取', () => {
  const cfg = Object.values(import.meta.glob('../../vite.config.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0] ?? ''
  /** codeSplitting 裡某一組的 test 正規式 */
  const groupTest = (name: string) => {
    const m = cfg.match(new RegExp(`name: '${name}', test: /(.+?)/, includeDependenciesRecursively: false`))
    expect(m, `vite.config.ts 要有不抓相依的 ${name} 分檔`).toBeTruthy()
    return new RegExp(m![1]!)
  }
  it('game 分檔只抓 src/game/；畫面跟著 /play 的路由', () => {
    const t = groupTest('game')
    expect(t.test('/w/web/src/game/engine/game.ts')).toBe(true)
    expect(t.test('/w/web/src/game/avatar/useTravellerSprites.ts')).toBe(true)
    expect(t.test('/w/web/src/components/game/DialogBox.vue')).toBe(false)
    expect(t.test('/w/web/src/stores/avatar.ts')).toBe(false)
  })
  it('three.js 與 3D 建模併進 Avatar3D（旅人頁的展示窗與遊戲的旅人側面共用，不另外拆一檔被預先快取）', () => {
    const t = groupTest('Avatar3D')
    expect(t.test('/w/web/node_modules/three/build/three.module.js')).toBe(true)
    expect(t.test('/w/web/src/services/avatar3d/avatar.ts')).toBe(true)
    expect(t.test('/w/web/src/services/avatar3d/inflate.ts')).toBe(true)
    // OrbitControls（three/examples）只有旅人頁的展示窗用：跟 Avatar3D.vue 自己一檔，遊戲不必下載
    expect(t.test('/w/web/node_modules/three/examples/jsm/controls/OrbitControls.js')).toBe(false)
    // 2D 的紙娃娃（raster）不進 3D 那一檔
    expect(t.test('/w/web/src/services/avatar3d/raster.ts')).toBe(false)
  })
  it('PWA 不預先快取 game、PlayView、Avatar3D', () => {
    const line = cfg.split('\n').find((l) => l.includes('globIgnores:')) ?? ''
    for (const g of ["'**/game-*.js'", "'**/PlayView-*'", "'**/Avatar3D-*.js'", "'**/pxcore-*.js'"]) expect(line, g).toContain(g)
  })
})
