<script setup lang="ts">
import { computed } from 'vue'

import type { ClimatePref } from '../services/bundles'
import { rainShare } from '../services/climate'

// 深度探索「天氣」：縣代表氣象台最近 10 年每月的平均氣溫、日最高／日最低、降水量、下雨天數（pipeline/climate.py）。
// 一個月一列，這個月標出來；下雨天數旁的橫條是這個月有幾成的日子下雨。
const props = defineProps<{ data: ClimatePref; years: [number, number] }>()
const thisMonth = new Date().getMonth() + 1

const rows = computed(() =>
  props.data.months.map((m) => ({ ...m, share: m.rain_days === undefined ? undefined : rainShare(m.month, m.rain_days) })),
)
const t = (v?: number) => (v === undefined ? '–' : v.toFixed(1))
</script>

<template>
  <div class="flex flex-col gap-3">
    <table class="w-full border-collapse text-body-sm">
      <thead>
        <tr class="text-left text-caption text-sub">
          <th scope="col" class="pb-1.5 pl-1 font-normal">月</th>
          <th scope="col" class="pb-1.5 text-right font-normal">平均</th>
          <th scope="col" class="pb-1.5 text-right font-normal">最高／最低</th>
          <th scope="col" class="pb-1.5 text-right font-normal">降水量</th>
          <th scope="col" class="pb-1.5 pl-3 font-normal sm:pl-5">下雨天數</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="m in rows"
          :key="m.month"
          class="border-t border-line-soft"
          :class="m.month === thisMonth ? 'bg-region-tint font-bold' : ''"
          :aria-current="m.month === thisMonth ? 'date' : undefined"
        >
          <th scope="row" class="py-2 pl-1 text-left font-num font-normal" :class="m.month === thisMonth ? 'font-bold' : ''">{{ m.month }}月</th>
          <td class="py-2 text-right font-num">{{ t(m.temp) }}<span class="text-caption text-sub">°</span></td>
          <td class="py-2 text-right font-num whitespace-nowrap">
            {{ t(m.high) }}<span class="text-sub"> / </span>{{ t(m.low) }}<span class="text-caption text-sub">°</span>
          </td>
          <td class="py-2 text-right font-num whitespace-nowrap">
            {{ m.precip === undefined ? '–' : Math.round(m.precip) }}<span class="text-caption text-sub"> mm</span>
          </td>
          <td class="py-2 pr-1 pl-3 sm:pl-5">
            <span v-if="m.rain_days !== undefined" class="flex items-center gap-2">
              <span class="w-12 shrink-0 text-right font-num whitespace-nowrap sm:w-14">{{ m.rain_days.toFixed(0) }}<span class="text-caption text-sub"> 天</span></span>
              <span class="relative h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-line-soft max-sm:hidden" aria-hidden="true">
                <span class="absolute inset-y-0 left-0 rounded-full bg-region-strong" :style="{ width: `${Math.round(m.share! * 100)}%` }"></span>
              </span>
              <span class="w-9 shrink-0 text-right font-num text-caption text-sub">{{ Math.round(m.share! * 100) }}%</span>
            </span>
            <span v-else>–</span>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="text-caption text-sub">
      {{ years[0] }}–{{ years[1] }} 年平均・<span lang="ja">{{ data.station.name }}</span>・°C・下雨天數為一天降水 1 mm 以上・<a
        :href="data.source.url"
        target="_blank"
        rel="noopener"
        class="text-sub pointer-coarse:py-4"
      >出典：気象庁ホームページ</a>
    </p>
  </div>
</template>
