<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, triggerRef, watch } from 'vue'

import type { SfxName } from '../../game/audio/sfx'
import type { Button } from '../../game/engine/input'
import { DialogFlow, type DialogLine, type DialogStep } from '../../game/ui/dialog'
import { canvasMeasure } from '../../game/ui/font'
import { paginate, visible } from '../../game/ui/text'

// 對話框（規格 §4）：GBA 風的白底雙線框，疊在畫面下方。兩行一頁、打字機、▼、是／否與多選、事實台詞的「出處」。
// 流程在 game/ui/dialog.ts（純邏輯）；這裡量字寬分頁、每格把時間交進去、把按鍵（鍵盤、十字鍵、點一下）交進去。
// 讀屏用的全文在 PlayView 的 aria-live 區（這個框打字到一半的字不給讀屏）。
const props = defineProps<{
  line: DialogLine | null
  /** 一秒幾個字（Infinity：直接出現） */
  cps: number
  /** 一個邏輯像素是幾 CSS px（畫面的放大倍數） */
  scale: number
  /** 畫面的邏輯寬（176–240） */
  width: number
  /** 字型載好時 +1：重新量字寬 */
  fontEpoch?: number
}>()
const emit = defineEmits<{
  /** 這一句結束：say 是 0，ask 是選的那一個 */
  done: [index: number]
  sfx: [name: SfxName]
}>()

// 尺寸（邏輯像素）：框離畫面邊 3、框線 1、左右內距 9（含內框線與 ▼ 的位置）、上下內距 5
const SIDE = 3
const PAD_X = 9
const PAD_Y = 5
const fontPx = computed(() => Math.max(12, Math.round(8 * props.scale)))
const lineH = computed(() => Math.round(fontPx.value * 1.75))
/** 字可以排的寬（px）：留 3% 給量不準的後備字型 */
const textW = computed(() => Math.max(40, (props.width - SIDE * 2 - 2 - PAD_X * 2) * props.scale * 0.97))
const boxH = computed(() => lineH.value * 2 + (PAD_Y * 2 + 2) * props.scale)

const flow = shallowRef<DialogFlow | null>(null)
const optionEls = ref<HTMLButtonElement[]>([])
let raf = 0
let last = 0

function pagesOf(text: string): string[] {
  return paginate(text, textW.value, canvasMeasure(fontPx.value))
}

/** 畫面要更新（flow 是一般的 class，自己通知） */
const bump = () => triggerRef(flow)

function frame(now: number) {
  raf = 0
  const f = flow.value
  if (!f || !f.typing) return
  const dt = Math.min(0.25, (now - (last || now)) / 1000)
  last = now
  if (f.tick(dt) > 0) emit('sfx', 'type')
  bump()
  if (f.typing) raf = requestAnimationFrame(frame)
  else onPageDone()
}
function startTyping() {
  cancelAnimationFrame(raf)
  last = 0
  if (flow.value?.typing) raf = requestAnimationFrame(frame)
  else onPageDone()
}

/** 這一頁出完：有選項就把焦點放到游標那一個 */
function onPageDone() {
  bump()
  if (flow.value?.asking) void nextTick(focusChoice)
}
function focusChoice() {
  const f = flow.value
  if (!f) return
  optionEls.value[f.choice]?.focus({ preventScroll: true })
}

watch(
  () => props.line,
  (l) => {
    cancelAnimationFrame(raf)
    flow.value = l ? new DialogFlow(l, pagesOf(l.text), props.cps) : null
    if (l) startTyping()
  },
  { immediate: true },
)
watch(
  () => [props.width, props.scale, props.fontEpoch],
  () => {
    const f = flow.value
    if (!f) return
    f.repaginate(pagesOf(f.line.text))
    bump()
  },
)
watch(
  () => props.cps,
  (c) => {
    flow.value?.setSpeed(c)
    bump()
  },
)

function apply(s: DialogStep, b: Button | 'pick') {
  const f = flow.value
  if (!f) return
  if (s.kind === 'cursor') {
    emit('sfx', 'cursor')
    bump()
    void nextTick(focusChoice)
    return
  }
  if (s.kind === 'page') {
    bump()
    startTyping()
    return
  }
  if (s.kind === 'finish') {
    cancelAnimationFrame(raf)
    onPageDone()
    return
  }
  if (s.kind === 'done') {
    if (f.line.kind === 'ask') emit('sfx', b === 'B' ? 'cancel' : 'confirm')
    cancelAnimationFrame(raf)
    emit('done', s.index)
  }
}

/** 遊戲的按鍵（A、B、上下）；處理了回 true */
function press(b: Button): boolean {
  const f = flow.value
  if (!f) return false
  const s = f.press(b)
  apply(s, b)
  return s.kind !== 'none'
}
function pick(i: number) {
  const f = flow.value
  if (!f) return
  apply(f.pick(i), 'pick')
}
/** 點框：跟按 A 一樣 */
function onBox(e: PointerEvent) {
  if (e.button > 0) return
  press('A')
}

const text = computed(() => {
  const f = flow.value
  return f ? visible(f.pages[f.page] ?? '', f.shown) : ''
})
const question = computed(() => flow.value?.line.text ?? '')

defineExpose({
  press,
  /** DEV、測試：目前的樣子 */
  state: () => {
    const f = flow.value
    return f ? { kind: f.line.kind, text: f.line.text, options: f.line.options, typing: f.typing, page: f.page, pages: f.pages.length, choice: f.choice } : null
  },
})

onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <div v-if="flow" class="dlg-root" :style="{ '--u': `${scale}px`, fontSize: `${fontPx}px`, lineHeight: `${lineH}px` }">
    <!-- 是／否、多選：框的右上 -->
    <div
      v-if="flow.asking"
      class="gba-box dlg-choices"
      role="group"
      :aria-label="question"
      :style="{ bottom: `calc(${boxH}px + var(--u) * ${SIDE + 2})` }"
    >
      <button
        v-for="(o, i) in flow.line.options"
        :key="i"
        :ref="(el) => (optionEls[i] = el as HTMLButtonElement)"
        type="button"
        class="dlg-opt"
        :aria-current="i === flow.choice ? 'true' : undefined"
        @pointerdown.stop
        @click.stop="pick(i)"
      >
        <svg class="dlg-caret" :class="{ 'is-on': i === flow.choice }" viewBox="0 0 5 7" aria-hidden="true" shape-rendering="crispEdges">
          <path d="M0 0h1v7H0zM1 1h1v5H1zM2 2h1v3H2zM3 3h1v1H3z" fill="currentColor" />
        </svg>
        <span>{{ o }}</span>
      </button>
    </div>

    <div class="gba-box dlg-box" :style="{ height: `${boxH}px` }" @pointerdown="onBox">
      <p v-if="flow.line.who" class="gba-box dlg-who">{{ flow.line.who }}</p>
      <p class="dlg-text">{{ text }}</p>
      <a
        v-if="flow.line.source"
        :href="flow.line.source.url"
        target="_blank"
        rel="noopener noreferrer"
        class="gba-box dlg-src"
        :aria-label="`出處：${flow.line.source.label}（開新分頁）`"
        @pointerdown.stop
        @click.stop
        >出處</a
      >
      <svg v-if="flow.more" class="dlg-more" viewBox="0 0 7 4" aria-hidden="true" shape-rendering="crispEdges">
        <path d="M0 0h7v1H0zM1 1h5v1H1zM2 2h3v1H2zM3 3h1v1H3z" fill="currentColor" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.dlg-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: var(--font-game);
}
.dlg-root :lang(ja) {
  font-family: var(--font-game-ja);
}
.dlg-box {
  position: absolute;
  left: calc(var(--u) * 3);
  right: calc(var(--u) * 3);
  bottom: calc(var(--u) * 3);
  padding: calc(var(--u) * 5) calc(var(--u) * 9);
  pointer-events: auto;
  cursor: pointer;
}
.dlg-text {
  margin: 0;
  white-space: pre;
  overflow: hidden;
}
.dlg-who {
  position: absolute;
  left: calc(var(--u) * 6);
  bottom: calc(100% - var(--u) * 2);
  margin: 0;
  padding: 0 calc(var(--u) * 5);
  font-size: max(11px, calc(var(--u) * 6));
  line-height: calc(var(--u) * 11);
}
.dlg-more {
  position: absolute;
  right: calc(var(--u) * 2.5);
  bottom: calc(var(--u) * 5);
  width: calc(var(--u) * 6);
  height: calc(var(--u) * 3.5);
  color: var(--color-px-shu-2);
  animation: more 0.8s steps(2, end) infinite;
}
/* 出處：框右上的小牌子（跟左上的說話的人對稱，不壓到字） */
.dlg-src {
  position: absolute;
  right: calc(var(--u) * 6);
  bottom: calc(100% - var(--u) * 2);
  padding: 0 calc(var(--u) * 5);
  font-size: max(11px, calc(var(--u) * 6));
  line-height: calc(var(--u) * 11);
  color: var(--color-px-sea-3);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
@media (pointer: coarse) {
  /* 觸控：點的範圍上下撐到 44px（牌子本身大小不變；旁邊沒有別的連結，不會點錯） */
  .dlg-src::before {
    content: '';
    position: absolute;
    inset: calc((44px - var(--u) * 11) / -2) 0;
  }
}
.dlg-src:focus-visible,
.dlg-opt:focus-visible {
  outline: 2px solid var(--color-px-ink);
  outline-offset: 1px;
}
.dlg-choices {
  position: absolute;
  right: calc(var(--u) * 3);
  display: flex;
  flex-direction: column;
  padding: calc(var(--u) * 4) calc(var(--u) * 8) calc(var(--u) * 4) calc(var(--u) * 5);
  pointer-events: auto;
}
.dlg-opt {
  display: flex;
  align-items: center;
  gap: calc(var(--u) * 3);
  min-height: calc(var(--u) * 14);
  padding: 0 calc(var(--u) * 2);
  color: inherit;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
}
@media (pointer: coarse) {
  .dlg-opt {
    min-height: 44px;
  }
}
.dlg-caret {
  width: calc(var(--u) * 5);
  height: calc(var(--u) * 7);
  visibility: hidden;
}
.dlg-caret.is-on {
  visibility: visible;
}
@keyframes more {
  50% {
    transform: translateY(calc(var(--u) * 1));
  }
}
@media (prefers-reduced-motion: reduce) {
  .dlg-more {
    animation: none;
  }
}
</style>
