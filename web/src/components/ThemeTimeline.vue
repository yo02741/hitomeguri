<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { ERAS, preloadThemeFonts, setTheme, theme } from '../services/theme'

// 年代的時間軸（DESIGN.md §13）：拖曳就換主題，下面的年代名稱也可以直接點。
const index = computed(() => Math.max(0, ERAS.findIndex((e) => e.key === theme.value)))
const era = computed(() => ERAS[index.value]!)

function onInput(e: Event) {
  setTheme(ERAS[Number((e.target as HTMLInputElement).value)]!.key)
}

onMounted(preloadThemeFonts)
</script>

<template>
  <div class="flex flex-col gap-1 px-2.5 pt-1.5 pb-1">
    <div class="flex items-baseline gap-2">
      <span class="mr-auto text-body-sm text-sub">年代</span>
      <span class="text-body-sm font-bold">{{ era.label }}</span>
      <span class="font-num text-caption text-sub">{{ era.years }}</span>
    </div>
    <!-- 刻度與名稱對齊把手的中心：左右各留半個把手寬（11px） -->
    <div class="relative h-[52px]">
      <span class="absolute top-[13px] right-[11px] left-[11px] h-0.5 bg-line" aria-hidden="true"></span>
      <span
        v-for="(e, i) in ERAS"
        :key="e.key"
        class="absolute top-[10px] size-2 -translate-x-1/2 rounded-full"
        :class="i <= index ? 'bg-ink' : 'bg-line'"
        :style="{ left: `calc(11px + (100% - 22px) * ${i / (ERAS.length - 1)})` }"
        aria-hidden="true"
      ></span>
      <input
        type="range"
        class="era-range absolute inset-x-0 top-0 w-full"
        min="0"
        :max="ERAS.length - 1"
        step="1"
        :value="index"
        aria-label="年代"
        :aria-valuetext="`${era.label}（${era.years}）`"
        @input="onInput"
      />
      <button
        v-for="(e, i) in ERAS"
        :key="e.key"
        type="button"
        tabindex="-1"
        class="absolute top-7 flex h-6 w-10 -translate-x-1/2 items-center justify-center text-caption"
        :class="i === index ? 'font-bold text-ink' : 'text-sub hover:text-ink active:text-ink'"
        :style="{ left: `calc(11px + (100% - 22px) * ${i / (ERAS.length - 1)})` }"
        :aria-label="`${e.label}（${e.years}）`"
        @click="setTheme(e.key)"
      >
        {{ e.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 軌道與刻度畫在 input 後面；把手：墨色圓點 */
.era-range {
  appearance: none;
  height: 28px;
  margin: 0;
  padding: 0;
  background: none;
  cursor: pointer;
}
.era-range::-webkit-slider-runnable-track {
  height: 28px;
  background: none;
}
.era-range::-moz-range-track {
  height: 28px;
  background: none;
}
.era-range::-webkit-slider-thumb {
  appearance: none;
  width: 22px;
  height: 22px;
  margin-top: 3px;
  border-radius: 50%;
  background: var(--region-ink);
  box-shadow: 0 0 0 3px var(--region-paper);
  transition: transform 0.15s var(--ease-out-soft);
}
.era-range::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 50%;
  background: var(--region-ink);
  box-shadow: 0 0 0 3px var(--region-paper);
}
.era-range:active::-webkit-slider-thumb {
  transform: scale(1.15);
}
.era-range:focus-visible {
  outline: 2px solid var(--region-strong);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
