<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { useTilt } from '../composables/tilt'
import type { CardFace, Rarity } from '../services/card'
import SpotCard from './SpotCard.vue'

// 收集卡放大檢視（DESIGN.md §7.19）：畫面中央一張大卡，點卡片翻面；手機可以用傾斜角度讓卡片轉動。
// 收集冊裡可以左右切換上一張、下一張（方向鍵、左右滑）。Esc、點背景或「關閉」離開。
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
}>()
const emit = defineEmits<{ close: []; step: [delta: -1 | 1] }>()

const tilt = useTilt(18)
const flipped = ref(false)
const gyro = ref(false)
// 觸控裝置才顯示「傾斜手機」
const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

// 換卡時回到正面，並從滑動的方向進場
const enterFrom = ref<'left' | 'right' | null>(null)
watch(
  () => props.card.id,
  () => {
    flipped.value = false
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

const closeBtn = ref<HTMLButtonElement | null>(null)
onMounted(() => {
  document.addEventListener('keydown', onKey)
  closeBtn.value?.focus()
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
        <button ref="closeBtn" type="button" class="h-10 rounded-full bg-paper px-4 text-label font-bold text-ink" @click="emit('close')">
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
