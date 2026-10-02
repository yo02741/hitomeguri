<script setup lang="ts">
// 紙娃娃共用的 SVG 定義（DESIGN.md §7.24）：剪紙的白邊與紙影（filter）、衣服與小物的花紋（pattern）。
// 紀念章的墨邊（#stamp-ink，§7.25）也放在這裡：成就頁上約 90 個章共用一個濾鏡。
// 放在 App 裡一次，娃娃與服裝小圖都用 url(#…) 參照。尺寸 0、不用 display:none（不然 pattern 畫不出來）。
</script>

<template>
  <svg class="pointer-events-none absolute size-0 overflow-hidden" aria-hidden="true" focusable="false">
    <defs>
      <!-- 紀念章（PrefStamp、AchvSeal）：雜訊吃掉一點墨，像蓋印的斑駁 -->
      <filter id="stamp-ink" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.75" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
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
      <!-- 3D 展示窗用：只有白邊、沒有落影（影子改畫在地上） -->
      <filter id="doll-cut-ns" x="-20%" y="-15%" width="140%" height="135%" color-interpolation-filters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius="4.5" result="grow" />
        <feFlood class="flood-paper" result="paper" />
        <feComposite in="paper" in2="grow" operator="in" result="margin" />
        <feMerge>
          <feMergeNode in="margin" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <!-- 紙的背面：整張紙色，透一點點正面的印刷 -->
      <filter id="doll-back" color-interpolation-filters="sRGB">
        <feFlood class="flood-back" result="back" />
        <feComposite in="back" in2="SourceAlpha" operator="in" result="sheet" />
        <feColorMatrix in="SourceGraphic" type="saturate" values="0" result="grey" />
        <feComponentTransfer in="grey" result="faint"><feFuncA type="linear" slope="0.07" /></feComponentTransfer>
        <feMerge>
          <feMergeNode in="sheet" />
          <feMergeNode in="faint" />
        </feMerge>
      </filter>
      <!-- 紙的切邊（厚度） -->
      <filter id="doll-edge" color-interpolation-filters="sRGB">
        <feFlood class="flood-edge" result="edge" />
        <feComposite in="edge" in2="SourceAlpha" operator="in" />
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
      <!-- 櫻花（三颯舞浴衣、夜來祭法被） -->
      <pattern id="doll-sakura" width="18" height="18" patternUnits="userSpaceOnUse">
        <g class="p-petal">
          <circle cx="5" cy="3" r="1.7" /><circle cx="7.6" cy="5" r="1.7" /><circle cx="6.6" cy="8" r="1.7" /><circle cx="3.4" cy="8" r="1.7" /><circle cx="2.4" cy="5" r="1.7" />
          <circle cx="14" cy="12" r="1.4" /><circle cx="16" cy="13.6" r="1.4" /><circle cx="15.2" cy="16" r="1.4" /><circle cx="12.8" cy="16" r="1.4" /><circle cx="12" cy="13.6" r="1.4" />
        </g>
      </pattern>
      <!-- 縞（阿波舞浴衣） -->
      <pattern id="doll-stripes" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M2 0 L2 10 M6 0 L6 10" class="p-stripe" />
      </pattern>
      <!-- 友禪：大小花 -->
      <pattern id="doll-yuzen" width="34" height="34" patternUnits="userSpaceOnUse">
        <g class="p-yuzen-a"><circle cx="9" cy="5" r="3" /><circle cx="13" cy="9" r="3" /><circle cx="9" cy="13" r="3" /><circle cx="5" cy="9" r="3" /></g>
        <circle cx="9" cy="9" r="2" class="p-yuzen-c" />
        <g class="p-yuzen-b"><circle cx="25" cy="23" r="2.4" /><circle cx="28" cy="26" r="2.4" /><circle cx="25" cy="29" r="2.4" /><circle cx="22" cy="26" r="2.4" /></g>
        <path d="M14 22 C18 20 20 24 24 22" class="p-leaf" />
      </pattern>
      <!-- 絣（博多山笠的水法被） -->
      <pattern id="doll-kasuri" width="16" height="12" patternUnits="userSpaceOnUse">
        <path d="M2 3 L8 3 M10 9 L16 9" class="p-kasuri" />
      </pattern>
      <!-- 扶桑花（甘露衫） -->
      <pattern id="doll-hibiscus" width="30" height="30" patternUnits="userSpaceOnUse">
        <g class="p-hibiscus"><ellipse cx="8" cy="4" rx="3" ry="4" /><ellipse cx="12" cy="8" rx="4" ry="3" /><ellipse cx="8" cy="12" rx="3" ry="4" /><ellipse cx="4" cy="8" rx="4" ry="3" /></g>
        <circle cx="8" cy="8" r="1.6" class="p-yuzen-c" />
        <path d="M18 20 C22 16 26 18 28 22 C24 24 20 24 18 20Z" class="p-leaf-fill" />
      </pattern>
      <!-- 江戶切子的菱形 -->
      <pattern id="doll-kiriko" width="10" height="10" patternUnits="userSpaceOnUse">
        <path d="M5 0 L10 5 L5 10 L0 5Z" class="p-kiriko" />
      </pattern>
      <!-- 寄木細工 -->
      <pattern id="doll-yosegi" width="12" height="12" patternUnits="userSpaceOnUse">
        <path d="M0 0 L6 0 L0 6Z M6 6 L12 6 L6 12Z" class="p-yosegi-a" />
        <path d="M6 0 L12 0 L12 6Z M0 6 L6 12 L0 12Z" class="p-yosegi-b" />
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
.flood-back {
  flood-color: var(--color-item-cream);
}
.flood-edge {
  flood-color: var(--color-item-grey);
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
.p-petal {
  fill: var(--color-item-white);
  opacity: 0.8;
}
.p-stripe {
  stroke: var(--color-item-white);
  stroke-width: 1.4;
  opacity: 0.7;
}
.p-yuzen-a {
  fill: var(--color-item-pink);
}
.p-yuzen-b {
  fill: var(--color-item-yellow);
}
.p-yuzen-c {
  fill: var(--color-gold-2);
}
.p-leaf {
  fill: none;
  stroke: var(--color-item-green);
  stroke-width: 1.6;
}
.p-leaf-fill {
  fill: var(--color-item-green);
}
.p-kasuri {
  stroke: var(--color-item-navy);
  stroke-width: 2;
}
.p-hibiscus {
  fill: var(--color-item-red);
}
.p-kiriko {
  fill: none;
  stroke: var(--color-item-white);
  stroke-width: 0.8;
}
.p-yosegi-a {
  fill: var(--color-item-yellow);
}
.p-yosegi-b {
  fill: var(--color-item-brown);
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
