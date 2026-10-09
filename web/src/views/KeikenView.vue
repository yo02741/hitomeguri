<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'

import BackLink from '../components/BackLink.vue'
import RollingNumber from '../components/RollingNumber.vue'
import SectionNav from '../components/SectionNav.vue'
import ShareImage from '../components/ShareImage.vue'
import { useDismiss } from '../composables/floating'
import { type NavItem, scrollParent, useScrollSpy } from '../composables/scrollSpy'
import { groupByArea, regionOf, regions } from '../data/regions'
import { japanOutline, type JapanOutline } from '../services/geo'
import { nearestHit } from '../services/nearestHit'
import { drawKeiken } from '../services/shareImage'
import { wide } from '../services/viewport'
import { KEIKEN_LEVELS, KEIKEN_MAX, type KeikenLevel, useKeikenStore } from '../stores/keiken'
import { useUserStore } from '../stores/user'

// 經縣值（DESIGN.md §7.21）：上方總分與日本地圖（依級數塗色，點縣選級數），下方依地方列出 47 縣。
const keiken = useKeikenStore()
const userStore = useUserStore()

const shape = shallowRef<JapanOutline | null>(null)
onMounted(async () => {
  shape.value = await japanOutline()
})
// 地圖的寬高比：手機打橫時依畫面高度限制寬度，整張地圖放得進一屏（第二階段 31）
const aspect = computed(() => {
  const [, , w, h] = shape.value?.viewBox.split(' ').map(Number) ?? []
  return w && h ? w / h : 1
})

const total = computed(() => regions.reduce((n, r) => n + keiken.levelOf(r.prefecture), 0))
const counts = computed(() => {
  const c: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of regions) c[keiken.levelOf(r.prefecture)]!++
  return c
})
const groups = computed(() => groupByArea(regions.map((r) => r.prefecture)))

// 地圖上點縣：桌機在點的位置打開級數選單；手機（<1024）是貼在分頁列上方的級數條
const mapBox = ref<HTMLElement | null>(null)
const picking = ref<{ pref: string; x: number; y: number } | null>(null)
function pick(e: MouseEvent, pref: string) {
  if (!userStore.user) return
  const box = mapBox.value?.getBoundingClientRect()
  if (!box) return
  picking.value = { pref, x: Math.max(0, Math.min(e.clientX - box.left, box.width - 150)), y: e.clientY - box.top }
}
// 觸控時點到海上（小的縣、離島點不準）：選 20px 內最近的縣（手機版計畫第二階段 19）
let pointerType = ''
const prefAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest('[data-keiken]')?.getAttribute('data-keiken') ?? null
function onMapPointerDown(e: PointerEvent) {
  pointerType = e.pointerType
}
function onMapClick(e: MouseEvent) {
  const type = (e as PointerEvent).pointerType || pointerType
  const pref = prefAt(e.clientX, e.clientY) ?? (type === 'touch' || type === 'pen' ? nearestHit(e.clientX, e.clientY, prefAt, 20) : null)
  if (pref) pick(e, pref)
}
// 選單放在點的位置下方；下面放不下（畫面下半、手機的分頁列）就翻到上方，
// 仍放不下（橫向）就貼齊可見區的頂端、選單自己捲動。可見區是頁面捲動容器與視窗的交集。
const menu = ref<HTMLElement | null>(null)
const menuPos = ref<{ top: number; maxHeight?: number; above: boolean } | null>(null)
function placeMenu() {
  const m = menu.value
  const box = mapBox.value
  const at = picking.value
  if (!m || !box || !at) return
  const b = box.getBoundingClientRect()
  const view = scrollParent(box)?.getBoundingClientRect()
  const gap = 8
  const visTop = Math.max(view?.top ?? 0, 0) + gap
  const visBottom = Math.min(view?.bottom ?? window.innerHeight, window.innerHeight) - gap
  const room = visBottom - visTop
  const h = Math.min(m.scrollHeight, room)
  const y = b.top + at.y
  const above = y + gap + h > visBottom
  const top = Math.min(Math.max(above ? y - gap - h : y + gap, visTop), visBottom - h)
  menuPos.value = { top: top - b.top, maxHeight: m.scrollHeight > room ? room : undefined, above }
}
// Esc、點地圖以外的地方關閉；打開時焦點放在目前的級數（不讓 focus 捲動頁面）
useDismiss(mapBox, picking, () => (picking.value = null))
watch(
  () => picking.value && `${picking.value.pref},${picking.value.x},${picking.value.y}`,
  async (k) => {
    menuPos.value = null
    if (!k) return
    await nextTick()
    if (wide.value) placeMenu()
    else revealPicked()
    await nextTick()
    const m = menu.value
    const item = m?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!m || !item) return
    item.focus({ preventScroll: true })
    // 選單自己捲動時，把目前的級數捲進選單裡（只捲選單）
    if (item.offsetTop + item.offsetHeight > m.clientHeight) m.scrollTop = item.offsetTop + item.offsetHeight - m.clientHeight + 4
  },
)
// 手機的級數條蓋到剛點的縣時，把頁面往上捲一點
function revealPicked() {
  const bar = menu.value
  const box = mapBox.value
  const at = picking.value
  if (!bar || !box || !at) return
  const y = box.getBoundingClientRect().top + at.y
  const barTop = bar.getBoundingClientRect().top
  if (y > barTop - 16) scrollParent(box)?.scrollBy({ top: y - barTop + 48, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
async function choose(pref: string, level: KeikenLevel | null) {
  picking.value = null
  await keiken.setLevel(pref, level)
}

// 手機：47 縣清單上方的地方段落列
const root = ref<HTMLElement | null>(null)
const nav = computed<NavItem[]>(() => groups.value.map((g) => ({ id: `keiken-${g.area}`, label: g.areaName })))
const { active, go } = useScrollSpy(root, () => nav.value.map((it) => it.id))

// 存成圖片
const imageOpen = ref(false)
async function render(canvas: HTMLCanvasElement) {
  await drawKeiken(canvas, { levelOf: keiken.levelOf, total: total.value })
}
</script>

<template>
  <section ref="root" class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 pt-9 pb-24 max-sm:px-4">
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
          class="ml-auto h-9 rounded-control border-[1.5px] border-on-region px-3 text-body-sm font-bold text-on-region hover:bg-region-accent active:not-disabled:translate-y-px pointer-coarse:h-tap"
          @click="imageOpen = true"
        >
          存成圖片
        </button>
      </div>
      <ul class="flex flex-wrap gap-x-4 gap-y-1.5 text-body-sm">
        <li v-for="l in KEIKEN_LEVELS" :key="l.level" class="flex items-center gap-1.5">
          <span class="size-3.5 rounded-[3px] border border-on-region/30" :class="`lv-${l.level}`" aria-hidden="true"></span>
          {{ l.label }}<span class="font-num text-sub">{{ l.level }}</span>
          <span class="font-num font-bold">{{ counts[l.level] }}</span>
        </li>
      </ul>
    </header>

    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <template v-else>
      <div ref="mapBox" class="relative mx-auto w-full max-w-[560px] land:max-w-[min(560px,calc((100dvh-var(--spacing-header)-1.5rem)*var(--map-aspect)))]" :style="{ '--map-aspect': aspect }">
        <svg
          v-if="shape"
          :viewBox="shape.viewBox"
          class="block h-auto w-full"
          role="img"
          aria-label="經縣值地圖"
          @pointerdown="onMapPointerDown"
          @click="onMapClick"
        >
          <rect :x="shape.inset[0]" :y="shape.inset[1]" :width="shape.inset[2]" :height="shape.inset[3]" rx="2" class="inset" />
          <path
            v-for="p in shape.paths"
            :key="p.pref"
            :d="p.d"
            :data-keiken="p.pref"
            class="pref"
            :class="[`lv-${keiken.levelOf(p.pref)}`, { auto: keiken.isAuto(p.pref), on: picking?.pref === p.pref }]"
          >
            <title>{{ regionOf(p.pref)?.name.ja }}　{{ KEIKEN_LEVELS.find((l) => l.level === keiken.levelOf(p.pref))?.label }}</title>
          </path>
        </svg>
        <div
          v-if="picking && wide"
          ref="menu"
          data-reduce="fade"
          class="absolute z-10 flex w-[140px] animate-pop-in flex-col overflow-y-auto *:shrink-0 overscroll-contain rounded-card bg-paper p-1 shadow-float"
          :class="menuPos?.above ? 'origin-bottom' : 'origin-top'"
          :style="{
            left: `${picking.x}px`,
            top: `${menuPos?.top ?? picking.y + 8}px`,
            maxHeight: menuPos?.maxHeight ? `${menuPos.maxHeight}px` : undefined,
            visibility: menuPos ? undefined : 'hidden',
          }"
          role="menu"
          :aria-label="regionOf(picking.pref)?.name.ja"
        >
          <p lang="ja" class="px-2.5 pt-1.5 pb-1 text-body-sm font-black">{{ regionOf(picking.pref)?.name.ja }}</p>
          <button
            v-for="l in KEIKEN_LEVELS"
            :key="l.level"
            type="button"
            role="menuitemradio"
            :aria-checked="keiken.levelOf(picking.pref) === l.level"
            class="flex min-h-tap items-center gap-2 rounded-control px-2.5 text-body-sm hover:bg-surface active:bg-surface"
            :class="keiken.levelOf(picking.pref) === l.level ? 'font-bold' : ''"
            @click="choose(picking.pref, l.level)"
          >
            <span class="size-3 rounded-[3px] border border-line" :class="`lv-${l.level}`" aria-hidden="true"></span>
            {{ l.label }}
          </button>
          <button type="button" class="min-h-tap rounded-control text-caption text-sub hover:bg-surface active:bg-surface" @click="picking = null">取消</button>
        </div>
        <!-- 手機：貼在分頁列上方的級數條，縣名＋6 段（未踏→住過）＋關閉 -->
        <div
          v-else-if="picking"
          ref="menu"
          data-reduce="fade"
          class="bottom-dock fixed right-[max(0.75rem,env(safe-area-inset-right))] left-[max(0.75rem,env(safe-area-inset-left))] z-30 mx-auto flex max-w-[560px] animate-pop-up items-center gap-2 rounded-card bg-paper p-2 shadow-float"
          role="group"
          :aria-label="`${regionOf(picking.pref)?.name.ja}的經縣值`"
        >
          <p lang="ja" class="w-12 shrink-0 pl-1 text-body-sm font-black">{{ regionOf(picking.pref)?.name.ja }}</p>
          <div role="radiogroup" :aria-label="regionOf(picking.pref)?.name.ja" class="flex min-w-0 flex-1">
            <button
              v-for="l in [...KEIKEN_LEVELS].reverse()"
              :key="l.level"
              type="button"
              role="radio"
              :aria-checked="keiken.levelOf(picking.pref) === l.level"
              class="-ml-px h-tap min-w-0 flex-1 border text-caption first:ml-0 first:rounded-l-control last:rounded-r-control active:not-disabled:translate-y-px"
              :class="
                keiken.levelOf(picking.pref) === l.level
                  ? [`lv-${l.level}`, 'relative z-[1] border-ink font-bold', l.level >= 4 ? 'text-paper' : 'text-ink', keiken.isAuto(picking.pref) ? 'border-dashed' : '']
                  : 'border-line bg-paper text-sub'
              "
              @click="choose(picking.pref, l.level)"
            >
              {{ l.label }}
            </button>
          </div>
          <button type="button" class="grid size-tap shrink-0 place-items-center rounded-control text-sub hover:bg-surface hover:text-ink active:not-disabled:translate-y-px" aria-label="關閉" @click="picking = null">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      <p v-if="keiken.localOnly" class="text-caption text-sub">暫存在這台裝置，之後會同步。</p>

      <div class="sticky top-0 z-10 -mx-6 -my-3.5 border-b border-line bg-paper px-4 py-2 lg:hidden max-sm:-mx-4">
        <SectionNav :items="nav" :active="active" variant="bar" @go="go" />
      </div>
      <section v-for="g in groups" :id="`keiken-${g.area}`" :key="g.area" class="flex flex-col gap-2 max-lg:scroll-mt-16" :aria-label="g.areaName">
        <h2 lang="ja" class="text-caption font-bold tracking-section text-sub">{{ g.areaName }}</h2>
        <ul class="grid gap-x-6 gap-y-1 md:grid-cols-2">
          <li v-for="r in g.items" :key="r.prefecture" :data-pref="r.prefecture" class="flex min-h-tap items-center gap-3 border-b border-line-soft">
            <span class="h-5 w-1.5 shrink-0 rounded-full bg-region-strong" aria-hidden="true"></span>
            <span lang="ja" class="w-14 shrink-0 text-body-sm font-bold">{{ r.name.ja }}</span>
            <!-- 觸控裝置：無間隙的分段條，每格 44px 高、平分剩下的寬度（最寬 44） -->
            <div role="radiogroup" :aria-label="`${r.name.ja}的經縣值`" class="ml-auto flex gap-1 pointer-coarse:max-w-66 pointer-coarse:flex-1 pointer-coarse:gap-0">
              <button
                v-for="l in [...KEIKEN_LEVELS].reverse()"
                :key="l.level"
                type="button"
                role="radio"
                :aria-checked="keiken.levelOf(r.prefecture) === l.level"
                :title="l.label"
                class="h-8 min-w-9 rounded-control border px-1.5 text-caption active:not-disabled:translate-y-px pointer-coarse:-ml-px pointer-coarse:h-tap pointer-coarse:min-w-0 pointer-coarse:flex-1 pointer-coarse:rounded-none pointer-coarse:px-0 pointer-coarse:first:ml-0 pointer-coarse:first:rounded-l-control pointer-coarse:last:rounded-r-control"
                :class="
                  keiken.levelOf(r.prefecture) === l.level
                    ? [`lv-${l.level}`, 'relative z-[1] border-ink font-bold', l.level >= 4 ? 'text-paper' : 'text-ink', keiken.isAuto(r.prefecture) ? 'border-dashed' : '']
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
.pref.on {
  stroke: var(--region-ink);
  stroke-width: 0.9;
}
/* 觸控點過後 :hover 會黏住，看起來像還選著；只給有滑鼠的裝置，而且比選中的框細 */
@media (hover: hover) and (pointer: fine) {
  .pref:hover:not(.on) {
    stroke: var(--region-ink);
    stroke-width: 0.7;
  }
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
