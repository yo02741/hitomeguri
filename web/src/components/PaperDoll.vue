<script setup lang="ts">
import { computed } from 'vue'

import { EYES, HAIR, outfitById, type Slot } from '../data/outfits'
import type { AvatarParts } from '../stores/avatar'

// 紙娃娃（DESIGN.md §7.24）：240×320 的 SVG，由下往上疊：後髮、身體、衣服、夥伴、頭、臉、瀏海、臉上的、頭上的、手上的。
const props = withDefaults(defineProps<{ parts: AvatarParts; equipped: Partial<Record<Slot, string>>; animate?: boolean }>(), { animate: false })

const svgOf = (slot: Slot) => (props.equipped[slot] ? (outfitById.get(props.equipped[slot]!)?.svg ?? '') : '')
const hair = computed(() => HAIR[props.parts.hair])
const eyes = computed(() => EYES[props.parts.eyes])
const style = computed(() => ({
  '--skin': `var(--color-doll-skin-${props.parts.skin})`,
  '--hair': `var(--color-doll-hair-${props.parts.hairColor})`,
}))
</script>

<template>
  <svg viewBox="0 0 240 320" class="doll block h-auto w-full" :class="{ 'is-animated': animate }" :style="style" role="img" aria-label="旅人">
    <g class="sway">
      <!-- 後髮 -->
      <g v-html="hair.back"></g>
      <!-- 身體 -->
      <g class="body">
        <rect x="96" y="236" width="20" height="56" rx="9" />
        <rect x="124" y="236" width="20" height="56" rx="9" />
        <ellipse cx="106" cy="294" rx="13" ry="6" class="line" />
        <ellipse cx="134" cy="294" rx="13" ry="6" class="line" />
        <rect x="60" y="156" width="22" height="78" rx="11" />
        <rect x="158" y="156" width="22" height="78" rx="11" />
        <rect x="80" y="150" width="80" height="98" rx="24" />
        <rect x="106" y="132" width="28" height="30" rx="10" />
        <circle cx="71" cy="236" r="11" />
        <circle cx="169" cy="236" r="11" />
      </g>
      <!-- 衣服、夥伴 -->
      <g v-html="svgOf('body')"></g>
      <g v-html="svgOf('buddy')"></g>
      <!-- 頭 -->
      <g class="body">
        <circle cx="62" cy="98" r="9" />
        <circle cx="178" cy="98" r="9" />
        <circle cx="120" cy="92" r="58" />
      </g>
      <!-- 臉 -->
      <g class="face">
        <ellipse cx="88" cy="118" rx="8" ry="5" class="blush" />
        <ellipse cx="152" cy="118" rx="8" ry="5" class="blush" />
        <g v-html="eyes"></g>
        <path d="M112 124 Q120 131 128 124" class="line-stroke" />
      </g>
      <!-- 瀏海、臉上的、頭上的 -->
      <g v-html="hair.front"></g>
      <g v-html="svgOf('face')"></g>
      <g v-html="svgOf('head')"></g>
      <!-- 手上的 -->
      <g v-html="svgOf('hand')"></g>
    </g>
  </svg>
</template>

<style scoped>
.body > * {
  fill: var(--skin);
  stroke: var(--color-doll-line);
  stroke-width: 3;
}
.body .line {
  fill: var(--color-doll-line);
}
.blush {
  fill: var(--color-doll-blush);
}
.line-stroke {
  fill: none;
  stroke: var(--color-doll-line);
  stroke-width: 3;
  stroke-linecap: round;
}
/* 輕輕搖：像紙娃娃被風吹 */
.is-animated .sway {
  transform-origin: 120px 300px;
  animation: doll-sway 3.2s ease-in-out infinite;
}
@keyframes doll-sway {
  0%,
  100% {
    transform: rotate(-1.5deg);
  }
  50% {
    transform: rotate(1.5deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-animated .sway {
    animation: none;
  }
}
</style>
