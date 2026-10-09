// 開場畫面的進度（畫面本身寫在 index.html，DESIGN.md §7.0）。
// 啟動時各模組用 trackSplash() 登記要等的工作，main.ts 掛載完呼叫 sealSplash()；
// 進度以 47 都道府縣的圓點表示：走到哪一縣就亮成該縣的地區色，一次亮一顆，不跳著亮。
// 全部完成後圓點走滿一圈，從圓心開洞露出畫面並移除。最少顯示 MIN_MS 避免一閃而過，最多等 MAX_MS。
// 看過完整版的人（SEEN_KEY）是短版：index.html 開頭設 <html data-splash="short">，圓點一開始就全亮，
// 工作完成就直接淡出（SHORT_EXIT_MS），不補點、不停留。減少動態的人不走短版，維持原樣。

const MIN_MS = 900
const MAX_MS = 10000
const FONT_MAX_MS = 4000
const BOOT = 30 // JS 接手前 CSS 動畫走到的進度（%）
const STEP_MS = 18 // 圓點一顆一顆亮的間隔
const EXIT_MS = 1100 // index.html 裡結束動畫最長的那段
const SHORT_EXIT_MS = 500 // 短版的淡出（index.html 的 html[data-splash="short"]）
const SEEN_KEY = 'hitomeguri:splash-seen'

const started = performance.now()
const el = typeof document !== 'undefined' ? document.getElementById('splash') : null
const dots = el ? Array.from(el.querySelectorAll<SVGElement>('.dot')) : []
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const short = !reduced && typeof document !== 'undefined' && document.documentElement.dataset.splash === 'short'
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
  if (short) return
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
  if (short) exit()
}

// 開場畫面拿掉之後才做的事（例如註冊 service worker，不和首次載入搶頻寬）
const after: Array<() => void> = []
let gone = !el

function exit() {
  if (finished || !el) return
  finished = true
  const wait = short ? 0 : Math.max(0, MIN_MS - (performance.now() - started)) + 220
  setTimeout(() => {
    el.classList.add('is-done')
    setTimeout(() => {
      el.remove()
      gone = true
      if (short) delete document.documentElement.dataset.splash
      else markSeen()
      after.splice(0).forEach((fn) => fn())
    }, short ? SHORT_EXIT_MS : EXIT_MS)
  }, wait)
}

// 完整版播完才記下來：第一次中途關掉的人，下次還是看完整版
function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // 私密瀏覽、封鎖網站資料：下次照樣播完整版
  }
}

/** 開場畫面拿掉之後執行（沒有開場畫面或已經拿掉時馬上執行） */
export function afterSplash(fn: () => void) {
  if (gone) fn()
  else after.push(fn)
}

function check() {
  render()
  if (sealed && settled >= total) finish()
}

/** 開場畫面還蓋著（還沒開始退場）：這時的地圖移動不必播動畫，反正看不到 */
export function splashCovering(): boolean {
  return Boolean(el) && !finished
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

/** 網頁字型：preload 的樣式表（index.html 的 link[data-webfonts]）都套用後，等畫面上用到的字型載完 */
export function webfontsReady(): Promise<void> {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[data-webfonts]'))
  const sheetReady = Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.rel === 'stylesheet') return resolve()
          // 已經載完或失敗（事件在這段程式執行前就發生了）：資源時間紀錄裡會有這個網址
          if (performance.getEntriesByName(link.href).length) return resolve()
          link.addEventListener('load', () => resolve(), { once: true })
          link.addEventListener('error', () => resolve(), { once: true })
        }),
    ),
  )
  const loaded = sheetReady
    .then(() => new Promise<void>((r) => requestAnimationFrame(() => r())))
    .then(() => document.fonts.ready)
    .then(() => {})
  // 字型服務很慢時不讓整個開場卡住
  return Promise.race([loaded, new Promise<void>((r) => setTimeout(r, FONT_MAX_MS))])
}
