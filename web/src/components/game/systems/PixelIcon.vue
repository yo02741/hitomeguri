<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { iconSprite } from '../../../game/content/icons'
import type { IconId } from '../../../game/content/items'

import { paintSprite } from './pixel'

// 品項的像素小圖（規格 §8.5：依類別套模板）。16×16 的點，CSS 依 size 放大（預設 2 倍）。
const props = withDefaults(defineProps<{ icon: IconId; size?: number }>(), { size: 2 })
const el = ref<HTMLCanvasElement | null>(null)
const draw = () => paintSprite(el.value, iconSprite(props.icon))
onMounted(draw)
watch(() => props.icon, draw)
</script>

<template>
  <canvas ref="el" class="px-icon" :style="{ width: `${16 * size}px`, height: `${16 * size}px` }" aria-hidden="true"></canvas>
</template>

<style scoped>
.px-icon {
  display: block;
  flex-shrink: 0;
  image-rendering: pixelated;
}
</style>
