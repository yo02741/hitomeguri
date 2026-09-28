<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'

import type { SearchHit } from '../services/search'
import { useExploreStore } from '../stores/explore'
import { useUserStore } from '../stores/user'
import SearchBox from './SearchBox.vue'
import Wordmark from './Wordmark.vue'

const userStore = useUserStore()
const explore = useExploreStore()

const route = useRoute()
const router = useRouter()

// 搜尋結果交給探索頁處理；在其他頁（行程、紀錄）先回到探索頁
function onPick(hit: SearchHit) {
  explore.searchPick = hit
  if (!['home', 'explore', 'map'].includes(String(route.name))) router.push('/')
}

const tabs = [
  { to: '/', label: '探索', match: ['home', 'explore', 'map', 'region'] },
  { to: '/trips', label: '行程', match: ['trips'] },
  { to: '/log', label: '紀錄', match: ['log'] },
]

function isActive(tab: (typeof tabs)[number]) {
  return tab.match.includes(String(route.name))
}
</script>

<template>
  <header class="flex h-header shrink-0 items-center gap-8 border-b border-line bg-header px-4 md:px-6">
    <Wordmark />

    <nav class="flex h-full max-md:hidden" aria-label="主要">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex items-center border-b-3 px-4 text-body no-underline"
        :class="isActive(tab) ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub'"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>

    <div class="ml-auto flex items-center gap-2.5">
      <SearchBox class="max-md:hidden" @pick="onPick" />
      <RouterLink
        v-if="userStore.user"
        to="/me"
        aria-label="我的"
        class="grid size-10 place-items-center overflow-hidden rounded-full border border-line bg-placeholder text-sub"
        :class="route.name === 'me' ? 'outline-2 outline-offset-2 outline-region-strong' : ''"
      >
        <img
          v-if="userStore.user.photoURL"
          :src="userStore.user.photoURL"
          :alt="userStore.user.displayName ?? ''"
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
      </RouterLink>
      <button
        v-else
        type="button"
        class="h-11 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!userStore.ready || !userStore.canSignIn"
        @click="userStore.signIn()"
      >
        登入
      </button>
    </div>
  </header>
</template>
