<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'

import BackLink from '../components/BackLink.vue'
import RollingNumber from '../components/RollingNumber.vue'
import ShareImage from '../components/ShareImage.vue'
import { useDismiss } from '../composables/floating'
import { groupByArea, regionOf, regions } from '../data/regions'
import { japanOutline, type JapanOutline } from '../services/geo'
import { drawKeiken } from '../services/shareImage'
import { KEIKEN_LEVELS, KEIKEN_MAX, type KeikenLevel, useKeikenStore } from '../stores/keiken'
import { useUserStore } from '../stores/user'

// 經縣值（DESIGN.md §7.21）：上方總分與日本地圖（依級數塗色，點縣選級數），下方依地方列出 47 縣。
const keiken = useKeikenStore()
const userStore = useUserStore()

const shape = shallowRef<JapanOutline | null>(null)
onMounted(async () => {
  shape.value = await japanOutline()
})

const total = computed(() => regions.reduce((n, r) => n + keiken.levelOf(r.prefecture), 0))
const counts = computed(() => {
  const c: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of regions) c[keiken.levelOf(r.prefecture)]!++
  return c
})
const groups = computed(() => groupByArea(regions.map((r) => r.prefecture)))

// 地圖上點縣：在點的位置打開級數選單
const mapBox = ref<HTMLElement | null>(null)
const picking = ref<{ pref: string; x: number; y: number } | null>(null)
function pick(e: MouseEvent, pref: string) {
  if (!userStore.user) return
  const box = mapBox.value?.getBoundingClientRect()
  if (!box) return
  picking.value = { pref, x: Math.min(e.clientX - box.left, box.width - 150), y: e.clientY - box.top }
}
// Esc、點地圖以外的地方關閉；打開時焦點放在目前的級數
const menu = ref<HTMLElement | null>(null)
useDismiss(mapBox, picking, () => (picking.value = null))
watch(
  () => picking.value?.pref,
  async (p) => {
    if (!p) return
    await nextTick()
    menu.value?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
  },
)
async function choose(pref: string, level: KeikenLevel | null) {
  picking.value = null
  await keiken.setLevel(pref, level)
}

// 存成圖片
const imageOpen = ref(false)
async function render(canvas: HTMLCanvasElement) {
  await drawKeiken(canvas, { levelOf: keiken.levelOf, total: total.value })
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 pt-9 pb-24 max-sm:px-4">
    <header class="paper-grain relative flex flex-col gap-5 overflow-hidden rounded-card bg-region p-6 text-on-region max-sm:p-5">
      <BackLink to="/log" on-region>紀錄</BackLink>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 class="text-h1 font-black tracking-title">經縣值</h1>
        <p class="flex items-baseline gap-1.5 font-latin">
          <RollingNumber :value="total" class="text-display leading-none font-bold" />
          <span class="text-title font-semibold">/ {{ KEIKEN_MAX }}</span>
        </p>
        <button
          v-if="userStore.user"
          type="button"
          class="ml-auto h-9 rounded-control border-[1.5px] border-on-region px-3 text-label font-bold text-on-region hover:bg-region-accent"
          @click="imageOpen = true"
        >
          存成圖片
        </button>
      </div>
      <ul class="flex flex-wrap gap-x-4 gap-y-1.5 text-label">
        <li v-for="l in KEIKEN_LEVELS" :key="l.level" class="flex items-center gap-1.5">
          <span class="size-3.5 rounded-[3px] border border-on-region/30" :class="`lv-${l.level}`" aria-hidden="true"></span>
          {{ l.label }}<span class="font-latin text-sub">{{ l.level }}</span>
          <span class="font-latin font-bold">{{ counts[l.level] }}</span>
        </li>
      </ul>
    </header>

    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <template v-else>
      <div ref="mapBox" class="relative mx-auto w-full max-w-[560px]">
        <svg v-if="shape" :viewBox="shape.viewBox" class="block h-auto w-full" role="img" aria-label="經縣值地圖">
          <rect :x="shape.inset[0]" :y="shape.inset[1]" :width="shape.inset[2]" :height="shape.inset[3]" rx="2" class="inset" />
          <path
            v-for="p in shape.paths"
            :key="p.pref"
            :d="p.d"
            class="pref"
            :class="[`lv-${keiken.levelOf(p.pref)}`, { auto: keiken.isAuto(p.pref), on: picking?.pref === p.pref }]"
            @click="pick($event, p.pref)"
          >
            <title>{{ regionOf(p.pref)?.name.ja }}　{{ KEIKEN_LEVELS.find((l) => l.level === keiken.levelOf(p.pref))?.label }}</title>
          </path>
        </svg>
        <div
          v-if="picking"
          ref="menu"
          data-reduce="fade"
          class="absolute z-10 flex w-[140px] origin-top animate-pop-in flex-col rounded-card bg-paper p-1 shadow-float"
          :style="{ left: `${picking.x}px`, top: `${picking.y + 8}px` }"
          role="menu"
          :aria-label="regionOf(picking.pref)?.name.ja"
        >
          <p lang="ja" class="px-2.5 pt-1.5 pb-1 text-label font-black">{{ regionOf(picking.pref)?.name.ja }}</p>
          <button
            v-for="l in KEIKEN_LEVELS"
            :key="l.level"
            type="button"
            role="menuitemradio"
            :aria-checked="keiken.levelOf(picking.pref) === l.level"
            class="flex min-h-tap items-center gap-2 rounded-control px-2.5 text-body-sm hover:bg-surface"
            :class="keiken.levelOf(picking.pref) === l.level ? 'font-bold' : ''"
            @click="choose(picking.pref, l.level)"
          >
            <span class="size-3 rounded-[3px] border border-line" :class="`lv-${l.level}`" aria-hidden="true"></span>
            {{ l.label }}
          </button>
          <button type="button" class="min-h-tap rounded-control text-caption text-sub hover:bg-surface" @click="picking = null">取消</button>
        </div>
      </div>

      <p v-if="keiken.localOnly" class="text-caption text-sub">暫存在這台裝置，之後會同步。</p>

      <section v-for="g in groups" :key="g.area" class="flex flex-col gap-2" :aria-label="g.areaName">
        <h2 class="text-caption font-bold tracking-section text-sub">{{ g.areaName }}</h2>
        <ul class="grid gap-x-6 gap-y-1 md:grid-cols-2">
          <li v-for="r in g.items" :key="r.prefecture" :data-pref="r.prefecture" class="flex min-h-tap items-center gap-3 border-b border-line-soft">
            <span class="h-5 w-1.5 shrink-0 rounded-full bg-region-strong" aria-hidden="true"></span>
            <span lang="ja" class="w-14 shrink-0 text-body-sm font-bold">{{ r.name.ja }}</span>
            <div role="radiogroup" :aria-label="`${r.name.ja}的經縣值`" class="ml-auto flex gap-1">
              <button
                v-for="l in [...KEIKEN_LEVELS].reverse()"
                :key="l.level"
                type="button"
                role="radio"
                :aria-checked="keiken.levelOf(r.prefecture) === l.level"
                :title="l.label"
                class="h-8 min-w-9 rounded-control border px-1.5 text-caption"
                :class="
                  keiken.levelOf(r.prefecture) === l.level
                    ? [`lv-${l.level}`, 'border-ink font-bold', l.level >= 4 ? 'text-paper' : 'text-ink', keiken.isAuto(r.prefecture) ? 'border-dashed' : '']
                    : 'border-line bg-paper text-sub hover:bg-surface'
                "
                @click="keiken.setLevel(r.prefecture, l.level)"
              >
                {{ l.label }}
              </button>
            </div>
          </li>
        </ul>
      </section>
      <p class="text-caption text-sub">沒選的縣，有去過的景點就算「玩過」（虛線框）。縣界：地球地図日本（国土地理院）。</p>
    </template>

    <ShareImage v-if="imageOpen" title="經縣值" file-name="ひとめぐり 經縣值" :render="render" @close="imageOpen = false" />
  </section>
</template>

<style scoped>
.inset {
  fill: none;
  stroke: var(--region-line);
  stroke-width: 0.6;
  stroke-dasharray: 2 1.5;
}
.pref {
  stroke: var(--region-paper);
  stroke-width: 0.45;
  stroke-linejoin: round;
  cursor: pointer;
  transition: fill 0.3s var(--ease-out-soft);
}
.pref:hover,
.pref.on {
  stroke: var(--region-ink);
  stroke-width: 0.9;
}
.pref.auto {
  stroke-dasharray: 1 0.8;
}
.lv-0 {
  fill: var(--region-surface);
  background: var(--region-surface);
}
.pref.lv-0 {
  fill: var(--region-line);
}
.lv-1 {
  fill: var(--color-keiken-1);
  background: var(--color-keiken-1);
}
.lv-2 {
  fill: var(--color-keiken-2);
  background: var(--color-keiken-2);
}
.lv-3 {
  fill: var(--color-keiken-3);
  background: var(--color-keiken-3);
}
.lv-4 {
  fill: var(--color-keiken-4);
  background: var(--color-keiken-4);
}
.lv-5 {
  fill: var(--color-keiken-5);
  background: var(--color-keiken-5);
}
</style>
