<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { useModal } from '../composables/modal'
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
// 收集冊裡可以左右切換上一張、下一張（方向鍵、左右滑）。Esc、點背景或「關閉」離開（原生 <dialog>，composables/modal.ts）。
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
const { cancel, closed } = useModal(() => emit('close'))

// 抽一張（DESIGN.md §7.19b）：用一張抽獎券，從這個景點還沒有的樣式裡抽，不會重複；都有了就不能抽
const cards = useCardsStore()
const wallet = useWalletStore()
const fresh = useFreshStore()
const cardDraw = useCardDraw()
const missing = computed(() => (props.variants ? missingVariants(props.rarity, hasNight(props.card), props.variants.map((v) => v.key)).length : 0))
const canDraw = computed(() => props.visited && Boolean(props.variants))
const flipped = ref(false)
let drawnKey: string | null = null
function drawOneCard() {
  const v = cardDraw.drawFor({ spotId: props.card.id, rarity: props.rarity, night: hasNight(props.card), owned: props.variants?.map((x) => x.key) ?? [] })
  if (!v) return
  drawnKey = v.key
  showReveal({ face: props.card, rarity: props.rarity, label: props.label ?? '', number: props.number ?? '', variant: v })
}
// 抽完樣式清單更新時，切到剛抽到的那種，翻回正面（翻到背面再抽，也是看到新卡的正面）
watch(
  () => props.variants,
  (list) => {
    if (!drawnKey || !list) return
    const i = list.findIndex((v) => v.key === drawnKey)
    if (i >= 0) {
      vi.value = i
      flipped.value = false
    }
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
// animate：從滑動的方向轉進來；按住方向鍵連續換卡時不播（每張都從頭播會一直閃）
function step(delta: -1 | 1, animate = true) {
  if (!props.position) return
  const i = props.position.index + delta
  if (i < 0 || i >= props.position.total) return
  enterFrom.value = animate ? (delta > 0 ? 'right' : 'left') : null
  emit('step', delta)
}

async function startGyro() {
  gyro.value = await tilt.useGyro()
}
let lastStep = 0
function onKey(e: KeyboardEvent) {
  // 新卡入手正在亮相時，按鍵只給那一層（Esc 由最上層的 <dialog> 收到）
  if (reveal.value) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    const now = performance.now()
    const quick = e.repeat || now - lastStep < 250
    lastStep = now
    step(e.key === 'ArrowRight' ? 1 : -1, !quick)
  }
  else if ((e.key === ' ' || e.key === 'Enter') && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
    e.preventDefault()
    flipped.value = !flipped.value
  }
}

// 左右滑換卡：卡片跟著手指走（第一張、最後一張往外拉有阻力），放開時拉過 48px 或甩得夠快就換卡，
// 不然彈回原位；滑過的那一下不算點擊（不翻面）。直接寫 style，不經過 reactive。
let drag: { x: number; lastX: number; lastT: number; prevX: number; prevT: number } | null = null
let swiped = false
function onPointerDown(e: PointerEvent) {
  swiped = false
  drag = null
  if (e.pointerType === 'mouse' || !props.position) return
  const t = performance.now()
  drag = { x: e.clientX, lastX: e.clientX, lastT: t, prevX: e.clientX, prevT: t }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function dragDx(clientX: number): number {
  const dx = clientX - (drag?.x ?? clientX)
  const p = props.position
  const edge = p && ((dx > 0 && p.index === 0) || (dx < 0 && p.index >= p.total - 1))
  return edge ? dx * 0.3 : dx
}
function onPointerMove(e: PointerEvent) {
  tilt.onPointerMove(e)
  if (!drag || !cardEl.value) return
  drag.prevX = drag.lastX
  drag.prevT = drag.lastT
  drag.lastX = e.clientX
  drag.lastT = performance.now()
  const dx = dragDx(e.clientX)
  const el = cardEl.value
  // 進場動畫的 fill 會蓋住 inline transform：拖的時候先拿掉（動畫早就播完，看起來不變）
  el.style.animation = 'none'
  el.style.transition = 'none'
  el.style.transform = `translateX(${dx}px) rotateY(${-dx * 0.05}deg)`
}
// 沒換卡：彈回原位
function settle() {
  const el = cardEl.value
  if (!el || !el.style.transform) return
  el.style.transition = 'transform 0.2s var(--ease-out-soft)'
  el.style.transform = ''
  el.addEventListener('transitionend', () => (el.style.transition = ''), { once: true })
}
function onPointerUp(e: PointerEvent) {
  if (!drag) return
  const dx = dragDx(e.clientX)
  // 速度（px/ms）：放開前最後一段移動
  const dt = performance.now() - drag.prevT
  const v = dt > 0 && dt < 100 ? (e.clientX - drag.prevX) / dt : 0
  drag = null
  const delta: -1 | 1 = (Math.abs(dx) > 48 ? dx : v) < 0 ? 1 : -1
  const p = props.position
  const canStep = Boolean(p && p.index + delta >= 0 && p.index + delta < p.total)
  if ((Math.abs(dx) > 48 || Math.abs(v) > 0.11) && canStep) {
    // 新卡用 :key 重建，舊卡的 inline style 跟著消失
    swiped = true
    step(delta)
  } else {
    if (Math.abs(dx) > 8) swiped = true
    settle()
  }
}
function onPointerCancel() {
  drag = null
  settle()
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
    <dialog
      ref="dlg"
      class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent"
      :aria-label="`${card.name.ja} 的卡片`"
      @cancel="cancel"
      @close="closed"
    >
      <div
        data-reduce="fade"
        class="viewer flex size-full flex-col items-center justify-center gap-5 bg-ink/75 p-4"
        @click.self="emit('close')"
      >
        <div class="flex items-center gap-3">
          <button
            v-if="position"
            type="button"
            class="nav grid size-11 place-items-center rounded-full bg-paper/90 text-ink disabled:opacity-30 max-sm:hidden active:not-disabled:translate-y-px"
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
            data-reduce="fade"
            class="viewer-card cursor-pointer rounded-[16px]"
            :class="enterFrom ? `from-${enterFrom}` : ''"
            :aria-label="flipped ? '翻回正面' : '翻到背面'"
            @click="onCardClick"
            @pointerdown="onPointerDown"
            @pointerup="onPointerUp"
            @pointercancel="onPointerCancel"
            @pointermove="onPointerMove"
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
            class="nav grid size-11 place-items-center rounded-full bg-paper/90 text-ink disabled:opacity-30 max-sm:hidden active:not-disabled:translate-y-px"
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
            class="relative h-8 rounded-full px-3 text-caption font-bold active:not-disabled:translate-y-px"
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
            class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink disabled:opacity-60 active:not-disabled:translate-y-px"
            :disabled="gyro"
            @click="startGyro"
          >
            {{ gyro ? '傾斜手機看看' : '用手機傾斜' }}
          </button>
          <button
            v-if="canDraw"
            type="button"
            class="flex h-10 items-center gap-2 rounded-full bg-paper px-4 text-label font-bold text-ink disabled:opacity-50 active:not-disabled:translate-y-px"
            :disabled="!missing || !wallet.canSpend(1)"
            @click="drawOneCard"
          >
            {{ missing ? '抽一張' : '已收齊' }}
            <span v-if="missing" class="font-latin text-caption font-semibold text-sub">券 {{ wallet.left }}</span>
          </button>
          <button type="button" class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink active:not-disabled:translate-y-px" @click="flipped = !flipped">
            {{ flipped ? '正面' : '背面' }}
          </button>
          <RouterLink
            v-if="to"
            :to="to"
            class="flex h-10 items-center rounded-full bg-paper px-4 text-label font-bold text-ink no-underline active:not-disabled:translate-y-px"
          >
            地圖
          </RouterLink>
          <button type="button" class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink active:not-disabled:translate-y-px" @click="emit('close')">
            關閉
          </button>
        </div>
      </div>
    </dialog>
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
@media (max-width: 400px) {
  .viewer-card :deep(.card-scene) {
    font-size: 14px;
  }
}
</style>
