<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useIndicator } from '../composables/indicator'
import { typing } from '../services/keyboard'
import { scrolledAreas, tabAction, tabOf } from '../services/tabNav'
import { useUserStore } from '../stores/user'

// 手機與平板（<1024）的底部分頁（UX-FLOW.md §1.1）：探索／行程／紀錄；「我的」在頂部右側頭像。
// 觸控裝置上打字時收起，不蓋住輸入框（services/keyboard.ts）。
// 各分頁記住上次的位置；點目前的分頁先捲回頂端，再點一次回到分頁的根（services/tabNav.ts）。
const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const tabs = [
  { to: '/', label: '探索', match: ['home', 'explore', 'map', 'region'], icon: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z' },
  { to: '/trips', label: '行程', match: ['trips', 'trip', 'prep', 'practice', 'book'], icon: 'M4 5h16v15H4z M4 10h16 M9 3v4 M15 3v4' },
  { to: '/log', label: '紀錄', match: ['log', 'cards', 'keiken', 'avatar', 'achievements'], icon: 'M5 4h11l3 3v13H5z M9 11h7 M9 15h7' },
] as const
type Tab = (typeof tabs)[number]
const current = computed(() => tabOf(tabs, route.name))

const last = reactive<Record<string, string>>({})
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

function href(tab: Tab): string {
  return current.value?.to === tab.to ? tab.to : (last[tab.to] ?? tab.to)
}

function onTap(e: MouseEvent, tab: Tab) {
  // 新分頁、新視窗開啟交給瀏覽器
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
  e.preventDefault()
  const areas = scrolledAreas(document.getElementById('app-main'))
  const action = tabAction(tab, current.value, route.path, last[tab.to], areas.length > 0)
  if (action.kind === 'go') void router.push(action.to)
  else if (action.kind === 'top') {
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    for (const el of areas) el.scrollTo({ top: 0, behavior })
  }
}

// 選中分頁上緣的線滑過去（DESIGN.md §9）
const nav = ref<HTMLElement | null>(null)
const { rect, animate } = useIndicator(nav, () => nav.value?.querySelector<HTMLElement>('[aria-current="page"]'), () => route.name)
</script>

<template>
  <nav
    v-show="!typing"
    ref="nav"
    class="app-tabbar relative box-content flex h-14 shrink-0 border-t border-line bg-header pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden [view-transition-name:app-tabbar]"
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
      :href="router.resolve(href(tab)).href"
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
