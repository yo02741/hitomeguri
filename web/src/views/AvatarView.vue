<script setup lang="ts">
import { computed, ref } from 'vue'

import PaperDoll from '../components/PaperDoll.vue'
import { regionOf } from '../data/regions'
import { EYE_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, type Outfit, SKINS, type Slot, SLOTS } from '../data/outfits'
import { useAvatarStore } from '../stores/avatar'
import { useUserStore } from '../stores/user'

// 旅人（紙娃娃，DESIGN.md §7.24）：左邊是角色，右邊改外觀、換服裝；下面「抽服裝」用旅行得到的抽獎機會抽。
const userStore = useUserStore()
const avatar = useAvatarStore()
const slot = ref<Slot>('body')
const items = computed(() => OUTFITS.filter((o) => o.slot === slot.value))
const prefName = (pref: string) => regionOf(pref)?.name.ja ?? pref

// 抽服裝：扭蛋。殼先搖、再打開，單品跳出來
type Stage = 'shake' | 'open'
const result = ref<{ outfit: Outfit; duplicate: boolean } | null>(null)
const stage = ref<Stage>('shake')
let timer = 0
function draw() {
  const r = avatar.draw()
  if (!r) return
  result.value = r
  stage.value = 'shake'
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    stage.value = 'open'
    navigator.vibrate?.(r.outfit.rarity === 3 ? 20 : 8)
  }, 900)
}
function wear() {
  if (result.value) avatar.equip(result.value.outfit.slot, result.value.outfit.id)
  result.value = null
}
function toggle(o: Outfit) {
  if (!avatar.has(o.id)) return
  avatar.equip(o.slot, avatar.equipped[o.slot] === o.id && o.slot !== 'body' ? null : o.id)
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-7 px-6 py-9 max-sm:px-4">
    <header class="paper-grain relative flex flex-col gap-4 overflow-hidden rounded-card bg-region p-6 text-on-region max-sm:p-5">
      <RouterLink to="/log" class="flex w-fit items-center gap-1 text-label font-bold text-on-region no-underline hover:underline">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        紀錄
      </RouterLink>
      <div class="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 class="text-h1 font-black tracking-[4px]">旅人</h1>
        <p class="flex items-baseline gap-1.5">
          服裝<span class="font-latin text-h3 font-bold">{{ avatar.ownedIds.size }}</span><span class="font-latin text-body-sm">/ {{ OUTFITS.length }}</span>
        </p>
        <p class="flex items-baseline gap-1.5">
          抽獎券<span class="font-latin text-h3 font-bold">{{ avatar.ticketsLeft }}</span>
        </p>
      </div>
    </header>

    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <div v-else class="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div class="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div class="paper-grain rounded-card bg-region-tint p-5">
          <PaperDoll :parts="avatar.parts" :equipped="avatar.equipped" animate class="mx-auto max-w-[240px]" />
        </div>
        <button
          type="button"
          class="h-12 rounded-control bg-region-strong text-body font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          :disabled="!avatar.canDraw"
          @click="draw"
        >
          抽服裝
        </button>
      </div>

      <div class="flex flex-col gap-7">
        <section class="flex flex-col gap-3" aria-labelledby="look-title">
          <h2 id="look-title" class="text-h3 font-black tracking-[2px]">外觀</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-label text-sub">膚色</span>
              <div class="flex gap-2" role="radiogroup" aria-label="膚色">
                <button
                  v-for="s in SKINS"
                  :key="s"
                  type="button"
                  role="radio"
                  :aria-checked="avatar.parts.skin === s"
                  :aria-label="`膚色 ${s}`"
                  class="size-9 rounded-full border-2"
                  :class="avatar.parts.skin === s ? 'border-ink' : 'border-line'"
                  :style="{ background: `var(--color-doll-skin-${s})` }"
                  @click="avatar.setParts({ skin: s })"
                ></button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-label text-sub">髮色</span>
              <div class="flex gap-2" role="radiogroup" aria-label="髮色">
                <button
                  v-for="c in HAIR_COLORS"
                  :key="c"
                  type="button"
                  role="radio"
                  :aria-checked="avatar.parts.hairColor === c"
                  :aria-label="`髮色 ${c}`"
                  class="size-9 rounded-full border-2"
                  :class="avatar.parts.hairColor === c ? 'border-ink' : 'border-line'"
                  :style="{ background: `var(--color-doll-hair-${c})` }"
                  @click="avatar.setParts({ hairColor: c })"
                ></button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-label text-sub">髮型</span>
              <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="髮型">
                <button
                  v-for="h in HAIR_STYLES"
                  :key="h.key"
                  type="button"
                  role="radio"
                  :aria-checked="avatar.parts.hair === h.key"
                  class="h-9 rounded-full border px-3 text-label"
                  :class="avatar.parts.hair === h.key ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:bg-surface'"
                  @click="avatar.setParts({ hair: h.key })"
                >
                  {{ h.label }}
                </button>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="w-12 shrink-0 text-label text-sub">眼睛</span>
              <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="眼睛">
                <button
                  v-for="e in EYE_STYLES"
                  :key="e.key"
                  type="button"
                  role="radio"
                  :aria-checked="avatar.parts.eyes === e.key"
                  class="h-9 rounded-full border px-3 text-label"
                  :class="avatar.parts.eyes === e.key ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:bg-surface'"
                  @click="avatar.setParts({ eyes: e.key })"
                >
                  {{ e.label }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section class="flex flex-col gap-3" aria-labelledby="wardrobe-title">
          <h2 id="wardrobe-title" class="text-h3 font-black tracking-[2px]">服裝</h2>
          <div class="flex flex-wrap gap-1.5" role="tablist" aria-label="位置">
            <button
              v-for="s in SLOTS"
              :key="s.key"
              type="button"
              role="tab"
              :aria-selected="slot === s.key"
              class="h-9 rounded-full border px-3.5 text-label font-bold"
              :class="slot === s.key ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:bg-surface'"
              @click="slot = s.key"
            >
              {{ s.label }}
            </button>
          </div>
          <ul class="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5" role="tabpanel">
            <li v-if="slot !== 'body'">
              <button
                type="button"
                class="flex w-full flex-col items-center gap-1.5 rounded-card border p-2 text-ink"
                :class="!avatar.equipped[slot] ? 'border-ink bg-surface' : 'border-line bg-paper hover:bg-surface'"
                :aria-pressed="!avatar.equipped[slot]"
                @click="avatar.equip(slot, null)"
              >
                <span class="grid aspect-square w-full place-items-center rounded-control border border-dashed border-line text-caption text-sub">無</span>
                <span class="text-caption font-bold">不戴</span>
              </button>
            </li>
            <li v-for="o in items" :key="o.id">
              <button
                type="button"
                class="flex w-full flex-col items-center gap-1.5 rounded-card border p-2 text-ink disabled:cursor-not-allowed"
                :class="avatar.equipped[o.slot] === o.id ? 'border-ink bg-surface' : 'border-line bg-paper hover:bg-surface'"
                :disabled="!avatar.has(o.id)"
                :aria-pressed="avatar.equipped[o.slot] === o.id"
                :aria-label="avatar.has(o.id) ? o.name : `${o.name}（${prefName(o.pref!)}去過就有）`"
                @click="toggle(o)"
              >
                <svg :viewBox="o.icon" class="aspect-square w-full rounded-control bg-region-tint" :class="avatar.has(o.id) ? '' : 'opacity-25 grayscale'" aria-hidden="true">
                  <g v-html="o.svg"></g>
                </svg>
                <span class="text-caption font-bold" :class="avatar.has(o.id) ? '' : 'text-sub'">{{ o.name }}</span>
                <span v-if="!avatar.has(o.id) && o.pref" lang="ja" class="text-[10px] leading-none text-sub">{{ prefName(o.pref) }}</span>
                <span v-else-if="o.pref" lang="ja" class="text-[10px] leading-none text-sub">{{ prefName(o.pref) }}</span>
              </button>
            </li>
          </ul>
        </section>
      </div>
    </div>

    <!-- 扭蛋 -->
    <div v-if="result" class="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-ink/75 p-4" role="dialog" aria-modal="true" aria-label="抽服裝">
      <div class="relative grid size-[260px] place-items-center">
        <div v-if="stage === 'open'" class="rays" :class="`rays-${result.outfit.rarity}`" aria-hidden="true"></div>
        <div class="capsule absolute inset-0" :class="stage" aria-hidden="true">
          <span class="half top"></span>
          <span class="half bottom"></span>
        </div>
        <svg v-if="stage === 'open'" :viewBox="result.outfit.icon" class="prize relative size-[180px] rounded-card bg-paper" aria-hidden="true">
          <g v-html="result.outfit.svg"></g>
        </svg>
      </div>
      <div v-if="stage === 'open'" class="flex flex-col items-center gap-1 text-paper">
        <p class="text-h3 font-black">{{ result.outfit.name }}</p>
        <p v-if="result.outfit.pref" lang="ja" class="text-label">{{ prefName(result.outfit.pref) }}</p>
        <p v-if="result.duplicate" class="text-label text-paper/70">已經有了</p>
      </div>
      <div v-if="stage === 'open'" class="flex gap-2">
        <button type="button" class="h-11 rounded-control bg-paper px-5 text-body-sm font-bold text-ink" @click="wear">穿上</button>
        <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper disabled:opacity-40" :disabled="!avatar.canDraw" @click="draw">再抽</button>
        <button type="button" class="h-11 rounded-control border border-paper/50 px-4 text-body-sm text-paper" @click="result = null">關閉</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 扭蛋殼：上半地區色、下半紙色；先左右搖，再上下分開 */
.capsule .half {
  position: absolute;
  left: 50%;
  width: 180px;
  height: 90px;
  translate: -50% 0;
}
.capsule .top {
  top: 40px;
  border-radius: 90px 90px 0 0;
  background: var(--region-strong);
}
.capsule .bottom {
  top: 130px;
  border-radius: 0 0 90px 90px;
  background: var(--color-glare);
}
.capsule.shake {
  animation: capsule-shake 0.9s ease-in-out both;
}
@keyframes capsule-shake {
  0%,
  100% {
    transform: rotate(0);
  }
  20% {
    transform: rotate(-12deg);
  }
  40% {
    transform: rotate(12deg);
  }
  60% {
    transform: rotate(-9deg);
  }
  80% {
    transform: rotate(9deg);
  }
}
.capsule.open .top {
  animation: capsule-top 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
.capsule.open .bottom {
  animation: capsule-bottom 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
@keyframes capsule-top {
  to {
    transform: translateY(-140px) rotate(-18deg);
    opacity: 0;
  }
}
@keyframes capsule-bottom {
  to {
    transform: translateY(140px) rotate(18deg);
    opacity: 0;
  }
}
.prize {
  animation: prize-pop 0.5s 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
@keyframes prize-pop {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
}
.rays {
  position: absolute;
  inset: -40%;
  border-radius: 50%;
  background: repeating-conic-gradient(var(--ray) 0deg 3deg, transparent 3deg 12deg);
  mask: radial-gradient(circle closest-side, #000 0 20%, transparent 90%);
  animation: rays-spin 24s linear infinite;
  opacity: 0.8;
}
.rays-1 {
  --ray: color-mix(in oklab, var(--color-glare) 35%, transparent);
}
.rays-2 {
  --ray: color-mix(in oklab, var(--region-accent) 80%, transparent);
}
.rays-3 {
  --ray: color-mix(in oklab, var(--color-gold-2) 85%, transparent);
}
@keyframes rays-spin {
  to {
    transform: rotate(1turn);
  }
}
@media (prefers-reduced-motion: reduce) {
  .capsule .half,
  .prize,
  .rays {
    animation: none;
  }
}
</style>
