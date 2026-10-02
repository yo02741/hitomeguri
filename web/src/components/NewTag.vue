<script setup lang="ts">
// NEW 標記（DESIGN.md §7.19b）：新拿到、還沒看過的卡片樣式與服裝。照 §6a 不加驚嘆號。
</script>

<template>
  <span class="new-tag pointer-events-none inline-flex items-center rounded-full px-1.5 font-latin text-micro font-bold tracking-[0.08em]" aria-label="新">NEW</span>
</template>

<style scoped>
.new-tag {
  background: var(--color-item-red);
  color: var(--color-item-white);
  box-shadow: 0 0 0 2px var(--color-item-white);
}
</style>
