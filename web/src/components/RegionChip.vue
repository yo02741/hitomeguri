<script setup lang="ts">
// 縣色小方塊：顏色取自該縣的 --region-base。
defineProps<{ pref: string; size?: number }>()
</script>

<template>
  <span
    :data-pref="pref"
    class="shrink-0 rounded-[5px] bg-region"
    :style="{ width: `${size ?? 22}px`, height: `${size ?? 22}px` }"
    aria-hidden="true"
  ></span>
</template>
