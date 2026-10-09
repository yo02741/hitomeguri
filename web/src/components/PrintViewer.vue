<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useModal } from '../composables/modal'
import { useSwipe } from '../composables/swipe'
import { type PrintRef, printUrl, workCredit, workMeta } from '../services/ukiyoe'

// 浮世繪放大檢視（DESIGN.md §7.19c）：原生 <dialog>（composables/modal.ts），Esc、點背景、「關閉」離開。
// 依頁面順序左右切換（← →、兩側 ‹ ›、觸控左右滑，composables/swipe.ts）。沒去過的地方也看得到原畫。
const props = defineProps<{
  prints: PrintRef[]
  index: number
  /** 去過的日期（yyyy-mm-dd）；去過但沒有日期是空字串；沒去過是 undefined */
  visitedOn?: string
  /** 作品 id → 圖的寬高比（格子裡的縮圖載入後量的） */
  ratios?: Map<string, number>
}>()
const emit = defineEmits<{ close: []; step: [delta: -1 | 1] }>()
const { cancel, closed } = useModal(() => emit('close'))

const cur = computed(() => props.prints[props.index]!)
const meta = computed(() => workMeta(cur.value.work))
const credit = computed(() => workCredit(cur.value.work))
const dateText = computed(() => (props.visitedOn ? props.visitedOn.replaceAll('-', '.') : ''))

// 圖還沒載入時也先排好大小：寬高比用格子裡縮圖量到的（ratios），沒有就先用 4:3，載入後換成實際的
const ratio = ref(4 / 3)
watch(
  () => cur.value.work.i,
  (id) => (ratio.value = props.ratios?.get(id) ?? 4 / 3),
  { immediate: true },
)
function onLoad(e: Event) {
  const img = e.target as HTMLImageElement
  if (img.naturalWidth && img.naturalHeight) ratio.value = img.naturalWidth / img.naturalHeight
}
const frame = ref<HTMLElement | null>(null)
const enterFrom = ref<'left' | 'right' | null>(null)
const canStep = (delta: -1 | 1) => props.index + delta >= 0 && props.index + delta < props.prints.length
function step(delta: -1 | 1, animate = true) {
  if (!canStep(delta)) return
  enterFrom.value = animate ? (delta > 0 ? 'right' : 'left') : null
  emit('step', delta)
}
const swipe = useSwipe({ el: () => frame.value, canStep, step: (d) => step(d) })

let lastStep = 0
function onKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
  const now = performance.now()
  const quick = e.repeat || now - lastStep < 250
  lastStep = now
  step(e.key === 'ArrowRight' ? 1 : -1, !quick)
}
// 換張時焦點留在畫上（讀屏念出新的題名）
watch(
  () => props.index,
  async () => {
    await nextTick()
    frame.value?.focus()
  },
)
onMounted(() => {
  document.addEventListener('keydown', onKey)
  frame.value?.focus()
})
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

const label = computed(() => [cur.value.work.t, cur.value.work.c, cur.value.spot.n].filter(Boolean).join('・'))
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dlg"
      class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:bg-transparent"
      :aria-label="label"
      @cancel="cancel"
      @close="closed"
    >
      <div data-reduce="fade" class="viewer relative flex size-full flex-col items-center justify-center gap-4 bg-ink/90 px-4 pt-16 pb-5 sm:pt-6" @click.self="emit('close')">
        <div class="flex min-h-0 w-full max-w-5xl flex-1 items-center justify-center gap-3" @click.self="emit('close')">
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full bg-paper/90 text-ink disabled:opacity-30 max-sm:hidden active:not-disabled:translate-y-px"
            aria-label="上一幅"
            :disabled="index === 0"
            @click="step(-1)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <figure
            :key="cur.work.i + cur.spot.s"
            ref="frame"
            tabindex="-1"
            data-reduce="fade"
            class="print paper-grain flex max-h-full min-w-0 touch-pan-y items-center justify-center rounded-[4px] bg-paper p-3 outline-none sm:p-4"
            :class="enterFrom ? `from-${enterFrom}` : ''"
            @pointerdown="swipe.onPointerDown"
            @pointermove="swipe.onPointerMove"
            @pointerup="swipe.onPointerUp"
            @pointercancel="swipe.onPointerCancel"
          >
            <img
              :src="printUrl(cur.work.f, 960)"
              :alt="label"
              class="img block max-w-full object-contain select-none"
              :style="{ aspectRatio: ratio, '--r': ratio, backgroundImage: `url(&quot;${printUrl(cur.work.f, 500)}&quot;)` }"
              draggable="false"
              @load="onLoad"
            />
          </figure>
          <button
            type="button"
            class="grid size-11 shrink-0 place-items-center rounded-full bg-paper/90 text-ink disabled:opacity-30 max-sm:hidden active:not-disabled:translate-y-px"
            aria-label="下一幅"
            :disabled="index >= prints.length - 1"
            @click="step(1)"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <!-- 說明：題名、系列・年份、作者；景點與去過的日期；圖的出處 -->
        <div class="flex w-full max-w-xl shrink-0 flex-col items-center gap-1 text-center text-paper" aria-live="polite">
          <p v-if="cur.work.t" lang="ja" class="text-title font-bold tracking-title">{{ cur.work.t }}</p>
          <p class="text-body-sm text-paper/80">
            <span v-if="meta" lang="ja">{{ meta }}</span><span v-if="meta && cur.work.c" aria-hidden="true">　</span><span v-if="cur.work.c" lang="ja">{{ cur.work.c }}</span>
          </p>
          <p class="flex flex-wrap items-center justify-center gap-x-2 text-body-sm">
            <span lang="ja" class="font-bold">{{ cur.spot.n }}</span>
            <span v-if="visitedOn !== undefined" class="rounded-full border border-paper/60 px-2 text-caption font-bold">去過{{ dateText ? ` ${dateText}` : '' }}</span>
          </p>
          <p class="text-caption text-paper/70">
            {{ credit }}<template v-if="credit">　</template><a :href="cur.work.u" target="_blank" rel="noopener" class="underline decoration-paper/40 underline-offset-2 hover:decoration-paper">Wikimedia Commons</a>
          </p>
        </div>

        <div class="flex shrink-0 flex-wrap items-center justify-center gap-2">
          <p class="mr-1 font-num text-body-sm text-paper/80">{{ index + 1 }} / {{ prints.length }}</p>
          <RouterLink
            :to="{ path: `/map/${cur.spot.p}`, query: { spot: cur.spot.s } }"
            class="flex h-10 items-center justify-center rounded-full bg-paper px-4 text-body-sm font-bold text-ink no-underline active:not-disabled:translate-y-px pointer-coarse:h-tap"
          >
            地圖
          </RouterLink>
          <button type="button" class="h-10 rounded-full bg-paper px-4 text-body-sm font-bold text-ink active:not-disabled:translate-y-px max-sm:hidden pointer-coarse:h-tap" @click="emit('close')">
            關閉
          </button>
        </div>
        <!-- 手機（<640）：「關閉」在右上角 -->
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
/* 圖的寬：放得下的高度（扣掉說明與按鈕列）× 寬高比，不超過畫面寬 */
/* 大圖載入前先看格子裡的縮圖（已經在快取裡） */
.img {
  background-size: 100% 100%;
  width: min(calc(100vw - 4rem), calc((100dvh - 18rem) * var(--r)));
}
@media (min-width: 640px) {
  .img {
    width: min(calc(100vw - 12rem), 64rem, calc((100dvh - 15rem) * var(--r)));
  }
}
.viewer {
  animation: viewer-in 0.2s var(--ease-out-soft) both;
}
.print {
  animation: print-in 0.3s var(--ease-out-soft) both;
}
.print.from-right {
  animation-name: print-from-right;
}
.print.from-left {
  animation-name: print-from-left;
}
@keyframes viewer-in {
  from {
    opacity: 0;
  }
}
@keyframes print-in {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
}
@keyframes print-from-right {
  from {
    opacity: 0;
    transform: translateX(48px);
  }
}
@keyframes print-from-left {
  from {
    opacity: 0;
    transform: translateX(-48px);
  }
}
</style>
