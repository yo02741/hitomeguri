<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useModal } from '../composables/modal'
import { useTilt } from '../composables/tilt'
import type { CardFace, Rarity } from '../services/card'
import type { Variant } from '../services/cardVariants'
import NewTag from './NewTag.vue'
import RegionMotif from './RegionMotif.vue'
import SpotCard from './SpotCard.vue'

// 十連抽（DESIGN.md §7.19b）：收集冊從還沒收齊的景點抽十種（都是新的，標 NEW）。十張卡背面朝上一次排成 5×2，發完牌後由左上依序自動翻開；
// 稀有的（銀箔、金箔、特別全景）翻開前停一下、翻開後背後放光。
// 「全部翻開」一次翻完；點還沒翻的那張先翻那張；翻開的點一下放大看。
// 版面用視窗寬高算卡寬，整個畫面放得下，不出捲軸。
export interface Pull {
  face: CardFace
  rarity: Rarity
  label: string
  number: string
  visitedOn: string | null
  variant: Variant
}
const props = defineProps<{ pulls: Pull[]; title: string; canAgain?: boolean }>()
const emit = defineEmits<{ close: []; again: [] }>()

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const open = ref<boolean[]>(props.pulls.map(() => false))
const done = computed(() => open.value.every(Boolean))
const zoom = ref<number | null>(null)
const tilt = useTilt(16)
// 打開時焦點移到對話框裡的第一個按鈕
const firstBtn = ref<HTMLButtonElement | null>(null)

// 翻開時背後的光：特別全景虹、金箔金、銀箔銀，全景・夜景・墨繪・切手淡淡的地區色
function glow(v: Variant): string {
  if (v.kind === 'special') return 'rainbow'
  if (v.kind === 'gold') return 'gold'
  if (v.kind === 'silver') return 'silver'
  if (v.rank >= 2) return 'soft'
  return ''
}
const rare = (v: Variant) => v.rank >= 3

let timers: number[] = []
const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
let running = true
function flip(i: number) {
  if (open.value[i]) return
  const next = [...open.value]
  next[i] = true
  open.value = next
  navigator.vibrate?.(rare(props.pulls[i]!.variant) ? 24 : 6)
}
// 發牌（0.06 秒一張）→ 依序翻：一般 0.26 秒一張，稀有的前後多停一下
async function autoFlip() {
  if (reduced) {
    open.value = props.pulls.map(() => true)
    return
  }
  await wait(props.pulls.length * 60 + 520)
  for (let i = 0; i < props.pulls.length && running; i++) {
    if (open.value[i]) continue
    const r = rare(props.pulls[i]!.variant)
    if (r) await wait(420)
    if (!running) return
    flip(i)
    await wait(r ? 700 : 260)
  }
}
function flipAll() {
  running = false
  open.value = props.pulls.map(() => true)
}
function onCell(i: number) {
  if (!open.value[i]) flip(i)
  else zoom.value = i
}

// Esc（<dialog> 的 cancel）：放大檢視時先收起放大
const { cancel, closed } = useModal(
  () => {
    if (zoom.value !== null) zoom.value = null
    else emit('close')
  },
  () => emit('close'),
)
onMounted(() => {
  firstBtn.value?.focus()
  void autoFlip()
})
onBeforeUnmount(() => {
  running = false
  timers.forEach(clearTimeout)
  timers = []
})

const zoomed = computed(() => (zoom.value === null ? null : props.pulls[zoom.value]))
</script>

<template>
  <dialog
    ref="dlg"
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent print:hidden"
    :aria-label="title"
    @cancel="cancel"
    @close="closed"
  >
    <div class="ten relative flex size-full flex-col items-center justify-center gap-[2.4vh] overflow-hidden bg-ink/90 px-4 backdrop-blur-sm">
      <p class="text-center text-h3 font-black text-paper">{{ title }}</p>

      <ol class="grid grid-cols-[repeat(5,var(--cw))] gap-(--g)" aria-label="十張卡">
        <li
          v-for="(p, i) in pulls"
          :key="i"
          class="slot relative aspect-[5/7] @container"
          :class="{ 'is-open': open[i], 'is-rare': rare(p.variant) }"
          :style="{ '--i': i, '--col': i % 5, '--row': Math.floor(i / 5) }"
        >
          <span v-if="open[i] && glow(p.variant)" class="glow pointer-events-none absolute" :class="`glow-${glow(p.variant)}`" :data-pref="p.face.pref" aria-hidden="true"></span>
          <button
            type="button"
            class="relative block size-full [perspective:900px]"
            :aria-label="open[i] ? `放大（${p.variant.label}）` : `翻開第 ${i + 1} 張`"
            @click="onCell(i)"
          >
            <span class="flip relative block size-full [transform-style:preserve-3d]">
              <span class="back paper-grain absolute inset-0 grid place-items-center overflow-hidden rounded-[5cqi] bg-region text-on-region" :data-pref="p.face.pref">
                <RegionMotif :pref="p.face.pref" class="absolute size-[120cqi] opacity-80" />
                <span lang="ja" class="relative text-[17cqi] leading-none font-black">一巡り</span>
              </span>
              <span class="front absolute inset-0 block">
                <SpotCard :card="p.face" :rarity="p.rarity" :label="p.label" :number="p.number" size="fluid" :variant="p.variant" />
              </span>
            </span>
          </button>
          <NewTag v-if="open[i]" class="new absolute -top-2 -left-1.5 z-10" />
        </li>
      </ol>

      <div class="flex gap-2">
        <button v-if="!done" ref="firstBtn" type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink active:not-disabled:translate-y-px" @click="flipAll">全部翻開</button>
        <button v-else-if="canAgain" type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink active:not-disabled:translate-y-px" @click="emit('again')">再十連抽</button>
        <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper active:not-disabled:translate-y-px" @click="emit('close')">關閉</button>
      </div>

      <!-- 放大看一張 -->
      <div v-if="zoomed" class="zoom absolute inset-0 grid place-items-center bg-ink/70" @click="zoom = null">
        <div class="cursor-pointer" role="button" tabindex="0" aria-label="收起" @pointermove="tilt.onPointerMove" @pointerleave="tilt.reset" @keydown.enter="zoom = null">
          <SpotCard :card="zoomed.face" :rarity="zoomed.rarity" :label="zoomed.label" :number="zoomed.number" visited :visited-on="zoomed.visitedOn" size="lg" :tilt="tilt" :variant="zoomed.variant" />
        </div>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* 卡寬：橫向放 5 張、縱向放 2 張（扣掉標題與按鈕），最大 190px */
.ten {
  --g: clamp(6px, 1.4vw, 18px);
  --cw: min(190px, calc((100vw - 32px - 4 * var(--g)) / 5), calc((100dvh - 190px - var(--g)) / 2 * 5 / 7));
  animation: ten-in 0.2s var(--ease-out-soft) both;
}
@keyframes ten-in {
  from {
    opacity: 0;
  }
}
/* 發牌：從整排的中央飛到自己的位置 */
.slot {
  animation: deal 0.5s var(--ease-out-soft) both;
  animation-delay: calc(var(--i) * 60ms);
}
@keyframes deal {
  from {
    opacity: 0;
    transform: translate(calc((2 - var(--col)) * (var(--cw) + var(--g))), calc((0.5 - var(--row)) * (var(--cw) * 1.4 + var(--g)) + 30vh)) rotate(-8deg) scale(0.8);
  }
}
.flip {
  transform: rotateY(180deg);
  transition: transform 0.55s var(--ease-flip);
}
.is-open .flip {
  transform: rotateY(0deg);
}
.back,
.front {
  backface-visibility: hidden;
}
.back {
  transform: rotateY(180deg);
  box-shadow: 0 0.4em 1em color-mix(in oklab, var(--color-shade) 35%, transparent);
}
/* 年代主題：卡背的陰影跟著年代（江戶沒有陰影，§13），同 SpotCard */
:root[data-theme] .back {
  box-shadow: var(--era-card-shadow);
}
/* 稀有的翻開前：輕輕抖一下 */
.is-rare:not(.is-open) .flip {
  animation: shiver 0.42s ease-in-out calc(var(--i) * 60ms + 0.5s) 1;
}
@keyframes shiver {
  25% {
    transform: rotateY(180deg) rotate(-2deg);
  }
  75% {
    transform: rotateY(180deg) rotate(2deg);
  }
}

/* 翻開後背後的光 */
.glow {
  inset: -30%;
  border-radius: 50%;
  animation: glow-in 0.5s var(--ease-out-soft) both;
}
.glow-soft {
  inset: -8%;
  background: radial-gradient(closest-side, color-mix(in oklab, var(--region-accent) 70%, transparent), transparent);
}
.glow-silver,
.glow-gold,
.glow-rainbow {
  mask: radial-gradient(closest-side, #000 30%, transparent);
  background: repeating-conic-gradient(var(--ray) 0deg 4deg, transparent 4deg 14deg);
  animation:
    glow-in 0.5s var(--ease-out-soft) both,
    glow-spin 18s linear infinite;
}
.glow-silver {
  --ray: color-mix(in oklab, var(--color-silver-1) 85%, transparent);
}
.glow-gold {
  --ray: color-mix(in oklab, var(--color-gold-2) 85%, transparent);
}
.glow-rainbow {
  background: conic-gradient(var(--color-foil-1), var(--color-foil-2), var(--color-foil-3), var(--color-foil-4), var(--color-foil-5), var(--color-foil-1));
  mask:
    radial-gradient(closest-side, #000 30%, transparent),
    repeating-conic-gradient(#000 0deg 4deg, transparent 4deg 14deg);
  mask-composite: intersect;
}
@keyframes glow-in {
  from {
    opacity: 0;
    scale: 0.5;
  }
}
@keyframes glow-spin {
  to {
    rotate: 1turn;
  }
}
.new {
  animation: ten-in 0.3s 0.25s both;
}
.zoom {
  animation: ten-in 0.18s var(--ease-out-soft) both;
}
@media (max-width: 400px) {
  .zoom :deep(.card-scene) {
    font-size: 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ten,
  .slot,
  .glow,
  .zoom,
  .is-rare:not(.is-open) .flip {
    animation: none;
  }
  .flip {
    transition: none;
  }
}
</style>
