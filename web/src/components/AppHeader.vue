<script setup lang="ts">
import { nextTick, ref, useId, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useIndicator } from '../composables/indicator'
import { useOnline } from '../composables/online'

import type { SearchHit } from '../services/search'
import { useExploreStore } from '../stores/explore'
import { useUserStore } from '../stores/user'
import SearchBox from './SearchBox.vue'
import UserMenu from './UserMenu.vue'
import Wordmark from './Wordmark.vue'

const userStore = useUserStore()
const online = useOnline()
const explore = useExploreStore()

const route = useRoute()
const router = useRouter()

// 搜尋結果交給探索頁處理；在其他頁（行程、紀錄）先回到探索頁
function onPick(hit: SearchHit) {
  explore.searchPick = hit
  if (!['home', 'explore', 'map'].includes(String(route.name))) router.push('/')
  closeSearch()
}

// 手機（<1024）：放大鏡鈕展開佔滿 header 的搜尋列；選了結果、取消、Esc 收起，焦點回到放大鏡鈕。
// 搜尋列一直掛著（v-show），在點擊的同一個事件裡就把它顯示出來並聚焦：
// iOS Safari 只有在使用者操作的事件當下呼叫 focus() 才會叫出鍵盤，等到 onMounted 就太晚了。
const searchOpen = ref(false)
const searchId = useId()
const searchBtn = ref<HTMLButtonElement | null>(null)
const searchBar = ref<HTMLElement | null>(null)
const phoneSearch = ref<InstanceType<typeof SearchBox> | null>(null)
function openSearch() {
  searchOpen.value = true
  // v-show 要等下一次更新才拿掉 display:none；先自己拿掉，focus() 才有作用
  if (searchBar.value) searchBar.value.style.display = ''
  phoneSearch.value?.focus()
}
function closeSearch() {
  if (!searchOpen.value) return
  searchOpen.value = false
  phoneSearch.value?.clear()
  void nextTick(() => searchBtn.value?.focus())
}
watch(
  () => route.fullPath,
  () => {
    if (!searchOpen.value) return
    searchOpen.value = false
    phoneSearch.value?.clear()
  },
)

const tabs = [
  { to: '/', label: '探索', match: ['home', 'explore', 'map', 'region'] },
  { to: '/trips', label: '行程', match: ['trips', 'trip', 'prep', 'practice', 'book'] },
  { to: '/log', label: '紀錄', match: ['log', 'cards', 'keiken', 'avatar', 'achievements'] },
]

function isActive(tab: (typeof tabs)[number]) {
  return tab.match.includes(String(route.name))
}
// 選中分頁的底線滑過去（DESIGN.md §9）
const nav = ref<HTMLElement | null>(null)
const { rect, animate } = useIndicator(nav, () => nav.value?.querySelector<HTMLElement>('[aria-current="page"]'), () => route.name)
</script>

<template>
  <!-- view-transition-name 讓 header 自成一層：要比 main 高，搜尋結果、帳號選單才不會被地圖蓋住 -->
  <header class="app-header relative z-40 flex h-header shrink-0 items-center gap-4 border-b border-line bg-header pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] lg:gap-8 print:hidden [view-transition-name:app-header]">
    <Wordmark />
    <span v-if="!online" class="-ml-1 shrink-0 rounded-tag bg-ink px-1.5 text-caption font-bold whitespace-nowrap text-paper lg:-ml-5" role="status">離線</span>

    <nav ref="nav" class="relative flex h-full max-lg:hidden" aria-label="主要">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
      :data-nav="tab.to === '/log' ? 'log' : undefined"
        class="flex items-center border-b-3 border-transparent px-4 text-body whitespace-nowrap no-underline active:text-ink"
        :class="isActive(tab) ? 'font-bold text-ink' : 'text-sub'"
        :aria-current="isActive(tab) ? 'page' : undefined"
      >
        {{ tab.label }}
      </RouterLink>
      <span
        v-if="rect"
        class="nav-indicator pointer-events-none absolute bottom-0 left-0 h-[3px] bg-region-strong"
        :class="animate ? 'transition-[translate,width] duration-300 ease-out-soft' : ''"
        :style="{ translate: `${rect.x}px 0`, width: `${rect.w}px` }"
        aria-hidden="true"
      ></span>
    </nav>

    <div class="ml-auto flex items-center gap-2.5">
      <SearchBox class="max-lg:hidden" @pick="onPick" />
      <button
        ref="searchBtn"
        type="button"
        class="grid size-tap place-items-center rounded-control text-ink active:translate-y-px lg:hidden"
        aria-label="搜尋景點、地區"
        :aria-expanded="searchOpen"
        :aria-controls="searchOpen ? searchId : undefined"
        @click="openSearch"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" />
        </svg>
      </button>
      <UserMenu v-if="userStore.user" />
      <button
        v-else
        type="button"
        class="h-11 rounded-control border border-line bg-paper px-3.5 text-body-sm whitespace-nowrap text-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!userStore.ready || !userStore.canSignIn"
        @click="userStore.signIn()"
      >
        登入
      </button>
    </div>

    <div
      v-show="searchOpen"
      :id="searchId"
      ref="searchBar"
      class="absolute inset-0 z-10 flex items-center gap-2 bg-header pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] lg:hidden"
      @keydown.esc="closeSearch"
    >
      <SearchBox ref="phoneSearch" full @pick="onPick" />
      <button type="button" class="h-tap shrink-0 px-2 text-body-sm whitespace-nowrap text-sub active:translate-y-px" @click="closeSearch">取消</button>
    </div>
  </header>
</template>
