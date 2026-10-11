<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import AchvSeal from '../components/AchvSeal.vue'
import JapanMap from '../components/JapanMap.vue'
import PrefStamp from '../components/PrefStamp.vue'
import RegionMotif from '../components/RegionMotif.vue'
import SpeakButton from '../components/SpeakButton.vue'
import SpotCard from '../components/SpotCard.vue'
import Wordmark from '../components/Wordmark.vue'
import { ACHIEVEMENTS } from '../data/achievements'
import { regionOf, regions } from '../data/regions'
import { cardFromMapSpot, cardNumberOf, type CardFace, isLandscapeCard } from '../services/card'
import { allVariants, BASE_VARIANT, seasonOfMonth, seasonVariant, type SeasonKey, type Variant } from '../services/cardVariants'
import { mapThumbUrl, type MapSpot } from '../services/bundles'
import { commonsThumb } from '../services/commons'
import { ERAS, preloadThemeFonts, setTheme, theme, type Theme } from '../services/theme'
import { useCatalogStore } from '../stores/catalog'
import themeColors from '../styles/theme-colors.json'

// 形象網站（使用者決定 2026-10-11；第二版同日）：這個網站能做什麼、一趟旅行怎麼用、資料從哪裡來。
// 不顯示 app 的標頭與分頁列（路由 meta.bare）。畫面用網站本身的元件（日本地圖、收集卡、紀念章），不放截圖；
// 數字與例子都是現在的資料（景點、車站、鐵路距離取自 data/，2026-10-11）。文案照 PLAN.md §6a：短、具體、不用驚嘆號。
const catalog = useCatalogStore()

// ---- 海報：浮世繪＋直排標語＋落款印（DESIGN.md §14） ----
// 歌川広重《名所江戸百景》本身分春、夏、秋、冬四部，照今天的季節換一張；都是 data/ukiyoe.json 收的作品，畫的地方在地圖上
interface Print {
  title: string
  year: number
  /** Commons 原圖網址，顯示時換成縮圖 */
  image: string
  source: string
  spot: string
  place: string
}
const PRINTS: Record<SeasonKey, Print> = {
  spring: {
    title: '上野清水堂不忍ノ池',
    year: 1856,
    image: 'https://upload.wikimedia.org/wikipedia/commons/1/1e/100_views_edo_011.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:100_views_edo_011.jpg',
    spot: 'wd-Q5365093',
    place: '不忍池',
  },
  summer: {
    title: '大はしあたけの夕立',
    year: 1857,
    image: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Hiroshige%2C_Sudden_shower_over_Shin-%C5%8Chashi_bridge_and_Atake%2C_1857.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Hiroshige,_Sudden_shower_over_Shin-%C5%8Chashi_bridge_and_Atake,_1857.jpg',
    spot: 'wd-Q222149',
    place: '隅田川',
  },
  autumn: {
    title: '両国花火',
    year: 1858,
    image: 'https://upload.wikimedia.org/wikipedia/commons/e/e3/Fireworks_at_Ryogoku_%28Ryogoku_Hanabi%29%2C_No._98_from_One_Hundred_Famous_Views_of_Edo.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:Fireworks_at_Ryogoku_(Ryogoku_Hanabi),_No._98_from_One_Hundred_Famous_Views_of_Edo.jpg',
    spot: 'wd-Q3080489',
    place: '兩國橋',
  },
  winter: {
    title: '浅草金龍山',
    year: 1856,
    image: 'https://upload.wikimedia.org/wikipedia/commons/d/df/100_views_edo_099.jpg',
    source: 'https://commons.wikimedia.org/wiki/File:100_views_edo_099.jpg',
    spot: 'wd-Q615183',
    place: '淺草寺',
  },
}
const print = PRINTS[seasonOfMonth(new Date().getMonth() + 1)]
const printSrcset = ([500, 960, 1280] as const).map((w) => `${commonsThumb(print.image, w)} ${w}w`).join(', ')

// 標語（DESIGN.md §1）直排，逗號處分兩行
const TAGLINE = ['來一趟日本，', '才知道它有多大。']

// 進場只有這一段：畫像掛軸一樣由上往下展開 → 標語一行一行寫出來 → 蓋上落款印。等畫載好才開始，最多等 1.5 秒
const ready = ref(false)
let readyTimer = 0
function start() {
  ready.value = true
  window.clearTimeout(readyTimer)
}
const printFailed = ref(false)

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
  // 減少動態：不等畫，直接是最後的樣子
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) start()
  else readyTimer = window.setTimeout(start, 1500)
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
  window.clearTimeout(readyTimer)
  eraObserver?.disconnect()
})
const kyotoRegion = regionOf('kyoto')
</script>

<template>
  <div class="about flex flex-col">
    <!-- 海報：當季的浮世繪、直排的標語與落款印 -->
    <header class="hero paper-grain bg-paper" :class="{ 'is-ready': ready }">
      <div class="mx-auto w-full max-w-6xl px-6 pt-6 pb-28 max-md:pb-12 max-sm:px-4 max-sm:pt-4 max-sm:pb-10">
        <Wordmark />
        <div class="hero-grid mt-10 max-sm:mt-6">
          <figure class="hero-print relative flex flex-col gap-3">
            <div class="relative aspect-[960/1470]">
              <img
                v-if="!printFailed"
                :src="commonsThumb(print.image, 960)"
                :srcset="printSrcset"
                sizes="(min-width: 768px) min(25rem, 36vw), 58vw"
                :alt="`歌川広重〈${print.title}〉`"
                fetchpriority="high"
                referrerpolicy="no-referrer"
                class="print-img absolute inset-0 size-full object-cover shadow-float"
                @load="start"
                @error="(printFailed = true), start()"
              />
              <div v-else class="absolute inset-0 bg-placeholder"></div>
            </div>
            <figcaption class="hero-cap flex flex-col gap-0.5 text-caption text-sub">
              <span lang="ja" class="text-body-sm font-bold text-ink">{{ print.title }}</span>
              <span><span lang="ja">歌川広重</span>《<span lang="ja">名所江戸百景</span>》，{{ print.year }} 年</span>
              <span class="mt-1 flex flex-wrap gap-x-4">
                <RouterLink :to="{ path: '/map/tokyo', query: { spot: print.spot } }" class="font-bold text-region-strong">在地圖上看{{ print.place }}</RouterLink>
                <a :href="print.source" target="_blank" rel="noopener" class="text-sub">圖片出處</a>
              </span>
            </figcaption>
          </figure>

          <div class="hero-words">
            <h1 class="tagline font-brand">
              <span v-for="(line, i) in TAGLINE" :key="line" class="tagline-line" :style="{ '--i': i }">{{ line }}</span>
            </h1>
            <span class="seal-wrap" aria-hidden="true"><span class="seal font-brand">巡</span></span>
          </div>

          <div class="hero-lede flex flex-col gap-4">
            <p class="font-brand text-h3 font-semibold tracking-title">日本 47 都道府縣的景點地圖</p>
            <p class="max-w-[24em] text-body text-ink-2">在一縣一色的地圖上找地方、排行程、記住念法；去過的地方，收成一張一張的卡。</p>
            <div class="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
              <RouterLink to="/" class="flex h-12 items-center rounded-control bg-ink px-6 text-body font-bold text-paper no-underline active:translate-y-px">開始探索</RouterLink>
              <a href="#flow" class="text-body font-bold text-ink underline decoration-line decoration-2 underline-offset-[6px] hover:decoration-ink">怎麼用</a>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- 收錄：一句話寫完，下面是 47 縣的地區色，北到南 -->
    <section aria-label="收錄" class="border-y border-line bg-surface">
      <div class="mx-auto w-full max-w-6xl px-6 py-12 max-sm:px-4 max-sm:py-9">
        <!-- 數字和量詞不拆到兩行 -->
        <p class="counts font-brand text-h3 leading-[1.8] font-medium xl:text-[1.625rem]">
          收錄日本 <span class="whitespace-nowrap"><b>{{ STATS.prefs }}</b> 都道府縣</span>的 <span class="whitespace-nowrap"><b>{{ STATS.spots }}</b> 個景點</span>、<span
            class="whitespace-nowrap"
            ><b>{{ STATS.stations }}</b> 個車站</span
          >、<span class="whitespace-nowrap"><b>{{ STATS.festivals }}</b> 個祭典</span>，<br class="max-lg:hidden" />以及
          <span class="whitespace-nowrap"><b>{{ STATS.airports }}</b> 座</span>有國際線的機場。
        </p>
        <div class="mt-7 flex flex-col gap-1.5">
          <ol class="flex h-3 gap-px" aria-hidden="true">
            <li v-for="r in regions" :key="r.prefecture" :data-pref="r.prefecture" :title="r.name.zh_tw" class="flex-1 bg-region"></li>
          </ol>
          <p class="flex justify-between text-caption text-sub" aria-hidden="true"><span>{{ north }}</span><span>{{ south }}</span></p>
        </div>
      </div>
    </section>

    <!-- 原則 -->
    <section class="mx-auto w-full max-w-6xl px-6 py-16 max-sm:px-4 max-sm:py-10" aria-labelledby="points">
      <h2 id="points" class="font-brand text-h2 font-semibold tracking-title">ひとめぐり 是什麼</h2>
      <p class="mt-2 max-w-[40em] text-body text-sub">「一巡り」是繞一圈的意思。從一個縣開始，一縣一縣把日本走過一遍。</p>
      <ul class="mt-8 grid gap-4 md:grid-cols-2">
        <li v-for="(p, i) in POINTS" :key="p.title" class="flex gap-4 rounded-card border border-line bg-paper p-5">
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
        <h2 id="features-title" class="font-brand text-h2 font-semibold tracking-title">能做什麼</h2>
        <div role="tablist" aria-label="能做什麼" class="scroll-quiet mt-6 flex gap-1 overflow-x-auto border-b border-line">
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
          class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
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
      <h2 id="flow-title" class="font-brand text-h2 font-semibold tracking-title">一趟旅行怎麼用</h2>
      <ol class="relative mt-8 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <li v-for="(s, i) in [
          { t: '找地方', d: '選一個縣，看地圖與清單，收藏想去的。', tab: 'explore' },
          { t: '排行程', d: '加入行程排進每一天，設定住在哪，看哪裡當天來回得了。', tab: 'trip' },
          { t: '準備', d: '看念法、練會話，印一本旅前小書。', tab: 'prep' },
          { t: '出發', d: '打開就是今天的行程與路線，沒有網路也看得到。', tab: 'trip' },
          { t: '去過', d: '到了按「去過」，拿到這一季的卡。', tab: 'cards' },
          { t: '回顧', d: '開卡包、蓋紀念章、做一張回顧圖。', tab: 'log' },
        ] as const" :key="s.t" class="flex">
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
          <h2 id="era-title" class="font-brand text-h2 font-semibold tracking-title">六個年代</h2>
          <p class="text-body text-ink-2">配色、字體、卡片與看板跟著年代換。點一個年代，這一頁就換過去。</p>
        </div>
        <ol class="grid grid-cols-6 gap-3 max-sm:gap-1.5" aria-label="年代">
          <li v-for="s in eraStrips" :key="s.era.key" class="flex">
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
        <h2 id="sources-title" class="font-brand text-h2 font-semibold tracking-title">資料從哪裡來</h2>
        <p class="text-body text-ink-2">每一筆資料都留著來源網址與取得日期。找不到來源的就留空，不另外編寫。</p>
      </div>
      <div class="colophon border-y-[3px] border-double border-ink px-1 py-6">
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
        <h2 id="faq-title" class="font-brand text-h2 font-semibold tracking-title">常見問題</h2>
        <dl class="flex flex-col">
          <div v-for="f in FAQ" :key="f.q" class="flex flex-col gap-2.5 border-b border-line py-5 first:pt-1 last:border-b-0">
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
        <p class="font-brand text-h1 font-semibold tracking-title max-sm:text-h2">{{ TAGLINE.join('') }}</p>
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
/* ---- 海報：畫 | 直排標語＋落款印 | 說明。手機：畫與標語並排，說明在下面 ---- */
.hero-grid {
  display: grid;
  grid-template-columns: min(25rem, 36vw) auto minmax(0, 1fr);
  grid-template-areas: 'print words lede';
  column-gap: clamp(1.5rem, 4.5vw, 4rem);
  align-items: start;
}
.hero-print {
  grid-area: print;
}
.hero-words {
  grid-area: words;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* 標語的字級；落款印用 em 對齊最後一行的中間 */
  font-size: clamp(3rem, 5vw, 4.25rem);
}
.hero-lede {
  grid-area: lede;
  /* 和畫的下緣對齊：桌機的圖說掛在畫的下面、不佔格子的高度 */
  align-self: end;
}
@media (min-width: 768px) {
  .hero-cap {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    padding-top: 0.75rem;
  }
}
@media (max-width: 767.98px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'print words'
      'lede lede';
    row-gap: 2rem;
    column-gap: 1rem;
  }
  .hero-words {
    font-size: min(2.5rem, 9.6vw);
  }
}

/* 直排：一行一欄，由右往左讀 */
.tagline {
  writing-mode: vertical-rl;
  margin: 0;
  font-size: 1em;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0.14em;
  color: var(--color-ink);
}
.tagline-line {
  display: block;
}
:root[data-theme] .tagline {
  font-family: var(--font-display-zh);
  font-weight: var(--display-zh-weight);
}

/* 落款印：蓋在最後一行（最左一欄）的下面 */
.seal-wrap {
  display: block;
  margin-top: 0.3em;
  margin-inline-start: calc((1.5em - 3.25rem) / 2);
  transform: rotate(-3deg);
}
/* 印泥沒吃滿的地方：雜訊當遮罩，透出一點紙色 */
.seal {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border: 3px solid currentColor;
  border-radius: 5px;
  font-size: 2.15rem;
  font-weight: 800;
  line-height: 1;
  color: var(--color-visited);
  mix-blend-mode: multiply;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='2' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -9 6.3'/%3E%3C/filter%3E%3Crect width='96' height='96' filter='url(%23n)'/%3E%3C/svg%3E");
  mask-size: 96px 96px;
}
@media (max-width: 767.98px) {
  .seal-wrap {
    margin-inline-start: calc((1.5em - 2.5rem) / 2);
  }
  .seal {
    width: 2.5rem;
    height: 2.5rem;
    border-width: 2.5px;
    font-size: 1.65rem;
  }
}

/* 進場：畫由上往下展開（掛軸）→ 標語一行一行由上往下寫出來 → 蓋印。減少動態時 theme.css 會把時間壓成 0 */
.print-img {
  clip-path: inset(0 0 100% 0);
}
.is-ready .print-img {
  animation: unroll 1.1s var(--ease-out-soft) forwards;
}
.tagline-line {
  clip-path: inset(0 0 100% 0);
}
.is-ready .tagline-line {
  animation: unroll 0.8s var(--ease-out-soft) forwards;
  animation-delay: calc(0.45s + var(--i) * 0.3s);
}
@keyframes unroll {
  to {
    clip-path: inset(0 0 0 0);
  }
}
.seal {
  opacity: 0;
}
.is-ready .seal {
  animation: var(--animate-stamp-press);
  animation-delay: 1.45s;
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
