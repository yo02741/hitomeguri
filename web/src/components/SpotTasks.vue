<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'

import type { CardFace, Rarity } from '../services/card'
import { queueReveal, showReveal } from '../services/cardReveal'
import { hasNight, isShrine, type TaskKey, type Variant } from '../services/cardVariants'
import { useSpotVariants } from '../composables/spotVariants'
import { useCardsStore } from '../stores/cards'
import { cardKey, useFreshStore } from '../stores/fresh'

// 這裡做過的事（DESIGN.md §7.19a）：景點卡片上、去過的景點才有。勾了就拿到那一種收集卡（新卡入手，CardReveal），
// 取消就拿掉。全景看已結束的行程，不能勾。
const props = defineProps<{
  card: CardFace
  rarity: Rarity
  label: string
  number: string
  /** 這個景點收集到的樣式（composables/spotVariants.ts） */
  variants: Variant[]
}>()

const cards = useCardsStore()
const fresh = useFreshStore()
const { tripBySpot } = useSpotVariants()
const ticked = computed(() => cards.tasksOf(props.card.id))
const trip = computed(() => tripBySpot.value.get(props.card.id) ?? null)
const tasks = computed(() => [
  ...(hasNight(props.card) ? [{ key: 'night' as const, label: '晚上去過', card: '夜景' }] : []),
  { key: 'stamp' as const, label: '蓋了紀念章或寄了明信片', card: '切手' },
  { key: 'ink' as const, label: isShrine(props.card.kind) ? '拿到御朱印' : '寫了旅日記', card: '墨繪' },
])

// 勾了之後樣式清單更新：新拿到的標 NEW、亮相。剛好收齊時拿到兩張：先亮相這件事的卡（夜景、切手、墨繪），
// 收進紀錄之後再亮相紀念卡（特別全景）。紀念卡常常晚一次更新才出現：勾完的幾秒內都接著看
let before: Set<string> | null = null
let shown = false
let beforeTimer = 0
function toggle(k: TaskKey) {
  const on = !ticked.value.includes(k)
  if (on) {
    before = new Set(props.variants.map((v) => v.key))
    shown = false
    clearTimeout(beforeTimer)
    beforeTimer = window.setTimeout(() => (before = null), 4000)
  }
  void cards.setTask(props.card.id, k, on)
}
watch(
  () => props.card.id,
  () => (before = null),
)
watch(
  () => props.variants,
  (list) => {
    if (!before) return
    const got = list.filter((v) => !before!.has(v.key))
    if (!got.length) return
    got.forEach((v) => before!.add(v.key))
    fresh.add(got.map((v) => cardKey(props.card.id, v.key)))
    const special = got.filter((v) => v.kind === 'special')
    const rest = got.filter((v) => v.kind !== 'special').sort((a, b) => b.rank - a.rank)
    const order = [...rest.slice(0, 1), ...special].map((variant) => ({
      face: props.card, rarity: props.rarity, label: props.label, number: props.number, variant,
    }))
    if (!shown) showReveal(order[0]!, ...order.slice(1))
    else order.forEach(queueReveal)
    shown = true
  },
)
onBeforeUnmount(() => clearTimeout(beforeTimer))
</script>

<template>
  <section class="flex flex-col" aria-labelledby="done-here">
    <h3 id="done-here" class="pb-0.5 text-caption font-bold tracking-section text-sub">這裡做過的事</h3>
    <ul class="flex flex-col">
      <li v-for="t in tasks" :key="t.key">
        <button
          type="button"
          role="checkbox"
          :aria-checked="ticked.includes(t.key)"
          class="-mx-1.5 flex min-h-9 w-[calc(100%+0.75rem)] items-center gap-2.5 rounded-control px-1.5 text-left text-body-sm text-ink hover:bg-surface active:bg-surface pointer-coarse:min-h-tap"
          @click="toggle(t.key)"
        >
          <span
            class="grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2"
            :class="ticked.includes(t.key) ? 'border-visited bg-visited text-white' : 'border-line bg-paper'"
            aria-hidden="true"
          >
            <svg v-if="ticked.includes(t.key)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <span class="min-w-0 flex-1">{{ t.label }}</span>
          <span class="shrink-0 text-caption text-sub">{{ t.card }}</span>
        </button>
      </li>
      <li>
        <span
          role="checkbox"
          :aria-checked="Boolean(trip)"
          aria-disabled="true"
          class="flex min-h-9 items-center gap-2.5 text-body-sm text-sub pointer-coarse:min-h-tap"
        >
          <span
            class="grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2"
            :class="trip ? 'border-visited/50 bg-visited/50 text-white' : 'border-line-soft bg-surface'"
            aria-hidden="true"
          >
            <svg v-if="trip" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <span class="min-w-0 flex-1 truncate">{{ trip ? `行程「${trip.name}」` : '行程裡去過' }}</span>
          <span class="shrink-0 text-caption text-sub">全景</span>
        </span>
      </li>
    </ul>
  </section>
</template>
