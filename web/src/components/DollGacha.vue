<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useModal } from '../composables/modal'
import type { Outfit } from '../data/outfits'
import { regionOf } from '../data/regions'
import NewTag from './NewTag.vue'

// 旅人的扭蛋（DESIGN.md §7.24）：轉扭蛋機的把手 → 扭蛋從出口掉出來、彈到中央 → 殼分開，貼紙跳出來。
// 殼的顏色看稀有度（常見：地區色、少見：紅、稀有：金）。動畫中點一下直接打開；系統減少動態時直接打開。
const props = defineProps<{ result: { outfit: Outfit; duplicate: boolean }; canDraw: boolean; pref?: string | null }>()
const emit = defineEmits<{ wear: []; again: []; close: [] }>()
const { cancel, closed } = useModal(() => emit('close'))

type Stage = 'turn' | 'drop' | 'open'
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const stage = ref<Stage>(reduced ? 'open' : 'turn')
let timers: number[] = []
function play() {
  timers.forEach(clearTimeout)
  timers = []
  if (reduced) {
    stage.value = 'open'
    void focusFirst()
    return
  }
  stage.value = 'turn'
  timers.push(window.setTimeout(() => (stage.value = 'drop'), 850))
  timers.push(window.setTimeout(open, 1550))
}
const root = ref<HTMLElement | null>(null)
const actions = ref<HTMLElement | null>(null)
function open() {
  timers.forEach(clearTimeout)
  timers = []
  if (stage.value === 'open') return
  stage.value = 'open'
  navigator.vibrate?.(props.result.outfit.rarity === 3 ? 24 : 8)
}
// 打開後焦點移到第一個按鈕（穿上）；減少動態時一開始就是打開的，掛上與再抽時也移過去
async function focusFirst() {
  await nextTick()
  actions.value?.querySelector('button')?.focus()
}
watch(stage, (s) => {
  if (s === 'open') void focusFirst()
})
// 殼分開、淡出之後拿掉整顆扭蛋：兩半都透明時外層 g 的 filter（doll-cut-sm）在 Chromium 會畫出一小塊黑色方塊。
// 減少動態時沒有分開的動畫，打開時就不畫殼。
const shellGone = ref(reduced)
watch(stage, (s) => {
  if (s !== 'open') shellGone.value = false
  else if (reduced) shellGone.value = true
})
// 再抽：結果換了就重播
watch(() => props.result, play)

const shell = computed(() => ['', 'shell-1', 'shell-2', 'shell-3'][props.result.outfit.rarity])
const prefName = computed(() => (props.result.outfit.pref ? (regionOf(props.result.outfit.pref)?.name.ja ?? '') : ''))
// 扭蛋機裡的扭蛋（裝飾）
const BALLS: Array<[number, number, string]> = [
  [62, 118, 'var(--color-item-red)'],
  [96, 128, 'var(--color-item-blue)'],
  [132, 120, 'var(--color-gold-2)'],
  [78, 88, 'var(--color-item-green)'],
  [114, 94, 'var(--color-item-pink)'],
  [146, 86, 'var(--color-item-orange)'],
  [94, 60, 'var(--color-item-purple)'],
  [130, 58, 'var(--color-item-yellow)'],
]

// 動畫中 Enter、Space 直接打開（Esc 由 <dialog> 的 cancel 收起）
function onKey(e: KeyboardEvent) {
  if ((e.key === 'Enter' || e.key === ' ') && stage.value !== 'open') {
    e.preventDefault()
    open()
  }
}
onMounted(() => {
  document.addEventListener('keydown', onKey)
  root.value?.focus()
  play()
})
onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <dialog
    ref="dlg"
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent print:hidden"
    aria-label="抽服裝"
    @cancel="cancel"
    @close="closed"
  >
    <div
      ref="root"
      tabindex="-1"
      class="gacha flex size-full flex-col items-center justify-center gap-5 overflow-hidden bg-ink/85 p-4 outline-none backdrop-blur-sm"
      :data-pref="pref ?? undefined"
      @click="stage !== 'open' && open()"
    >
      <div class="relative grid size-[300px] place-items-center max-sm:size-[260px]">
        <!-- 扭蛋機 -->
        <svg v-if="stage !== 'open'" viewBox="0 0 200 260" class="machine absolute inset-0 size-full" :class="stage" aria-hidden="true">
          <g filter="url(#doll-cut)">
            <rect x="86" y="10" width="28" height="14" rx="4" class="m-strong" />
            <circle cx="100" cy="92" r="72" class="m-glass" />
            <g class="balls">
              <g v-for="([x, y, c], i) in BALLS" :key="i">
                <circle :cx="x" :cy="y" r="16" class="m-ball-top" />
                <path :d="`M${x - 16} ${y} A16 16 0 0 0 ${x + 16} ${y}Z`" :style="{ fill: c }" />
              </g>
            </g>
            <circle cx="100" cy="92" r="72" class="m-glass-shine" />
            <path d="M44 150 L156 150 C164 150 170 156 170 164 L170 238 C170 246 164 252 156 252 L44 252 C36 252 30 246 30 238 L30 164 C30 156 36 150 44 150Z" class="m-strong" />
            <rect x="52" y="160" width="96" height="22" rx="4" class="m-plate" />
            <text x="100" y="176" text-anchor="middle" class="m-plate-text" lang="ja">一巡り</text>
            <circle cx="100" cy="210" r="20" class="m-plate" />
            <rect x="84" y="206" width="32" height="8" rx="4" class="m-strong handle" />
            <rect x="76" y="234" width="48" height="12" rx="4" class="m-chute" />
          </g>
        </svg>

        <!-- 掉出來的扭蛋 -->
        <svg
          v-if="stage !== 'turn' && !shellGone"
          viewBox="0 0 120 120"
          class="capsule absolute size-[150px]"
          :class="[stage, shell]"
          aria-hidden="true"
          @animationend="(e: AnimationEvent) => stage === 'open' && e.animationName.includes('cap-bottom') && (shellGone = true)"
        >
          <g filter="url(#doll-cut-sm)">
            <g class="cap-top">
              <path d="M14 60 A46 46 0 0 1 106 60Z" class="c-clear" />
              <path d="M30 34 C40 24 54 20 66 20" class="c-shine" />
            </g>
            <g class="cap-bottom">
              <path d="M14 60 A46 46 0 0 0 106 60Z" class="c-color" />
              <path d="M14 60 L106 60" class="c-band" />
            </g>
          </g>
        </svg>

        <!-- 打開：貼紙跳出來 -->
        <template v-if="stage === 'open'">
          <div class="rays" :class="`rays-${result.outfit.rarity}`" aria-hidden="true"></div>
          <svg :viewBox="result.outfit.icon" class="prize relative size-[200px] overflow-visible" aria-hidden="true">
            <g filter="url(#doll-cut)" v-html="result.outfit.svg"></g>
          </svg>
        </template>
      </div>

      <div class="flex min-h-[76px] flex-col items-center gap-1 text-paper">
        <template v-if="stage === 'open'">
          <p class="reveal flex items-center gap-2 text-h3 font-black">{{ result.outfit.name }}<NewTag /></p>
          <p v-if="prefName" lang="ja" class="reveal text-body-sm">{{ prefName }}</p>
        </template>
      </div>
      <div ref="actions" class="flex min-h-11 gap-2">
        <template v-if="stage === 'open'">
          <button type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink active:not-disabled:translate-y-px" @click="emit('wear')">穿上</button>
          <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper disabled:opacity-40 active:not-disabled:translate-y-px" :disabled="!canDraw" @click="emit('again')">再抽一次</button>
          <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper active:not-disabled:translate-y-px" @click="emit('close')">關閉</button>
        </template>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.gacha {
  animation: fade-in 0.18s var(--ease-out-soft) both;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
.m-strong {
  fill: var(--region-strong);
}
.m-glass {
  fill: color-mix(in oklab, var(--color-item-white) 55%, transparent);
}
.m-glass-shine {
  fill: none;
  stroke: var(--color-item-white);
  stroke-opacity: 0.7;
  stroke-width: 5;
  stroke-dasharray: 60 400;
  stroke-dashoffset: -250;
  stroke-linecap: round;
}
.m-ball-top {
  fill: var(--color-item-white);
  opacity: 0.9;
}
.m-plate {
  fill: var(--color-item-cream);
}
.m-plate-text {
  fill: var(--region-strong);
  font-family: var(--font-ja);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0.2em;
}
.m-chute {
  fill: var(--color-doll-line);
  opacity: 0.75;
}
/* 轉把手、機器晃一下、裡面的扭蛋跟著動 */
.machine {
  animation: machine-in 0.3s var(--ease-out-soft) both;
}
@keyframes machine-in {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96);
  }
}
.machine .handle {
  transform-box: fill-box;
  transform-origin: center;
  animation: handle-turn 0.7s 0.1s cubic-bezier(0.5, 0, 0.3, 1) both;
}
@keyframes handle-turn {
  to {
    transform: rotate(360deg);
  }
}
.machine .balls {
  animation: balls-jiggle 0.7s 0.1s ease-in-out both;
}
@keyframes balls-jiggle {
  30% {
    transform: translate(3px, -4px);
  }
  60% {
    transform: translate(-3px, -2px);
  }
}
.machine.drop {
  animation: machine-out 0.45s 0.15s ease-in both;
}
@keyframes machine-out {
  to {
    opacity: 0;
    transform: translateY(40px) scale(0.92);
  }
}

/* 扭蛋：從出口（下方）彈到中央 */
.c-clear {
  fill: color-mix(in oklab, var(--color-item-white) 70%, transparent);
}
.c-shine {
  fill: none;
  stroke: var(--color-item-white);
  stroke-width: 5;
  stroke-linecap: round;
}
.c-band {
  stroke: var(--color-doll-line);
  stroke-opacity: 0.25;
  stroke-width: 2;
}
.shell-1 .c-color {
  fill: var(--region-accent);
}
.shell-2 .c-color {
  fill: var(--color-item-red);
}
.shell-3 .c-color {
  fill: var(--color-gold-2);
}
.capsule.drop {
  animation: capsule-drop 0.7s var(--ease-flip) both;
}
@keyframes capsule-drop {
  from {
    transform: translateY(110px) scale(0.35) rotate(-40deg);
  }
}
.capsule .cap-top,
.capsule .cap-bottom {
  transform-box: fill-box;
  transform-origin: center bottom;
}
.capsule.open .cap-top {
  animation: cap-top 0.55s var(--ease-out-soft) both;
}
.capsule.open .cap-bottom {
  transform-origin: center top;
  animation: cap-bottom 0.55s var(--ease-out-soft) both;
}
@keyframes cap-top {
  to {
    transform: translate(-70px, -80px) rotate(-35deg);
    opacity: 0;
  }
}
@keyframes cap-bottom {
  to {
    transform: translate(70px, 80px) rotate(30deg);
    opacity: 0;
  }
}
.prize {
  animation: prize-pop 0.55s 0.12s var(--ease-stamp) both;
}
@keyframes prize-pop {
  from {
    transform: scale(0.2) rotate(-12deg);
    opacity: 0;
  }
}
.reveal {
  animation: fade-in 0.3s 0.35s both;
}
.rays {
  position: absolute;
  inset: -45%;
  border-radius: 50%;
  background: repeating-conic-gradient(var(--ray) 0deg 3deg, transparent 3deg 12deg);
  mask: radial-gradient(circle closest-side, #000 0 22%, transparent 88%);
  animation:
    rays-in 0.5s var(--ease-out-soft) both,
    rays-spin 24s linear infinite;
}
.rays-1 {
  --ray: color-mix(in oklab, var(--color-glare) 30%, transparent);
}
.rays-2 {
  --ray: color-mix(in oklab, var(--region-accent) 75%, transparent);
}
.rays-3 {
  --ray: color-mix(in oklab, var(--color-gold-2) 85%, transparent);
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
@media (prefers-reduced-motion: reduce) {
  .gacha,
  .machine,
  .capsule,
  .prize,
  .reveal,
  .rays {
    animation: none;
  }
}
</style>
