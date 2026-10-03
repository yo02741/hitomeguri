<script setup lang="ts">
import { defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { whenIdle } from '../services/idle'
import { afterSplash } from '../services/splash'
import { wide } from '../services/viewport'
import { walkerOn } from '../services/walker'
import { useUserStore } from '../stores/user'
import ThemeTimeline from './ThemeTimeline.vue'

// 右上角頭像：點開向下展開的帳號選單（UX-FLOW.md F0）。
// 滑鼠移到頭像上（桌機）：旅人的小卡片（DESIGN.md §7.24）；選單上方是旅人的半身像，連到旅人頁，
// 「散步的旅人」開關（DollWalker）。
// 紙娃娃（UserMenuDoll，含全部服裝的 SVG）不放進入口程式：這個元件只在登入後掛上，開場之後閒下來先抓。
const userStore = useUserStore()
const loadDoll = () => import('./UserMenuDoll.vue')
const UserMenuDoll = defineAsyncComponent(loadDoll)
afterSplash(() => whenIdle(() => void loadDoll()))
const route = useRoute()
const router = useRouter()

const items = [
  { to: '/trips', label: '我的行程', match: ['trips', 'trip', 'prep', 'practice', 'book'] },
  { to: '/log', label: '旅行紀錄', match: ['log', 'cards', 'keiken', 'avatar', 'achievements'] },
  { to: '/me', label: '收藏與清單', match: ['me', 'list'] },
  { to: '/limited', label: '期間限定', match: ['limited'] },
]
const isActive = (it: (typeof items)[number]) => it.match.includes(String(route.name))

const open = ref(false)
// 桌機 hover 頭像：停一下才出現，移開就收
const peek = ref(false)
const canHover = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches
let peekTimer = 0
function onEnter() {
  if (!canHover) return
  void loadDoll()
  clearTimeout(peekTimer)
  peekTimer = window.setTimeout(() => (peek.value = true), 220)
}
function onLeave() {
  clearTimeout(peekTimer)
  peek.value = false
}
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function menuItems(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"], input[type="range"]') ?? [])
}

async function show(focus: 'first' | 'last' | null = null) {
  open.value = true
  await nextTick()
  const list = menuItems()
  if (focus === 'first') list[0]?.focus()
  if (focus === 'last') list[list.length - 1]?.focus()
}

function hide(returnFocus = false) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

function onTriggerKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    hide()
  } else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    void show('first')
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    void show('last')
  }
}

function onMenuKey(e: KeyboardEvent) {
  const list = menuItems()
  const i = list.indexOf(document.activeElement as HTMLElement)
  if (e.key === 'ArrowDown') list[(i + 1) % list.length]?.focus()
  else if (e.key === 'ArrowUp') list[(i - 1 + list.length) % list.length]?.focus()
  else if (e.key === 'Home') list[0]?.focus()
  else if (e.key === 'End') list[list.length - 1]?.focus()
  else if (e.key === 'Escape') hide(true)
  else if (e.key === 'Tab') hide()
  else return
  e.preventDefault()
}

// 點選單以外的地方就收起
function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) hide()
}
watch(open, (o) => {
  if (o) document.addEventListener('pointerdown', onPointerDown)
  else document.removeEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
watch(() => route.fullPath, () => hide())

async function logOut() {
  hide()
  await userStore.logOut()
  await router.push('/')
}
</script>

<template>
  <div v-if="userStore.user" ref="root" class="relative" @mouseenter="onEnter" @mouseleave="onLeave">
    <button
      ref="trigger"
      type="button"
      aria-label="帳號選單"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="user-menu"
      class="grid size-10 place-items-center overflow-hidden rounded-full border border-line bg-placeholder text-sub active:not-disabled:translate-y-px"
      :class="open || items.some(isActive) ? 'outline-2 outline-offset-2 outline-region-strong' : ''"
      @click="peek = false; open ? hide() : show()"
      @keydown="onTriggerKey"
    >
      <img
        v-if="userStore.user.photoURL"
        :src="userStore.user.photoURL"
        alt=""
        class="size-full object-cover"
        referrerpolicy="no-referrer"
      />
      <svg
        v-else
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </svg>
    </button>

    <!-- hover：旅人小卡片 -->
    <RouterLink
      v-if="peek && !open"
      to="/log/avatar"
      data-reduce="fade"
      class="peek paper-grain absolute top-12 right-0 z-30 flex w-44 flex-col items-center gap-1 rounded-card bg-region-tint px-3 pt-3 pb-2.5 text-ink no-underline shadow-float"
      @click="peek = false"
    >
      <UserMenuDoll kind="peek" />
    </RouterLink>

    <div
      v-if="open"
      id="user-menu"
      ref="menu"
      role="menu"
      aria-label="帳號選單"
      data-reduce="fade"
      class="absolute top-12 right-0 z-30 flex w-72 origin-top-right animate-pop-in flex-col rounded-card bg-paper p-1.5 shadow-float"
      @keydown="onMenuKey"
    >
      <div class="flex items-center gap-3 px-2.5 pt-1.5 pb-2.5">
        <RouterLink to="/log/avatar" role="menuitem" tabindex="-1" aria-label="旅人" class="paper-grain relative h-14 w-12 shrink-0 overflow-hidden rounded-control bg-region-tint active:not-disabled:translate-y-px" @click="hide()">
          <UserMenuDoll kind="bust" />
        </RouterLink>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-body-sm font-bold text-ink">{{ userStore.user.displayName }}</span>
          <span v-if="userStore.user.email" class="truncate text-caption text-sub">{{ userStore.user.email }}</span>
        </span>
      </div>
      <div class="mx-1 border-t border-line-soft" role="none"></div>
      <RouterLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        role="menuitem"
        tabindex="-1"
        class="mt-1 flex min-h-tap items-center rounded-control px-2.5 text-body-sm text-ink no-underline hover:bg-surface focus-visible:bg-surface active:bg-surface"
        :class="isActive(it) ? 'font-bold' : ''"
        :aria-current="isActive(it) ? 'page' : undefined"
        @click="hide()"
      >
        {{ it.label }}
      </RouterLink>
      <div class="mx-1 mt-1 border-t border-line-soft" role="none"></div>
      <!-- 年代主題（DESIGN.md §13）：存在這台裝置 -->
      <ThemeTimeline />
      <button
        v-if="wide"
        type="button"
        role="menuitemcheckbox"
        tabindex="-1"
        :aria-checked="walkerOn"
        class="mt-1 flex min-h-tap items-center justify-between rounded-control px-2.5 text-left text-body-sm text-ink hover:bg-surface focus-visible:bg-surface active:bg-surface"
        @click="walkerOn = !walkerOn"
      >
        散步的旅人
        <span class="relative h-5 w-9 rounded-full transition-colors" :class="walkerOn ? 'bg-region-strong' : 'bg-line'" aria-hidden="true">
          <span class="absolute top-0.5 left-0.5 size-4 rounded-full bg-paper transition-transform duration-150 ease-out-soft" :class="walkerOn ? 'translate-x-4' : ''"></span>
        </span>
      </button>
      <div class="mx-1 mt-1 border-t border-line-soft" role="none"></div>
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        class="mt-1 flex min-h-tap items-center rounded-control px-2.5 text-left text-body-sm text-ink hover:bg-surface focus-visible:bg-surface active:bg-surface"
        @click="logOut"
      >
        登出
      </button>
    </div>
  </div>
</template>

<style scoped>
.peek {
  animation: peek-in 0.2s var(--ease-out-soft) both;
}
@keyframes peek-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
</style>
