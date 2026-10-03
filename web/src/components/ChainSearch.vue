<script setup lang="ts">
// 連鎖店的期間限定：本站不抓超商、麥當勞的網站（使用條款不允許），改成直接開 Google 搜尋近一個月的結果。
// 查詢字用日文（日本的新品資訊多是日文頁）；介面語言設為繁體中文。
const CHAINS = [
  { label: '超商', q: 'コンビニ 期間限定 新商品' },
  { label: '連鎖餐飲', q: 'チェーン店 期間限定 新メニュー' },
  { label: '7-11', q: 'セブンイレブン 期間限定 新商品' },
  { label: '全家', q: 'ファミリーマート 期間限定 新商品' },
  { label: 'LAWSON', q: 'ローソン 期間限定 新商品' },
  { label: '麥當勞', q: 'マクドナルド 期間限定' },
]

function href(q: string): string {
  return `https://www.google.com/search?${new URLSearchParams({ q, tbs: 'qdr:m', hl: 'zh-TW' })}`
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <span class="mr-1 text-caption text-sub">Google・近一個月</span>
    <a
      v-for="c in CHAINS"
      :key="c.label"
      :href="href(c.q)"
      target="_blank"
      rel="noopener"
      :title="c.q"
      class="flex h-9 items-center gap-1.5 rounded-control border border-line bg-paper px-3 text-label text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
    >
      {{ c.label }}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sub" aria-hidden="true">
        <path d="M14 5h5v5 M19 5l-8 8 M17 14v5H5V7h5" />
      </svg>
    </a>
  </div>
</template>
