<script setup lang="ts">
// 三行版式：假名／漢字／羅馬拼音（DESIGN.md §1b）。Header 用橫排。
</script>

<template>
  <RouterLink to="/" aria-label="ひとめぐり 首頁" class="flex items-end gap-2.5 no-underline text-ink pointer-coarse:-my-1.5 pointer-coarse:py-1.5">
    <span class="flex shrink-0 flex-col leading-none whitespace-nowrap">
      <span lang="ja" class="mb-[3px] text-[10px] tracking-[3px] text-sub">ひとめぐり</span>
      <span lang="ja" class="text-[22px] font-black tracking-[2px]">一巡り</span>
    </span>
    <span class="font-latin text-[13px] font-semibold whitespace-nowrap uppercase tracking-[3px] text-sub max-[380px]:hidden">HITOMEGURI</span>
  </RouterLink>
</template>
