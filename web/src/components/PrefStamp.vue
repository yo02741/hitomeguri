<script setup lang="ts">
import { computed } from 'vue'

import { regionOf } from '../data/regions'

// 縣的第一個「去過」：像車站的紀念章（駅スタンプ）蓋在卡片上（DESIGN.md §7.19）。
// 雙圈、上緣羅馬拼音沿著圓弧、中間縣名、下面「初訪」與日期；墨色是該縣的 strong，邊緣用雜訊做出蓋印的斑駁。
const props = defineProps<{ pref: string; date: string }>()
const region = computed(() => regionOf(props.pref))
const id = `stamp-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <svg :data-pref="pref" viewBox="0 0 120 120" class="pref-stamp" role="img" :aria-label="`${region?.name.ja} 初訪 ${date}`">
    <defs>
      <path :id="`${id}-arc`" d="M 22 60 A 38 38 0 0 1 98 60" />
      <filter :id="`${id}-ink`" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.75" result="m" />
        <feComposite in="SourceGraphic" in2="m" operator="in" />
      </filter>
    </defs>
    <g :filter="`url(#${id}-ink)`" class="ink">
      <circle cx="60" cy="60" r="56" fill="none" stroke-width="4" />
      <circle cx="60" cy="60" r="49" fill="none" stroke-width="1.5" />
      <text font-size="9.5" font-weight="700" letter-spacing="2.4" text-anchor="middle" class="latin">
        <textPath :href="`#${id}-arc`" startOffset="50%">{{ region?.name.romaji }}</textPath>
      </text>
      <text x="60" y="70" font-size="25" font-weight="900" text-anchor="middle" lang="ja">{{ region?.name.ja }}</text>
      <line x1="30" y1="79" x2="90" y2="79" stroke-width="1.2" />
      <text x="60" y="92" font-size="9" font-weight="700" text-anchor="middle">初訪</text>
      <text x="60" y="103" font-size="8.5" font-weight="600" text-anchor="middle" class="latin">{{ date.replaceAll('-', '.') }}</text>
    </g>
  </svg>
</template>

<style scoped>
.pref-stamp {
  display: block;
  /* 印泥色：該縣的 strong 再壓深一點，淡色的縣蓋在卡上也看得清楚 */
  color: color-mix(in oklab, var(--region-strong) 72%, var(--region-ink));
}
.ink {
  fill: currentColor;
  stroke: currentColor;
}
.ink circle,
.ink line {
  fill: none;
}
.ink text {
  stroke: none;
  font-family: var(--font-ja);
}
.ink text.latin {
  font-family: var(--font-latin);
}
</style>
