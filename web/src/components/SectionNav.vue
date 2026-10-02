<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import { useIndicator } from '../composables/indicator'
import type { NavItem } from '../composables/scrollSpy'

// 頁內段落目錄（DESIGN.md §7.2a）。side：桌機左側直列，目前段落的子段落展開；
// bar：手機頂部橫列，目前段落捲到中間。每一項都是 #錨點連結。
const props = defineProps<{ items: NavItem[]; active: string | null; variant: 'side' | 'bar' }>()
const emit = defineEmits<{ go: [id: string] }>()

/** 目前所在的第一層段落（捲到子段落時是它的上層） */
const activeTop = computed(
  () => props.items.find((it) => it.id === props.active || it.children?.some((c) => c.id === props.active))?.id ?? null,
)

const bar = ref<HTMLElement | null>(null)
const side = ref<HTMLElement | null>(null)
// 目前段落的標示滑過去（DESIGN.md §9）：side 是左側直線（含展開的子段落），bar 是底色膠囊
const root = computed(() => (props.variant === 'side' ? side.value : bar.value))
const { rect, animate } = useIndicator(
  root,
  () => root.value?.querySelector<HTMLElement>(`[data-group="${activeTop.value}"]`),
  () => [activeTop.value, props.items.length],
)
watch(activeTop, async (id) => {
  if (props.variant !== 'bar' || !id) return
  await nextTick()
  const el = bar.value?.querySelector<HTMLElement>(`[data-id="${id}"]`)
  if (el && bar.value) bar.value.scrollTo({ left: el.offsetLeft - (bar.value.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
})
</script>

<template>
  <nav v-if="variant === 'side'" ref="side" aria-label="段落" class="relative flex flex-col border-l-2 border-line text-body-sm">
    <div v-for="it in items" :key="it.id" :data-group="it.id" class="flex flex-col">
      <a
        :href="`#${it.id}`"
        class="flex items-baseline gap-1.5 py-1.5 pl-3.5 no-underline"
        :class="activeTop === it.id ? 'font-bold text-ink' : 'text-sub hover:text-ink active:text-ink'"
        :aria-current="activeTop === it.id ? 'location' : undefined"
        @click.prevent="emit('go', it.id)"
      >
        {{ it.label }}<span v-if="it.count" class="font-latin text-caption font-normal text-sub">{{ it.count }}</span>
      </a>
      <div v-if="it.children?.length && activeTop === it.id" class="flex flex-col pb-1">
        <a
          v-for="c in it.children"
          :key="c.id"
          :href="`#${c.id}`"
          class="py-1 pl-6 text-caption no-underline"
          :class="active === c.id ? 'font-bold text-ink' : 'text-sub hover:text-ink active:text-ink'"
          :aria-current="active === c.id ? 'location' : undefined"
          @click.prevent="emit('go', c.id)"
        >
          {{ c.label }}
        </a>
      </div>
    </div>
    <span
      v-if="rect"
      class="pointer-events-none absolute top-0 -left-[2px] w-[2px] bg-region-strong"
      :class="animate ? 'transition-[translate,height] duration-300 ease-out-soft' : ''"
      :style="{ translate: `0 ${rect.y}px`, height: `${rect.h}px` }"
      aria-hidden="true"
    ></span>
  </nav>
  <nav v-else ref="bar" aria-label="段落" class="scroll-quiet relative flex gap-1 overflow-x-auto">
    <span
      v-if="rect"
      class="pointer-events-none absolute top-0 left-0 rounded-full bg-region-strong"
      :class="animate ? 'transition-[translate,width] duration-300 ease-out-soft' : ''"
      :style="{ translate: `${rect.x}px ${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }"
      aria-hidden="true"
    ></span>
    <a
      v-for="it in items"
      :key="it.id"
      :data-id="it.id"
      :data-group="it.id"
      :href="`#${it.id}`"
      class="relative flex h-8 shrink-0 items-center rounded-full px-3 text-label no-underline transition-colors duration-300 ease-out-soft"
      :class="activeTop === it.id ? ['font-bold text-white', rect ? '' : 'bg-region-strong'] : 'text-sub hover:bg-surface hover:text-ink active:bg-surface active:text-ink'"
      :aria-current="activeTop === it.id ? 'location' : undefined"
      @click.prevent="emit('go', it.id)"
    >
      {{ it.label }}
    </a>
  </nav>
</template>
