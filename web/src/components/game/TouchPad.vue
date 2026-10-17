<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { Button } from '../../game/engine/input'
import type { Dir } from '../../game/engine/types'

// 手機的控制區（規格 §3）：左邊十字鍵（按住滑動可以換方向）、右邊 A／B，中間「手帳」（START）與「相機」。
// 直拿時整組放在畫面下面（side = both）；打橫時十字鍵與 A/B 分到畫面兩側（兩個元件，side = left / right）。
// 按鍵至少 44px、touch-action: none（不捲動、不雙擊放大、不跳選單）；按下有按下的樣子、可以的話震一下。
// 多指同時按（十字鍵＋按住 B 跑）各自追蹤。讀屏的點兩下（click 沒有 pointer）當作按一下。
// P4 的情境提示（game/ui/hints.ts 的 touchCue；手機不放提示列，按鈕本身有字）：hot 的鈕亮著（剛亮起來時閃一下，
// 減少動態時不閃），labels 換鈕上的字（取景框裡 A 寫「拍照」、B 寫「收起」、相機鈕寫「變焦」；站上拍攝點時相機鈕寫「拍照」）。
const props = withDefaults(
  defineProps<{
    side?: 'left' | 'right' | 'both'
    hot?: readonly Button[]
    labels?: Partial<Record<'A' | 'B' | 'CAMERA' | 'START', string>>
  }>(),
  { side: 'both', hot: () => [], labels: () => ({}) },
)
const emit = defineEmits<{
  press: [b: Button]
  release: [b: Button]
  /** 十字鍵現在按著的方向（null = 放開） */
  dir: [d: Dir | null]
  /** 剛按下（給按鍵聲） */
  tick: []
}>()

const showDpad = computed(() => props.side !== 'right')
const showAB = computed(() => props.side !== 'left')

// ---------- 情境提示：亮著、剛亮起來閃一下 ----------
const hotSet = computed(() => new Set(props.hot))
const pulse = ref(new Set<Button>())
let pulseTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => [...props.hot].sort().join(','),
  (_now, before) => {
    const was = new Set((before ?? '').split(',').filter(Boolean))
    const fresh = props.hot.filter((b) => !was.has(b))
    if (!fresh.length) return
    pulse.value = new Set(fresh)
    clearTimeout(pulseTimer)
    pulseTimer = setTimeout(() => (pulse.value = new Set()), 700)
  },
)
const cls = (b: Button) => ({ 'is-down': held.value.has(b), 'is-hot': hotSet.value.has(b), 'is-pulse': pulse.value.has(b) })
const ARIA: Record<'A' | 'B' | 'CAMERA' | 'START', string> = { A: 'A 確定', B: 'B 取消（按住跑）', CAMERA: '相機', START: '旅人手帳' }
const aria = (b: 'A' | 'B' | 'CAMERA' | 'START') => {
  const l = props.labels[b]
  if (!l) return ARIA[b]
  return b === 'A' || b === 'B' ? `${b} ${l}` : l
}

// ---------- 十字鍵 ----------
const dpad = ref<HTMLElement | null>(null)
const cur = ref<Dir | null>(null)
let dpadPointer: number | null = null

function feedback() {
  emit('tick')
  try {
    navigator.vibrate?.(8)
  } catch {
    // 不支援就算了
  }
}

/** 指頭在十字鍵的哪一邊（正中間一小塊不換方向） */
function dirAt(e: PointerEvent): Dir | null {
  const el = dpad.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2)
  const dy = e.clientY - (r.top + r.height / 2)
  if (Math.hypot(dx, dy) < r.width * 0.1) return cur.value
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}
function setDir(d: Dir | null) {
  if (d === cur.value) return
  cur.value = d
  emit('dir', d)
}
function dpadDown(e: PointerEvent) {
  touched()
  if (dpadPointer !== null || !dpad.value) return
  e.preventDefault()
  dpadPointer = e.pointerId
  try {
    dpad.value.setPointerCapture(e.pointerId)
  } catch {
    // 舊瀏覽器：沒有 capture 也能用（離開十字鍵時放開）
  }
  setDir(dirAt(e))
  feedback()
}
function dpadMove(e: PointerEvent) {
  if (e.pointerId !== dpadPointer) return
  setDir(dirAt(e))
}
function dpadUp(e: PointerEvent) {
  if (e.pointerId !== dpadPointer) return
  touched()
  dpadPointer = null
  setDir(null)
}
/**
 * 這個 click 是手指（滑鼠）按下、放開之後瀏覽器補發的嗎：pointerdown 已經算過一次，click 不再算。
 * Chromium 手指點的 click 的 detail 是 0（只看 detail 會按兩下：取景框的變焦切過去又切回來），
 * 所以也看剛剛（1 秒內）有沒有 pointerdown／pointerup。讀屏、鍵盤的 click 前面沒有 pointer。
 */
let lastPointer = -Infinity
const POINTER_CLICK_MS = 1000
const touched = () => {
  lastPointer = performance.now()
}
const fromPointer = (e: MouseEvent) => e.detail !== 0 || performance.now() - lastPointer < POINTER_CLICK_MS

/** 讀屏、鍵盤按十字鍵上的一個方向（沒有 pointer 的 click）：按一下 */
function dpadClick(e: MouseEvent, d: Dir) {
  if (fromPointer(e)) return
  emit('press', d)
  emit('release', d)
}

// ---------- A、B、手帳、相機 ----------
const held = ref(new Set<Button>())
const owner = new Map<number, Button>()

function btnDown(e: PointerEvent, b: Button) {
  touched()
  e.preventDefault()
  owner.set(e.pointerId, b)
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // 同上
  }
  if (!held.value.has(b)) {
    held.value = new Set(held.value).add(b)
    emit('press', b)
    feedback()
  }
}
function btnUp(e: PointerEvent) {
  const b = owner.get(e.pointerId)
  if (!b) return
  touched()
  owner.delete(e.pointerId)
  if ([...owner.values()].includes(b)) return
  const next = new Set(held.value)
  next.delete(b)
  held.value = next
  emit('release', b)
}
function btnClick(e: MouseEvent, b: Button) {
  if (fromPointer(e)) return
  emit('press', b)
  emit('release', b)
}

/** 全部放開（版面換了、離開頁面） */
function releaseAll() {
  for (const b of held.value) emit('release', b)
  held.value = new Set()
  owner.clear()
  dpadPointer = null
  setDir(null)
}
defineExpose({ releaseAll })
onBeforeUnmount(() => {
  releaseAll()
  clearTimeout(pulseTimer)
})

const ARMS: Array<{ d: Dir; label: string }> = [
  { d: 'up', label: '上' },
  { d: 'left', label: '左' },
  { d: 'right', label: '右' },
  { d: 'down', label: '下' },
]
</script>

<template>
  <div class="tpad" :class="`tpad-${side}`" @contextmenu.prevent>
    <div class="tpad-main">
      <!-- 十字鍵：整塊追蹤指頭（按住滑過去就換方向），四個方向各是一個按鈕給讀屏 -->
      <div
        v-if="showDpad"
        ref="dpad"
        class="tpad-dpad"
        role="group"
        aria-label="十字鍵"
        @pointerdown="dpadDown"
        @pointermove="dpadMove"
        @pointerup="dpadUp"
        @pointercancel="dpadUp"
        @lostpointercapture="dpadUp"
      >
        <button
          v-for="a in ARMS"
          :key="a.d"
          type="button"
          tabindex="-1"
          class="tpad-arm"
          :class="[`arm-${a.d}`, { 'is-down': cur === a.d }]"
          :aria-label="a.label"
          @click="dpadClick($event, a.d)"
        >
          <svg viewBox="0 0 7 4" aria-hidden="true" shape-rendering="crispEdges"><path d="M3 0h1v1H3zM2 1h3v1H2zM1 2h5v1H1zM0 3h7v1H0z" fill="currentColor" /></svg>
        </button>
        <span class="tpad-hub" aria-hidden="true"></span>
      </div>

      <div v-if="showAB" class="tpad-ab">
        <button
          type="button"
          tabindex="-1"
          class="tpad-round tpad-b"
          :class="cls('B')"
          :aria-label="aria('B')"
          @pointerdown="btnDown($event, 'B')"
          @pointerup="btnUp"
          @pointercancel="btnUp"
          @lostpointercapture="btnUp"
          @click="btnClick($event, 'B')"
        >
          <span class="tpad-letter">B</span>
          <span v-if="labels.B" class="tpad-cap" aria-hidden="true">{{ labels.B }}</span>
        </button>
        <button
          type="button"
          tabindex="-1"
          class="tpad-round tpad-a"
          :class="cls('A')"
          :aria-label="aria('A')"
          @pointerdown="btnDown($event, 'A')"
          @pointerup="btnUp"
          @pointercancel="btnUp"
          @lostpointercapture="btnUp"
          @click="btnClick($event, 'A')"
        >
          <span class="tpad-letter">A</span>
          <span v-if="labels.A" class="tpad-cap" aria-hidden="true">{{ labels.A }}</span>
        </button>
      </div>
    </div>

    <div class="tpad-mid">
      <button
        v-if="side !== 'right'"
        type="button"
        tabindex="-1"
        class="tpad-pill"
        :class="cls('START')"
        :aria-label="aria('START')"
        @pointerdown="btnDown($event, 'START')"
        @pointerup="btnUp"
        @pointercancel="btnUp"
        @lostpointercapture="btnUp"
        @click="btnClick($event, 'START')"
      >
        {{ labels.START ?? '手帳' }}
      </button>
      <button
        v-if="side !== 'left'"
        type="button"
        tabindex="-1"
        class="tpad-pill"
        :class="cls('CAMERA')"
        :aria-label="aria('CAMERA')"
        @pointerdown="btnDown($event, 'CAMERA')"
        @pointerup="btnUp"
        @pointercancel="btnUp"
        @lostpointercapture="btnUp"
        @click="btnClick($event, 'CAMERA')"
      >
        {{ labels.CAMERA ?? '相機' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.tpad {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.tpad button {
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}
.tpad-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.tpad-both .tpad-main {
  width: min(100%, 380px);
}
/* 平板直拿（寬）：十字鍵靠左、A/B 靠右，兩手拿著時拇指搆得到 */
@media (min-width: 600px) {
  .tpad-both {
    align-self: stretch;
  }
  .tpad-both .tpad-main {
    width: 100%;
    padding: 0 max(24px, env(safe-area-inset-left)) 0 max(24px, env(safe-area-inset-right));
  }
}
.tpad-mid {
  display: flex;
  gap: 16px;
}

/* 十字鍵：3×48 的十字，中間一塊不動的軸 */
.tpad-dpad {
  position: relative;
  width: 144px;
  height: 144px;
  flex-shrink: 0;
  touch-action: none;
}
.tpad-arm,
.tpad-hub {
  position: absolute;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  color: var(--color-px-stone-2);
  background: var(--color-px-stone-4);
  border: 2px solid var(--color-px-ink);
}
.tpad-arm svg {
  width: 14px;
  height: 8px;
}
.arm-up {
  left: 48px;
  top: 0;
  border-bottom: 0;
  border-radius: 6px 6px 0 0;
}
.arm-down {
  left: 48px;
  bottom: 0;
  border-top: 0;
  border-radius: 0 0 6px 6px;
}
.arm-down svg {
  transform: rotate(180deg);
}
.arm-left {
  left: 0;
  top: 48px;
  border-right: 0;
  border-radius: 6px 0 0 6px;
}
.arm-left svg {
  transform: rotate(-90deg);
}
.arm-right {
  right: 0;
  top: 48px;
  border-left: 0;
  border-radius: 0 6px 6px 0;
}
.arm-right svg {
  transform: rotate(90deg);
}
.tpad-hub {
  left: 48px;
  top: 48px;
  border: 0;
  pointer-events: none;
}
.tpad-arm.is-down {
  color: var(--color-px-paper);
  background: var(--color-px-stone-3);
}

/* A／B：圓鈕，A 在右上、B 在左下 */
.tpad-ab {
  position: relative;
  width: 140px;
  height: 120px;
  flex-shrink: 0;
}
.tpad-round {
  position: absolute;
  width: 60px;
  height: 60px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  font-family: var(--font-latin);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-px-ink);
  background: var(--color-px-paper-2);
  border: 2px solid var(--color-px-ink);
  border-radius: 999px;
  box-shadow: 0 3px 0 var(--color-px-ink);
}
.tpad-letter {
  line-height: 1;
}
/* 鈕上的小字（取景框的「拍照」「收起」、坐車的「跳過」） */
.tpad-cap {
  font-family: var(--font-game);
  font-size: 0.6875rem;
  font-weight: 400;
  line-height: 1;
  letter-spacing: 0.02em;
}
.tpad-a {
  right: 0;
  top: 0;
}
.tpad-b {
  left: 0;
  bottom: 0;
}

/* 手帳、相機：小的膠囊 */
.tpad-pill {
  min-width: 76px;
  height: 44px;
  padding: 0 14px;
  font-family: var(--font-game);
  font-size: 0.875rem;
  color: var(--color-px-paper);
  background: var(--color-px-stone-4);
  border: 2px solid var(--color-px-ink);
  border-radius: 999px;
  box-shadow: 0 2px 0 var(--color-px-ink);
}

.tpad-round.is-down,
.tpad-pill.is-down {
  transform: translateY(2px);
  box-shadow: 0 1px 0 var(--color-px-ink);
  background: var(--color-px-stone-2);
}
.tpad-pill.is-down {
  color: var(--color-px-ink);
}

/* 情境提示：亮著（金色的框與字），剛亮起來閃兩下（steps，像 GBA） */
.tpad-round.is-hot {
  border-color: var(--color-px-gold-2);
  box-shadow:
    0 3px 0 var(--color-px-ink),
    0 0 0 3px var(--color-px-gold-1);
}
.tpad-pill.is-hot {
  color: var(--color-px-ink);
  background: var(--color-px-gold-1);
  border-color: var(--color-px-ink);
}
.tpad-round.is-hot.is-down,
.tpad-pill.is-hot.is-down {
  background: var(--color-px-gold-2);
}
.is-pulse {
  animation: tpad-pulse 0.7s steps(1, end);
}
@keyframes tpad-pulse {
  0%,
  50% {
    filter: brightness(1.25);
  }
  25%,
  75% {
    filter: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-pulse {
    animation: none;
  }
}

/* 打橫：一側一組，直的排 */
.tpad-left .tpad-main,
.tpad-right .tpad-main {
  flex-direction: column;
}
</style>
