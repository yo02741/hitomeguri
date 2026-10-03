<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import BackLink from '../components/BackLink.vue'
import CardRules from '../components/CardRules.vue'
import CardViewer from '../components/CardViewer.vue'
import NewTag from '../components/NewTag.vue'
import JapanMap from '../components/JapanMap.vue'
import RollingNumber from '../components/RollingNumber.vue'
import SeasonDrift from '../components/SeasonDrift.vue'
import SpotCard from '../components/SpotCard.vue'
import TenPull, { type Pull } from '../components/TenPull.vue'
import { useCardDraw } from '../composables/cardDraw'
import { type CollectionCard, useCollection } from '../composables/collection'
import { useVisitedEntries } from '../composables/visited'
import { type Region, regions } from '../data/regions'
import { cardFromSpot } from '../services/card'
import { hasNight } from '../services/cardVariants'
import { useCatalogStore } from '../stores/catalog'
import { useFreshStore } from '../stores/fresh'
import { TICKET_RULES, useWalletStore } from '../stores/wallet'
import { useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 收集冊（DESIGN.md §7.19）：去過的景點做成收集卡，依縣（JIS 順）排列，縣內依卡號（分數）。
// 放大檢視時才載入該縣的詳細資料，換上簡介與照片出處。
const userStore = useUserStore()
const marks = useMarksStore()
const catalog = useCatalogStore()
const { entries, datesById } = useVisitedEntries()

const { cards, pendingByPref, castleTotal, castleDone, prefDone } = useCollection(() => entries.value, (id) => datesById.value.get(id))

// 篩選：依屬性（一張卡可以同時是名城和國寶）
type FilterKey = 'all' | 'heritage' | 'castle' | 'treasure' | 'special'
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'heritage', label: '世界遺產' },
  { key: 'castle', label: '名城' },
  { key: 'treasure', label: '國寶・特別史跡・特別名勝' },
  { key: 'special', label: '全景・金箔' },
]
const matches: Record<FilterKey, (e: CollectionCard) => boolean> = {
  all: () => true,
  heritage: (e) => e.face.designation === '世界遺產',
  castle: (e) => e.castle,
  treasure: (e) => Boolean(e.face.designation && e.face.designation !== '世界遺產'),
  special: (e) => e.variants.some((v) => v.rank >= 2),
}
const filter = ref<FilterKey>('all')
// 卡面：自己選的封面；沒選時是基本卡，只有篩「全景・金箔」時顯示最稀有的那種
const shownVariant = (e: CollectionCard) => (filter.value === 'special' && !e.coverChosen ? e.variants[0]! : e.cover)
const counts = computed(() => Object.fromEntries(FILTERS.map((f) => [f.key, cards.value.filter(matches[f.key]).length])) as Record<FilterKey, number>)

interface Group {
  region: Region
  items: CollectionCard[]
  pending: number
}
const groups = computed<Group[]>(() => {
  const by = new Map<string, CollectionCard[]>()
  for (const e of cards.value) {
    if (!matches[filter.value](e)) continue
    const list = by.get(e.face.pref) ?? []
    list.push(e)
    by.set(e.face.pref, list)
  }
  return regions.flatMap((r) => {
    const items = (by.get(r.prefecture) ?? []).sort((a, b) => b.score - a.score || a.face.id.localeCompare(b.face.id))
    const pending = filter.value === 'all' ? (pendingByPref.value.get(r.prefecture) ?? 0) : 0
    return items.length || pending ? [{ region: r, items, pending }] : []
  })
})
// 地圖上每縣的張數；點縣跳到那一縣
const perPref = computed(() => {
  const m = new Map<string, number>()
  for (const e of cards.value) m.set(e.face.pref, (m.get(e.face.pref) ?? 0) + 1)
  return m
})
// 畫面外的卡先不畫，用估計的高度佔位（.deal），和實際高度不同：直接捲過去會停在別的縣。
// 捲之前先把目標以上的縣排一次版（排過的卡記得實際高度，之後再收起來也不會變），目標的位置才會準
// 排完等一個畫面（瀏覽器在那時記下實際高度），捲完再收起來
const laidOut = ref<string | null>(null)
let layoutTimer = 0
const frame = () => new Promise(requestAnimationFrame)
async function jumpTo(pref: string) {
  filter.value = 'all'
  clearTimeout(layoutTimer)
  laidOut.value = pref
  await nextTick()
  await frame()
  await frame()
  document.querySelector(`section[data-pref="${pref}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  layoutTimer = window.setTimeout(() => (laidOut.value = null), 1500)
}
onBeforeUnmount(() => clearTimeout(layoutTimer))
const above = computed(() => {
  const i = laidOut.value ? groups.value.findIndex((g) => g.region.prefecture === laidOut.value) : -1
  return new Set(groups.value.slice(0, Math.max(0, i)).map((g) => g.region.prefecture))
})
const flat = computed(() => groups.value.flatMap((g) => g.items))

// 放大檢視：依目前的篩選左右切換；打開時載入該縣的詳細資料換上簡介與照片出處
const openId = ref<string | null>(null)
const openIndex = computed(() => flat.value.findIndex((e) => e.face.id === openId.value))
const opened = computed(() => (openIndex.value >= 0 ? flat.value[openIndex.value] : null))
watch(opened, (e) => {
  if (e) void catalog.loadDetail(e.face.pref)
})
const openedFace = computed(() => {
  const e = opened.value
  const d = e ? catalog.details[e.face.pref]?.[e.face.id] : undefined
  return d ? cardFromSpot(d) : e?.face
})
function step(delta: -1 | 1) {
  const e = flat.value[openIndex.value + delta]
  if (e) openId.value = e.face.id
}
// 十連抽（DESIGN.md §7.19b）：用 10 張抽獎券，從去過、還沒收齊的景點裡抽 10 種還沒有的樣式（剩不到 10 種就抽剩下的）
const wallet = useWalletStore()
const fresh = useFreshStore()
const cardDraw = useCardDraw()
const missingTotal = computed(() => cards.value.reduce((s, e) => s + e.variantTotal - e.variants.length, 0))
const variantTotal = computed(() => cards.value.reduce((s, e) => s + e.variantTotal, 0))
const tenCount = computed(() => Math.min(10, missingTotal.value))
const tenPull = ref<Pull[] | null>(null)
const tenKey = ref(0)
function drawTen() {
  const byId = new Map(cards.value.map((e) => [e.face.id, e]))
  const got = cardDraw.drawAcross(cards.value.map((e) => ({ spotId: e.face.id, rarity: e.rarity, night: hasNight(e.face), owned: e.variants.map((v) => v.key) })), 10)
  if (!got.length) return
  tenKey.value++
  tenPull.value = got.map(([t, v]) => {
    const e = byId.get(t.spotId)!
    return { face: e.face, rarity: e.rarity, label: e.label, number: e.number, visitedOn: e.visitedOn, variant: v }
  })
}
const showTickets = ref(false)
const showRules = ref(false)

function onCardKey(e: KeyboardEvent, id: string) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    openId.value = id
  }
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 pt-9 pb-24 max-sm:px-4">
    <header class="paper-grain relative overflow-hidden rounded-card bg-region p-6 text-on-region max-sm:p-5">
      <SeasonDrift :pref="null" />
      <div class="relative grid grid-cols-[minmax(0,1fr)_minmax(0,44%)] items-center gap-6 max-sm:gap-2 sm:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div class="flex min-w-0 flex-col gap-4">
          <BackLink to="/log" on-region>紀錄</BackLink>
          <h1 class="flex items-baseline gap-3 text-h1 font-black tracking-title">
            收集冊<RollingNumber :value="cards.length" class="font-latin text-h3 font-semibold tracking-normal" />
          </h1>
          <p class="flex items-baseline gap-2 text-label font-bold">
            都道府縣<span class="whitespace-nowrap font-latin text-body-sm">{{ prefDone.size }} / 47</span>
          </p>
          <div v-if="castleTotal" class="flex max-w-[420px] flex-col gap-1.5">
            <p class="flex flex-wrap items-baseline gap-x-2 text-label font-bold">
              日本100名城・続日本100名城<span class="whitespace-nowrap font-latin text-body-sm">{{ castleDone }} / {{ castleTotal }}</span>
            </p>
            <div class="h-3.5 overflow-hidden rounded-[2px] bg-paper/55" aria-hidden="true">
              <div class="h-full rounded-[2px] bg-t-castle" :style="{ width: `${(castleDone / castleTotal) * 100}%` }"></div>
            </div>
          </div>
        </div>
        <JapanMap :done="prefDone" :counts="perPref" @pick="jumpTo" />
      </div>
    </header>

    <template v-if="userStore.user">
      <!-- 抽卡：抽獎券、十連抽 -->
      <div v-if="cards.length" class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-paper px-4 py-3 sm:gap-x-4">
        <button type="button" class="flex items-baseline gap-1.5 text-label text-sub hover:text-ink active:text-ink pointer-coarse:-my-2 pointer-coarse:py-2" :aria-expanded="showTickets" @click="showTickets = !showTickets">
          抽獎券<span class="font-latin text-h3 font-bold text-ink">{{ wallet.left }}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" class="self-center transition-transform" :class="showTickets ? 'rotate-180' : ''" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        <span class="text-label text-sub">樣式 <span class="whitespace-nowrap font-latin"><span class="font-bold text-ink">{{ variantTotal - missingTotal }}</span> / {{ variantTotal }}</span></span>
        <button type="button" class="h-8 rounded-control px-2 text-label font-bold text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="showRules = true">規則</button>
        <button
          type="button"
          class="ml-auto h-10 rounded-full bg-ink px-4 text-label sm:px-5 font-bold text-paper disabled:opacity-40 active:not-disabled:translate-y-px pointer-coarse:h-tap"
          :disabled="!tenCount || !wallet.canSpend(tenCount)"
          @click="drawTen"
        >
          {{ !missingTotal ? '已收齊' : tenCount < 10 ? `抽 ${tenCount} 張` : '十連抽' }}
        </button>
        <dl v-if="showTickets" class="grid w-full grid-cols-[auto_auto_1fr] gap-x-4 gap-y-1 border-t border-line pt-3 text-caption text-sub">
          <dt>去過的景點</dt><dd class="font-latin text-ink">{{ wallet.breakdown.spots }} × {{ TICKET_RULES.spot }}</dd><dd></dd>
          <dt>去過的縣</dt><dd class="font-latin text-ink">{{ wallet.breakdown.prefs }} × {{ TICKET_RULES.pref }}</dd><dd></dd>
          <dt>去過的地方</dt><dd class="font-latin text-ink">{{ wallet.breakdown.areas }} × {{ TICKET_RULES.area }}</dd><dd></dd>
          <dt>每 10 個景點</dt><dd class="font-latin text-ink">{{ wallet.breakdown.bonus }} × {{ TICKET_RULES.every10 }}</dd><dd></dd>
          <dt>成就</dt><dd class="font-latin text-ink">{{ wallet.breakdown.achv }} × {{ TICKET_RULES.achv }}</dd><dd></dd>
          <dt>用掉</dt><dd class="font-latin text-ink">{{ wallet.used }}</dd><dd></dd>
        </dl>
      </div>

      <div v-if="entries.length" role="group" aria-label="篩選" class="flex flex-wrap gap-2">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          type="button"
          class="flex h-9 items-center gap-2 rounded-full border px-3.5 text-label active:not-disabled:translate-y-px pointer-coarse:h-tap"
          :class="filter === f.key ? 'border-ink bg-ink font-bold text-paper' : 'border-line bg-paper text-ink hover:bg-surface'"
          :aria-pressed="filter === f.key"
          @click="filter = f.key"
        >
          <span v-if="f.key !== 'all'" class="swatch size-3 rounded-full" :class="`swatch-${f.key}`" aria-hidden="true"></span>
          {{ f.label }}
          <RollingNumber :value="counts[f.key]" class="font-latin" />
        </button>
      </div>

      <section v-for="g in groups" :key="g.region.prefecture" :data-pref="g.region.prefecture" class="flex flex-col gap-4" :class="{ 'lay-out': above.has(g.region.prefecture) }" :aria-label="g.region.name.ja">
        <h2 class="flex items-center gap-2.5">
          <span class="h-5 w-1.5 rounded-full bg-region-strong" aria-hidden="true"></span>
          <span lang="ja" class="text-h3 font-black tracking-[2px]">{{ g.region.name.ja }}</span>
          <span class="font-latin text-label font-semibold tracking-[0.2em] text-sub uppercase">{{ g.region.name.romaji }}</span>
          <span class="ml-auto font-latin text-body-sm text-sub">{{ g.items.length || g.pending }}</span>
        </h2>
        <ul class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <li v-for="(e, i) in g.items" :key="e.face.id" class="deal relative @container" :class="{ 'deal-in': i < 12 }" :style="{ '--i': i }">
            <div
              role="button"
              tabindex="0"
              class="rounded-[5cqi] outline-offset-4"
              :aria-label="[e.face.name.ja, e.label, e.number].filter(Boolean).join('・')"
              @click="openId = e.face.id"
              @keydown="onCardKey($event, e.face.id)"
            >
              <SpotCard :card="e.face" :rarity="e.rarity" :label="e.label" :number="e.number" visited :visited-on="e.visitedOn" size="fluid" :variant="shownVariant(e)" lite />
            </div>
            <NewTag v-if="fresh.spotHasNew(e.face.id)" class="absolute -top-1.5 -left-1.5 z-10" />
            <p v-if="e.variants.length > 1" class="mt-1.5 flex justify-center gap-1 text-caption text-sub">
              <span class="whitespace-nowrap font-latin">{{ e.variants.length }} / {{ e.variantTotal }}</span> 種
            </p>
          </li>
          <li v-for="n in g.pending" :key="`p${n}`" class="skeleton aspect-[5/7] rounded-[10px]" aria-hidden="true"></li>
        </ul>
      </section>

      <p v-if="marks.loaded && !entries.length" class="flex flex-wrap items-center gap-x-3 text-body-sm text-sub">還沒有去過的地方<RouterLink to="/" class="inline-flex min-h-tap items-center font-bold text-region-strong active:not-disabled:translate-y-px">到地圖找地方</RouterLink></p>
      <p v-else-if="cards.length && !groups.length" class="flex flex-wrap items-center gap-x-3 text-body-sm text-sub">
        沒有符合的卡片
        <button type="button" class="inline-flex min-h-tap items-center font-bold text-region-strong active:not-disabled:translate-y-px" @click="filter = 'all'">看全部</button>
      </p>
      <p v-if="cards.length" class="text-caption text-sub">照片：Wikimedia Commons，作者與授權在卡片背面。</p>
    </template>
    <p v-else class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>

    <CardRules v-if="showRules" @close="showRules = false" />
    <CardViewer
      v-if="opened && openedFace"
      :card="openedFace"
      :rarity="opened.rarity"
      :label="opened.label"
      :number="opened.number"
      visited
      :visited-on="opened.visitedOn"
      :position="{ index: openIndex, total: flat.length }"
      :variants="opened.variants"
      :variant-total="opened.variantTotal"
      :to="{ path: `/map/${opened.face.pref}`, query: { spot: opened.face.id } }"
      @step="step"
      @close="openId = null"
    />
    <TenPull v-if="tenPull" :key="tenKey" :pulls="tenPull" title="十連抽" :can-again="tenCount > 0 && wallet.canSpend(tenCount)" @again="drawTen" @close="tenPull = null" />
  </section>
</template>

<style scoped>
/* 畫面外的卡先不畫（收集冊有上百張卡）。四周留 1rem 給 NEW 標記與卡片陰影，不被 paint containment 裁掉；
 * 滑鼠移上去、聚焦時取消，傾斜時的大陰影才不會被裁 */
.deal {
  content-visibility: auto;
  contain-intrinsic-size: auto 360px;
  padding: 1rem;
  margin: -1rem;
}
.deal:hover,
.deal:focus-within,
.lay-out .deal {
  content-visibility: visible;
}
/* 發牌：第一屏的卡依序從下方翻上來（只有前 12 張；動畫結束後不保留 transform，才不會一直佔著合成層） */
.deal-in {
  animation: deal-in 0.5s var(--ease-out-soft) backwards;
  animation-delay: calc(var(--i) * 45ms);
}
@keyframes deal-in {
  from {
    opacity: 0;
    transform: translateY(18px) rotate(-2deg) scale(0.96);
  }
}
/* 篩選鈕的小色票：與卡片箔片同色 */
.swatch-heritage {
  background: conic-gradient(var(--color-foil-1), var(--color-foil-2), var(--color-foil-3), var(--color-foil-4), var(--color-foil-5), var(--color-foil-1));
}
.swatch-castle {
  background: var(--color-t-castle);
}
.swatch-special {
  background: repeating-linear-gradient(62deg, var(--color-gold-2) 0 1.5px, var(--color-gold-3) 1.5px 3px);
}
.swatch-treasure {
  background: linear-gradient(135deg, var(--color-gold-1), var(--color-gold-2), var(--color-gold-3));
}
</style>
