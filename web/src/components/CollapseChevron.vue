<script setup lang="ts">
// 收合圖示：直角的兩條邊轉 45 度。收合時朝右（›），展開時朝下（⌄）。
defineProps<{ open: boolean }>()
</script>

<template>
  <span
    class="inline-block size-[7px] shrink-0 border-r-[1.5px] border-b-[1.5px] border-current transition-transform duration-150"
    :class="open ? '-translate-y-[2px] rotate-45' : '-rotate-45'"
    aria-hidden="true"
  ></span>
</template>
