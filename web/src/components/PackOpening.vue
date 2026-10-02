<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useCardDraw } from '../composables/cardDraw'
import { type CollectionCard, useCollection } from '../composables/collection'
import { useVisitedEntries } from '../composables/visited'
import type { Rarity } from '../services/card'
import { drawVariants, hasNight, ownedVariants, type Variant } from '../services/cardVariants'
import { dayDate, type Trip } from '../services/trip'
import { useCardsStore } from '../stores/cards'
import { useWalletStore } from '../stores/wallet'
import type { Mark } from '../stores/marks'
import RegionMotif from './RegionMotif.vue'
import SpotCard from './SpotCard.vue'

// 開卡包（DESIGN.md §7.19）：行程結束後，這趟去過的地方包成一包卡。點一下撕開，
// 卡片疊在中央，一張一張翻開（一般在前、最稀有的最後），稀有卡翻開時背後放光；翻完排成一覽。
// （收集卡的十連抽是另一個元件 TenPull.vue）
const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ close: [] }>()

const entries = computed<Array<[string, Mark]>>(() => {
  const t = props.trip
  return t.days.flatMap((d, i) => d.stops.map((s): [string, Mark] => [s.spot_id, { pref: s.pref, name: s.name, visited: true, visited_on: dayDate(t, i) }]))
})
// 這一趟的日期各抽一次樣式
const tripDates = computed(() => {
  const m = new Map<string, Array<string | null>>()
  const t = props.trip
  t.days.forEach((d, i) => d.stops.forEach((s) => m.set(s.spot_id, [...(m.get(s.spot_id) ?? []), dayDate(t, i) ?? null])))
  return m
})
const { cards } = useCollection(() => entries.value, (id) => tripDates.value.get(id))
const RANK: Record<Rarity, number> = { normal: 0, castle: 1, gold: 2, rainbow: 3 }
// 卡包（DESIGN.md §7.19b）：這趟去過的景點，第一次去過的各送一次免費抽（每個景點只送一次，
// 重開卡包、取消再勾去過都不會再送）；已經送過的顯示這趟的季節卡
const cardsStore = useCardsStore()
const wallet = useWalletStore()
const cardDraw = useCardDraw()
const { datesById } = useVisitedEntries()
const redraws = ref(new Map<string, Variant>())
type DeckCard = CollectionCard & { key: string }
/** 這趟拿到的：這趟日期的季節卡（沒有日期是基本卡） */
const tripCard = (c: DeckCard): Variant =>
  (tripDates.value.get(c.face.id) ?? [null]).flatMap((d) => drawVariants(d)).sort((a, b) => b.rank - a.rank)[0]!
/** 這張卡在卡包裡的樣子：這次抽到的，沒有就是這趟的季節卡 */
const shown = (c: DeckCard): Variant => redraws.value.get(c.key) ?? tripCard(c)
// 同一個景點只算一張；稀有度、分數低的先翻
const deck = computed<DeckCard[]>(() => {
  const seen = new Set<string>()
  return cards.value
    .filter((c) => !seen.has(c.face.id) && seen.add(c.face.id))
    .map((c) => ({ ...c, key: c.face.id }))
    .sort((a, b) => shown(a).rank - shown(b).rank || RANK[a.rarity] - RANK[b.rarity] || a.score - b.score)
})
const title = computed(() => props.trip.name || '未命名行程')
const mainPref = computed(() => {
  const n = new Map<string, number>()
  for (const [, m] of entries.value) n.set(m.pref, (n.get(m.pref) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
})

type Stage = 'sealed' | 'opening' | 'dealing' | 'done'
const stage = ref<Stage>('sealed')
const index = ref(0)
const flipped = ref(false)
const revealed = ref<DeckCard[]>([])
const current = computed(() => deck.value[index.value] ?? null)

// 翻開時背後的光：特別全景是虹、金箔是金、全景是白光，其他照稀有度
function raysKind(c: DeckCard): string {
  const k = shown(c).kind
  if (k === 'special') return 'rainbow'
  if (k === 'gold') return 'gold'
  if (k === 'silver') return 'silver'
  if (k !== 'base' && k !== 'season' && c.rarity === 'normal') return 'castle'
  return c.rarity
}
function open() {
  if (stage.value !== 'sealed' || !deck.value.length) return
  const next = new Map<string, Variant>()
  for (const c of deck.value) {
    if (!wallet.claimFree(c.face.id)) continue
    const dates = [...(datesById.value.get(c.face.id) ?? []), ...(tripDates.value.get(c.face.id) ?? [])]
    const night = hasNight(c.face)
    const owned = ownedVariants(dates, c.rarity, night, cardsStore.extraOf(c.face.id)).map((v) => v.key)
    const v = cardDraw.drawFor({ spotId: c.face.id, rarity: c.rarity, night, owned }, true)
    if (v) next.set(c.key, v)
  }
  redraws.value = next
  stage.value = 'opening'
  setTimeout(() => (stage.value = 'dealing'), 900)
}
function next() {
  if (stage.value === 'sealed') return open()
  if (stage.value !== 'dealing' || !current.value) return
  if (!flipped.value) {
    flipped.value = true
    navigator.vibrate?.(raysKind(current.value) === 'normal' ? 8 : 20)
    return
  }
  revealed.value = [...revealed.value, current.value]
  flipped.value = false
  index.value++
  if (index.value >= deck.value.length) finish()
}
function revealAll() {
  revealed.value = [...deck.value]
  index.value = deck.value.length
  finish()
}
function finish() {
  stage.value = 'done'
  markOpened(props.trip.id)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    next()
  }
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<script lang="ts">
const KEY = 'hm-packs-opened'
/** 這台裝置上打開過卡包的行程（只是「還沒開」的提示用） */
export function packOpened(tripId: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]).includes(tripId)
  } catch {
    return false
  }
}
function markOpened(tripId: string) {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]
    if (!list.includes(tripId)) localStorage.setItem(KEY, JSON.stringify([...list, tripId]))
  } catch {
    // 記不住只是提示還在
  }
}
</script>

<template>
  <div class="fixed inset-0 z-[66] flex flex-col items-center justify-center gap-5 overflow-hidden bg-ink/80 p-4 print:hidden" role="dialog" aria-modal="true" aria-label="卡包">
    <!-- 封著的卡包 -->
    <div v-if="stage === 'sealed' || stage === 'opening'" class="pack-stage" :class="stage" :data-pref="mainPref ?? undefined">
      <button type="button" class="pack paper-grain relative block overflow-hidden rounded-[18px] bg-region text-on-region" aria-label="打開卡包" @click="open">
        <span class="pack-top absolute inset-x-0 top-0 h-[14%] border-b-2 border-dashed border-on-region/40 bg-region-strong/30"></span>
        <RegionMotif :pref="mainPref ?? undefined" class="absolute top-1/2 left-1/2 size-[220px] -translate-x-1/2 -translate-y-1/2 opacity-70" />
        <span class="relative flex h-full flex-col items-center justify-end gap-1 px-4 pb-6 text-center">
          <span lang="ja" class="text-[30px] leading-none font-black">一巡り</span>
          <span class="line-clamp-2 text-label font-bold">{{ title }}</span>
          <span class="font-latin text-body-sm font-semibold">{{ deck.length }} 張</span>
        </span>
        <span class="pack-sheen pointer-events-none absolute inset-0" aria-hidden="true"></span>
      </button>
    </div>

    <!-- 一張一張翻 -->
    <div v-else-if="stage === 'dealing' && current" class="relative flex flex-col items-center gap-4">
      <div v-if="flipped && raysKind(current) !== 'normal'" class="rays" :class="`rays-${raysKind(current)}`" :data-pref="current.face.pref" aria-hidden="true"></div>
      <button :key="current.key" type="button" class="deal-card relative [perspective:1400px]" :aria-label="flipped ? `下一張（${current.face.name.ja}）` : '翻開'" @click="next">
        <span class="flip relative block [transform-style:preserve-3d]" :class="{ 'is-flipped': flipped }">
          <span class="flip-back paper-grain absolute inset-0 grid place-items-center overflow-hidden rounded-[16px] bg-region text-on-region" :data-pref="mainPref ?? undefined">
            <RegionMotif :pref="mainPref ?? undefined" class="absolute size-[260px] opacity-80" />
            <span lang="ja" class="relative text-[34px] font-black">一巡り</span>
          </span>
          <span class="flip-front block">
            <SpotCard :card="current.face" :rarity="current.rarity" :label="current.label" :number="current.number" visited :visited-on="current.visitedOn" size="lg" :variant="shown(current)" />
          </span>
        </span>
      </button>
      <p class="font-latin text-body-sm text-paper/80">{{ index + 1 }} / {{ deck.length }}</p>
    </div>

    <!-- 翻完：一覽 -->
    <div v-else-if="stage === 'done'" class="flex max-h-full w-full max-w-3xl flex-col gap-4 overflow-x-hidden overflow-y-auto p-3">
      <p class="text-center text-h3 font-black text-paper">{{ title }}　<span class="font-latin">{{ deck.length }}</span> 張</p>
      <ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
        <li v-for="(c, i) in revealed" :key="c.key" class="deal-in @container" :style="{ '--i': Math.min(i, 15) }">
          <SpotCard :card="c.face" :rarity="c.rarity" :label="c.label" :number="c.number" visited :visited-on="c.visitedOn" size="fluid" :variant="shown(c)" />
        </li>
      </ul>
    </div>

    <!-- 已翻開的排在下方 -->
    <ul v-if="stage === 'dealing' && revealed.length" class="flex max-w-full gap-2 overflow-x-auto px-2 pb-1" aria-label="已翻開">
      <li v-for="c in revealed" :key="c.key" class="mini w-12 shrink-0 @container">
        <SpotCard :card="c.face" :rarity="c.rarity" :number="c.number" size="fluid" :variant="shown(c)" />
      </li>
    </ul>

    <div class="flex gap-2">
      <button v-if="stage === 'sealed'" type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink" :disabled="!deck.length" @click="open">打開</button>
      <button v-if="stage === 'dealing'" type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper" @click="revealAll">全部翻開</button>
      <RouterLink v-if="stage === 'done'" to="/log/cards" class="flex h-11 items-center rounded-control bg-paper px-5 text-body-sm font-bold text-ink no-underline" @click="emit('close')">收集冊</RouterLink>
      <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper" @click="emit('close')">關閉</button>
    </div>
  </div>
</template>

<style scoped>
.pack {
  width: min(240px, 60vw);
  aspect-ratio: 5 / 8;
  box-shadow: 0 1.5em 3em color-mix(in oklab, var(--color-shade) 45%, transparent);
  animation: pack-float 2.6s ease-in-out infinite;
}
@keyframes pack-float {
  50% {
    transform: translateY(-8px) rotate(-1deg);
  }
}
.pack-sheen {
  background: linear-gradient(105deg, transparent 35%, color-mix(in oklab, var(--color-glare) 55%, transparent) 50%, transparent 65%);
  background-size: 300% 100%;
  mix-blend-mode: overlay;
  animation: pack-sheen 2.6s ease-in-out infinite;
}
@keyframes pack-sheen {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -20% 0;
  }
}
/* 撕開：上緣飛走、包裝往下掉 */
.opening .pack {
  animation: pack-drop 0.7s 0.25s cubic-bezier(0.5, 0, 0.75, 0) both;
}
.opening .pack-top {
  animation: pack-tear 0.45s cubic-bezier(0.2, 0.7, 0.3, 1) both;
}
@keyframes pack-tear {
  to {
    transform: translate(40px, -140px) rotate(24deg);
    opacity: 0;
  }
}
@keyframes pack-drop {
  to {
    transform: translateY(70vh) rotate(6deg);
    opacity: 0;
  }
}

.deal-card {
  animation: card-rise 0.5s cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
@keyframes card-rise {
  from {
    transform: translateY(40vh) scale(0.7);
    opacity: 0;
  }
}
.flip {
  width: 320px;
  aspect-ratio: 5 / 7;
  transform: rotateY(180deg);
  transition: transform 0.65s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.flip.is-flipped {
  transform: rotateY(0deg);
}
.flip-back,
.flip-front {
  backface-visibility: hidden;
}
.flip-back {
  transform: rotateY(180deg);
  box-shadow: 0 0.6em 1.6em color-mix(in oklab, var(--color-shade) 35%, transparent);
}

/* 稀有卡翻開時背後的光 */
.rays {
  position: absolute;
  left: 50%;
  top: 45%;
  width: 900px;
  aspect-ratio: 1;
  translate: -50% -50%;
  border-radius: 50%;
  mask: radial-gradient(circle closest-side, #000 0 25%, transparent 95%);
  background: repeating-conic-gradient(var(--ray) 0deg 3deg, transparent 3deg 12deg);
  animation:
    rays-in 0.6s var(--ease-out-soft) both,
    rays-spin 20s linear infinite;
  pointer-events: none;
}
.rays-castle {
  --ray: color-mix(in oklab, var(--region-accent) 80%, transparent);
}
.rays-silver {
  --ray: color-mix(in oklab, var(--color-silver-1) 85%, transparent);
}
.rays-gold {
  --ray: color-mix(in oklab, var(--color-gold-2) 85%, transparent);
}
.rays-rainbow {
  background: conic-gradient(var(--color-foil-1), var(--color-foil-2), var(--color-foil-3), var(--color-foil-4), var(--color-foil-5), var(--color-foil-1));
  mask:
    radial-gradient(circle closest-side, #000 0 25%, transparent 95%),
    repeating-conic-gradient(#000 0deg 3deg, transparent 3deg 12deg);
  mask-composite: intersect;
}
@keyframes rays-in {
  from {
    opacity: 0;
    scale: 0.4;
  }
}
@keyframes rays-spin {
  to {
    rotate: 1turn;
  }
}

.mini {
  animation: card-rise 0.35s var(--ease-out-soft) both;
}
.deal-in {
  animation: card-rise 0.45s var(--ease-out-soft) both;
  animation-delay: calc(var(--i) * 50ms);
}
@media (prefers-reduced-motion: reduce) {
  .pack,
  .pack-sheen,
  .rays {
    animation: none;
  }
}
</style>
