<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useModal } from '../composables/modal'
import type { Outfit, Slot } from '../data/outfits'
import { regionOf } from '../data/regions'
import { narrow } from '../services/viewport'
import NewTag from './NewTag.vue'

// 旅人的十連抽（DESIGN.md §7.24）：十顆扭蛋一次掉下來排好（5×2，手機 4 欄），由左上依序打開，貼紙跳出來。
// 殼的顏色看稀有度（常見：地區色、少見：紅、稀有：金），稀有的打開前抖一下。「全部打開」一次開完；
// 點還沒開的那顆先開那顆；開了的點一下穿上（再點一下脫掉，衣服除外）。系統減少動態時一開始就全部打開。
const props = defineProps<{ got: Outfit[]; worn: Partial<Record<Slot, string>>; canAgain: boolean }>()
const emit = defineEmits<{ wear: [o: Outfit]; again: []; close: [] }>()
const { cancel, closed } = useModal(() => emit('close'))

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
const open = ref<boolean[]>(props.got.map(() => reduced))
// 殼分開、淡出之後拿掉（同 DollGacha：兩半都透明時外層 g 的 filter 在 Chromium 會畫出黑色方塊）
const gone = ref<boolean[]>(props.got.map(() => reduced))
const done = computed(() => open.value.every(Boolean))

let timers: number[] = []
const wait = (ms: number) => new Promise<void>((r) => timers.push(window.setTimeout(r, ms)))
let running = true
function openAt(i: number) {
  if (open.value[i]) return
  const next = [...open.value]
  next[i] = true
  open.value = next
  navigator.vibrate?.(props.got[i]!.rarity === 3 ? 24 : 6)
}
function setGone(i: number) {
  const next = [...gone.value]
  next[i] = true
  gone.value = next
}
// 掉下來（0.05 秒一顆）→ 依序打開：一般 0.24 秒一顆，稀有的前後多停一下
async function autoOpen() {
  if (reduced) return
  await wait(props.got.length * 50 + 560)
  for (let i = 0; i < props.got.length && running; i++) {
    if (open.value[i]) continue
    const rare = props.got[i]!.rarity === 3
    if (rare) await wait(420)
    if (!running) return
    openAt(i)
    await wait(rare ? 650 : 240)
  }
}
function openAll() {
  running = false
  open.value = props.got.map(() => true)
}
function onCell(i: number) {
  if (!open.value[i]) openAt(i)
  else emit('wear', props.got[i]!)
}

// 打開時焦點移到「全部打開」；全部開完那顆按鈕換掉時，焦點移到下一排的第一個按鈕
const actions = ref<HTMLElement | null>(null)
const focusFirst = async () => {
  await nextTick()
  actions.value?.querySelector('button')?.focus()
}
watch(done, async (d) => {
  if (!d) return
  await nextTick()
  const a = document.activeElement
  if (!a || a === document.body) void focusFirst()
})
onMounted(() => {
  void focusFirst()
  void autoOpen()
})
onBeforeUnmount(() => {
  running = false
  timers.forEach(clearTimeout)
  timers = []
})

const prefName = (pref?: string) => (pref ? (regionOf(pref)?.name.ja ?? '') : '')
const isWorn = (o: Outfit) => props.worn[o.slot] === o.id
const cols = computed(() => (narrow.value ? 4 : 5))
</script>

<template>
  <dialog
    ref="dlg"
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent print:hidden"
    aria-label="十連抽"
    @cancel="cancel"
    @close="closed"
  >
    <div class="ten flex size-full flex-col items-center justify-center gap-[2.4vh] overflow-hidden bg-ink/90 px-4 backdrop-blur-sm">
      <p class="text-center text-h3 font-black text-paper">十連抽</p>

      <ol class="flex flex-wrap justify-center gap-(--g)" :style="{ width: `calc(${cols} * var(--cw) + ${cols - 1} * var(--g))` }" aria-label="十件服裝">
        <li
          v-for="(o, i) in got"
          :key="o.id"
          class="cell relative w-(--cw)"
          :class="{ 'is-open': open[i], 'is-rare': o.rarity === 3 }"
          :style="{ '--i': i }"
          :data-pref="o.pref"
        >
          <button
            type="button"
            class="tile flex w-full flex-col items-center gap-1 rounded-control p-1 active:not-disabled:translate-y-px"
            :class="{ 'is-worn': open[i] && isWorn(o) }"
            :aria-label="open[i] ? (isWorn(o) ? `${o.name}（穿著）` : `穿上${o.name}`) : `打開第 ${i + 1} 個`"
            :aria-pressed="open[i] ? isWorn(o) : undefined"
            @click="onCell(i)"
          >
            <span class="relative grid aspect-square w-full place-items-center">
              <span v-if="open[i] && o.rarity > 1" class="glow pointer-events-none absolute rounded-full" :class="`glow-${o.rarity}`" aria-hidden="true"></span>
              <!-- 裁在自己的格子裡（相機的背帶這種伸出去的不畫到隔壁） -->
              <span v-if="open[i]" class="absolute inset-[2%] overflow-hidden">
                <svg :viewBox="o.icon" class="prize size-full overflow-visible p-[7%]" aria-hidden="true">
                  <g filter="url(#doll-cut-sm)" v-html="o.svg"></g>
                </svg>
              </span>
              <svg
                v-if="!gone[i]"
                viewBox="0 0 120 120"
                class="capsule absolute inset-[6%]"
                :class="`shell-${o.rarity}`"
                aria-hidden="true"
                @animationend="(e: AnimationEvent) => open[i] && e.animationName.includes('cap-bottom') && setGone(i)"
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
            </span>
            <span class="flex h-[3.4rem] flex-col items-center gap-0.5 text-paper">
              <template v-if="open[i]">
                <span class="name line-clamp-2 text-center text-caption leading-tight font-bold text-balance">{{ o.name }}</span>
                <span v-if="o.pref" lang="ja" class="name pref-tag rounded-tag px-1.5 text-micro font-bold">{{ prefName(o.pref) }}</span>
              </template>
            </span>
          </button>
          <NewTag v-if="open[i]" class="new absolute -top-1 -left-1 z-10" />
          <span v-if="open[i] && isWorn(o)" class="seal pointer-events-none absolute top-0.5 right-0.5 grid size-6 place-items-center rounded-full text-[11px] font-black" aria-hidden="true">穿</span>
        </li>
      </ol>

      <div ref="actions" class="flex gap-2">
        <button v-if="!done" type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink active:not-disabled:translate-y-px" @click="openAll">全部打開</button>
        <button v-else-if="canAgain" type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink active:not-disabled:translate-y-px" @click="emit('again')">再十連抽</button>
        <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper active:not-disabled:translate-y-px" @click="emit('close')">關閉</button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* 一格：扭蛋（正方形）＋名稱兩行與縣名（約 60px）。橫向放 5 格、縱向 2 列（扣掉標題與按鈕），最大 150px */
.ten {
  --g: clamp(6px, 1.4vw, 16px);
  --cw: min(150px, calc((100vw - 32px - 4 * var(--g)) / 5), calc((100dvh - 200px - var(--g)) / 2 - 64px));
  animation: fade-in 0.2s var(--ease-out-soft) both;
}
/* 手機：橫向 4 格、縱向 3 列（最後一列 2 格置中） */
@media (max-width: 639px) {
  .ten {
    --cw: min(120px, calc((100vw - 32px - 3 * var(--g)) / 4), calc((100dvh - 200px - 2 * var(--g)) / 3 - 64px));
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
.tile {
  background: color-mix(in oklab, var(--color-paper) 8%, transparent);
  transition: background-color 0.15s;
}
@media (hover: hover) and (pointer: fine) {
  .is-open .tile:hover {
    background: color-mix(in oklab, var(--color-paper) 16%, transparent);
  }
}
.tile.is-worn {
  box-shadow: inset 0 0 0 2px var(--color-paper);
}
/* 掉下來：從上面落到自己的位置 */
.cell {
  animation: drop 0.5s var(--ease-flip) both;
  animation-delay: calc(var(--i) * 50ms);
}
@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-40px) rotate(-14deg) scale(0.7);
  }
}
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
.capsule .cap-top,
.capsule .cap-bottom {
  transform-box: fill-box;
  transform-origin: center bottom;
}
.is-open .capsule .cap-top {
  animation: cap-top 0.45s var(--ease-out-soft) both;
}
.is-open .capsule .cap-bottom {
  transform-origin: center top;
  animation: cap-bottom 0.45s var(--ease-out-soft) both;
}
@keyframes cap-top {
  to {
    transform: translate(-28px, -30px) rotate(-30deg);
    opacity: 0;
  }
}
@keyframes cap-bottom {
  to {
    transform: translate(28px, 30px) rotate(26deg);
    opacity: 0;
  }
}
/* 稀有的打開前：輕輕抖一下 */
.is-rare:not(.is-open) .capsule {
  animation: shiver 0.42s ease-in-out calc(var(--i) * 50ms + 0.55s) 1;
}
@keyframes shiver {
  25% {
    transform: rotate(-8deg);
  }
  75% {
    transform: rotate(8deg);
  }
}
.prize {
  animation: prize-pop 0.45s 0.08s var(--ease-stamp) both;
}
@keyframes prize-pop {
  from {
    transform: scale(0.2) rotate(-12deg);
    opacity: 0;
  }
}
.name,
.new {
  animation: fade-in 0.25s 0.25s both;
}
.pref-tag {
  background: var(--region-strong);
  color: var(--color-white);
}
.glow {
  inset: -6%;
  animation: glow-in 0.5s var(--ease-out-soft) both;
}
.glow-2 {
  background: radial-gradient(closest-side, color-mix(in oklab, var(--region-accent) 65%, transparent), transparent);
}
.glow-3 {
  inset: -14%;
  background:
    radial-gradient(closest-side, color-mix(in oklab, var(--color-gold-2) 70%, transparent), transparent 75%),
    repeating-conic-gradient(color-mix(in oklab, var(--color-gold-2) 55%, transparent) 0deg 4deg, transparent 4deg 16deg);
  mask: radial-gradient(circle closest-side, #000 0 30%, transparent 92%);
}
@keyframes glow-in {
  from {
    opacity: 0;
    scale: 0.5;
  }
}
/* 穿著：朱色的小印（同衣櫃） */
.seal {
  background: var(--color-item-red);
  color: var(--color-item-white);
  rotate: -10deg;
}
@media (prefers-reduced-motion: reduce) {
  .ten,
  .cell,
  .prize,
  .name,
  .new,
  .glow,
  .is-rare:not(.is-open) .capsule {
    animation: none;
  }
}
</style>
