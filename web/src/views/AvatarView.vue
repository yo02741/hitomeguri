<script setup lang="ts">
import { computed, ref } from 'vue'

import DollGacha from '../components/DollGacha.vue'
import PaperDoll from '../components/PaperDoll.vue'
import { useVisitedEntries } from '../composables/visited'
import { EYE_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, type Outfit, SKINS, type Slot, SLOTS } from '../data/outfits'
import { NATIONAL_PATTERN, PATTERN_BY_AREA } from '../data/patterns'
import { regionOf, regions } from '../data/regions'
import { type AvatarParts, useAvatarStore } from '../stores/avatar'
import { useUserStore } from '../stores/user'

// 旅人（紙娃娃，DESIGN.md §7.24）：左邊是舞台（去過的縣的地區色與紋樣，下面的站名標換縣），
// 右邊是衣櫃：外觀與五個位置的服裝，單品是貼紙；還沒有的只剩剪影。舞台下「抽服裝」用旅行得到的抽獎機會抽。
const userStore = useUserStore()
const avatar = useAvatarStore()
const { entries } = useVisitedEntries()

// ---------- 舞台 ----------
/** 去過的縣（都道府縣代碼順） */
const visitedRegions = computed(() => regions.filter((r) => avatar.visitedPrefs.has(r.prefecture)))
/** 最近去的縣 */
const latestPref = computed(() => {
  let best: { pref: string; on: string } | null = null
  for (const [, m] of entries.value) if (!best || (m.visited_on ?? '') > best.on) best = { pref: m.pref, on: m.visited_on ?? '' }
  return best?.pref ?? null
})
const stagePref = computed(() => {
  const s = avatar.parts.stage
  return s && avatar.visitedPrefs.has(s) ? s : latestPref.value
})
const stageRegion = computed(() => (stagePref.value ? regionOf(stagePref.value) : undefined))
const PATTERN_CLASS: Record<string, string> = {
  seigaiha: 'wa-seigaiha',
  asanoha: 'wa-asanoha',
  kikko: 'wa-kikko',
  ichimatsu: 'wa-ichimatsu',
  uroko: 'wa-uroko',
  shippo: 'wa-shippo',
  yagasuri: 'wa-yagasuri',
  hishi: 'wa-hishi',
}
const stagePattern = computed(() => PATTERN_CLASS[((stageRegion.value && PATTERN_BY_AREA[stageRegion.value.area]) || NATIONAL_PATTERN).key])
function stepStage(delta: -1 | 1) {
  const list = visitedRegions.value
  if (list.length < 2) return
  const i = list.findIndex((r) => r.prefecture === stagePref.value)
  const next = list[(i + delta + list.length) % list.length]!
  avatar.setParts({ stage: next.prefecture })
}
const neighbor = (delta: -1 | 1) => {
  const list = visitedRegions.value
  if (list.length < 2) return undefined
  const i = list.findIndex((r) => r.prefecture === stagePref.value)
  return list[(i + delta + list.length) % list.length]
}

// ---------- 衣櫃 ----------
type Tab = 'look' | Slot
const tab = ref<Tab>('body')
const TABS: Array<{ key: Tab; label: string }> = [{ key: 'look', label: '外觀' }, ...SLOTS]
const items = computed(() => (tab.value === 'look' ? [] : OUTFITS.filter((o) => o.slot === tab.value)))
const prefName = (pref: string) => regionOf(pref)?.name.ja ?? pref
const ownedCount = computed(() => avatar.ownedIds.size)
function toggle(o: Outfit) {
  if (!avatar.has(o.id)) return
  avatar.equip(o.slot, avatar.equipped[o.slot] === o.id && o.slot !== 'body' ? null : o.id)
}
// 外觀選項的頭像：目前的樣子，只換那一項
const look = (p: Partial<AvatarParts>): AvatarParts => ({ ...avatar.parts, ...p })
const HEAD_CROP = '48 14 144 150'

// ---------- 扭蛋 ----------
const result = ref<{ outfit: Outfit; duplicate: boolean } | null>(null)
function draw() {
  const r = avatar.draw()
  if (r) result.value = r
}
function wear() {
  if (result.value) avatar.equip(result.value.outfit.slot, result.value.outfit.id)
  result.value = null
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 max-sm:px-4">
    <header class="flex flex-col gap-2">
      <RouterLink to="/log" class="flex w-fit items-center gap-1 text-label font-bold text-sub no-underline hover:text-ink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        紀錄
      </RouterLink>
      <div class="flex items-baseline gap-4">
        <h1 class="text-h1 font-black tracking-[6px]">旅人</h1>
        <p class="text-label text-sub">服裝 <span class="font-latin text-body font-bold text-ink">{{ ownedCount }}</span> / {{ OUTFITS.length }}</p>
      </div>
    </header>

    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <div v-else class="grid items-start gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
      <!-- 舞台 -->
      <div class="flex w-full flex-col gap-4 max-lg:mx-auto max-lg:max-w-[440px] lg:sticky lg:top-6" :data-pref="stagePref ?? undefined">
        <div class="stage paper-grain relative overflow-hidden rounded-card bg-region-tint">
          <span class="wa-pattern pointer-events-none absolute inset-0 bg-region opacity-30" :class="stagePattern" aria-hidden="true"></span>
          <span class="floor pointer-events-none absolute inset-x-0 bottom-0 h-[17%] bg-region" aria-hidden="true"></span>
          <PaperDoll :parts="avatar.parts" :equipped="avatar.equipped" animate class="doll-main relative mx-auto h-auto pt-[6%]" />
        </div>
        <!-- 站名標：換舞台的縣 -->
        <div class="sign overflow-hidden rounded-card bg-paper shadow-float">
          <div class="flex flex-col items-center px-3 pt-2.5 pb-2">
            <span lang="ja" class="font-display text-h2 leading-tight tracking-[0.3em] max-sm:text-h3">{{ stageRegion?.name.ja ?? '日本' }}</span>
            <span class="text-caption font-bold tracking-[0.4em] text-sub uppercase">{{ stageRegion?.name.romaji ?? 'Nippon' }}</span>
          </div>
          <div class="flex items-center justify-between bg-region-strong px-1 text-caption font-bold text-white" :class="visitedRegions.length > 1 ? 'h-9' : 'h-2'">
            <button v-if="neighbor(-1)" type="button" class="flex h-full items-center gap-1.5 px-2" :aria-label="`舞台換成${neighbor(-1)!.name.ja}`" @click="stepStage(-1)">
              <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M8 0L0 5l8 5z" fill="currentColor" /></svg>
              <span lang="ja">{{ neighbor(-1)!.name.ja }}</span>
            </button>
            <span v-else></span>
            <button v-if="neighbor(1)" type="button" class="flex h-full items-center gap-1.5 px-2" :aria-label="`舞台換成${neighbor(1)!.name.ja}`" @click="stepStage(1)">
              <span lang="ja">{{ neighbor(1)!.name.ja }}</span>
              <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 0l8 5-8 5z" fill="currentColor" /></svg>
            </button>
          </div>
        </div>
        <button
          type="button"
          class="draw flex h-14 items-center gap-3 rounded-card bg-ink px-4 text-paper disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!avatar.canDraw"
          @click="draw"
        >
          <svg width="30" height="30" viewBox="0 0 120 120" aria-hidden="true">
            <path d="M14 60 A46 46 0 0 1 106 60Z" class="ball-top" />
            <path d="M14 60 A46 46 0 0 0 106 60Z" class="ball-bottom" />
          </svg>
          <span class="text-body font-bold">抽服裝</span>
          <span class="ml-auto text-label opacity-80">抽獎券 <span class="font-latin text-body font-bold">{{ avatar.ticketsLeft }}</span></span>
        </button>
      </div>

      <!-- 衣櫃 -->
      <section class="flex min-w-0 flex-col" aria-label="衣櫃">
        <div class="flex items-end gap-1 overflow-x-auto px-2" role="tablist" aria-label="衣櫃">
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="tab === t.key"
            class="tab h-10 shrink-0 rounded-t-control px-4 text-label font-bold"
            :class="tab === t.key ? 'is-on bg-surface text-ink' : 'text-sub hover:text-ink'"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="sheet rounded-card bg-surface p-5 max-sm:p-3 lg:min-h-[520px]" role="tabpanel">
          <!-- 外觀 -->
          <div v-if="tab === 'look'" class="flex flex-col gap-6">
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-2 text-label font-bold text-sub">髮型</legend>
              <div class="grid grid-cols-5 gap-2 max-sm:grid-cols-3">
                <button
                  v-for="h in HAIR_STYLES"
                  :key="h.key"
                  type="button"
                  class="tile flex flex-col items-center gap-1 rounded-control p-1.5"
                  :class="{ 'is-on': avatar.parts.hair === h.key }"
                  :aria-pressed="avatar.parts.hair === h.key"
                  @click="avatar.setParts({ hair: h.key })"
                >
                  <PaperDoll :parts="look({ hair: h.key })" :equipped="{}" :crop="HEAD_CROP" class="aspect-[144/150] w-full" />
                  <span class="text-caption font-bold">{{ h.label }}</span>
                </button>
              </div>
            </fieldset>
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-2 text-label font-bold text-sub">眼睛</legend>
              <div class="grid grid-cols-5 gap-2 max-sm:grid-cols-3">
                <button
                  v-for="e in EYE_STYLES"
                  :key="e.key"
                  type="button"
                  class="tile flex flex-col items-center gap-1 rounded-control p-1.5"
                  :class="{ 'is-on': avatar.parts.eyes === e.key }"
                  :aria-pressed="avatar.parts.eyes === e.key"
                  @click="avatar.setParts({ eyes: e.key })"
                >
                  <PaperDoll :parts="look({ eyes: e.key })" :equipped="{}" :crop="HEAD_CROP" class="aspect-[144/150] w-full" />
                  <span class="text-caption font-bold">{{ e.label }}</span>
                </button>
              </div>
            </fieldset>
            <div class="flex flex-wrap gap-x-10 gap-y-5">
              <fieldset>
                <legend class="mb-2 text-label font-bold text-sub">膚色</legend>
                <div class="flex gap-2.5">
                  <button
                    v-for="s in SKINS"
                    :key="s"
                    type="button"
                    class="swatch size-10 rounded-full"
                    :class="{ 'is-on': avatar.parts.skin === s }"
                    :aria-pressed="avatar.parts.skin === s"
                    :aria-label="`膚色 ${s}`"
                    :style="{ background: `var(--color-doll-skin-${s})` }"
                    @click="avatar.setParts({ skin: s })"
                  ></button>
                </div>
              </fieldset>
              <fieldset>
                <legend class="mb-2 text-label font-bold text-sub">髮色</legend>
                <div class="flex gap-2.5">
                  <button
                    v-for="c in HAIR_COLORS"
                    :key="c"
                    type="button"
                    class="swatch size-10 rounded-full"
                    :class="{ 'is-on': avatar.parts.hairColor === c }"
                    :aria-pressed="avatar.parts.hairColor === c"
                    :aria-label="`髮色 ${c}`"
                    :style="{ background: `var(--color-doll-hair-${c})` }"
                    @click="avatar.setParts({ hairColor: c })"
                  ></button>
                </div>
              </fieldset>
            </div>
          </div>

          <!-- 服裝：貼紙 -->
          <ul v-else class="grid grid-cols-4 gap-x-2 gap-y-4 max-sm:grid-cols-3 xl:grid-cols-5">
            <li v-if="tab !== 'body'">
              <button
                type="button"
                class="tile flex w-full flex-col items-center gap-1.5 rounded-control p-1.5"
                :class="{ 'is-on': !avatar.equipped[tab] }"
                :aria-pressed="!avatar.equipped[tab]"
                @click="avatar.equip(tab, null)"
              >
                <span class="grid aspect-square w-full place-items-center">
                  <span class="size-[46%] rounded-full border-2 border-dashed border-line"></span>
                </span>
                <span class="text-caption font-bold">不戴</span>
              </button>
            </li>
            <li v-for="o in items" :key="o.id">
              <button
                type="button"
                class="tile relative flex w-full flex-col items-center gap-1.5 rounded-control p-1.5 disabled:cursor-default"
                :class="{ 'is-on': avatar.equipped[o.slot] === o.id, 'is-locked': !avatar.has(o.id) }"
                :disabled="!avatar.has(o.id)"
                :aria-pressed="avatar.equipped[o.slot] === o.id"
                :aria-label="avatar.has(o.id) ? o.name : o.pref ? `${o.name}（${prefName(o.pref)}）` : `${o.name}（還沒抽到）`"
                @click="toggle(o)"
              >
                <svg :viewBox="o.icon" class="aspect-square w-full overflow-visible p-[8%]" aria-hidden="true">
                  <g :filter="avatar.has(o.id) ? 'url(#doll-cut-sm)' : 'url(#doll-ghost)'" v-html="o.svg"></g>
                </svg>
                <span class="text-caption font-bold" :class="avatar.has(o.id) ? 'text-ink' : 'text-sub'">{{ o.name }}</span>
                <span v-if="o.pref" lang="ja" class="pref-tag rounded-tag px-1.5 text-[10px] leading-[16px] font-bold" :data-pref="o.pref">{{ prefName(o.pref) }}</span>
                <span v-if="avatar.equipped[o.slot] === o.id" class="seal absolute top-1 right-1 grid size-6 place-items-center rounded-full text-[11px] font-black" aria-hidden="true">穿</span>
              </button>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <DollGacha
      v-if="result"
      :result="result"
      :can-draw="avatar.canDraw"
      :pref="stagePref"
      @wear="wear"
      @again="draw"
      @close="result = null"
    />
  </section>
</template>

<style scoped>
.stage {
  aspect-ratio: 5 / 6;
}
.doll-main {
  width: 78%;
}
/* 手機：舞台矮一點，抽服裝與衣櫃不用捲很遠 */
@media (max-width: 1023px) {
  .stage {
    aspect-ratio: 1;
  }
  .doll-main {
    width: 64%;
  }
}
.floor {
  opacity: 0.55;
  border-top: 3px solid color-mix(in oklab, var(--region-strong) 40%, transparent);
}
/* 衣櫃的索引標籤接在紙上 */
.tab.is-on {
  position: relative;
}
.sheet {
  background-image: radial-gradient(color-mix(in oklab, var(--color-line) 70%, transparent) 1px, transparent 1.2px);
  background-size: 18px 18px;
}
.tile {
  transition: background-color 0.15s;
}
.tile:not(:disabled):hover {
  background: color-mix(in oklab, var(--color-paper) 70%, transparent);
}
.tile.is-on {
  background: var(--color-paper);
  box-shadow: inset 0 0 0 2px var(--color-ink);
}
.tile:not(:disabled):active svg {
  transform: scale(0.94);
}
.tile svg {
  transition: transform 0.15s var(--ease-out-soft);
}
.pref-tag {
  background: var(--region-strong);
  color: var(--color-white);
}
.is-locked .pref-tag {
  background: transparent;
  color: var(--color-sub);
  box-shadow: inset 0 0 0 1px var(--color-line);
}
/* 穿著：朱色的小印 */
.seal {
  background: var(--color-item-red);
  color: var(--color-item-white);
  rotate: -10deg;
}
.swatch {
  box-shadow:
    0 0 0 3px var(--color-item-white),
    0 2px 6px color-mix(in oklab, var(--color-shade) 20%, transparent);
}
.swatch.is-on {
  box-shadow:
    0 0 0 3px var(--color-item-white),
    0 0 0 5px var(--color-ink);
}
.ball-top {
  fill: var(--color-item-white);
  opacity: 0.9;
}
.ball-bottom {
  fill: var(--color-item-red);
}
@media (prefers-reduced-motion: reduce) {
  .tile svg {
    transition: none;
  }
}
</style>
