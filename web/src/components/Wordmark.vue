<script setup lang="ts">
// 三行版式：假名／漢字／羅馬拼音（DESIGN.md §1b）。Header 用橫排。
// app 標頭的標誌連到形象網站（/about，2026-10-12 回報：在規劃的頁面找不到回形象網站的入口）；地圖用「探索」分頁回去。
// 形象網站自己的標誌（海報、頁尾）不是連結（to=null）：進 app 只從「開始探索」（2026-10-13 使用者）。
withDefaults(defineProps<{ to?: string | null }>(), { to: '/about' })
</script>

<template>
  <component
    :is="to ? 'RouterLink' : 'div'"
    v-bind="to ? { to, 'aria-label': to === '/about' ? '關於 ひとめぐり' : 'ひとめぐり 首頁' } : {}"
    class="flex items-end gap-2.5 no-underline text-ink pointer-coarse:-my-1.5 pointer-coarse:py-1.5"
  >
    <span class="flex shrink-0 flex-col leading-none whitespace-nowrap">
      <span lang="ja" class="mb-[3px] text-[10px] tracking-[3px] text-sub">ひとめぐり</span>
      <span lang="ja" class="text-[22px] font-black tracking-[2px]">一巡り</span>
    </span>
    <span class="font-latin text-[13px] font-semibold whitespace-nowrap uppercase tracking-[3px] text-sub max-[380px]:hidden">HITOMEGURI</span>
  </component>
</template>
