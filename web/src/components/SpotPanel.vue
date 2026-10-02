<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { Spot } from '../services/bundles'
import { cardFromSpot, cardNumberFor, designationOf, rarityLabel, rarityOf } from '../services/card'
import { showReveal } from '../services/cardReveal'
import { allVariants, drawVariants, hasNight, ownedVariants } from '../services/cardVariants'
import { todayIso } from '../services/userdb'
import { useCardDraw } from '../composables/cardDraw'
import { useVisitedEntries } from '../composables/visited'
import { PREF_GIFT_IDS } from '../data/outfitGifts'
import { useCardsStore } from '../stores/cards'
import { outfitKey, useFreshStore } from '../stores/fresh'
import { useWalletStore } from '../stores/wallet'
import { googleMapsUrl } from '../services/maps'
import { canSpeak, speakJa } from '../services/tts'
import { useCatalogStore } from '../stores/catalog'
import { useMarksStore } from '../stores/marks'
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
}>()
const emit = defineEmits<{ close: []; selectPack: [id: string] }>()

// 圖片載入失敗（Commons 暫時無法取得等）時退回底色，不顯示破圖
const imageFailed = ref(false)
watch(() => props.spot?.id, () => (imageFailed.value = false))
const image = computed(() => (imageFailed.value ? undefined : props.spot?.images[0]))
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
  <section
    v-if="spot"
    :data-pref="spot.prefecture"
    class="flex h-full flex-col overflow-y-auto bg-paper text-ink"
    aria-label="景點"
  >
    <div class="photo-frame relative h-[170px] shrink-0 overflow-hidden bg-placeholder">
      <img
        v-if="image"
        data-photo
        :key="image.url"
        :src="image.url"
        :alt="spot.name.ja"
        class="size-full object-cover"
        referrerpolicy="no-referrer"
        @error="imageFailed = true"
      />
      <a
        v-if="image"
        :href="image.source_url"
        target="_blank"
        rel="noopener"
        class="absolute right-2 bottom-2 max-w-[85%] truncate rounded-tag bg-ink/50 px-1.5 text-[11px] text-white no-underline"
      >{{ image.author }} / {{ image.license }}</a>
      <button
        type="button"
        aria-label="關閉"
        class="absolute top-2 right-2 grid size-tap place-items-center rounded-full bg-paper/90 text-ink"
        @click="emit('close')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>

    <div class="paper-grain flex items-center gap-3.5 bg-region px-5 py-4 text-on-region">
      <div class="flex min-w-0 flex-col gap-px">
        <span v-if="spot.name.kana" lang="ja" class="text-caption tracking-kana opacity-85">{{ spot.name.kana }}</span>
        <h2 lang="ja" class="text-h2 font-black tracking-name">{{ spot.name.ja }}</h2>
        <span v-if="spot.name.romaji" class="font-latin text-base font-semibold tracking-romaji uppercase">{{ spot.name.romaji }}</span>
      </div>
      <button
        type="button"
        :aria-label="`${spot.name.ja} 的卡片`"
        title="卡片"
        class="ml-auto grid size-tap shrink-0 place-items-center rounded-full border-[1.5px] border-on-region bg-transparent text-on-region"
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
        class="grid size-tap shrink-0 place-items-center rounded-full border-[1.5px] border-on-region bg-transparent text-on-region"
        @click="speakJa(spot.name.kana || spot.name.ja)"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" />
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
          <span class="font-latin text-caption text-sub">{{ distance(station.distance_m) }}</span>
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
    </div>

    <figure v-if="spot.summary" class="mx-5 mt-3.5 flex flex-col gap-1">
      <SummaryText :summary="spot.summary" />
      <figcaption class="text-caption text-sub">
        <a :href="spot.summary.source_url" target="_blank" rel="noopener" class="text-sub"
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
        附近的{{ nb.label }}<span class="font-latin font-normal tracking-normal">{{ nb.items.length }}</span>
      </h3>
      <button
        v-for="it in nb.items"
        :key="it.id"
        type="button"
        class="-mx-1.5 flex min-h-tap items-center gap-3 rounded-control px-1.5 text-left hover:bg-surface"
        @click="emit('selectPack', it.id)"
      >
        <span class="size-2.5 shrink-0 rounded-full bg-(--pack)" aria-hidden="true"></span>
        <span lang="ja" class="min-w-0 truncate text-body-sm font-bold">{{ it.n }}</span>
        <span class="shrink-0 text-caption text-sub">{{ it.group }}</span>
        <span class="ml-auto shrink-0 font-latin text-caption text-sub">{{ distance(it.d) }}</span>
      </button>
    </section>

    <div class="mx-5 mt-2 flex flex-wrap gap-x-3 text-caption text-sub">
      <span>來源</span>
      <a v-for="s in spot.sources" :key="s.url" :href="s.url" target="_blank" rel="noopener" class="text-sub">{{ sourceLabel(s.url) }}</a>
    </div>

    <div class="mt-auto flex flex-col gap-2 border-t border-line px-5 pt-3.5 pb-5">
      <SpotActions v-if="spotRef" :spot="spotRef" @stamped="onStamped" />
      <a
        :href="mapsUrl"
        target="_blank"
        rel="noopener"
        class="flex h-11 grow items-center justify-center rounded-control bg-region-strong px-4 text-body-sm font-bold text-white no-underline active:translate-y-px"
      >在 Google Maps 開啟</a>
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
    <div class="skeleton h-[170px] shrink-0"></div>
    <div class="flex flex-col gap-2 bg-region px-5 py-4">
      <div class="skeleton h-3 w-24 rounded-full"></div>
      <div class="skeleton h-7 w-44 rounded-full"></div>
      <div class="skeleton h-3 w-32 rounded-full"></div>
    </div>
    <div class="grid grid-cols-2 gap-2 px-5 pt-4">
      <div v-for="n in 4" :key="n" class="skeleton h-11 rounded-control"></div>
    </div>
    <div class="flex flex-col gap-2 px-5 pt-5">
      <div v-for="n in 4" :key="n" class="skeleton h-3 rounded-full" :class="n === 4 ? 'w-2/3' : 'w-full'"></div>
    </div>
  </section>
</template>

<style scoped>
</style>
