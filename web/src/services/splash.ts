// 開場畫面的進度（畫面本身寫在 index.html）。
// 啟動時各模組用 trackSplash() 登記要等的工作，main.ts 掛載完呼叫 sealSplash()；
// 全部完成後進度條走滿、淡出並移除。最少顯示 MIN_MS 避免一閃而過，最多等 MAX_MS。

const MIN_MS = 900
const MAX_MS = 10000
const FONT_MAX_MS = 4000
const BOOT = 30 // JS 接手前 CSS 動畫走到的進度（%）

const started = performance.now()
const el = typeof document !== 'undefined' ? document.getElementById('splash') : null
const fill = el?.querySelector<HTMLElement>('.fill') ?? null
let total = 0
let settled = 0
let sealed = false
let finished = false
const pending = new Set<string>()
// 除錯：主控台輸入 __splashPending 看還在等哪些工作
;(globalThis as { __splashPending?: Set<string> }).__splashPending = pending

function render() {
  if (!el || !fill) return
  const p = total ? BOOT + ((100 - BOOT) * settled) / total : BOOT
  fill.style.setProperty('--p', `${p}%`)
  el.setAttribute('aria-valuenow', String(Math.round(p)))
}

if (el) {
  // 接手 CSS 的開場動畫：從目前寬度繼續
  const current = fill ? (fill.getBoundingClientRect().width / (fill.parentElement?.clientWidth || 1)) * 100 : 0
  fill?.style.setProperty('--p', `${Math.max(current, 5)}%`)
  el.classList.add('is-live')
  requestAnimationFrame(render)
  setTimeout(finish, MAX_MS)
}

function finish() {
  if (finished || !el) return
  finished = true
  fill?.style.setProperty('--p', '100%')
  const wait = Math.max(0, MIN_MS - (performance.now() - started)) + 300
  setTimeout(() => {
    el.classList.add('is-done')
    el.addEventListener('transitionend', () => el.remove(), { once: true })
    setTimeout(() => el.remove(), 800)
  }, wait)
}

function check() {
  render()
  if (sealed && settled >= total) finish()
}

/** 登記一件開場要等的工作（失敗也算完成）。開場結束後呼叫無作用。 */
export function trackSplash<T>(p: Promise<T>, label = ''): Promise<T> {
  if (!el || finished) return p
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
