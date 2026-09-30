<script setup lang="ts">
import { computed } from 'vue'

// 數字滾動（DESIGN.md §9）：每一位數是一條 0–9 的直欄，值改變時滑到新的數字（像里程表）。
// 位數從右邊對齊（個位數的直欄一直是同一個），螢幕報讀器讀整個數字。
const props = defineProps<{ value: number }>()
const digits = computed(() => String(Math.max(0, Math.round(props.value))).split('').map(Number))
</script>

<template>
  <span class="inline-flex tabular-nums">
    <span class="sr-only">{{ Math.round(value) }}</span>
    <span v-for="(d, i) in digits" :key="digits.length - i" class="inline-block h-[1em] overflow-hidden leading-none" aria-hidden="true">
      <span class="flex flex-col transition-transform duration-500 ease-out-soft" :style="{ transform: `translateY(${-d}em)` }">
        <span v-for="n in 10" :key="n" class="h-[1em]">{{ n - 1 }}</span>
      </span>
    </span>
  </span>
</template>
