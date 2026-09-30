<script setup lang="ts">
// 清單載入中的佔位（DESIGN.md §9）：取代「載入中」文字；螢幕報讀器仍讀到「載入中」。
withDefaults(defineProps<{ rows?: number; thumb?: boolean }>(), { rows: 4, thumb: false })
</script>

<template>
  <div class="flex flex-col" aria-busy="true">
    <span class="sr-only">載入中</span>
    <div v-for="n in rows" :key="n" class="flex items-center gap-3 px-2 py-2.5" aria-hidden="true">
      <span v-if="thumb" class="skeleton size-11 shrink-0 rounded-control"></span>
      <span class="flex flex-1 flex-col gap-1.5">
        <span class="skeleton h-2.5 w-16 rounded-full"></span>
        <span class="skeleton h-3.5 rounded-full" :class="n % 3 === 0 ? 'w-1/2' : n % 2 ? 'w-3/4' : 'w-2/3'"></span>
      </span>
    </div>
  </div>
</template>
