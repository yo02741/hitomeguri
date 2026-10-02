<script setup lang="ts">
// 紙娃娃共用的 SVG 定義（DESIGN.md §7.24）：剪紙的白邊與紙影（filter）、衣服與小物的花紋（pattern）。
// 放在 App 裡一次，娃娃與服裝小圖都用 url(#…) 參照。尺寸 0、不用 display:none（不然 pattern 畫不出來）。
</script>

<template>
  <svg class="pointer-events-none absolute size-0 overflow-hidden" aria-hidden="true" focusable="false">
    <defs>
      <!-- 剪下來的紙：外面一圈白邊，下面一層淡淡的影子 -->
      <filter id="doll-cut" x="-20%" y="-15%" width="140%" height="135%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="grow" />
        <feFlood class="flood-paper" result="paper" />
        <feComposite in="paper" in2="grow" operator="in" result="margin" />
        <feGaussianBlur in="grow" stdDeviation="3.2" result="blur" />
        <feOffset in="blur" dx="0" dy="4" result="drop" />
        <feFlood class="flood-shade" result="shade" />
        <feComposite in="shade" in2="drop" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="margin" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- 小圖（貼紙）用：白邊細一點 -->
      <filter id="doll-cut-sm" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="grow" />
        <feFlood class="flood-paper" result="paper" />
        <feComposite in="paper" in2="grow" operator="in" result="margin" />
        <feGaussianBlur in="grow" stdDeviation="2" result="blur" />
        <feOffset in="blur" dx="0" dy="2.5" result="drop" />
        <feFlood class="flood-shade" result="shade" />
        <feComposite in="shade" in2="drop" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="margin" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- 還沒有的：只剩剪影 -->
      <filter id="doll-ghost" color-interpolation-filters="sRGB">
        <feFlood class="flood-ghost" result="ghost" />
        <feComposite in="ghost" in2="SourceAlpha" operator="in" />
      </filter>

      <!-- 水玉（浴衣） -->
      <pattern id="doll-dots" width="14" height="14" patternUnits="userSpaceOnUse">
        <circle cx="3.5" cy="3.5" r="2" class="p-white" />
        <circle cx="10.5" cy="10.5" r="2" class="p-white" />
      </pattern>
      <!-- 麻の葉（御朱印帳） -->
      <pattern id="doll-asanoha" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M6 0 L6 12 M0 3 L12 9 M0 9 L12 3" class="p-gold" />
      </pattern>
      <!-- 哈密瓜的網紋 -->
      <pattern id="doll-net" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
        <path d="M0 0 L11 11 M11 0 L0 11" class="p-cream" />
      </pattern>
      <!-- 經木（章魚燒的船） -->
      <pattern id="doll-wood" width="40" height="5" patternUnits="userSpaceOnUse">
        <path d="M0 2.5 C10 1.5 20 3.5 40 2.5" class="p-brown" />
      </pattern>
      <!-- 甜筒的格紋 -->
      <pattern id="doll-waffle" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0 L7 0 M0 0 L0 7" class="p-brown" />
      </pattern>
    </defs>
  </svg>
</template>

<style scoped>
.flood-paper {
  flood-color: var(--color-item-white);
}
.flood-ghost {
  flood-color: var(--color-line);
}
.flood-shade {
  flood-color: var(--color-shade);
  flood-opacity: 0.22;
}
.p-white {
  fill: var(--color-item-white);
  opacity: 0.85;
}
.p-gold,
.p-cream,
.p-brown {
  fill: none;
  stroke-width: 1;
}
.p-gold {
  stroke: var(--color-gold-2);
}
.p-cream {
  stroke: var(--color-item-cream);
  stroke-width: 1.4;
}
.p-brown {
  stroke: var(--color-item-brown);
}
</style>
