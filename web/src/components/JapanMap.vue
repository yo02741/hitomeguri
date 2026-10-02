<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'

import { regionOf, regions } from '../data/regions'
import { japanOutline, type JapanOutline } from '../services/geo'

// 收集冊的都道府縣地圖（DESIGN.md §7.19）：去過的縣塗上該縣的顏色，進頁面時依北到南一縣一縣蓋上去。
// 點去過的縣跳到那一縣的卡片。
const props = defineProps<{ done: Set<string>; counts?: Map<string, number> }>()
const emit = defineEmits<{ pick: [pref: string] }>()

const shape = shallowRef<JapanOutline | null>(null)
onMounted(async () => {
  shape.value = await japanOutline()
})

// 蓋上去的順序：JIS 順（北海道 → 沖繩）
const order = computed(() => {
  const m = new Map<string, number>()
  let i = 0
  for (const r of regions) if (props.done.has(r.prefecture)) m.set(r.prefecture, i++)
  return m
})
// 每縣的間隔：去過的少時 55ms，多了就縮短，整段最多約 0.6s（47 縣全去過約 1.4s 內結束）
const step = computed(() => `${Math.min(55, 600 / Math.max(1, order.value.size))}ms`)

function title(pref: string): string {
  const name = regionOf(pref)?.name.ja ?? pref
  const n = props.counts?.get(pref)
  return n ? `${name}　${n} 張` : name
}
</script>

<template>
  <svg v-if="shape" :viewBox="shape.viewBox" class="japan block h-auto w-full" :style="{ '--step': step }" role="img" aria-label="去過的都道府縣">
    <rect
      :x="shape.inset[0]"
      :y="shape.inset[1]"
      :width="shape.inset[2]"
      :height="shape.inset[3]"
      rx="2"
      class="inset"
    />
    <path
      v-for="p in shape.paths"
      :key="p.pref"
      :d="p.d"
      :data-pref="done.has(p.pref) ? p.pref : undefined"
      class="pref"
      :class="done.has(p.pref) ? 'is-done' : ''"
      :style="{ '--i': order.get(p.pref) ?? 0 }"
      @click="done.has(p.pref) && emit('pick', p.pref)"
    >
      <title>{{ title(p.pref) }}</title>
    </path>
  </svg>
  <div v-else class="aspect-[166/187] w-full" aria-hidden="true"></div>
</template>

<style scoped>
/* 縣界的線：海報區的底色（在 svg 上先算好，塗色的縣換了 data-pref 也不會變） */
.japan {
  --gap: var(--region-base);
  --blank: color-mix(in oklab, var(--region-paper) 50%, transparent);
  overflow: visible;
}
.inset {
  fill: none;
  stroke: var(--blank);
  stroke-width: 0.6;
  stroke-dasharray: 2 1.5;
}
.pref {
  fill: var(--blank);
  stroke: var(--gap);
  stroke-width: 0.35;
  stroke-linejoin: round;
  transform-box: fill-box;
  transform-origin: center;
}
/* 去過的縣：該縣的 strong 色，依序蓋上去（放大、壓下）；--step 由去過的縣數決定 */
.pref.is-done {
  fill: var(--region-strong);
  cursor: pointer;
  animation: pref-stamp 0.55s var(--ease-stamp) both;
  animation-delay: calc(0.25s + var(--i) * var(--step));
}
@media (hover: hover) and (pointer: fine) {
  .pref.is-done:hover {
    fill: color-mix(in oklab, var(--region-strong) 80%, var(--region-ink));
  }
}
@keyframes pref-stamp {
  from {
    fill: var(--blank);
    transform: scale(1.6);
  }
  45% {
    fill: var(--region-strong);
  }
  to {
    transform: scale(1);
  }
}
</style>
