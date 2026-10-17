<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { STAMP_INK, STAMP_SIZE, type StampArt, stampSprite } from '../../../game/content/icons'

import { paintSprite } from './pixel'

// 一個章（規格 §8.6）：圖案是像素畫（content/icons.ts 的 stampSprite），參拜印的名字用 DOM 直書蓋在框裡，
// 名城的章下面寫印面的字（日本100名城 No.53）。蓋章的動畫由外面（StampPress）加 class。
const props = withDefaults(defineProps<{ art: StampArt; name?: string; size?: number }>(), { size: 2 })
const el = ref<HTMLCanvasElement | null>(null)
const draw = () => paintSprite(el.value, stampSprite(props.art))
onMounted(draw)
watch(() => props.art, draw, { deep: true })
const dim = computed(() => STAMP_SIZE[props.art.shape])
const ink = computed(() => `var(--color-px-${STAMP_INK[props.art.shape]})`)
/**
 * 參拜印的名字：框裡下半（剪影與橫線下面）直書。4 個字以內一行，再長分兩行（右邊那一行先讀）；
 * 字放得下為止（最大 5.5 格），框的高度剛好是一行的字數，換行才會在對的地方。
 */
const TATE_TOP = 33
const TATE_BOTTOM = 7
const tate = computed(() => {
  const n = [...(props.name ?? '')].length
  const per = n <= 4 ? Math.max(1, n) : Math.ceil(n / 2)
  const room = dim.value.h - TATE_TOP - TATE_BOTTOM
  const font = Math.min(5.5, room / per)
  return { top: `calc(var(--s) * ${TATE_TOP})`, height: `calc(var(--s) * ${per * font})`, fontSize: `calc(var(--s) * ${font})` }
})
</script>

<template>
  <span class="stamp-mark" :class="`is-${art.shape}`" :style="{ width: `${dim.w * size}px`, height: `${dim.h * size}px`, color: ink, '--s': `${size}px` }">
    <canvas ref="el" class="stamp-art" aria-hidden="true"></canvas>
    <span v-if="art.shape === 'sanpai' && name" class="stamp-tate" lang="ja" :style="tate">{{ name }}</span>
  </span>
</template>

<style scoped>
.stamp-mark {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
}
.stamp-art {
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
/* 參拜印：框裡下半直書名字（top、height、font-size 照字數算） */
.stamp-tate {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  writing-mode: vertical-rl;
  line-height: 1.1;
  white-space: normal;
  word-break: break-all;
  overflow: hidden;
  font-family: var(--font-game-ja, var(--font-ja));
}
</style>
