<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { useModal } from '../composables/modal'
import { useSwipe } from '../composables/swipe'
import { useTilt } from '../composables/tilt'
import type { CardFace, Rarity } from '../services/card'
import { reveal, showReveal } from '../services/cardReveal'
import { allVariants, BASE_VARIANT, hasNight, isShrine, missingSeasons, type TaskKey, type Variant } from '../services/cardVariants'
import { useCardDraw } from '../composables/cardDraw'
import { useSpotVariants } from '../composables/spotVariants'
import { useCardsStore } from '../stores/cards'
import { cardKey, useFreshStore } from '../stores/fresh'
import { useWalletStore } from '../stores/wallet'
import NewTag from './NewTag.vue'
import SpotCard from './SpotCard.vue'

// 收集卡放大檢視（DESIGN.md §7.19）：畫面中央一張大卡，點卡片翻面；手機可以用傾斜角度讓卡片轉動。
// 收集冊裡可以左右切換上一張、下一張（方向鍵、左右滑）。Esc、點背景或「關閉」離開（原生 <dialog>，composables/modal.ts）。
// 手機（<640）「關閉」在右上角；觸控裝置點卡片翻面，沒有「背面」鈕（手機版計畫第二階段 27）。
// 去過的景點可以「抽一張」（用一張抽獎券，只抽還沒有的季節）；卡片下面「這裡做過的事」勾了就拿到那一種卡。
// 新拿到還沒看過的樣式標 NEW。
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

// 抽一張（DESIGN.md §7.19b）：用一張抽獎券，從這個景點還沒有的季節抽一張，不會重複；四季都有了就不能抽
const cards = useCardsStore()
const wallet = useWalletStore()
const fresh = useFreshStore()
const cardDraw = useCardDraw()
const night = computed(() => hasNight(props.card))
const ownedKeys = computed(() => props.variants?.map((v) => v.key) ?? [])
const missing = computed(() => (props.variants ? missingSeasons(ownedKeys.value).length : 0))
const canDraw = computed(() => props.visited && Boolean(props.variants))
const flipped = ref(false)
// 季節以外的樣式（紀念卡除外）都有了：四季收齊就有紀念卡
const othersDone = computed(() => allVariants(night.value).every((v) => v.kind === 'season' || v.kind === 'special' || ownedKeys.value.includes(v.key)))
function drawOneCard() {
  const before = ownedKeys.value
  if (cardDraw.drawFor({ spotId: props.card.id, owned: before, othersDone: othersDone.value })) expectNew(before)
}

// 這裡做過的事（DESIGN.md §7.19a）：勾了就拿到那一種卡，取消就拿掉。全景看已結束的行程，不能勾
const { tripBySpot } = useSpotVariants()
const ticked = computed(() => cards.tasksOf(props.card.id))
const trip = computed(() => tripBySpot.value.get(props.card.id) ?? null)
const tasks = computed(() => [
  ...(night.value ? [{ key: 'night' as const, label: '晚上去過', card: '夜景' }] : []),
  { key: 'stamp' as const, label: '蓋了紀念章或寄了明信片', card: '切手' },
  { key: 'ink' as const, label: isShrine(props.card.kind) ? '拿到御朱印' : '寫了旅日記', card: '墨繪' },
])
const showTasks = computed(() => props.visited && Boolean(props.variants))
function toggleTask(k: TaskKey) {
  const on = !ticked.value.includes(k)
  if (on) expectNew(ownedKeys.value)
  void cards.setTask(props.card.id, k, on)
}

// 新拿到的樣式（抽到、勾了任務）：樣式清單更新時標 NEW、亮相最稀有的那張（四季或任務剛好收齊時是紀念卡），
// 切到那一種、翻回正面（翻到背面再抽，也是看到新卡的正面）
let before: Set<string> | null = null
let beforeTimer = 0
function expectNew(keys: string[]) {
  before = new Set(keys)
  clearTimeout(beforeTimer)
  beforeTimer = window.setTimeout(() => (before = null), 4000)
}
onBeforeUnmount(() => clearTimeout(beforeTimer))
watch(
  () => props.variants,
  (list) => {
    if (!list) return
    const got = before ? list.filter((v) => !before!.has(v.key)) : []
    if (got.length) {
      before = null
      fresh.add(got.map((v) => cardKey(props.card.id, v.key)))
      const top = got[0]!
      vi.value = list.indexOf(top)
      flipped.value = false
      showReveal({ face: props.card, rarity: props.rarity, label: props.label ?? '', number: props.number ?? '', variant: top })
      return
    }
    // 取消勾選拿掉了一種：停在原本看的那一種，沒有了就回到封面
    const i = list.findIndex((v) => v.key === shownKey.value)
    vi.value = i >= 0 ? i : coverIndex()
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
const shownKey = ref(variant.value.key)
watch(variant, (v) => (shownKey.value = v.key))
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

// 左右滑換卡（composables/swipe.ts）：卡片跟著手指走，順便轉一點；滑過的那一下不算點擊（不翻面）
const swipe = useSwipe({
  el: () => cardEl.value,
  enabled: () => !!props.position,
  canStep: (delta) => {
    const p = props.position
    return !!p && p.index + delta >= 0 && p.index + delta < p.total
  },
  step: (delta) => step(delta),
  transform: (dx) => `translateX(${dx}px) rotateY(${-dx * 0.05}deg)`,
})
function onPointerMove(e: PointerEvent) {
  tilt.onPointerMove(e)
  swipe.onPointerMove(e)
}
function onCardClick() {
  if (swipe.consumeSwipe()) return
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
        class="viewer relative flex size-full flex-col items-center justify-center gap-5 bg-ink/75 p-4"
        :class="{ 'has-tasks': showTasks }"
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
            @pointerdown="swipe.onPointerDown"
            @pointerup="swipe.onPointerUp"
            @pointercancel="swipe.onPointerCancel"
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
        <!-- 控制列：直向排在卡片下面；橫向（手機打橫）排成一欄放在卡片右邊，像切符的副券 -->
        <div class="controls">
          <p v-if="position" class="font-num text-body-sm text-white/80" aria-live="polite">{{ position.index + 1 }} / {{ position.total }}</p>
          <!-- 樣式：收集到的幾種之間切換 -->
          <div v-if="variants && variants.length" class="variants flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="樣式">
            <button
              v-for="(v, i) in variants"
              :key="v.key"
              type="button"
              class="relative h-8 rounded-full px-3 text-caption font-bold active:not-disabled:translate-y-px pointer-coarse:h-tap"
              :class="i === vi ? 'bg-paper text-ink' : 'bg-paper/15 text-white hover:bg-paper/25'"
              :aria-pressed="i === vi"
              @click="vi = i"
            >
              {{ v.label }}
              <NewTag v-if="fresh.has(cardKey(card.id, v.key))" class="absolute -top-2 -right-1.5" />
            </button>
            <span v-if="variantTotal" class="ml-1 font-num text-caption text-white/70">{{ variants.length }} / {{ variantTotal }}</span>
          </div>
          <!-- 收集冊的封面：這個景點在收集冊顯示哪一種 -->
          <button
            v-if="visited && variants && variants.length > 1"
            type="button"
            class="cover-btn -mt-2 flex h-8 items-center justify-center gap-1.5 rounded-full px-3 text-caption font-bold pointer-coarse:h-tap"
            :class="isCover ? 'text-white/70' : 'text-white underline decoration-white/40 underline-offset-4 hover:decoration-white'"
            :disabled="isCover"
            @click="setCover"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" :fill="isCover ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z" /></svg>
            {{ isCover ? '收集冊的封面' : '設為收集冊的封面' }}
          </button>
          <!-- 這裡做過的事：勾了就拿到那一種卡；全景看已結束的行程，不能勾 -->
          <section v-if="showTasks" class="tasks flex flex-col items-center gap-1" aria-labelledby="done-here">
            <h3 id="done-here" class="text-caption font-bold text-white/70">這裡做過的事</h3>
            <ul class="flex max-w-[34rem] flex-wrap justify-center gap-x-1 gap-y-0.5 max-sm:flex-col max-sm:items-start">
              <li v-for="t in tasks" :key="t.key">
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="ticked.includes(t.key)"
                  class="task flex h-8 items-center gap-2 rounded-full px-2.5 text-body-sm text-white hover:bg-paper/15 active:translate-y-px pointer-coarse:h-tap"
                  @click="toggleTask(t.key)"
                >
                  <span class="box grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2 border-paper" :class="ticked.includes(t.key) ? 'bg-paper text-ink' : ''" aria-hidden="true">
                    <svg v-if="ticked.includes(t.key)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                  {{ t.label }}
                  <span class="text-caption text-white/60">{{ t.card }}</span>
                </button>
              </li>
              <li>
                <span
                  role="checkbox"
                  :aria-checked="Boolean(trip)"
                  aria-disabled="true"
                  class="task flex h-8 items-center gap-2 rounded-full px-2.5 text-body-sm text-white/80 pointer-coarse:h-tap"
                >
                  <span class="box grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2 border-paper/50" :class="trip ? 'bg-paper/50 text-ink' : ''" aria-hidden="true">
                    <svg v-if="trip" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                  <span class="max-w-[16rem] truncate">{{ trip ? `行程「${trip.name}」` : '行程裡去過' }}</span>
                  <span class="text-caption text-white/60">全景</span>
                </span>
              </li>
            </ul>
          </section>
          <div class="actions flex flex-wrap justify-center gap-2">
            <button
              v-if="touch && !tilt.reduced"
              type="button"
              class="h-10 rounded-full bg-paper px-4 text-body-sm font-bold text-ink disabled:opacity-60 active:not-disabled:translate-y-px pointer-coarse:h-tap"
              :disabled="gyro"
              @click="startGyro"
            >
              {{ gyro ? '傾斜手機看看' : '用手機傾斜' }}
            </button>
            <button
              v-if="canDraw"
              type="button"
              class="flex h-10 items-center justify-center gap-2 rounded-full bg-paper px-4 text-body-sm font-bold text-ink disabled:opacity-50 active:not-disabled:translate-y-px pointer-coarse:h-tap"
              :disabled="!missing || !wallet.canSpend(1)"
              @click="drawOneCard"
            >
              {{ missing ? '抽一張' : '四季收齊' }}
              <span v-if="missing" class="font-num text-caption font-semibold text-sub">券 {{ wallet.left }}</span>
            </button>
            <!-- 觸控裝置點卡片就會翻面，不另外放「背面」 -->
            <button v-if="!touch" type="button" class="h-10 rounded-full bg-paper px-4 text-body-sm font-bold text-ink active:not-disabled:translate-y-px pointer-coarse:h-tap" @click="flipped = !flipped">
              {{ flipped ? '正面' : '背面' }}
            </button>
            <RouterLink
              v-if="to"
              :to="to"
              class="flex h-10 items-center justify-center rounded-full bg-paper px-4 text-body-sm font-bold text-ink no-underline active:not-disabled:translate-y-px pointer-coarse:h-tap"
            >
              地圖
            </RouterLink>
            <button type="button" class="h-10 rounded-full bg-paper px-4 text-body-sm font-bold text-ink active:not-disabled:translate-y-px max-sm:hidden pointer-coarse:h-tap" @click="emit('close')">
              關閉
            </button>
          </div>
        </div>
        <!-- 手機（<640）：「關閉」在右上角，按鈕列放得進一行 -->
        <button
          type="button"
          class="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] flex h-10 items-center rounded-full bg-paper px-4 text-body-sm font-bold text-ink active:not-disabled:translate-y-px sm:hidden pointer-coarse:h-tap"
          @click="emit('close')"
        >
          關閉
        </button>
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
/* 卡寬（DESIGN.md §7.19）：最寬 320px；也依高度算，扣掉控制列（約 360px）後放得下整張卡。
   卡片用 em 排版，寬 20em：改 font-size 就是改卡寬 */
.viewer {
  --reserve: 360px;
  --cw: min(320px, calc(100vw - 40px), calc((100dvh - var(--reserve)) * 5 / 7));
}
/* 卡片下面有「這裡做過的事」：多扣一兩行（手機排成三四行）；還是放不下（樣式膠囊排成兩行）時整頁上下捲，不蓋到「關閉」 */
.viewer.has-tasks {
  --reserve: 440px;
  justify-content: safe center;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media (max-width: 639px) {
  .viewer.has-tasks {
    padding-top: max(4rem, calc(env(safe-area-inset-top) + 3.5rem));
  }
}
@media (max-width: 639px) {
  .viewer.has-tasks {
    --reserve: 500px;
  }
}
@media (max-width: 400px) {
  .viewer {
    --cw: min(280px, calc((100dvh - var(--reserve)) * 5 / 7));
  }
}
.viewer-card :deep(.card-scene) {
  font-size: calc(var(--cw) / 20);
}
/* 橫卡（DESIGN.md §7.19a）：卡寬 28em。高度和直卡一樣（直卡寬 × 7/5），寬度放不下時縮到畫面寬
   （桌機扣掉左右兩個切換鈕；手機直拿時就是畫面寬） */
.viewer {
  --lw: min(calc(var(--cw) * 1.96), calc(100vw - 152px));
}
@media (max-width: 639px) {
  .viewer {
    --lw: min(calc(var(--cw) * 1.96), calc(100vw - 32px));
  }
}
.viewer-card :deep(.card-scene.landscape) {
  font-size: calc(var(--lw) / 28);
}
.controls {
  display: contents;
}
/* 手機打橫：卡片在左、高度撐滿；控制列一欄在右，用虛線隔開；放不下時控制列自己捲 */
@media (orientation: landscape) and (max-height: 500px) {
  .viewer {
    --cw: min(320px, calc((100dvh - 2rem) * 5 / 7));
    --lw: min(calc(var(--cw) * 1.96), calc(100vw - 13rem - 1.5rem - 2rem - env(safe-area-inset-left) - env(safe-area-inset-right)));
    flex-direction: row;
    gap: 1.5rem;
    padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
  }
  .controls {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
    width: 13rem;
    max-height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.25rem 0 0.25rem 1.5rem;
    border-left: 2px dashed color-mix(in oklab, var(--color-paper) 35%, transparent);
  }
  .controls > p {
    text-align: center;
  }
  /* 樣式排成一行，多的往旁邊捲（上方留給 NEW 標記） */
  .variants {
    flex-wrap: nowrap;
    justify-content: flex-start;
    flex-shrink: 0;
    overflow-x: auto;
    padding-top: 0.5rem;
  }
  .variants > * {
    flex-shrink: 0;
  }
  .controls .cover-btn {
    margin-top: 0;
  }
  .tasks ul {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: flex-start;
  }
  .viewer.has-tasks {
    overflow-y: hidden;
    padding-top: 1rem;
  }
  .actions {
    flex-direction: column;
    flex-wrap: nowrap;
  }
}
</style>
