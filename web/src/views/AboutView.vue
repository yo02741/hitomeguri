<script setup lang="ts">
import { computed, type Directive, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import AchvSeal from '../components/AchvSeal.vue'
import JapanMap from '../components/JapanMap.vue'
import OverlayScrollbar from '../components/OverlayScrollbar.vue'
import PrefStamp from '../components/PrefStamp.vue'
import RegionMotif from '../components/RegionMotif.vue'
import SpeakButton from '../components/SpeakButton.vue'
import SpotCard from '../components/SpotCard.vue'
import Wordmark from '../components/Wordmark.vue'
import { ACHIEVEMENTS } from '../data/achievements'
import { regionOf, regions } from '../data/regions'
import { cardFromMapSpot, cardNumberOf, type CardFace, isLandscapeCard } from '../services/card'
import { allVariants, BASE_VARIANT, seasonVariant, type Variant } from '../services/cardVariants'
import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { commonsThumb } from '../services/commons'
import { ERAS, preloadThemeFonts, setTheme, theme, type Theme } from '../services/theme'
import { useCatalogStore } from '../stores/catalog'
import themeColors from '../styles/theme-colors.json'

// 形象網站（使用者決定 2026-10-11；第二版同日）：這個網站能做什麼、一趟旅行怎麼用、資料從哪裡來。
// 不顯示 app 的標頭與分頁列（路由 meta.bare）。畫面用網站本身的元件（日本地圖、收集卡、紀念章），不放截圖；
// 數字與例子都是現在的資料（景點、車站、鐵路距離取自 data/，2026-10-11）。文案照 PLAN.md §6a：短、具體、不用驚嘆號。
const catalog = useCatalogStore()

// ---- 海報：全版輪播的日本風景，由北海道到沖繩走一圈（DESIGN.md §14） ----
// 照片是各景點資料裡的 Commons 照片（data/spots），作者與授權照原樣寫在右下角
interface Slide {
  id: string
  pref: string
  name: string
  /** Commons 縮圖網址，顯示時換成需要的寬度 */
  image: string
  author: string
  license: string
  source: string
  /** 手機直的畫面裁切時保留的位置（object-position） */
  focus: string
}
const SLIDES: Slide[] = [
  {
    id: 'wd-Q713619',
    pref: 'hokkaido',
    name: '羊蹄山',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/c7/Yotei-zan-from-hirafu.jpg/960px-Yotei-zan-from-hirafu.jpg',
    author: 'Oga',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Yotei-zan-from-hirafu.jpg',
    focus: '50% 40%',
  },
  {
    id: 'wd-Q1144855',
    pref: 'miyagi',
    name: '松島',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/9/94/Miyagi-Landscape_of_cherry_blossoms_and_Matsushima_Bay-xl.jpg/960px-Miyagi-Landscape_of_cherry_blossoms_and_Matsushima_Bay-xl.jpg',
    author: 'Makoto_Lab',
    license: 'CC BY 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:Miyagi-Landscape_of_cherry_blossoms_and_Matsushima_Bay-xl.jpg',
    focus: '50% 50%',
  },
  {
    id: 'wd-Q615183',
    pref: 'tokyo',
    name: '淺草寺',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Sensoji_at_night.JPG/960px-Sensoji_at_night.JPG',
    author: 'Kakidai',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Sensoji_at_night.JPG',
    focus: '58% 50%',
  },
  {
    id: 'wd-Q1002193',
    pref: 'gifu',
    name: '白川鄉',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/50/A_world_heritage_SIRAKAWAGOU_JPN_2010.jpg/960px-A_world_heritage_SIRAKAWAGOU_JPN_2010.jpg',
    author: 'Masaki ikeda 池田正樹',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:A_world_heritage_SIRAKAWAGOU_JPN_2010.jpg',
    focus: '45% 50%',
  },
  {
    id: 'wd-Q714828',
    pref: 'kyoto',
    name: '伏見稻荷大社',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/1/16/KyotoFushimiInariLarge.jpg/960px-KyotoFushimiInariLarge.jpg',
    author: 'Paul Vlaar',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:KyotoFushimiInariLarge.jpg',
    focus: '42% 50%',
  },
  {
    id: 'wd-Q191763',
    pref: 'hiroshima',
    name: '嚴島神社',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0e/Itsukushima_Gate.jpg/960px-Itsukushima_Gate.jpg',
    author: 'JordyMeow',
    license: 'CC BY-SA 3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Itsukushima_Gate.jpg',
    focus: '38% 50%',
  },
  {
    id: 'wd-Q2027215',
    pref: 'miyazaki',
    name: '高千穂峽',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/2/28/Takachiho-kyo%28Gorge%29_-_River_-_%E5%B7%9D.jpg/960px-Takachiho-kyo%28Gorge%29_-_River_-_%E5%B7%9D.jpg',
    author: 'TANAKA Juuyoh (田中十洋)',
    license: 'CC BY 2.0',
    source: 'https://commons.wikimedia.org/wiki/File:Takachiho-kyo(Gorge)_-_River_-_%E5%B7%9D.jpg',
    focus: '60% 50%',
  },
  {
    id: 'wd-Q2654598',
    pref: 'okinawa',
    name: '川平灣',
    image: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8e/Kabira_Bay_Ishigaki_Island40bs3s4592.jpg/960px-Kabira_Bay_Ishigaki_Island40bs3s4592.jpg',
    author: '663highland',
    license: 'CC BY 2.5',
    source: 'https://commons.wikimedia.org/wiki/File:Kabira_Bay_Ishigaki_Island40bs3s4592.jpg',
    focus: '45% 50%',
  },
]
const srcsetOf = (url: string) => ([960, 1280, 1920] as const).map((w) => `${commonsThumb(url, w)} ${w}w`).join(', ')
const prefName = (pref: string) => regionOf(pref)?.name.zh_tw ?? ''

// 標語（DESIGN.md §1）
const TAGLINE = '把日本走一圈。'

// 輪播：每張 7 秒，交叉淡入。可以暫停（WCAG 2.2.2）；減少動態的人一開始就是暫停的。
// 分頁在背景、海報捲出畫面時也先停，回來再接著跑。照片只載入看過的與下一張
const DURATION = 7000
const cur = ref(0)
const prev = ref(-1)
const cycle = ref(0)
const userPaused = ref(false)
const away = ref(false)
const paused = computed(() => userPaused.value || away.value)
const mounted = ref(new Set([0, 1]))
let timer = 0
let startedAt = 0
let remaining = DURATION

function go(i: number) {
  const n = SLIDES.length
  const next = (i + n) % n
  if (next === cur.value) return
  prev.value = cur.value
  cur.value = next
  cycle.value++
  mounted.value = new Set([...mounted.value, next, (next + 1) % n])
  remaining = DURATION
  schedule()
}
function schedule() {
  window.clearTimeout(timer)
  timer = 0
  if (paused.value || !started) return
  startedAt = performance.now()
  timer = window.setTimeout(() => go(cur.value + 1), remaining)
}
function hold() {
  if (!timer) return
  window.clearTimeout(timer)
  timer = 0
  remaining = Math.max(0, remaining - (performance.now() - startedAt))
}
watch(paused, (p) => (p ? hold() : schedule()))
function togglePause() {
  userPaused.value = !userPaused.value
}
function onVisibility() {
  away.value = document.hidden || !heroVisible
}
let heroVisible = true
const heroEl = ref<HTMLElement | null>(null)

let heroObserver: IntersectionObserver | null = null
// 照片載好才淡入；還沒載好時上一張留著，不會閃一下底色
const loaded = ref(new Set<number>())
// 第一張載好才開始計時（開場畫面、慢的網路不會把第一張的時間吃掉）
let started = false
let startFallback = 0
function startTimer() {
  if (started) return
  started = true
  window.clearTimeout(startFallback)
  schedule()
}
function onSlideLoad(i: number) {
  loaded.value = new Set([...loaded.value, i])
  startTimer()
}
// 手機左右滑換張
let touchX = 0
let touchY = 0
function onTouchStart(e: TouchEvent) {
  touchX = e.touches[0]!.clientX
  touchY = e.touches[0]!.clientY
}
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0]!.clientX - touchX
  const dy = e.changedTouches[0]!.clientY - touchY
  if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur.value + (dx < 0 ? 1 : -1))
}

// ---- 捲動：海報往下捲時文字淡出、照片慢一點跟著走（視差）；下面各段進到畫面時淡入 ----
// 捲動的是 App.vue 的 <main>。只動 opacity 與 transform；減少動態時都不做
const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
let scroller: HTMLElement | null = null
let scrollRaf = 0
function onScroll() {
  if (scrollRaf) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const hero = heroEl.value
    if (!hero || !scroller) return
    const p = Math.min(1, Math.max(0, scroller.scrollTop / (hero.offsetHeight || 1)))
    hero.style.setProperty('--p', p.toFixed(3))
  })
}
function scrollToFlow() {
  document.getElementById('flow')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
}

let revealIO: IntersectionObserver | null = null
function revealObserver(): IntersectionObserver {
  revealIO ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('is-in')
        revealIO!.unobserve(e.target)
      }
    },
    { root: document.getElementById('app-main'), rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  )
  return revealIO
}
/** v-reveal="n"：進到畫面時淡入，n 是同一組裡的順序（每個晚 80ms）。淡入完拿掉 class，之後的 hover、按下不受影響；.keep 留著（給子元素用的） */
const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, { value, modifiers }) {
    if (reduceMotion || !('IntersectionObserver' in window)) return
    el.classList.add('reveal')
    if (value) el.style.setProperty('--d', String(value))
    if (!modifiers.keep) {
      el.addEventListener('transitionend', function done(ev) {
        if (ev.target !== el || !el.classList.contains('is-in')) return
        el.classList.remove('reveal', 'is-in')
        el.style.removeProperty('--d')
        el.removeEventListener('transitionend', done)
      })
    }
    revealObserver().observe(el)
  },
  unmounted(el) {
    revealIO?.unobserve(el)
  },
}

// 明朝體只有這一頁用，打開時才載入
const BRAND_FONT = 'https://fonts.googleapis.com/css2?display=swap&family=Noto+Serif+TC:wght@500..900'
function loadBrandFont() {
  if (document.getElementById('webfonts-brand')) return
  const link = document.createElement('link')
  link.id = 'webfonts-brand'
  link.rel = 'stylesheet'
  link.href = BRAND_FONT
  document.head.append(link)
}

const STATS = { prefs: 47, spots: '17,904', stations: '8,661', festivals: '1,014', airports: 32 }
const north = regions[0]!.name.zh_tw
const south = regions[regions.length - 1]!.name.zh_tw

const POINTS = [
  { title: '一縣一色', text: '47 縣各有地區色與和風紋樣。進到哪一縣，整個畫面就換成那一縣的顏色，看得出自己在哪裡，也記得住去過哪裡。' },
  { title: '每一筆都有出處', text: '簡介取自維基百科，座標取自 Wikidata 與 OpenStreetMap，花期取自氣象廳。找不到來源的就留空，不另外編寫。' },
  { title: '念得出來', text: '地名、站名附假名與羅馬拼音，按一下就聽得到日文。出發前把這趟會遇到的念法整理成卡片。' },
  { title: '從找地方到回憶', text: '探索、排行程、旅前準備、旅途中、回來之後的紀錄，接在同一個地方，不用在幾個 App 之間抄來抄去。' },
]

// ---- 能做什麼（頁籤） ----
const TABS = [
  { key: 'explore', label: '探索' },
  { key: 'trip', label: '行程' },
  { key: 'prep', label: '旅前準備' },
  { key: 'log', label: '紀錄' },
  { key: 'cards', label: '收集卡' },
] as const
type TabKey = (typeof TABS)[number]['key']
const tab = ref<TabKey>('explore')
const tabEls = ref<HTMLButtonElement[]>([])
function onTabKey(e: KeyboardEvent, i: number) {
  const n = TABS.length
  const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i - 1 + n) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
  if (next < 0) return
  e.preventDefault()
  tab.value = TABS[next]!.key
  void nextTick(() => tabEls.value[next]?.focus())
}
/** 流程的某一步：切到對應的頁籤並捲過去 */
function showTab(k: TabKey) {
  tab.value = k
  void nextTick(() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

const FEATURES: Record<TabKey, { title: string; lines: string[] }> = {
  explore: {
    title: '先找地方',
    lines: [
      '選一個縣，地圖與清單只看這一縣；縣裡再分到市區町村，東京的台東區、京都的東山區。',
      '景點依類型分：寺社、城・史跡、博物館、自然、島・海岸、購物・市場、娛樂、機場。',
      '擴充包疊在地圖上：寶可夢人孔蓋、日本百名城、老舖・茶屋、角色商店。',
      '深度探索：花期月曆、祭典、地區特色、期間限定。',
      '漢字、假名、羅馬拼音都搜得到：「いっぽど」「ippodo」「一保堂」。',
    ],
  },
  trip: {
    title: '再排每一天',
    lines: [
      '從景點卡片加入行程，放進某一天或先放待排；同一個機場可以排在第一天和最後一天。',
      '拖曳排順序，一天的路線直接用 Google Maps 打開。',
      '設定每天住在哪個車站，列出當天來回得了的地方，依鐵路距離分段，標出能不能搭新幹線。',
      '和旅伴共編，各自的手機即時同步。',
      '匯出 KML、CSV；下載離線用之後，沒有網路也打得開。',
    ],
  },
  prep: {
    title: '出發前準備念法',
    lines: [
      '這趟會去的地名、站名，附假名、羅馬拼音與日文發音。',
      '會話分「聽」「說」「讀」，翻卡練習；每一句附出處。',
      '地區特色：這幾縣的郷土料理、名產、茶。',
      '旅前小書：整理成 A5 或 A4，列印或存成 PDF 帶著走。',
    ],
  },
  log: {
    title: '回來之後',
    lines: [
      '去過的地方蓋上日期，地圖上一縣一縣塗滿。',
      '紀念章帳：47 縣的初訪章，加上 40 個成就。',
      '行程結束開卡包，看這趟的成就，做一張回顧圖分享。',
    ],
  },
  cards: {
    title: '一個地方，一疊卡',
    lines: [
      '基本：按下去過就有。',
      '春景・夏景・秋景・冬景：去的那一季；沒去過的季節用抽獎券抽。',
      '全景：排在已結束的行程裡。',
      '夜景、切手、墨繪：晚上去過、蓋了紀念章或寄了明信片、拿到御朱印或寫了旅日記。',
      '特別全景：其他都收齊之後才有，印著去過的日期與那趟旅行。',
    ],
  },
}

// ---- 探索：京都的清單與擴充包（地圖 bundle 的資料） ----
const kyoto = shallowRef<MapSpot[]>([])
const kyotoTop = computed(() =>
  [...kyoto.value]
    .filter((s) => s.f === 1 && s.i)
    .sort((a, b) => b.s - a.s)
    .slice(0, 4),
)
const PACK_CHIPS = [
  { label: '寶可夢', n: 10, color: 'pokemon' },
  { label: '城', n: 2, color: 'castle' },
  { label: '老舖・茶屋', n: 19, color: 'shinise' },
  { label: '角色商店', n: 6, color: 'chara' },
]

// ---- 行程：住在京都時的單日來回（data/rail 的鐵路距離） ----
const DAY = [
  { day: 'DAY 1', date: '11/18（二）', stops: ['清水寺', '八坂神社', '伏見稲荷大社'] },
  { day: 'DAY 2', date: '11/19（三）', stops: ['鹿苑寺', '龍安寺', '嵐山'] },
]
const BANDS = [
  { label: '鐵路 60 km 內', rows: [['宇治', 13], ['奈良', 36], ['大阪', 42]] },
  { label: '60–150 km', rows: [['彦根', 61], ['天橋立', 121], ['伊勢市', 131]] },
  { label: '新幹線', rows: [['姫路', 124], ['名古屋', 134]] },
] as const

// ---- 旅前準備：地名與會話（phrases bundle） ----
const NAMES = [
  { ja: '清水寺', kana: 'きよみずでら', romaji: 'KIYOMIZU-DERA' },
  { ja: '伏見稲荷大社', kana: 'ふしみいなりたいしゃ', romaji: 'FUSHIMI INARI TAISHA' },
  { ja: '京都駅', kana: 'きょうとえき', romaji: 'KYŌTO-EKI' },
]
const PHRASE_IDS = [
  { id: 'common-general-shosho', how: '聽' },
  { id: 'common-general-daijobu', how: '說' },
  { id: 'castle-kutsu', how: '讀' },
]
const phrases = computed(() =>
  PHRASE_IDS.flatMap(({ id, how }) => {
    const p = catalog.phrases?.find((x) => x.id === id)
    return p ? [{ how, ja: p.ja, kana: p.kana, zh: p.zh_tw }] : []
  }),
)

// ---- 紀錄：塗了幾縣的地圖、紀念章 ----
const visitedDemo = new Set(['hokkaido', 'tokyo', 'kanagawa', 'kyoto', 'osaka', 'nara', 'hyogo', 'hiroshima', 'fukuoka', 'okinawa'])
const seals = ACHIEVEMENTS.filter((a, i, list) => list.findIndex((b) => b.group === a.group) === i).slice(0, 4)

// ---- 收集卡：清水寺的四種樣子 ----
const kiyomizu = computed<CardFace | null>(() => {
  const s = kyoto.value.find((x) => x.id === 'wd-Q221716')
  return s ? cardFromMapSpot(s, 'kyoto') : null
})
const cardNumber = computed(() => cardNumberOf('wd-Q221716', kyoto.value))
const special = computed(() => variants.value.find((v) => v.kind === 'special'))
const others = computed(() => variants.value.filter((v) => v.kind !== 'special'))
const variants = computed<Variant[]>(() => {
  const list = allVariants(true)
  const night = list.find((v) => v.kind === 'night')
  const special = list.find((v) => v.kind === 'special')
  return [
    BASE_VARIANT,
    seasonVariant('autumn'),
    ...(night ? [night] : []),
    ...(special
      ? [{ ...special, record: { dates: ['2025-11-18'], trip: '京都三天', stamps: ['season-spring', 'season-autumn', 'season-winter', 'night', 'sumi', 'stamp', 'full'] } }]
      : []),
  ]
})

// ---- 六個年代：每個年代一條色見本，紙色、墨色與 47 縣的地區色取自 build-region-css 產生的 theme-colors.json ----
type Swatch = Record<'paper' | 'ink' | 'line' | 'sub', string>
const ERA_COLORS = themeColors as unknown as Record<Theme, { national: Swatch; regions: Record<string, { base: string }> }>
const eraStrips = ERAS.map((e) => {
  const c = ERA_COLORS[e.key]
  return {
    era: e,
    style: { '--e-paper': c.national.paper, '--e-ink': c.national.ink, '--e-line': c.national.line, '--e-sub': c.national.sub },
    band: regions.map((r) => c.regions[r.prefecture]?.base ?? c.national.line),
  }
})
// 色見本用各年代的字型：捲到附近才去抓
const eraSection = ref<HTMLElement | null>(null)
let eraObserver: IntersectionObserver | null = null

const SOURCES = [
  { use: '景點簡介、念法', name: '維基百科' },
  { use: '景點、座標、類型', name: 'Wikidata' },
  { use: '照片', name: 'Wikimedia Commons', note: '作者與授權寫在卡片上' },
  { use: '鐵路、車站、擴充包的店', name: 'OpenStreetMap' },
  { use: '花期、紅葉', name: '気象庁', note: '平年值與本季觀測' },
  { use: '市區町村界、國際線機場', name: '国土交通省' },
  { use: '郷土料理', name: '農林水産省' },
  { use: '景點挑選', name: '各地的官方觀光網站', note: '東京、京都、大阪、北海道、福岡、沖繩' },
]

const FAQ = [
  { q: '要付費嗎？', a: '不用。' },
  { q: '一定要登入嗎？', a: '看地圖、景點不用。收藏、行程、收集卡用 Google 帳號登入，換手機也還在。' },
  { q: '手機可以用嗎？', a: '可以。加到主畫面就像一個 App；行程下載離線用之後，沒有網路也打得開。' },
  { q: '資料多久更新？', a: '期間限定每天；寶可夢、城、祭典每週；其他每月或每季，更新前先檢查過。' },
]

onMounted(() => {
  loadBrandFont()
  if (reduceMotion) userPaused.value = true
  // 照片一直載不到時，5 秒後照常開始
  startFallback = window.setTimeout(startTimer, 5000)
  scroller = document.getElementById('app-main')
  if (!reduceMotion) scroller?.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('visibilitychange', onVisibility)
  if (heroEl.value && 'IntersectionObserver' in window) {
    heroObserver = new IntersectionObserver(
      (entries) => {
        heroVisible = entries.some((e) => e.isIntersecting)
        onVisibility()
      },
      { root: document.getElementById('app-main') },
    )
    heroObserver.observe(heroEl.value)
  }
  void catalog.loadMap('kyoto').then((list) => (kyoto.value = list)).catch(() => {})
  void catalog.loadPhrases().catch(() => {})
  if (eraSection.value && 'IntersectionObserver' in window) {
    eraObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        preloadThemeFonts()
        eraObserver?.disconnect()
      },
      // 捲動的是 App.vue 的 <main>，rootMargin 要對它算才會提早
      { root: document.getElementById('app-main'), rootMargin: '600px 0px' },
    )
    eraObserver.observe(eraSection.value)
  } else preloadThemeFonts()
})
onBeforeUnmount(() => {
  window.clearTimeout(timer)
  window.clearTimeout(startFallback)
  scroller?.removeEventListener('scroll', onScroll)

  cancelAnimationFrame(scrollRaf)
  revealIO?.disconnect()
  document.removeEventListener('visibilitychange', onVisibility)
  heroObserver?.disconnect()
  eraObserver?.disconnect()
})
const kyotoRegion = regionOf('kyoto')
</script>

<template>
  <div class="about flex flex-col">
    <OverlayScrollbar target="app-main" />
    <!-- 海報：全版輪播的日本風景（北海道到沖繩），左下標語與開始探索，右下這張的地方與照片出處，最下面是八站的進度 -->
    <header ref="heroEl" class="hero relative isolate flex min-h-[34rem] flex-col overflow-hidden bg-ink text-white" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
      <div class="hero-slides absolute inset-0 -z-10" aria-roledescription="輪播" aria-label="日本各地的風景">
        <figure
          v-for="(s, i) in SLIDES"
          :key="s.id"
          class="slide absolute inset-0 m-0"
          :class="{ 'is-current': i === cur, 'is-prev': i === prev }"
          role="group"
          aria-roledescription="張"
          :aria-label="`${i + 1} / ${SLIDES.length}：${s.name}（${prefName(s.pref)}）`"
          :aria-hidden="i !== cur"
        >
          <img
            v-if="mounted.has(i)"
            :src="commonsThumb(s.image, 1280)"
            :srcset="srcsetOf(s.image)"
            sizes="100vw"
            :alt="`${s.name}（${prefName(s.pref)}）`"
            :fetchpriority="i === 0 ? 'high' : 'low'"
            referrerpolicy="no-referrer"
            class="slide-img size-full object-cover"
            :class="{ 'is-loaded': loaded.has(i) }"
            :style="{ objectPosition: s.focus }"
            @load="onSlideLoad(i)"
          />
        </figure>
      </div>
      <div class="hero-scrim pointer-events-none absolute inset-0 -z-10" aria-hidden="true"></div>

      <div class="hero-content mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pt-6 max-sm:px-4 max-sm:pt-4">
        <div class="hero-mark"><Wordmark /></div>

        <div class="mt-auto grid items-end gap-x-10 gap-y-6 pt-16 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="flex flex-col gap-4">
            <h1 v-reveal class="tagline font-brand">{{ TAGLINE }}</h1>
            <p v-reveal="1" class="max-w-[28em] text-body leading-[1.9] tracking-[0.03em] text-white/85 md:text-[1rem]">日本 47 都道府縣的景點地圖。在一縣一色的地圖上找地方、排行程、記住念法；去過的地方，收成一張一張的卡。</p>
            <div v-reveal="2" class="flex flex-wrap items-center gap-x-6 gap-y-3">
              <RouterLink to="/" class="flex h-11 items-center rounded-control bg-paper px-5 text-body-sm font-bold tracking-[0.04em] text-ink no-underline active:translate-y-px">開始探索</RouterLink>
              <a href="#flow" class="text-body-sm font-bold tracking-[0.04em] text-white underline decoration-white/50 decoration-2 underline-offset-[6px] hover:decoration-white" @click.prevent="scrollToFlow">怎麼用</a>
            </div>
          </div>
          <!-- 這一張：地方與照片出處（CC 授權要寫作者與授權） -->
          <p class="flex flex-col gap-0.5 text-body-sm md:items-end md:text-right" aria-live="polite">
            <RouterLink :to="{ path: `/map/${SLIDES[cur]!.pref}`, query: { spot: SLIDES[cur]!.id } }" class="font-bold text-white no-underline hover:underline">
              {{ SLIDES[cur]!.name }}<span class="ml-2 font-normal text-white/80">{{ prefName(SLIDES[cur]!.pref) }}</span>
            </RouterLink>
            <a :href="SLIDES[cur]!.source" target="_blank" rel="noopener" class="text-caption text-white/75 no-underline hover:underline">照片 {{ SLIDES[cur]!.author }}／{{ SLIDES[cur]!.license }}</a>
          </p>
        </div>

        <!-- 進度：北海道到沖繩，按了跳到那一張 -->
        <div class="mt-6 flex items-center gap-3 pb-6 max-sm:pb-4">
          <button
            type="button"
            class="grid size-9 shrink-0 place-items-center rounded-full border border-white/50 text-white hover:border-white"
            :aria-label="userPaused ? '播放輪播' : '暫停輪播'"
            @click="togglePause"
          >
            <svg v-if="userPaused" viewBox="0 0 16 16" class="size-3.5" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>
            <svg v-else viewBox="0 0 16 16" class="size-3.5" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" /></svg>
          </button>
          <ol class="grid flex-1 grid-cols-8 gap-1.5">
            <li v-for="(s, i) in SLIDES" :key="s.id" class="flex">
              <button
                type="button"
                class="seg flex min-h-9 w-full flex-col justify-center gap-1.5 text-left"
                :aria-label="`${s.name}（${prefName(s.pref)}）`"
                :aria-current="i === cur ? 'true' : undefined"
                @click="go(i)"
              >
                <span class="seg-track relative block h-[3px] w-full overflow-hidden rounded-full" :class="i === cur ? 'bg-white/55' : 'bg-white/30'">
                  <span
                    :key="i === cur ? `on-${cycle}` : 'off'"
                    class="seg-fill absolute inset-y-0 left-0 block bg-white"
                    :class="{ 'is-done': i < cur, 'is-current': i === cur, 'is-paused': paused }"
                  ></span>
                </span>
                <span class="truncate text-caption text-white/75 max-sm:sr-only" :class="{ 'font-bold text-white': i === cur }">{{ prefName(s.pref) }}</span>
              </button>
            </li>
          </ol>
        </div>
      </div>
    </header>

    <!-- 收錄：一句話寫完，下面是 47 縣的地區色，北到南 -->
    <section aria-label="收錄" class="border-y border-line bg-surface">
      <div class="mx-auto w-full max-w-6xl px-6 py-12 max-sm:px-4 max-sm:py-9">
        <!-- 數字和量詞不拆到兩行 -->
        <p v-reveal class="counts font-brand text-h3 leading-[1.8] font-medium xl:text-[1.625rem]">
          收錄日本 <span class="whitespace-nowrap"><b>{{ STATS.prefs }}</b> 都道府縣</span>的 <span class="whitespace-nowrap"><b>{{ STATS.spots }}</b> 個景點</span>、<span
            class="whitespace-nowrap"
            ><b>{{ STATS.stations }}</b> 個車站</span
          >、<span class="whitespace-nowrap"><b>{{ STATS.festivals }}</b> 個祭典</span>，<br class="max-lg:hidden" />以及
          <span class="whitespace-nowrap"><b>{{ STATS.airports }}</b> 座</span>有國際線的機場。
        </p>
        <div class="mt-7 flex flex-col gap-1.5">
          <ol v-reveal.keep class="band flex h-3 gap-px" aria-hidden="true">
            <li v-for="(r, i) in regions" :key="r.prefecture" :data-pref="r.prefecture" :title="r.name.zh_tw" class="flex-1 bg-region" :style="{ '--i': i }"></li>
          </ol>
          <p class="flex justify-between text-caption text-sub" aria-hidden="true"><span>{{ north }}</span><span>{{ south }}</span></p>
        </div>
      </div>
    </section>

    <!-- 原則 -->
    <section class="mx-auto w-full max-w-6xl px-6 py-16 max-sm:px-4 max-sm:py-10" aria-labelledby="points">
      <h2 id="points" v-reveal class="font-brand text-h2 font-semibold tracking-title">ひとめぐり 是什麼</h2>
      <p v-reveal="1" class="mt-2 max-w-[40em] text-body text-sub">「一巡り」是繞一圈的意思。從一個縣開始，一縣一縣把日本走過一遍。</p>
      <ul class="mt-8 grid gap-4 md:grid-cols-2">
        <li v-for="(p, i) in POINTS" :key="p.title" v-reveal="i + 1" class="flex gap-4 rounded-card border border-line bg-paper p-5">
          <span class="font-latin text-h2 leading-none font-bold text-region-strong">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="flex flex-col gap-1.5">
            <span class="text-title font-bold">{{ p.title }}</span>
            <span class="text-body text-ink-2">{{ p.text }}</span>
          </span>
        </li>
      </ul>
    </section>

    <!-- 能做什麼：頁籤 -->
    <section id="features" class="scroll-mt-4 bg-surface py-16 max-sm:py-10" aria-labelledby="features-title">
      <div class="mx-auto w-full max-w-6xl px-6 max-sm:px-4">
        <h2 id="features-title" v-reveal class="font-brand text-h2 font-semibold tracking-title">能做什麼</h2>
        <div v-reveal="1" role="tablist" aria-label="能做什麼" class="scroll-quiet mt-6 flex gap-1 overflow-x-auto border-b border-line">
          <button
            v-for="(t, i) in TABS"
            :key="t.key"
            :ref="(el) => (tabEls[i] = el as HTMLButtonElement)"
            type="button"
            role="tab"
            :id="`tab-${t.key}`"
            :aria-selected="tab === t.key"
            :aria-controls="`panel-${t.key}`"
            :tabindex="tab === t.key ? 0 : -1"
            class="min-h-tap shrink-0 border-b-3 px-4 text-body font-bold whitespace-nowrap"
            :class="tab === t.key ? 'border-region-strong text-ink' : 'border-transparent text-sub hover:text-ink'"
            @click="tab = t.key"
            @keydown="onTabKey($event, i)"
          >
            {{ t.label }}
          </button>
        </div>

        <div
          v-for="t in TABS"
          v-show="tab === t.key"
          :id="`panel-${t.key}`"
          :key="t.key"
          role="tabpanel"
          :aria-labelledby="`tab-${t.key}`"
          class="tab-panel grid gap-10 pt-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
        >
          <div class="flex flex-col gap-4">
            <h3 class="text-h3 font-black tracking-title">{{ FEATURES[t.key].title }}</h3>
            <ul class="flex flex-col gap-3">
              <li v-for="line in FEATURES[t.key].lines" :key="line" class="flex gap-2.5 text-body">
                <span class="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-region-strong" aria-hidden="true"></span>
                <span>{{ line }}</span>
              </li>
            </ul>
          </div>

          <!-- 探索：京都的地區標籤、擴充包、清單 -->
          <div v-if="t.key === 'explore'" data-pref="kyoto" class="flex flex-col gap-3 rounded-card bg-map-land p-4 sm:p-6" aria-hidden="true">
            <div class="paper-grain relative flex h-[72px] items-center gap-3 overflow-hidden rounded-card bg-region px-4 text-on-region shadow-float">
              <RegionMotif pref="kyoto" class="absolute -right-6 size-28 opacity-70" />
              <span class="flex flex-col">
                <span lang="ja" class="text-caption tracking-kana">{{ kyotoRegion?.name.kana }}</span>
                <span lang="ja" class="text-h3 leading-none font-black tracking-name">{{ kyotoRegion?.name.ja }}</span>
              </span>
              <span class="relative ml-auto text-right font-latin text-caption font-bold tracking-romaji uppercase">{{ kyotoRegion?.name.romaji }}<br />{{ kyotoRegion?.area_name }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="c in PACK_CHIPS" :key="c.label" class="flex h-9 items-center gap-1.5 rounded-full bg-paper px-3.5 text-body-sm font-bold shadow-float" :style="{ '--pack': `var(--color-t-${c.color})` }">
                <span class="size-2 rounded-full bg-(--pack)"></span>{{ c.label }}<span class="font-num">{{ c.n }}</span>
              </span>
            </div>
            <div class="flex flex-col rounded-card bg-paper p-1.5 shadow-float">
              <div class="flex h-10 items-center gap-2 rounded-control bg-region-tint px-3">
                <span class="text-body-sm font-bold">景點</span><span class="font-num text-body-sm text-sub">{{ kyoto.length || 393 }}</span>
                <span class="ml-auto flex h-8 items-center gap-1.5 rounded-control border border-line bg-paper px-2.5 text-body-sm">地區 <span class="text-sub">▾</span></span>
              </div>
              <div v-for="s in kyotoTop" :key="s.id" class="flex min-h-tap items-center gap-3 px-1.5 py-1.5">
                <img :src="mapThumbUrl(s.i!)" alt="" loading="lazy" referrerpolicy="no-referrer" class="size-11 shrink-0 rounded-control bg-placeholder object-cover" />
                <span class="flex min-w-0 flex-col">
                  <span lang="ja" class="truncate text-caption tracking-kana text-sub">{{ s.h }}</span>
                  <span lang="ja" class="truncate text-body-sm font-bold">{{ s.n }}</span>
                </span>
                <span class="ml-auto shrink-0 text-caption text-sub">{{ s.c }}</span>
              </div>
            </div>
          </div>

          <!-- 行程：兩天的停留點＋住在京都的單日來回 -->
          <div v-else-if="t.key === 'trip'" data-pref="kyoto" class="grid gap-4 md:grid-cols-2" aria-hidden="true">
            <div class="flex flex-col gap-3">
              <div v-for="d in DAY" :key="d.day" class="flex flex-col gap-2 rounded-card bg-paper p-4 shadow-float">
                <div class="flex items-center gap-2.5">
                  <span class="grid size-11 place-items-center rounded-control bg-region font-latin text-caption leading-none font-bold text-on-region">{{ d.day.split(' ')[0] }}<br /><span class="text-body">{{ d.day.split(' ')[1] }}</span></span>
                  <span class="text-body-sm">{{ d.date }}</span>
                  <span class="ml-auto flex h-8 items-center gap-1 rounded-control border border-line px-2.5 text-caption">住在 <span lang="ja" class="font-bold">京都</span> ▾</span>
                </div>
                <ol class="flex flex-col">
                  <li v-for="(s, i) in d.stops" :key="s" class="flex min-h-9 items-center gap-2.5 text-body-sm">
                    <span class="grid size-6 place-items-center rounded-full bg-ink font-num text-micro font-bold text-paper">{{ i + 1 }}</span>
                    <span lang="ja" class="font-bold">{{ s }}</span>
                  </li>
                </ol>
              </div>
            </div>
            <div class="flex flex-col gap-2 rounded-card bg-paper p-4 shadow-float">
              <p class="text-body-sm font-bold">單日來回<span class="ml-1.5 font-normal text-sub">住在 <span lang="ja">京都</span></span></p>
              <div v-for="b in BANDS" :key="b.label" class="flex flex-col">
                <p class="pt-2 pb-1 text-caption font-bold tracking-section text-sub">{{ b.label }}</p>
                <p v-for="[name, km] in b.rows" :key="name" class="flex min-h-9 items-center border-b border-line-soft text-body-sm last:border-b-0">
                  <span lang="ja" class="font-bold">{{ name }}</span>
                  <span class="ml-auto text-sub">鐵路約 <span class="font-num text-ink">{{ km }}</span> km</span>
                </p>
              </div>
            </div>
          </div>

          <!-- 旅前準備：地名卡、聽說讀 -->
          <div v-else-if="t.key === 'prep'" class="grid gap-4 md:grid-cols-2">
            <div class="flex flex-col gap-3">
              <div v-for="n in NAMES" :key="n.ja" class="flex items-center gap-3 rounded-card bg-paper p-4 shadow-float">
                <span class="flex min-w-0 flex-col">
                  <span lang="ja" class="text-caption tracking-kana text-sub">{{ n.kana }}</span>
                  <span lang="ja" class="text-h3 leading-tight font-black tracking-name">{{ n.ja }}</span>
                  <span class="font-latin text-caption font-semibold tracking-romaji">{{ n.romaji }}</span>
                </span>
                <SpeakButton :text="n.kana" :label="`${n.ja} 的念法`" class="ml-auto" />
              </div>
            </div>
            <div class="flex flex-col gap-3">
              <div v-for="p in phrases" :key="p.ja" class="flex gap-3 rounded-card bg-paper p-4 shadow-float">
                <span class="grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] border-ink text-body-sm font-bold">{{ p.how }}</span>
                <span class="flex min-w-0 flex-col">
                  <span lang="ja" class="text-title font-bold">{{ p.ja }}</span>
                  <span lang="ja" class="text-caption tracking-kana text-sub">{{ p.kana }}</span>
                  <span class="text-body-sm">{{ p.zh }}</span>
                </span>
              </div>
              <div class="flex items-center gap-3 rounded-card border border-dashed border-line p-4 text-body-sm text-sub">
                <span class="grid h-12 w-9 shrink-0 place-items-center rounded-[3px] border border-line bg-paper font-latin text-micro font-bold text-ink">A5</span>
                旅前小書：地名、會話、地區特色印成一本
              </div>
            </div>
          </div>

          <!-- 紀錄：塗了十縣的地圖、初訪章、成就 -->
          <div v-else-if="t.key === 'log'" class="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div class="rounded-card bg-region p-5 text-on-region">
              <JapanMap :done="visitedDemo" />
              <p class="mt-2 text-center text-caption">去過的縣塗上那一縣的顏色</p>
            </div>
            <div class="flex flex-col items-center gap-3">
              <div class="flex flex-wrap items-center justify-center gap-4">
                <PrefStamp pref="kyoto" date="2025-11-18" class="size-24" />
                <AchvSeal v-for="a in seals" :key="a.id" :def="a" status="done" at="2025-11-20" :size="80" />
              </div>
              <p class="text-caption text-sub">京都的初訪章與四個成就</p>
            </div>
          </div>

          <!-- 收集卡：清水寺的特別全景（大）＋基本、秋景、夜景。橫的照片是橫卡，照原本的方向放 -->
          <div v-else-if="t.key === 'cards'" class="flex flex-col items-center gap-5">
            <template v-if="kiyomizu">
              <figure v-if="special" class="flex w-full flex-col items-center gap-2">
                <div class="@container w-full max-w-[28rem]">
                  <SpotCard :card="kiyomizu" rarity="rainbow" label="世界遺產" :number="cardNumber" visited visited-on="2025-11-18" :variant="special" size="fluid" />
                </div>
                <figcaption class="text-body-sm font-bold">{{ special.label }}</figcaption>
              </figure>
              <div class="flex flex-wrap items-end justify-center gap-4">
                <figure v-for="v in others" :key="v.key" class="flex flex-col items-center gap-2">
                  <div class="@container" :class="isLandscapeCard(kiyomizu, v) ? 'w-[12.6rem] max-sm:w-[9.8rem]' : 'w-[9rem] max-sm:w-[7rem]'">
                    <SpotCard :card="kiyomizu" rarity="rainbow" label="世界遺產" :number="cardNumber" visited visited-on="2025-11-18" :variant="v" size="fluid" />
                  </div>
                  <figcaption class="text-body-sm font-bold">{{ v.label }}</figcaption>
                </figure>
              </div>
            </template>
            <div v-else class="aspect-[7/5] w-full max-w-[28rem] rounded-card bg-placeholder" aria-hidden="true"></div>
            <p class="text-caption text-sub">清水寺。每個景點 9 種，有夜景照片的 10 種；卡片可以翻面、拿著轉。</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 一趟旅行的流程 -->
    <section id="flow" class="mx-auto w-full max-w-6xl scroll-mt-4 px-6 py-16 max-sm:px-4 max-sm:py-10" aria-labelledby="flow-title">
      <h2 id="flow-title" v-reveal class="font-brand text-h2 font-semibold tracking-title">一趟旅行怎麼用</h2>
      <ol class="relative mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <li v-for="(s, i) in [
          { t: '找地方', d: '選一個縣，看地圖與清單，收藏想去的。', tab: 'explore' },
          { t: '排行程', d: '加入行程排進每一天，設定住在哪，看哪裡當天來回得了。', tab: 'trip' },
          { t: '準備', d: '看念法、練會話，印一本旅前小書。', tab: 'prep' },
          { t: '出發', d: '打開就是今天的行程與路線，沒有網路也看得到。', tab: 'trip' },
          { t: '去過', d: '到了按「去過」，拿到這一季的卡。', tab: 'cards' },
          { t: '回顧', d: '開卡包、蓋紀念章、做一張回顧圖。', tab: 'log' },
        ] as const" :key="s.t" v-reveal="i + 1" class="flex">
          <button type="button" class="flex w-full flex-col gap-2 rounded-card border border-line bg-paper p-4 text-left hover:bg-surface active:translate-y-px" @click="showTab(s.tab)">
            <span class="flex items-center gap-2">
              <span class="grid size-8 place-items-center rounded-full bg-region font-latin text-body font-bold text-on-region">{{ i + 1 }}</span>
              <span class="text-title font-bold">{{ s.t }}</span>
            </span>
            <span class="text-body-sm text-ink-2">{{ s.d }}</span>
          </button>
        </li>
      </ol>
    </section>

    <!-- 六個年代：每個年代一條色見本（紙、墨、47 縣的地區色、年代的字），按了整頁換過去 -->
    <section ref="eraSection" class="border-y border-line bg-surface" aria-labelledby="era-title">
      <div class="mx-auto grid w-full max-w-6xl gap-x-12 gap-y-8 px-6 py-16 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] max-sm:px-4 max-sm:py-10">
        <div class="flex flex-col gap-3">
          <h2 id="era-title" v-reveal class="font-brand text-h2 font-semibold tracking-title">六個年代</h2>
          <p v-reveal="1" class="text-body text-ink-2">配色、字體、卡片與看板跟著年代換。點一個年代，這一頁就換過去。</p>
        </div>
        <ol class="grid grid-cols-6 gap-3 max-sm:gap-1.5" aria-label="年代">
          <li v-for="(s, i) in eraStrips" :key="s.era.key" v-reveal="i + 1" class="flex">
            <button
              type="button"
              class="era-strip"
              :style="s.style"
              :aria-pressed="theme === s.era.key"
              :aria-label="`${s.era.label}（${s.era.years}）`"
              @click="setTheme(s.era.key)"
            >
              <span class="era-band" aria-hidden="true">
                <span v-for="(c, i) in s.band" :key="i" :style="{ background: c }"></span>
              </span>
              <span class="era-name" :style="{ fontFamily: s.era.face }">{{ s.era.label }}</span>
              <span class="era-year font-latin">{{ s.era.years.split('–')[0] }}</span>
            </button>
          </li>
        </ol>
      </div>
    </section>

    <!-- 資料從哪裡來：版權頁（奧付）的樣子 -->
    <section class="mx-auto grid w-full max-w-6xl gap-x-12 gap-y-8 px-6 py-16 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] max-sm:px-4 max-sm:py-10" aria-labelledby="sources-title">
      <div class="flex flex-col gap-3">
        <h2 id="sources-title" v-reveal class="font-brand text-h2 font-semibold tracking-title">資料從哪裡來</h2>
        <p v-reveal="1" class="text-body text-ink-2">每一筆資料都留著來源網址與取得日期。找不到來源的就留空，不另外編寫。</p>
      </div>
      <div v-reveal="2" class="colophon border-y-[3px] border-double border-ink px-1 py-6">
        <dl class="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] items-baseline gap-x-8 gap-y-3 max-sm:grid-cols-1 max-sm:gap-y-0">
          <template v-for="src in SOURCES" :key="src.name">
            <dt class="text-body-sm text-sub max-sm:pt-3">{{ src.use }}</dt>
            <dd class="text-body">
              <span class="font-bold">{{ src.name }}</span><span v-if="src.note" class="ml-2 text-body-sm text-sub">{{ src.note }}</span>
            </dd>
          </template>
        </dl>
        <p class="mt-6 border-t border-line pt-4 text-body-sm">
          <RouterLink to="/credits" class="font-bold text-region-strong">完整的資料來源與授權</RouterLink>
        </p>
      </div>
    </section>

    <!-- 常見問題：問、答 -->
    <section class="bg-surface" aria-labelledby="faq-title">
      <div class="mx-auto grid w-full max-w-6xl gap-x-12 gap-y-6 px-6 py-16 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] max-sm:px-4 max-sm:py-10">
        <h2 id="faq-title" v-reveal class="font-brand text-h2 font-semibold tracking-title">常見問題</h2>
        <dl class="flex flex-col">
          <div v-for="(f, i) in FAQ" :key="f.q" v-reveal="i + 1" class="flex flex-col gap-2.5 border-b border-line py-5 first:pt-1 last:border-b-0">
            <dt class="flex items-start gap-3">
              <span class="qa qa-q font-brand" aria-hidden="true">問</span><span class="text-title font-bold">{{ f.q }}</span>
            </dt>
            <dd class="flex items-start gap-3">
              <span class="qa qa-a font-brand" aria-hidden="true">答</span><span class="pt-0.5 text-body text-ink-2">{{ f.a }}</span>
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- 頁尾 -->
    <footer class="paper-grain relative overflow-hidden bg-region text-on-region">
      <div class="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-6 py-14 max-sm:px-4 max-sm:py-10">
        <p v-reveal class="font-brand text-h1 font-semibold tracking-title max-sm:text-h2">{{ TAGLINE }}</p>
        <RouterLink to="/" class="flex h-12 items-center rounded-control bg-ink px-6 text-body font-bold text-paper no-underline active:translate-y-px">開始探索</RouterLink>
        <div class="mt-4 flex w-full flex-wrap items-center gap-x-6 gap-y-2 border-t border-on-region/30 pt-5 text-body-sm">
          <Wordmark class="text-on-region" />
          <RouterLink to="/credits" class="text-on-region">資料來源</RouterLink>
          <span class="ml-auto text-caption">地圖 © OpenStreetMap contributors</span>
        </div>
      </div>
    </footer>
  </div>
</template>


<style scoped>
/* ---- 海報：全版照片。高度是一個畫面（下面露一點收錄），太矮、太高時有上下限 ---- */
.hero {
  height: min(100svh, 62rem);
}
.hero-scrim {
  /* 上緣給 wordmark、下半給標語與控制列的底，照片中間保持原樣 */
  background:
    linear-gradient(to bottom, color-mix(in oklab, var(--color-ink) 55%, transparent), transparent 22%),
    linear-gradient(to top, color-mix(in oklab, var(--color-ink) 82%, transparent), color-mix(in oklab, var(--color-ink) 35%, transparent) 45%, transparent 72%);
}
.hero-mark :deep(*) {
  color: inherit;
}

/* 交叉淡入：新的一張從 0 淡到 1，蓋在上一張上面（上一張維持不透明，不會先暗一下）；照片慢慢拉遠 */
.slide {
  opacity: 0;
}
.slide.is-prev {
  opacity: 1;
}
.slide.is-current {
  z-index: 1;
  opacity: 1;
  transition: opacity 1.4s var(--ease-out-soft);
}
@starting-style {
  .slide.is-current {
    opacity: 0;
  }
}
.slide.is-current .slide-img,
.slide.is-prev .slide-img {
  animation: drift 9s linear both;
}
@keyframes drift {
  from {
    transform: scale(1.08);
  }
  to {
    transform: scale(1);
  }
}
/* 各年代的照片質感（eras.css 的 --era-photo-filter） */
:root[data-theme] .slide-img {
  filter: var(--era-photo-filter, none);
}

.tagline {
  margin: 0;
  font-size: clamp(2rem, 3.6vw, 3.5rem);
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: 0.08em;
}
:root[data-theme] .tagline {
  font-family: var(--font-display-zh);
  font-weight: var(--display-zh-weight);
}

/* 進度條：看過的滿格，這一張 7 秒填滿（暫停時停住） */
.seg-fill {
  width: 0;
}
.seg-fill.is-done {
  width: 100%;
}
.seg-fill.is-current {
  animation: seg-fill 7s linear forwards;
}
.seg-fill.is-paused {
  animation-play-state: paused;
}
@keyframes seg-fill {
  from {
    width: 0;
  }
  to {
    width: 100%;
  }
}

/* 海報往下捲：文字淡出、往上一點；照片慢一點跟著走（--p 是捲過海報的比例，onScroll 設定） */
.hero-content {
  opacity: calc(1 - var(--p, 0) * 1.6);
  transform: translateY(calc(var(--p, 0) * -3rem));
}
.hero-slides {
  transform: translateY(calc(var(--p, 0) * 30%));
  will-change: transform;
}
/* 照片載好才淡入（還沒載好時看到的是上一張） */
.slide-img {
  opacity: 0;
  transition: opacity 0.6s var(--ease-out-soft);
}
.slide-img.is-loaded {
  opacity: 1;
}

/* 進到畫面時淡入、往上 18px；同一組依序晚 80ms */
.reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.8s var(--ease-out-soft),
    transform 0.8s var(--ease-out-soft);
  transition-delay: calc(var(--d, 0) * 80ms);
}
.reveal.is-in {
  opacity: 1;
  transform: none;
}
/* 47 縣色帶：北海道到沖繩一格一格長出來 */
.band.reveal {
  opacity: 1;
  transform: none;
}
.band.reveal > li {
  transform: scaleY(0);
  transform-origin: bottom;
  transition: transform 0.5s var(--ease-out-soft);
  transition-delay: calc(var(--i) * 18ms);
}
.band.reveal.is-in > li {
  transform: none;
}

/* 換頁籤：內容淡入 */
.tab-panel {
  animation: var(--animate-panel-in);
}

/* 收錄的數字用拉丁字型 */
.counts b {
  font-family: var(--font-latin);
  font-size: 1.15em;
  font-weight: 600;
  letter-spacing: 0.01em;
}

/* ---- 年代色見本：左邊 47 縣的色帶（北到南），右上直排年代名，下面是起始年 ---- */
.era-strip {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 15rem;
  padding: 0.75rem 0.75rem 0.75rem 1.25rem;
  border: 1px solid var(--e-line);
  border-radius: 3px;
  background: var(--e-paper);
  color: var(--e-ink);
  text-align: left;
  cursor: pointer;
}
.era-strip:hover {
  border-color: var(--e-ink);
}
.era-strip[aria-pressed='true'] {
  outline: 2px solid var(--color-ink);
  outline-offset: 3px;
}
.era-band {
  position: absolute;
  inset: 0.75rem auto 0.75rem 0.5rem;
  display: flex;
  flex-direction: column;
  width: 5px;
}
.era-band > span {
  flex: 1;
}
.era-name {
  margin-left: auto;
  writing-mode: vertical-rl;
  font-size: 1.75rem;
  line-height: 1.2;
  letter-spacing: 0.1em;
}
.era-year {
  position: absolute;
  bottom: 0.6rem;
  left: 1.25rem;
  font-size: 0.8125rem;
  color: var(--e-sub);
}
@media (max-width: 639.98px) {
  .era-strip {
    min-height: 10.5rem;
    padding: 0.5rem 0.25rem 0.5rem 0.75rem;
  }
  .era-band {
    inset: 0.5rem auto 0.5rem 0.3rem;
    width: 3px;
  }
  .era-name {
    margin: 0 auto;
    font-size: 1.25rem;
  }
  .era-year {
    left: 0;
    right: 0;
    padding-left: 0.5rem;
    text-align: center;
    font-size: 0.6875rem;
  }
}

/* ---- 常見問題的「問」「答」 ---- */
.qa {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 3px;
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1;
}
.qa-q {
  border: 1.5px solid var(--color-ink);
  color: var(--color-ink);
}
.qa-a {
  background: var(--color-region-strong);
  color: var(--color-paper);
}
</style>

<style>
/* 形象網站不顯示原生捲軸（App.vue 的 #app-main，路由 meta.bare）：照片滿版到右緣，捲軸改用 OverlayScrollbar 浮在畫面上 */
#app-main[data-bare] {
  scrollbar-width: none;
}
#app-main[data-bare]::-webkit-scrollbar {
  display: none;
}
</style>
