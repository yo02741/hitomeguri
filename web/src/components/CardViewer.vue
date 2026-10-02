<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { useTilt } from '../composables/tilt'
import type { CardFace, Rarity } from '../services/card'
import { reveal, showReveal } from '../services/cardReveal'
import { BASE_VARIANT, hasNight, missingVariants, type Variant } from '../services/cardVariants'
import { useCardDraw } from '../composables/cardDraw'
import { useCardsStore } from '../stores/cards'
import { cardKey, useFreshStore } from '../stores/fresh'
import { useWalletStore } from '../stores/wallet'
import NewTag from './NewTag.vue'
import SpotCard from './SpotCard.vue'

// 收集卡放大檢視（DESIGN.md §7.19）：畫面中央一張大卡，點卡片翻面；手機可以用傾斜角度讓卡片轉動。
// 收集冊裡可以左右切換上一張、下一張（方向鍵、左右滑）。Esc、點背景或「關閉」離開。
// 去過的景點可以「抽一張」（用一張抽獎券，只抽還沒有的）；新拿到還沒看過的樣式標 NEW。
// 收集到兩種以上時可以把目前這種設為收集冊的封面（stores/cards.ts）。
// 打開時焦點在卡片上：Space、Enter 翻面。
const props = defineProps<{
  card: CardFace
  rarity: Rarity
  label?: string
  number?: string
  visited?: boolean
  visitedOn?: string | null
  /** 收集冊：第幾張／共幾張 */
  position?: { index: number; total: number }
  /** 收集冊：到地圖上看這個景點 */
  to?: RouteLocationRaw
  /** 收集到的樣式（DESIGN.md §7.19a）與全部樣式的數量 */
  variants?: Variant[]
  variantTotal?: number
}>()
const emit = defineEmits<{ close: []; step: [delta: -1 | 1] }>()

// 抽一張（DESIGN.md §7.19b）：用一張抽獎券，從這個景點還沒有的樣式裡抽，不會重複；都有了就不能抽
const cards = useCardsStore()
const wallet = useWalletStore()
const fresh = useFreshStore()
const cardDraw = useCardDraw()
const missing = computed(() => (props.variants ? missingVariants(props.rarity, hasNight(props.card), props.variants.map((v) => v.key)).length : 0))
const canDraw = computed(() => props.visited && Boolean(props.variants))
let drawnKey: string | null = null
function drawOneCard() {
  const v = cardDraw.drawFor({ spotId: props.card.id, rarity: props.rarity, night: hasNight(props.card), owned: props.variants?.map((x) => x.key) ?? [] })
  if (!v) return
  drawnKey = v.key
  showReveal({ face: props.card, rarity: props.rarity, label: props.label ?? '', number: props.number ?? '', variant: v })
}
// 抽完樣式清單更新時，切到剛抽到的那種
watch(
  () => props.variants,
  (list) => {
    if (!drawnKey || !list) return
    const i = list.findIndex((v) => v.key === drawnKey)
    if (i >= 0) vi.value = i
    drawnKey = null
  },
)

const tilt = useTilt(18)
// 樣式：預設看封面那張（自己選的，沒選就是基本）；換卡時回到封面
const coverIndex = () => Math.max(0, props.variants?.findIndex((v) => v.key === cards.coverOf(props.card.id)) ?? 0)
const vi = ref(coverIndex())
const isCover = computed(() => variant.value.key === cards.coverOf(props.card.id))
function setCover() {
  void cards.setCover(props.card.id, variant.value.key)
}
const variant = computed(() => props.variants?.[vi.value] ?? props.variants?.[0] ?? BASE_VARIANT)
// 看到的那一種就不是 NEW 了
watch(
  () => [props.card.id, variant.value.key] as const,
  ([id, key]) => fresh.seen([cardKey(id, key)]),
  { immediate: true },
)
const flipped = ref(false)
const gyro = ref(false)
// 觸控裝置才顯示「傾斜手機」
const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

// 換卡時回到正面，並從滑動的方向進場
const enterFrom = ref<'left' | 'right' | null>(null)
const cardEl = ref<HTMLElement | null>(null)
watch(
  () => props.card.id,
  async () => {
    flipped.value = false
    vi.value = coverIndex()
    // 換卡時卡片元素重建，焦點跟著移到新的卡片
    await nextTick()
    cardEl.value?.focus()
  },
)
function step(delta: -1 | 1) {
  if (!props.position) return
  const i = props.position.index + delta
  if (i < 0 || i >= props.position.total) return
  enterFrom.value = delta > 0 ? 'right' : 'left'
  emit('step', delta)
}

async function startGyro() {
  gyro.value = await tilt.useGyro()
}
function onKey(e: KeyboardEvent) {
  // 新卡入手正在亮相、十連抽的卡包開著時，Esc 只關那一層
  if (reveal.value) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
  else if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
    e.preventDefault()
    flipped.value = !flipped.value
  }
}

// 左右滑換卡；滑過的那一下不算點擊（不翻面）
let startX: number | null = null
let swiped = false
function onPointerDown(e: PointerEvent) {
  startX = e.pointerType === 'mouse' ? null : e.clientX
  swiped = false
}
function onPointerUp(e: PointerEvent) {
  if (startX === null) return
  const dx = e.clientX - startX
  startX = null
  if (Math.abs(dx) > 48) {
    swiped = true
    step(dx < 0 ? 1 : -1)
  }
}
function onCardClick() {
  if (swiped) {
    swiped = false
    return
  }
  flipped.value = !flipped.value
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  cardEl.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      class="viewer fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-ink/75 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="`${card.name.ja} 的卡片`"
      @click.self="emit('close')"
    >
      <div class="flex items-center gap-3">
        <button
          v-if="position"
          type="button"
          class="nav grid size-11 place-items-center rounded-full bg-paper/90 text-ink disabled:opacity-30 max-sm:hidden"
          aria-label="上一張"
          :disabled="position.index === 0"
          @click="step(-1)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div
          :key="card.id"
          ref="cardEl"
          role="button"
          tabindex="0"
          class="viewer-card cursor-pointer rounded-[16px]"
          :class="enterFrom ? `from-${enterFrom}` : ''"
          :aria-label="flipped ? '翻回正面' : '翻到背面'"
          @click="onCardClick"
          @pointerdown="onPointerDown"
          @pointerup="onPointerUp"
          @pointermove="tilt.onPointerMove"
          @pointerleave="tilt.reset"
        >
          <SpotCard
            :card="card"
            :rarity="rarity"
            :label="label"
            :number="number"
            :visited="visited"
            :visited-on="visitedOn"
            size="lg"
            :flipped="flipped"
            :tilt="tilt"
            :variant="variant"
          />
        </div>
        <button
          v-if="position"
          type="button"
          class="nav grid size-11 place-items-center rounded-full bg-paper/90 text-ink disabled:opacity-30 max-sm:hidden"
          aria-label="下一張"
          :disabled="position.index >= position.total - 1"
          @click="step(1)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <p v-if="position" class="font-latin text-label text-white/80" aria-live="polite">{{ position.index + 1 }} / {{ position.total }}</p>
      <!-- 樣式：收集到的幾種之間切換 -->
      <div v-if="variants && variants.length" class="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="樣式">
        <button
          v-for="(v, i) in variants"
          :key="v.key"
          type="button"
          class="relative h-8 rounded-full px-3 text-caption font-bold"
          :class="i === vi ? 'bg-paper text-ink' : 'bg-paper/15 text-white hover:bg-paper/25'"
          :aria-pressed="i === vi"
          @click="vi = i"
        >
          {{ v.label }}
          <NewTag v-if="fresh.has(cardKey(card.id, v.key))" class="absolute -top-2 -right-1.5" />
        </button>
        <span v-if="variantTotal" class="ml-1 font-latin text-caption text-white/70">{{ variants.length }} / {{ variantTotal }}</span>
      </div>
      <!-- 收集冊的封面：這個景點在收集冊顯示哪一種 -->
      <button
        v-if="visited && variants && variants.length > 1"
        type="button"
        class="cover-btn -mt-2 flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-bold"
        :class="isCover ? 'text-white/70' : 'text-white underline decoration-white/40 underline-offset-4 hover:decoration-white'"
        :disabled="isCover"
        @click="setCover"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" :fill="isCover ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" /></svg>
        {{ isCover ? '收集冊的封面' : '設為收集冊的封面' }}
      </button>
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-if="touch && !tilt.reduced"
          type="button"
          class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink disabled:opacity-60"
          :disabled="gyro"
          @click="startGyro"
        >
          {{ gyro ? '傾斜手機看看' : '用手機傾斜' }}
        </button>
        <button
          v-if="canDraw"
          type="button"
          class="flex h-10 items-center gap-2 rounded-full bg-paper px-4 text-label font-bold text-ink disabled:opacity-50"
          :disabled="!missing || !wallet.canSpend(1)"
          @click="drawOneCard"
        >
          {{ missing ? '抽一張' : '已收齊' }}
          <span v-if="missing" class="font-latin text-caption font-semibold text-sub">券 {{ wallet.left }}</span>
        </button>
        <button type="button" class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink" @click="flipped = !flipped">
          {{ flipped ? '正面' : '背面' }}
        </button>
        <RouterLink
          v-if="to"
          :to="to"
          class="flex h-10 items-center rounded-full bg-paper px-4 text-label font-bold text-ink no-underline"
        >
          地圖
        </RouterLink>
        <button type="button" class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink" @click="emit('close')">
          關閉
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.viewer {
  animation: viewer-in 0.2s var(--ease-out-soft) both;
}
.viewer-card {
  animation: card-in 0.45s var(--ease-out-soft) both;
}
.viewer-card.from-right {
  animation-name: card-from-right;
  animation-duration: 0.32s;
}
.viewer-card.from-left {
  animation-name: card-from-left;
  animation-duration: 0.32s;
}
@keyframes viewer-in {
  from {
    opacity: 0;
  }
}
@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(24px) rotateX(18deg);
  }
}
@keyframes card-from-right {
  from {
    opacity: 0;
    transform: translateX(64px) rotateY(-24deg);
  }
}
@keyframes card-from-left {
  from {
    opacity: 0;
    transform: translateX(-64px) rotateY(24deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .viewer,
  .viewer-card {
    animation: none;
  }
}
@media (max-width: 400px) {
  .viewer-card :deep(.card-scene) {
    font-size: 14px;
  }
}
</style>
