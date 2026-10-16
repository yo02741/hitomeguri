<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from 'vue'

import DollDefs from '../components/DollDefs.vue'
import PaperDoll from '../components/PaperDoll.vue'
import { EYE_STYLES, HAIR_COLORS, HAIR_STYLES, OUTFITS, SKINS, type Slot, SLOTS } from '../data/outfits'
import { type AvatarParts, useAvatarStore } from '../stores/avatar'

// 3D 旅人的對照頁（DESIGN.md §7.24a，2026-10-11）：左邊現在的紙娃娃、右邊 3D，換外觀與服裝對照看。
// 旅人頁的展示窗也是這個 3D；這裡可以試穿全部的單品（對照用，不改收集的資料）。
const Avatar3D = defineAsyncComponent(() => import('../components/Avatar3D.vue'))

const avatar = useAvatarStore()
const parts = ref<AvatarParts>({ ...avatar.parts })
const equipped = ref<Partial<Record<Slot, string>>>({ ...avatar.equipped })
// 背景不在 3D 裡（展示窗後面的一層，DESIGN.md §7.24b）
const SLOTS_3D = SLOTS.filter((s) => s.key !== 'bg')
const bySlot = computed(() => Object.fromEntries(SLOTS.map((s) => [s.key, OUTFITS.filter((o) => o.slot === s.key)])) as Record<Slot, typeof OUTFITS>)

function setItem(slot: Slot, id: string) {
  const next = { ...equipped.value }
  if (id) next[slot] = id
  else delete next[slot]
  equipped.value = next
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8 max-sm:px-4 max-sm:py-5">
    <DollDefs />
    <h1 class="text-h2 font-black tracking-title">旅人 3D</h1>
    <div class="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <figure class="flex flex-col items-center gap-2 rounded-card bg-surface p-4">
        <PaperDoll :parts="parts" :equipped="equipped" class="h-auto w-full max-w-[16rem]" />
        <figcaption class="text-caption text-sub">紙娃娃</figcaption>
      </figure>
      <figure class="flex flex-col items-center gap-2 rounded-card bg-surface p-4">
        <Avatar3D :parts="parts" :equipped="equipped" class="aspect-[4/5] w-full max-w-[28rem]" />
        <figcaption class="text-caption text-sub">3D（拖曳轉圈，雙擊回正面）</figcaption>
      </figure>
    </div>

    <div class="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
      <label class="flex flex-col gap-1 text-body-sm">
        <span class="font-bold">髮型</span>
        <select v-model="parts.hair" class="h-10 rounded-control border border-line bg-paper px-2">
          <option v-for="h in HAIR_STYLES" :key="h.key" :value="h.key">{{ h.label }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-body-sm">
        <span class="font-bold">眼睛</span>
        <select v-model="parts.eyes" class="h-10 rounded-control border border-line bg-paper px-2">
          <option v-for="e in EYE_STYLES" :key="e.key" :value="e.key">{{ e.label }}</option>
        </select>
      </label>
      <div class="flex flex-col gap-1 text-body-sm">
        <span class="font-bold">膚色</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="s in SKINS"
            :key="s"
            type="button"
            class="size-8 rounded-full border-2"
            :class="parts.skin === s ? 'border-ink' : 'border-line'"
            :style="{ background: `var(--color-doll-skin-${s})` }"
            :aria-label="`膚色 ${s}`"
            :aria-pressed="parts.skin === s"
            @click="parts.skin = s"
          ></button>
        </div>
      </div>
      <div class="flex flex-col gap-1 text-body-sm">
        <span class="font-bold">髮色</span>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="c in HAIR_COLORS"
            :key="c"
            type="button"
            class="size-8 rounded-full border-2"
            :class="parts.hairColor === c ? 'border-ink' : 'border-line'"
            :style="{ background: `var(--color-doll-hair-${c})` }"
            :aria-label="`髮色 ${c}`"
            :aria-pressed="parts.hairColor === c"
            @click="parts.hairColor = c"
          ></button>
        </div>
      </div>
      <label v-for="s in SLOTS_3D" :key="s.key" class="flex flex-col gap-1 text-body-sm">
        <span class="font-bold">{{ s.label }}</span>
        <select :value="equipped[s.key] ?? ''" class="h-10 rounded-control border border-line bg-paper px-2" @change="setItem(s.key, ($event.target as HTMLSelectElement).value)">
          <option value="">不穿</option>
          <option v-for="o in bySlot[s.key]" :key="o.id" :value="o.id">{{ o.name }}</option>
        </select>
      </label>
    </div>
  </div>
</template>
