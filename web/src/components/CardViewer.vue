<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useTilt } from '../composables/tilt'
import type { Spot } from '../services/bundles'
import type { Rarity } from '../services/card'
import SpotCard from './SpotCard.vue'

// 收集卡放大檢視（DESIGN.md §7.19）：畫面中央一張大卡，點卡片翻面；手機可以用傾斜角度讓卡片轉動。
// Esc、點背景或「關閉」離開。
const props = defineProps<{
  spot: Spot
  rarity: Rarity
  number?: string
  visited?: boolean
  visitedOn?: string | null
}>()
const emit = defineEmits<{ close: [] }>()

const tilt = useTilt(18)
const flipped = ref(false)
const gyro = ref(false)
// 觸控裝置才顯示「傾斜手機」
const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

async function startGyro() {
  gyro.value = await tilt.useGyro()
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    flipped.value = !flipped.value
  }
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
      :aria-label="`${spot.name.ja} 的卡片`"
      @click.self="emit('close')"
    >
      <div
        role="button"
        tabindex="0"
        class="viewer-card cursor-pointer rounded-[16px]"
        :aria-label="flipped ? '翻回正面' : '翻到背面'"
        @click="flipped = !flipped"
        @pointermove="tilt.onPointerMove"
        @pointerleave="tilt.reset"
      >
        <SpotCard
          :spot="spot"
          :rarity="rarity"
          :number="number"
          :visited="visited"
          :visited-on="visitedOn"
          size="lg"
          :flipped="flipped"
          :tilt="tilt"
        />
      </div>
      <div class="flex gap-2">
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
