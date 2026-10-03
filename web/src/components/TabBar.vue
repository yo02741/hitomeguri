<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { TABS as tabs, lastOfTab as last, useTabNav } from '../composables/tabNav'
import { useIndicator } from '../composables/indicator'
import { typing } from '../services/keyboard'
import { useUserStore } from '../stores/user'

// 手機與平板（<1024）的底部分頁（UX-FLOW.md §1.1）：探索／行程／紀錄；「我的」在頂部右側頭像。
// 手機打橫（高 ≤500）不顯示，分頁放進 header（決定事項 N2）；這裡照樣記錄各分頁的位置，header 共用。
// 觸控裝置上打字時收起，不蓋住輸入框（services/keyboard.ts）。
// 各分頁記住上次的位置；點目前的分頁先捲回頂端，再點一次回到分頁的根（services/tabNav.ts）。
const route = useRoute()
const userStore = useUserStore()
const { current, href, onTap } = useTabNav()

watch(
  () => route.fullPath,
  () => {
    if (current.value) last[current.value.to] = route.fullPath
  },
  { immediate: true },
)
// 登出、換帳號：上一個人的行程不留著（從未登入到登入不清）
watch(
  () => userStore.user?.uid ?? null,
  (uid, old) => {
    if (!old || uid === old) return
    for (const k of Object.keys(last)) delete last[k]
    if (current.value) last[current.value.to] = route.fullPath
  },
)

// 選中分頁上緣的線滑過去（DESIGN.md §9）
const nav = ref<HTMLElement | null>(null)
const { rect, animate } = useIndicator(nav, () => nav.value?.querySelector<HTMLElement>('[aria-current="page"]'), () => route.name)
</script>

<template>
  <nav
    v-show="!typing"
    ref="nav"
    class="app-tabbar relative box-content flex h-tabbar shrink-0 border-t border-line bg-header pb-[env(safe-area-inset-bottom)] lg:hidden land:hidden print:hidden [view-transition-name:app-tabbar]"
    aria-label="主要"
  >
    <span
      v-if="rect"
      class="pointer-events-none absolute top-0 left-0 flex justify-center"
      :class="animate ? 'transition-[translate] duration-300 ease-out-soft' : ''"
      :style="{ translate: `${rect.x}px 0`, width: `${rect.w}px` }"
      aria-hidden="true"
    >
      <span class="nav-indicator h-[3px] w-10 rounded-b-full bg-region-strong"></span>
    </span>
    <a
      v-for="tab in tabs"
      :key="tab.to"
      :href="href(tab)"
      :data-nav="tab.to === '/log' ? 'log' : undefined"
      class="flex flex-1 flex-col items-center justify-center gap-0.5 text-caption no-underline active:translate-y-px active:text-ink"
      :class="current?.to === tab.to ? 'font-bold text-ink' : 'text-sub'"
      :aria-current="current?.to === tab.to ? 'page' : undefined"
      @click="onTap($event, tab)"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="tab.icon" />
      </svg>
      {{ tab.label }}
    </a>
  </nav>
</template>
