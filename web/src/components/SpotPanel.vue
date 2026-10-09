<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { Spot } from '../services/bundles'
import { cardFromSpot, cardNumberFor, designationOf, rarityLabel, rarityOf } from '../services/card'
import { commonsCandidates, commonsWidthFor } from '../services/commons'
import { showReveal } from '../services/cardReveal'
import { allVariants, drawVariants, hasNight, ownedVariants } from '../services/cardVariants'
import { todayIso } from '../services/userdb'
import { useCardDraw } from '../composables/cardDraw'
import { useStampPress } from '../composables/stampPress'
import { useVisitedEntries } from '../composables/visited'
import { PREF_GIFT_IDS } from '../data/outfitGifts'
import { useCardsStore } from '../stores/cards'
import { outfitKey, useFreshStore } from '../stores/fresh'
import { useWalletStore } from '../stores/wallet'
import { googleMapsUrl } from '../services/maps'
import { canSpeak, speakJa } from '../services/tts'
import { useCatalogStore } from '../stores/catalog'
import { useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'
import type { Snap } from '../services/sheetSnap'
import CardViewer from './CardViewer.vue'
import SpotActions from './SpotActions.vue'
import SummaryText from './SummaryText.vue'

export interface NearbyPack {
  pack: string
  label: string
  color: string
  items: { id: string; n: string; group: string; d: number }[]
}

const props = defineProps<{
  spot: Spot | null
  loading?: boolean
  nearby?: NearbyPack[]
  /** 這個景點是 100 名城／續 100 名城時（擴充包「城」） */
  castle?: { no: number; label: string; stamp: string[] }
  /** 手機 sheet 目前的段（桌機不傳）：有值時上方是把手＋名稱帶（可拖），收合時名稱帶放「去過」 */
  snap?: Snap
  /** 手機打橫的左側欄（決定事項 N2）：版面同 sheet（名稱帶固定、以下捲動），但沒有把手、不能拖 */
  noHandle?: boolean
}>()
const emit = defineEmits<{
  close: []
  selectPack: [id: string]
  /** 把手：點一下輪替（0），鍵盤上下鍵往上（1）或往下（-1）一段 */
  snapStep: [dir: -1 | 0 | 1]
  /** 把手＋名稱帶的高度（收合段的高度） */
  headHeight: [px: number]
}>()

// 圖片載入失敗（Commons 暫時無法取得等）時退回底色，不顯示破圖
// 照片寬度依畫面上的寬 × devicePixelRatio 選 Commons 的標準寬度（平板 820 寬的 sheet 要 1920、手機 390@3x 要 1280）；
// 讀不到就依序退回小一號、原圖，全部失敗才藏起來（services/commons.ts）
const imageTry = ref(0)
watch(() => props.spot?.id, () => (imageTry.value = 0))
const photoFrame = ref<HTMLElement | null>(null)
const frameWidth = ref(0)
let frameObserver: ResizeObserver | null = null
onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  frameObserver = new ResizeObserver(([e]) => {
    const w = Math.round(e?.contentRect.width ?? 0)
    // 只往大換：sheet 換段、拖動時不重抓小一號的照片
    if (w > frameWidth.value) frameWidth.value = w
  })
  watch(photoFrame, (el, old) => {
    if (old) frameObserver?.unobserve(old)
    if (el) frameObserver?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => frameObserver?.disconnect())
const imageSources = computed(() => {
  const url = props.spot?.images[0]?.url
  if (!url || !frameWidth.value) return []
  return commonsCandidates(url, commonsWidthFor(frameWidth.value, window.devicePixelRatio))
})
const image = computed(() => {
  const img = props.spot?.images[0]
  const src = imageSources.value[imageTry.value]
  return img && src ? { ...img, src } : undefined
})
const category = computed(() => props.spot?.tags.filter((t) => !t.startsWith('guide-')) ?? [])
// 景點收集卡（DESIGN.md §7.19）：名稱帶右側的卡片鈕放大檢視
const catalog = useCatalogStore()
const marks = useMarksStore()
const { datesById, entries } = useVisitedEntries()
const cardOpen = ref(false)
watch(() => props.spot?.id, () => (cardOpen.value = false))
const card = computed(() => {
  const s = props.spot
  if (!s) return null
  const m = marks.markOf(s.id)
  const d = designationOf(s.tags)
  return {
    face: cardFromSpot(s),
    rarity: rarityOf(d, Boolean(props.castle)),
    label: rarityLabel(d, props.castle),
    number: cardNumberFor(s.id, catalog.mapSpots[s.prefecture], props.castle, d),
    visited: Boolean(m?.visited),
    visitedOn: m?.visited_on ?? null,
  }
})
// 收集到的樣式（去過的才有；沒去過只有基本卡）
const cardsStore = useCardsStore()
const wallet = useWalletStore()
const fresh = useFreshStore()
const cardDraw = useCardDraw()
const cardVariants = computed(() => {
  const c = card.value
  if (!c) return []
  const dates = datesById.value.get(c.face.id)
  return dates ? ownedVariants(dates, c.rarity, hasNight(c.face), cardsStore.extraOf(c.face.id)) : []
})
// 按下去過：收集卡飛出來亮相，再收進紀錄分頁
function onStamped() {
  const c = card.value
  if (!c) return
  // 這個縣還沒有其他去過的地方（含已結束的行程）：第一次到這個縣
  const firstInPref = !entries.value.some(([id, m]) => id !== c.face.id && m.pref === c.face.pref)
  // 今天去過：基本卡＋今天的季節卡；這個景點第一次去過再送一次免費抽（只送一次，取消再勾不會再送）
  const today = drawVariants(todayIso())
  const owned = [...new Set([...cardVariants.value.map((v) => v.key), ...today.map((v) => v.key)])]
  const gift = wallet.claimFree(c.face.id) ? cardDraw.drawFor({ spotId: c.face.id, rarity: c.rarity, night: hasNight(c.face), owned }, true) : null
  const variant = [...today, ...(gift ? [gift] : [])].sort((a, b) => b.rank - a.rank)[0]
  // 第一次到這個縣：送那個縣的代表服裝（旅人），標 NEW
  if (firstInPref) {
    const outfit = PREF_GIFT_IDS[c.face.pref]
    if (outfit) fresh.add([outfitKey(outfit)])
  }
  showReveal({ face: c.face, rarity: c.rarity, label: c.label, number: c.number, firstInPref, variant })
}
const station = computed(() => props.spot?.nearest_stations?.[0])
const showZh = computed(() => props.spot && props.spot.name.zh_tw !== props.spot.name.ja)
const mapsUrl = computed(() => (props.spot ? googleMapsUrl(props.spot.name.ja, props.spot.prefecture) : ''))
const spotRef = computed(() => (props.spot ? { id: props.spot.id, pref: props.spot.prefecture, name: props.spot.name.ja } : null))

// 手機收合時名稱帶右側的「去過」：和工作列的去過是同一個狀態，按下去也播新卡入手
const userStore = useUserStore()
const visited = computed(() => Boolean(props.spot && marks.markOf(props.spot.id)?.visited))
const peekStamp = useStampPress(() => visited.value, () => props.spot?.id ?? '')
watch(peekStamp.pressing, (p) => {
  if (p) onStamped()
})
function togglePeekVisited() {
  if (!spotRef.value) return
  peekStamp.arm()
  void marks.toggleVisited(spotRef.value)
}
// 手機打橫時的名稱帶（Tailwind 要看到完整的 class 字串）
const short = {
  hide: '[@media(orientation:landscape)_and_(max-height:500px)]:hidden',
  name: '[@media(orientation:landscape)_and_(max-height:500px)]:text-h3',
}
const handleLabel = computed(() => (props.snap === 'full' ? '收合卡片' : '展開卡片'))
function onHandleKey(e: KeyboardEvent) {
  if (e.key === 'ArrowUp') emit('snapStep', 1)
  else if (e.key === 'ArrowDown') emit('snapStep', -1)
  else return
  e.preventDefault()
}

// 收合段的高度＝把手＋名稱帶（名稱長短、有沒有假名與羅馬拼音都不同）
const head = ref<HTMLElement | null>(null)
const headObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => head.value && emit('headHeight', head.value.offsetHeight)) : null
watch(
  [head, () => Boolean(props.snap)],
  ([el, on], [old] = [null, false]) => {
    if (old) headObserver?.unobserve(old)
    if (el && on) headObserver?.observe(el)
  },
  { immediate: true },
)
onBeforeUnmount(() => headObserver?.disconnect())

function sourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    if (host.includes('wikidata')) return 'Wikidata'
    if (host.includes('openstreetmap')) return 'OpenStreetMap'
    if (host === 'ja.wikipedia.org') return '維基百科（日文）'
    if (host === 'zh.wikipedia.org') return '維基百科（中文）'
    return host
  } catch {
    return url
  }
}

function distance(m: number): string {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`
}
</script>

<template>
  <!-- 手機（snap 有值）：上方是把手＋名稱帶，固定不捲、可以拖（三段高度，DESIGN.md §7.13），照片以下在 sheet 裡捲動。
       桌機：整張卡片一起捲，照片在名稱帶上面（內層用 display: contents，照片 order-first） -->
  <section
    v-if="spot"
    :data-pref="spot.prefecture"
    class="flex h-full flex-col bg-paper text-ink"
    :class="snap ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'"
    aria-label="景點"
  >
    <div
      ref="head"
      class="paper-grain bg-region text-on-region"
      :class="snap ? (noHandle ? 'shrink-0' : 'shrink-0 touch-none select-none') : ''"
      :data-sheet-drag="snap && !noHandle ? '' : undefined"
    >
      <!-- 把手：拖曳或點一下換段；鍵盤上下鍵往上、往下一段。
           觸控時點擊區撐到 44、往下疊進名稱帶 20px（名稱帶本來就能拖），名稱帶上的按鈕疊在把手上面（決定事項 B2） -->
      <button
        v-if="snap && !noHandle"
        type="button"
        :aria-label="handleLabel"
        :aria-expanded="snap !== 'peek'"
        class="relative z-[1] flex h-6 w-full items-start justify-center pt-2 pointer-coarse:-mb-5 pointer-coarse:h-tap"
        @click="emit('snapStep', 0)"
        @keydown="onHandleKey"
      >
        <span class="h-1 w-10 rounded-full bg-on-region/40" aria-hidden="true"></span>
      </button>
      <!-- 手機：卡片、播放、關閉三顆並排，按鈕之間只留 4px，名稱才放得下一行 -->
      <div class="flex items-center" :class="snap ? ['gap-1 pr-2 pb-3 pl-5 [&>button]:relative [&>button]:z-[2]', noHandle ? 'pt-3' : 'pt-0'] : 'gap-3.5 px-5 py-4'">
        <!-- 手機打橫（高 ≤500px）：名稱帶只留日文名、字小一級，半開時下面還看得到內容 -->
        <div class="flex min-w-0 flex-col gap-px" :class="snap ? 'mr-2' : ''">
          <span v-if="spot.name.kana" lang="ja" class="text-caption tracking-kana" :class="snap ? short.hide : ''">{{ spot.name.kana }}</span>
          <h2 lang="ja" class="text-h2 font-black tracking-name" :class="snap ? short.name : ''">{{ spot.name.ja }}</h2>
          <span v-if="spot.name.romaji" class="font-latin text-base font-semibold tracking-romaji uppercase wrap-anywhere" :class="snap ? short.hide : ''">{{ spot.name.romaji }}</span>
        </div>
        <!-- 收合：名稱帶右側放「去過」（工作列在收合時看不到） -->
        <button
          v-if="snap === 'peek'"
          type="button"
          class="ml-auto flex h-tap shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-body-sm font-bold active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
          :class="visited ? 'border-visited bg-visited-tint text-visited' : 'border-on-region bg-transparent text-on-region'"
          :aria-pressed="visited"
          :disabled="!userStore.canSignIn"
          @click="togglePeekVisited"
        >
          <span v-if="visited" :key="peekStamp.key.value" class="grid size-4 place-items-center rounded-full" :class="peekStamp.pressing.value ? 'stamp-ring' : ''">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" :class="peekStamp.pressing.value ? 'animate-stamp-press' : ''">
              <circle cx="12" cy="12" r="9.5" fill="currentColor" />
              <path d="M8.3 12.3l2.5 2.5 4.9-5.1" fill="none" class="stroke-white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
          </svg>
          去過
        </button>
        <template v-else>
          <button
            type="button"
            :aria-label="`${spot.name.ja} 的卡片`"
            title="卡片"
            class="ml-auto grid size-tap shrink-0 place-items-center rounded-full border-[1.5px] border-on-region bg-transparent text-on-region active:not-disabled:translate-y-px"
            @click="cardOpen = true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="5.5" y="3" width="13" height="18" rx="2" /><path d="M8.5 13.5h7M8.5 16.5h4.5" /><rect x="8.5" y="6" width="7" height="5" rx="1" />
            </svg>
          </button>
          <button
            v-if="canSpeak()"
            type="button"
            :aria-label="`播放 ${spot.name.ja}`"
            class="grid size-tap shrink-0 place-items-center rounded-full border-[1.5px] border-on-region bg-transparent text-on-region active:not-disabled:translate-y-px"
            @click="speakJa(spot.name.kana || spot.name.ja)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </button>
        </template>
        <button
          v-if="snap"
          type="button"
          aria-label="關閉"
          class="grid size-tap shrink-0 place-items-center rounded-full text-on-region hover:bg-region-accent active:not-disabled:translate-y-px"
          @click="emit('close')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <div
      :class="snap ? 'flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain' : 'contents'"
      :inert="snap === 'peek' ? true : undefined"
    >
      <div ref="photoFrame" class="photo-frame relative h-[170px] shrink-0 overflow-hidden bg-placeholder" :class="snap ? '' : 'order-first'">
        <img
          v-if="image"
          data-photo
          :key="image.url"
          :src="image.src"
          :alt="spot.name.ja"
          class="size-full object-cover"
          referrerpolicy="no-referrer"
          @error="imageTry++"
        />
        <a
          v-if="image"
          :href="image.source_url"
          target="_blank"
          rel="noopener"
          class="absolute right-2 bottom-2 z-[1] max-w-[85%] truncate rounded-tag bg-ink/70 px-1.5 text-caption text-white no-underline"
        >{{ image.author }} / {{ image.license }}</a>
        <button
          v-if="!snap"
          type="button"
          aria-label="關閉"
          class="absolute top-2 right-2 z-[1] grid size-tap place-items-center rounded-full bg-paper/90 text-ink active:not-disabled:translate-y-px"
          @click="emit('close')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="flex flex-col px-5 pt-0.5">
        <div v-if="showZh" class="flex border-b border-line-soft py-2.5 text-body-sm">
          <span class="w-[72px] shrink-0 text-sub">中文</span><span>{{ spot.name.zh_tw }}</span>
        </div>
        <div v-if="station" class="flex border-b border-line-soft py-2.5 text-body-sm">
          <span lang="ja" class="w-[72px] shrink-0 text-sub">最寄駅</span>
          <span class="flex flex-wrap items-baseline gap-x-2">
            <span lang="ja">{{ station.name.ja }}</span>
            <span v-if="station.name.kana" lang="ja" class="text-caption text-sub">{{ station.name.kana }}</span>
            <span class="font-num text-caption text-sub">{{ distance(station.distance_m) }}</span>
          </span>
        </div>
        <div v-if="category.length" class="flex border-b border-line-soft py-2.5 text-body-sm">
          <span class="w-[72px] shrink-0 text-sub">分類</span><span>{{ category.join('　') }}</span>
        </div>
        <div v-if="castle" class="flex border-b border-line-soft py-2.5 text-body-sm">
          <span class="w-[72px] shrink-0 text-sub">名城</span>
          <span class="flex min-w-0 flex-col gap-0.5">
            <span><span class="font-latin font-semibold">No.{{ castle.no }}</span><span lang="ja" class="ml-2">{{ castle.label }}</span></span>
            <span v-if="castle.stamp.length" lang="ja" class="text-caption text-sub">スタンプ：{{ castle.stamp.join('、') }}</span>
          </span>
        </div>
        <!-- 主題列暫停（PLAN.md §5：主題層暫停），資料保留 -->
        <a
          :href="mapsUrl"
          target="_blank"
          rel="noopener"
          class="flex min-h-tap items-center justify-between border-b border-line-soft py-2.5 text-body-sm font-bold text-ink no-underline hover:text-sub active:text-sub lg:hidden"
        >
          在 Google Maps 開啟
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M7 17L17 7M9 7h8v8" />
          </svg>
        </a>
      </div>

      <figure v-if="spot.summary" class="mx-5 mt-3.5 flex flex-col gap-1">
        <SummaryText :summary="spot.summary" />
        <figcaption class="text-caption text-sub">
          <a :href="spot.summary.source_url" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-4"
            >維基百科（{{ { zh: '中文', en: '英文', ja: '日文' }[spot.summary.lang] }}）</a
          >・{{ spot.summary.license }}
        </figcaption>
      </figure>

      <!-- 附近的擴充包小點（設定中啟用的擴充包）：找大點時順便看到可以塞的小點 -->
      <section
        v-for="nb in nearby ?? []"
        :key="nb.pack"
        class="mx-5 mt-4 flex flex-col"
        :style="{ '--pack': `var(--color-t-${nb.color})` }"
      >
        <h3 class="flex items-baseline gap-1.5 pb-1 text-caption font-bold tracking-section text-sub">
          附近的{{ nb.label }}<span class="font-num font-normal tracking-normal">{{ nb.items.length }}</span>
        </h3>
        <button
          v-for="it in nb.items"
          :key="it.id"
          type="button"
          class="-mx-1.5 flex min-h-tap items-center gap-3 rounded-control px-1.5 text-left hover:bg-surface active:bg-surface"
          @click="emit('selectPack', it.id)"
        >
          <span class="size-2.5 shrink-0 rounded-full bg-(--pack)" aria-hidden="true"></span>
          <span lang="ja" class="min-w-0 truncate text-body-sm font-bold">{{ it.n }}</span>
          <span class="shrink-0 text-caption text-sub">{{ it.group }}</span>
          <span class="ml-auto shrink-0 font-num text-caption text-sub">{{ distance(it.d) }}</span>
        </button>
      </section>

      <div class="mx-5 mt-2 flex flex-wrap gap-x-3 text-caption text-sub pointer-coarse:-my-3.5 pointer-coarse:items-center">
        <span>來源</span>
        <a v-for="s in spot.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener" class="text-sub pointer-coarse:py-3.5">{{ sourceLabel(s.url) }}</a>
      </div>

      <!-- 手機：收藏・去過・清單・行程貼在 sheet 底部，不必先捲到最下面；Google Maps 移到上面的資訊列 -->
      <div data-toast-above class="mt-auto flex flex-col gap-2 border-t border-line px-5 pt-3.5 pb-5 max-lg:sticky max-lg:bottom-0 max-lg:z-[2] max-lg:bg-paper max-lg:px-3 max-lg:pt-2 max-lg:pb-2">
        <SpotActions v-if="spotRef" :spot="spotRef" @stamped="onStamped" />
        <a
          :href="mapsUrl"
          target="_blank"
          rel="noopener"
          class="flex h-11 grow items-center justify-center rounded-control bg-region-strong px-4 text-body-sm font-bold text-white no-underline max-lg:hidden active:translate-y-px"
        >在 Google Maps 開啟</a>
      </div>
    </div>
    <CardViewer
      v-if="cardOpen && card"
      :card="card.face"
      :rarity="card.rarity"
      :label="card.label"
      :number="card.number"
      :visited="card.visited"
      :visited-on="card.visitedOn"
      :variants="cardVariants.length ? cardVariants : undefined"
      :variant-total="cardVariants.length ? allVariants(card.rarity, hasNight(card.face)).length : undefined"
      @close="cardOpen = false"
    />
  </section>
  <!-- 載入中：照片、名稱、按鈕的佔位（DESIGN.md §9 skeleton） -->
  <section v-else-if="loading" class="flex h-full flex-col bg-paper" aria-busy="true" aria-label="景點">
    <div class="skeleton h-[170px] shrink-0" :class="snap ? 'order-1' : ''"></div>
    <div class="flex shrink-0 flex-col gap-2 bg-region px-5" :class="snap ? 'pt-0 pb-4' : 'py-4'">
      <div v-if="snap" class="mx-auto mt-2 mb-1.5 h-1 w-10 rounded-full bg-on-region/40" aria-hidden="true"></div>
      <div class="skeleton h-3 w-24 rounded-full"></div>
      <div class="skeleton h-7 w-44 rounded-full"></div>
      <div class="skeleton h-3 w-32 rounded-full"></div>
    </div>
    <div class="grid grid-cols-2 gap-2 px-5 pt-4" :class="snap ? 'order-2' : ''">
      <div v-for="n in 4" :key="n" class="skeleton h-11 rounded-control"></div>
    </div>
    <div class="flex flex-col gap-2 px-5 pt-5" :class="snap ? 'order-3' : ''">
      <div v-for="n in 4" :key="n" class="skeleton h-3 rounded-full" :class="n === 4 ? 'w-2/3' : 'w-full'"></div>
    </div>
  </section>
</template>

<style scoped>
</style>
