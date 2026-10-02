<script setup lang="ts">
import { computed } from 'vue'

import { EYES, HAIR, outfitById, type Slot } from '../data/outfits'
import type { AvatarParts } from '../stores/avatar'

// 紙娃娃（DESIGN.md §7.24）：240×320 的 SVG，剪紙的紙人形。整隻套 DollDefs 的 #doll-cut（白邊＋紙影），
// 夥伴是另一張紙。由下往上疊：後髮、手腳、衣服、手、頭、臉、瀏海、臉上的、頭上的、手上的（右手握著）。
const props = withDefaults(
  defineProps<{
    parts: AvatarParts
    equipped: Partial<Record<Slot, string>>
    animate?: boolean
    /** 只畫一部分（viewBox：x y w h），例如外觀選項的頭像 */
    crop?: string
  }>(),
  { animate: false, crop: '0 0 240 320' },
)

const svgOf = (slot: Slot) => (props.equipped[slot] ? (outfitById.get(props.equipped[slot]!)?.svg ?? '') : '')
const hair = computed(() => HAIR[props.parts.hair] ?? HAIR.bob)
const eyes = computed(() => EYES[props.parts.eyes] ?? EYES.round)
const style = computed(() => ({
  '--skin': `var(--color-doll-skin-${props.parts.skin})`,
  '--hair': `var(--color-doll-hair-${props.parts.hairColor})`,
}))
</script>

<template>
  <svg :viewBox="crop" class="doll block" :class="[{ 'is-animated': animate }, crop === '0 0 240 320' ? 'overflow-visible' : 'overflow-hidden']" :style="style" role="img" aria-label="旅人">
    <g v-if="equipped.buddy" class="buddy" filter="url(#doll-cut)" v-html="svgOf('buddy')"></g>
    <g class="sway">
      <g filter="url(#doll-cut)">
        <!-- 後髮 -->
        <g v-html="hair.back"></g>
        <!-- 腳、手臂 -->
        <g class="skin">
          <rect x="104" y="236" width="13" height="36" rx="5" />
          <rect x="123" y="236" width="13" height="36" rx="5" />
          <rect x="77" y="160" width="14" height="60" rx="7" />
          <rect x="149" y="160" width="14" height="60" rx="7" />
        </g>
        <g class="shoe">
          <path d="M98 276 C98 270 104 268 110 268 C116 268 119 271 119 276 C119 279 117 280 114 280 L101 280 C99 280 98 278 98 276Z" />
          <path d="M142 276 C142 270 136 268 130 268 C124 268 121 271 121 276 C121 279 123 280 126 280 L139 280 C141 280 142 278 142 276Z" />
        </g>
        <!-- 衣服 -->
        <g v-html="svgOf('body')"></g>
        <!-- 左手 -->
        <circle cx="84" cy="222" r="8" class="skin-1" />
        <!-- 頭與臉 -->
        <path class="skin-1" d="M120 44 C153 44 174 68 174 101 C174 134 151 156 120 156 C89 156 66 134 66 101 C66 68 87 44 120 44Z" />
        <g class="face">
          <ellipse cx="93" cy="123" rx="8.5" ry="5" class="blush" />
          <ellipse cx="147" cy="123" rx="8.5" ry="5" class="blush" />
          <g v-html="eyes"></g>
          <path d="M116 129 Q120 132.5 124 129" class="mouth" />
        </g>
        <!-- 瀏海、臉上的、頭上的 -->
        <g v-html="hair.front"></g>
        <g v-html="svgOf('face')"></g>
        <g v-html="svgOf('head')"></g>
        <!-- 手上的，右手握著 -->
        <g v-html="svgOf('hand')"></g>
        <circle cx="156" cy="222" r="8" class="skin-1" />
      </g>
    </g>
  </svg>
</template>

<style scoped>
.skin > *,
.skin-1 {
  fill: var(--skin);
  stroke: var(--color-doll-line);
  stroke-opacity: 0.2;
  stroke-width: 1.4;
}
.shoe > * {
  fill: var(--color-item-brown);
}
.blush {
  fill: var(--color-doll-blush);
  opacity: 0.7;
}
.mouth {
  fill: none;
  stroke: var(--color-doll-line);
  stroke-width: 2.2;
  stroke-linecap: round;
}
/* 輕輕搖：像紙娃娃被風吹 */
.is-animated .sway {
  transform-origin: 120px 280px;
  animation: doll-sway 3.6s ease-in-out infinite;
}
.is-animated .buddy {
  transform-origin: 58px 294px;
  animation: buddy-hop 3.6s ease-in-out infinite;
}
@keyframes doll-sway {
  0%,
  100% {
    transform: rotate(-1.2deg);
  }
  50% {
    transform: rotate(1.2deg);
  }
}
@keyframes buddy-hop {
  0%,
  40%,
  100% {
    transform: none;
  }
  48% {
    transform: translateY(-6px) rotate(-3deg);
  }
  56% {
    transform: none;
  }
}
/* 赤牛的頭會點頭 */
.is-animated :deep(.bob) {
  transform-box: fill-box;
  transform-origin: 100% 80%;
  animation: bob 2.4s ease-in-out infinite;
}
@keyframes bob {
  0%,
  100% {
    transform: rotate(0);
  }
  50% {
    transform: rotate(-10deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-animated :deep(.bob),
  .is-animated .sway,
  .is-animated .buddy {
    animation: none;
  }
}
</style>
