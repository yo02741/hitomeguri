<script setup lang="ts">
import { computed } from 'vue'

import { nameText } from '../data/achievements'
import { regionOf } from '../data/regions'
import type { Trip } from '../services/trip'
import { useAchievementsStore } from '../stores/achievements'
import AchvSeal from './AchvSeal.vue'
import PrefStamp from './PrefStamp.vue'

// 這趟的成就（DESIGN.md §7.25）：達成日落在這趟旅行期間（開始日到結束日）的初訪章與成就章。
// 由現在的紀錄推算，每次打開都一樣；沒有就不顯示。
// 卡包翻完（56px，animate 時依序出現）、行程頁標頭（40px，不動，只列章、名稱給讀屏，最後接「成就」連結）。
const props = withDefaults(defineProps<{ trip: Trip; size?: number; animate?: boolean }>(), { size: 56, animate: false })
const achv = useAchievementsStore()
const got = computed(() => achv.inTrip(props.trip))
const total = computed(() => got.value.stamps.length + got.value.seals.length)
const compact = computed(() => props.size < 48)
</script>

<template>
  <section v-if="total" class="flex flex-col text-ink" :class="compact ? 'gap-1.5' : 'gap-2 rounded-card bg-paper p-3'" aria-label="這趟的成就">
    <div class="flex items-center">
      <h3 class="text-body-sm font-bold" :class="compact ? 'text-sub' : ''">這趟的成就</h3>
      <RouterLink v-if="compact" to="/log/achievements" class="-my-1.5 ml-auto flex h-9 items-center gap-0.5 rounded-control px-2 text-body-sm font-bold text-ink no-underline hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:-my-2.5 pointer-coarse:h-tap">
        成就
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
      </RouterLink>
    </div>
    <ul class="flex flex-wrap" :class="compact ? 'gap-1.5' : 'gap-x-3 gap-y-2'">
      <li
        v-for="(s, i) in got.stamps"
        :key="`p-${s.pref}`"
        class="flex flex-col items-center gap-1"
        :class="animate ? 'row-in' : ''"
        :style="{ '--i': i, width: compact ? `${size}px` : `${size + 20}px` }"
      >
        <div :data-pref="s.pref" :style="{ width: `${size}px` }" :title="compact ? regionOf(s.pref)?.name.zh_tw : undefined">
          <PrefStamp :pref="s.pref" :date="s.at" />
        </div>
        <span v-if="!compact" class="text-center text-caption leading-tight">{{ regionOf(s.pref)?.name.zh_tw }}</span>
      </li>
      <li
        v-for="(s, i) in got.seals"
        :key="s.def.id"
        class="flex flex-col items-center gap-1"
        :class="animate ? 'row-in' : ''"
        :style="{ '--i': got.stamps.length + i, width: compact ? `${size}px` : `${size + 20}px` }"
        :title="compact ? s.def.name : undefined"
      >
        <AchvSeal :def="s.def" status="done" :at="s.at" :size="size" :label="compact ? s.def.name : undefined" />
        <span v-if="!compact" class="line-clamp-2 text-center text-caption leading-tight break-keep">{{ nameText(s.def.name) }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
/* 卡包翻完時依序出現（和卡片一覽的 deal-in 同一個節奏） */
.row-in {
  animation: row-in 0.45s var(--ease-out-soft) both;
  animation-delay: calc(0.3s + var(--i) * 80ms);
}
@keyframes row-in {
  from {
    transform: translateY(12px) scale(0.8);
    opacity: 0;
  }
}
</style>
