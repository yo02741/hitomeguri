<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useUserStore } from '../stores/user'

// 右上角頭像：點開向下展開的帳號選單（UX-FLOW.md F0）。
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const items = [
  { to: '/trips', label: '我的行程', match: ['trips'] },
  { to: '/log', label: '旅行紀錄', match: ['log'] },
  { to: '/me', label: '收藏與清單', match: ['me', 'list'] },
]
const isActive = (it: (typeof items)[number]) => it.match.includes(String(route.name))

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function menuItems(): HTMLElement[] {
  return Array.from(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
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
  <div v-if="userStore.user" ref="root" class="relative">
    <button
      ref="trigger"
      type="button"
      aria-label="帳號選單"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="user-menu"
      class="grid size-10 place-items-center overflow-hidden rounded-full border border-line bg-placeholder text-sub"
      :class="open || items.some(isActive) ? 'outline-2 outline-offset-2 outline-region-strong' : ''"
      @click="open ? hide() : show()"
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

    <div
      v-if="open"
      id="user-menu"
      ref="menu"
      role="menu"
      aria-label="帳號選單"
      class="absolute top-12 right-0 z-30 flex w-60 flex-col rounded-card bg-paper p-1.5 shadow-float"
      @keydown="onMenuKey"
    >
      <div class="flex flex-col px-2.5 pt-1.5 pb-2.5">
        <span class="truncate text-body-sm font-bold text-ink">{{ userStore.user.displayName }}</span>
        <span v-if="userStore.user.email" class="truncate text-caption text-sub">{{ userStore.user.email }}</span>
      </div>
      <div class="mx-1 border-t border-line-soft" role="none"></div>
      <RouterLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        role="menuitem"
        tabindex="-1"
        class="mt-1 flex min-h-tap items-center rounded-control px-2.5 text-body-sm text-ink no-underline hover:bg-surface focus-visible:bg-surface"
        :class="isActive(it) ? 'font-bold' : ''"
        :aria-current="isActive(it) ? 'page' : undefined"
        @click="hide()"
      >
        {{ it.label }}
      </RouterLink>
      <div class="mx-1 mt-1 border-t border-line-soft" role="none"></div>
      <button
        type="button"
        role="menuitem"
        tabindex="-1"
        class="mt-1 flex min-h-tap items-center rounded-control px-2.5 text-left text-body-sm text-ink hover:bg-surface focus-visible:bg-surface"
        @click="logOut"
      >
        登出
      </button>
    </div>
  </div>
</template>
