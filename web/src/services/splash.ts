// 開場畫面的進度（畫面本身寫在 index.html，DESIGN.md §7.0）。
// 啟動時各模組用 trackSplash() 登記要等的工作，main.ts 掛載完呼叫 sealSplash()；
// 進度以 47 都道府縣的圓點表示：走到哪一縣就亮成該縣的地區色，一次亮一顆，不跳著亮。
// 全部完成後圓點走滿一圈，從圓心開洞露出畫面並移除。最少顯示 MIN_MS 避免一閃而過，最多等 MAX_MS。

const MIN_MS = 900
const MAX_MS = 10000
const FONT_MAX_MS = 4000
const BOOT = 30 // JS 接手前 CSS 動畫走到的進度（%）
const STEP_MS = 18 // 圓點一顆一顆亮的間隔
const EXIT_MS = 1100 // index.html 裡結束動畫最長的那段

const started = performance.now()
const el = typeof document !== 'undefined' ? document.getElementById('splash') : null
const dots = el ? Array.from(el.querySelectorAll<SVGElement>('.dot')) : []
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
let total = 0
let settled = 0
let sealed = false
let finishing = false
let finished = false
let lit = 0
let target = 0
let timer = 0
const pending = new Set<string>()
// 除錯：主控台輸入 __splashPending 看還在等哪些工作
;(globalThis as { __splashPending?: Set<string> }).__splashPending = pending

function progress(): number {
  if (finishing) return 100
  return total ? BOOT + ((100 - BOOT) * settled) / total : BOOT
}

function render() {
  if (!el) return
  const p = progress()
  el.setAttribute('aria-valuenow', String(Math.round(p)))
  target = Math.max(target, Math.round((p / 100) * dots.length))
  if (reduced) {
    while (lit < target) dots[lit++].classList.add('on')
    afterStep()
  } else if (!timer && lit < target) timer = window.setTimeout(step, 0)
}

// 一次亮一顆，追上目前的進度
function step() {
  timer = 0
  if (lit < target) dots[lit++].classList.add('on')
  if (lit < target) timer = window.setTimeout(step, STEP_MS)
  else afterStep()
}

function afterStep() {
  if (finishing && !finished && lit >= dots.length) exit()
}

if (el) {
  // 接手 CSS 的開場動畫：已經開始亮的圓點留著
  const booted = el
    .getAnimations?.({ subtree: true })
    .filter((a) => (a as CSSAnimation).animationName === 'splash-dot' && Number(a.currentTime ?? 0) > 0)
  lit = Math.min(booted?.length ?? 0, dots.length)
  for (let i = 0; i < lit; i++) dots[i].classList.add('on')
  el.classList.add('is-live')
  requestAnimationFrame(render)
  setTimeout(finish, MAX_MS)
}

function finish() {
  if (finishing || !el) return
  finishing = true
  render()
}

function exit() {
  if (finished || !el) return
  finished = true
  const wait = Math.max(0, MIN_MS - (performance.now() - started)) + 220
  setTimeout(() => {
    el.classList.add('is-done')
    setTimeout(() => el.remove(), EXIT_MS)
  }, wait)
}

function check() {
  render()
  if (sealed && settled >= total) finish()
}

/** 登記一件開場要等的工作（失敗也算完成）。開場結束後呼叫無作用。 */
export function trackSplash<T>(p: Promise<T>, label = ''): Promise<T> {
  if (!el || finishing) return p
  total++
  pending.add(label)
  render()
  p.finally(() => {
    pending.delete(label)
    settled++
    check()
  }).catch(() => {})
  return p
}

/** 啟動流程登記完畢：之後工作全部完成就結束開場。 */
export function sealSplash() {
  sealed = true
  check()
}

/** 網頁字型：preload 的樣式表套用後，等畫面上用到的字型載完 */
export function webfontsReady(): Promise<void> {
  const link = document.getElementById('webfonts') as HTMLLinkElement | null
  const sheetReady = new Promise<void>((resolve) => {
    if (!link || link.rel === 'stylesheet') return resolve()
    // 已經載完或失敗（事件在這段程式執行前就發生了）：資源時間紀錄裡會有這個網址
    if (performance.getEntriesByName(link.href).length) return resolve()
    link.addEventListener('load', () => resolve(), { once: true })
    link.addEventListener('error', () => resolve(), { once: true })
  })
  const loaded = sheetReady
    .then(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
    .then(() => document.fonts.ready)
    .then(() => {})
  // 字型服務很慢時不讓整個開場卡住
  return Promise.race([loaded, new Promise<void>((r) => setTimeout(r, FONT_MAX_MS))])
}
