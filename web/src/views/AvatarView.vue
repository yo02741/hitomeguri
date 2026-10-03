<script setup lang="ts">
import { computed, ref } from 'vue'

import AvatarRules from '../components/AvatarRules.vue'
import BackLink from '../components/BackLink.vue'
import DollGacha from '../components/DollGacha.vue'
import NewTag from '../components/NewTag.vue'
import DollSpin from '../components/DollSpin.vue'
import PaperDoll from '../components/PaperDoll.vue'
import { EYE_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, type Outfit, SKINS, type Slot, SLOTS } from '../data/outfits'
import { regionOf, regions } from '../data/regions'
import { type AvatarParts, useAvatarStore } from '../stores/avatar'
import { outfitKey, useFreshStore } from '../stores/fresh'
import { useUserStore } from '../stores/user'
import { useWalletStore } from '../stores/wallet'

// 旅人（紙娃娃，DESIGN.md §7.24）：左邊是角色與「抽服裝」，右邊是衣櫃：外觀與五個位置的服裝，單品是貼紙；
// 還沒有的只剩剪影，新拿到還沒點過的標 NEW。抽服裝用抽獎券（與景點卡共用），只抽還沒有的。
const userStore = useUserStore()
const avatar = useAvatarStore()
const wallet = useWalletStore()
const fresh = useFreshStore()

// ---------- 衣櫃 ----------
type Tab = 'look' | Slot
const tab = ref<Tab>('body')
const TABS: Array<{ key: Tab; label: string }> = [{ key: 'look', label: '外觀' }, ...SLOTS]
// 有的在前；同一類裡不限縣的在前，各縣依都道府縣代碼順
const PREF_ORDER = new Map(regions.map((r, i) => [r.prefecture, i]))
const onlyOwned = ref(false)
const items = computed(() =>
  tab.value === 'look'
    ? []
    : OUTFITS.filter((o) => o.slot === tab.value && (!onlyOwned.value || avatar.has(o.id))).sort(
        (a, b) => Number(avatar.has(b.id)) - Number(avatar.has(a.id)) || (a.pref ? (PREF_ORDER.get(a.pref) ?? 99) + 1 : 0) - (b.pref ? (PREF_ORDER.get(b.pref) ?? 99) + 1 : 0),
      ),
)
const prefName = (pref: string) => regionOf(pref)?.name.ja ?? pref
const ownedCount = computed(() => avatar.ownedIds.size)
// 扭蛋抽得到但還沒抽到的；要去那個縣才會加進扭蛋的
const drawable = computed(() => new Set(avatar.remaining.map((o) => o.id)))
const prefLocked = computed(() => OUTFITS.filter((o) => o.pref && !avatar.visitedPrefs.has(o.pref)).length)
function toggle(o: Outfit) {
  if (!avatar.has(o.id)) return
  fresh.seen([outfitKey(o.id)])
  avatar.equip(o.slot, avatar.equipped[o.slot] === o.id && o.slot !== 'body' ? null : o.id)
}
// 外觀選項的頭像：目前的樣子，只換那一項
const look = (p: Partial<AvatarParts>): AvatarParts => ({ ...avatar.parts, ...p })
const HEAD_CROP = '48 14 144 150'

// 規則（使用者自己打開）
const showRules = ref(false)

// ---------- 扭蛋 ----------
const result = ref<{ outfit: Outfit; duplicate: boolean } | null>(null)
function draw() {
  const r = avatar.draw()
  if (r) result.value = r
}
function wear() {
  if (result.value) {
    avatar.equip(result.value.outfit.slot, result.value.outfit.id)
    fresh.seen([outfitKey(result.value.outfit.id)])
  }
  result.value = null
}
</script>

<template>
  <!-- 桌機：整頁不捲動，左邊固定、右邊衣櫃自己捲 -->
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 max-sm:px-4 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:pb-6">
    <header class="flex flex-col gap-2">
      <BackLink to="/log">紀錄</BackLink>
      <div class="flex items-baseline gap-4">
        <h1 class="text-h2 font-black tracking-title">旅人</h1>
        <p class="text-label text-sub">服裝 <span class="whitespace-nowrap font-latin"><span class="text-body font-bold text-ink">{{ ownedCount }}</span> / {{ OUTFITS.length }}</span></p>
        <button
          v-if="userStore.user"
          type="button"
          class="ml-auto flex h-9 items-center gap-1.5 self-center rounded-full border border-line bg-paper px-3.5 text-label font-bold text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
          aria-haspopup="dialog"
          @click="showRules = true"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" /><path d="M9 9h6M9 13h6" /></svg>
          規則
        </button>
      </div>
    </header>

    <p v-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <div v-else class="grid items-start gap-8 lg:min-h-0 lg:flex-1 lg:grid-cols-[380px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch">
      <!-- 角色：3D 展示窗 -->
      <div class="flex w-full flex-col gap-4 max-lg:mx-auto max-lg:max-w-[440px] lg:min-h-0">
        <div class="stage paper-grain relative overflow-hidden rounded-card bg-region-tint lg:min-h-0 lg:flex-1">
          <span class="wa-pattern wa-seigaiha pointer-events-none absolute inset-0 bg-region opacity-25" aria-hidden="true"></span>
          <span class="floor pointer-events-none absolute inset-x-0 bottom-0 h-[17%] bg-region" aria-hidden="true"></span>
          <DollSpin :parts="avatar.parts" :equipped="avatar.equipped" class="absolute inset-0" />
        </div>
        <button
          type="button"
          class="draw flex h-14 shrink-0 items-center gap-3 rounded-card bg-ink px-4 text-paper disabled:cursor-not-allowed disabled:opacity-40 active:not-disabled:translate-y-px"
          :disabled="!avatar.canDraw"
          @click="draw"
        >
          <svg width="30" height="30" viewBox="0 0 120 120" aria-hidden="true">
            <path d="M14 60 A46 46 0 0 1 106 60Z" class="ball-top" />
            <path d="M14 60 A46 46 0 0 0 106 60Z" class="ball-bottom" />
          </svg>
          <span class="text-body font-bold">{{ avatar.remaining.length ? '抽服裝' : prefLocked ? '去過的縣都抽齊了' : '都抽齊了' }}</span>
          <span v-if="avatar.remaining.length" class="ml-auto text-label opacity-80">抽獎券 <span class="font-latin text-body font-bold">{{ wallet.left }}</span></span>
          <span v-else-if="prefLocked" class="ml-auto text-label opacity-80">沒去過的縣 <span class="font-latin text-body font-bold">{{ prefLocked }}</span> 件</span>
        </button>
      </div>

      <!-- 衣櫃 -->
      <section class="flex min-w-0 flex-col lg:min-h-0" aria-label="衣櫃">
        <!-- 手機（<1024）每個分頁平分寬度，不會左右捲 -->
        <div class="flex items-end gap-1 overflow-x-auto px-2" role="tablist" aria-label="衣櫃">
          <button
            v-for="t in TABS"
            :key="t.key"
            type="button"
            role="tab"
            :aria-selected="tab === t.key"
            class="tab h-10 shrink-0 rounded-t-control px-4 text-label font-bold whitespace-nowrap active:text-ink max-lg:min-w-0 max-lg:flex-1 max-lg:shrink max-lg:px-0 pointer-coarse:h-tap"
            :class="tab === t.key ? 'is-on bg-surface text-ink' : 'text-sub hover:text-ink'"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="sheet scroll-quiet rounded-card bg-surface p-5 max-sm:p-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" role="tabpanel">
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
                <div class="flex flex-wrap gap-2.5">
                  <button
                    v-for="s in SKINS"
                    :key="s"
                    type="button"
                    class="swatch size-10 rounded-full active:not-disabled:translate-y-px"
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
                <div class="flex flex-wrap gap-2.5">
                  <button
                    v-for="c in HAIR_COLORS"
                    :key="c"
                    type="button"
                    class="swatch size-10 rounded-full active:not-disabled:translate-y-px"
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
          <div v-if="tab !== 'look'" class="mb-3 flex justify-end">
            <button type="button" class="flex h-8 items-center gap-1.5 rounded-full px-3 text-caption font-bold active:not-disabled:translate-y-px pointer-coarse:h-tap" :class="onlyOwned ? 'bg-ink text-paper' : 'bg-paper text-ink'" :aria-pressed="onlyOwned" @click="onlyOwned = !onlyOwned">
              只看有的
            </button>
          </div>
          <ul v-if="tab !== 'look'" class="grid grid-cols-4 gap-x-2 gap-y-4 max-sm:grid-cols-3 xl:grid-cols-5">
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
            <li v-for="o in items" :key="o.id" class="item">
              <button
                type="button"
                class="tile relative flex w-full flex-col items-center gap-1.5 rounded-control p-1.5 disabled:cursor-default"
                :class="{ 'is-on': avatar.equipped[o.slot] === o.id, 'is-locked': !avatar.has(o.id) }"
                :disabled="!avatar.has(o.id)"
                :aria-pressed="avatar.equipped[o.slot] === o.id"
                :aria-label="avatar.has(o.id) ? o.name : drawable.has(o.id) ? `${o.name}（扭蛋抽得到）` : `${o.name}（去過${prefName(o.pref!)}就有）`"
                @click="toggle(o)"
              >
                <svg :viewBox="o.icon" class="aspect-square w-full overflow-visible p-[8%]" aria-hidden="true">
                  <g :filter="avatar.has(o.id) ? 'url(#doll-cut-sm)' : 'url(#doll-ghost)'" v-html="o.svg"></g>
                </svg>
                <span class="text-caption font-bold text-balance" :class="avatar.has(o.id) ? 'text-ink' : 'text-sub'">{{ o.name }}</span>
                <span v-if="o.pref" lang="ja" class="pref-tag rounded-tag px-1.5 text-micro font-bold" :data-pref="o.pref">{{ prefName(o.pref) }}</span>
                <span v-if="avatar.equipped[o.slot] === o.id" class="seal absolute top-1 right-1 grid size-6 place-items-center rounded-full text-[11px] font-black" aria-hidden="true">穿</span>
                <NewTag v-if="avatar.has(o.id) && fresh.has(outfitKey(o.id))" class="absolute top-1 left-1" />
                <!-- 扭蛋抽得到、還沒抽到 -->
                <svg v-if="drawable.has(o.id)" class="absolute top-1.5 right-1.5" width="16" height="16" viewBox="0 0 120 120" aria-hidden="true">
                  <path d="M14 60 A46 46 0 0 1 106 60Z" class="ball-top-line" />
                  <path d="M14 60 A46 46 0 0 0 106 60Z" class="ball-bottom" />
                </svg>
              </button>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <AvatarRules v-if="showRules" @close="showRules = false" />
    <DollGacha
      v-if="result"
      :result="result"
      :can-draw="avatar.canDraw"
      @wear="wear"
      @again="draw"
      @close="result = null"
    />
  </section>
</template>

<style scoped>
/* 手機：展示窗正方形；桌機填滿左欄的高度 */
@media (max-width: 1023px) {
  .stage {
    aspect-ratio: 1;
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
/* 衣櫃一個分頁上百件：捲動窗外的先不畫（記號都在格子裡，不會被裁到） */
.item {
  content-visibility: auto;
  contain-intrinsic-size: auto 150px;
}
.tile {
  transition: background-color 0.15s;
}
@media (hover: hover) and (pointer: fine) {
  .tile:not(:disabled):hover {
    background: color-mix(in oklab, var(--color-paper) 70%, transparent);
  }
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
.ball-top-line {
  fill: var(--color-paper);
  stroke: var(--color-line);
  stroke-width: 8;
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
