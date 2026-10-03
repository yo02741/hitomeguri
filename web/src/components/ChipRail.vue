<script setup lang="ts">
import { computed, ref } from 'vue'

import { useDismiss } from '../composables/floating'
import { usePackChips } from '../composables/packChips'
import { useExploreStore } from '../stores/explore'
import { useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'
import PackSettings from './PackSettings.vue'
import RollingNumber from './RollingNumber.vue'

// 手機（<1024）探索頁的 chip 軌道（決定事項 C、DESIGN.md §7.5）：海報條下面一行，橫向捲動。
// 收藏 n（登入且有收藏時）、各擴充包（--pack 色、件數跟著目前的縣）、設定。開著的 chip 實心，再點一下關閉。
// 軌道本身不吃點擊（地圖照樣拖得動），只有 chip 可以點；設定選單放在捲動區外面，才不會被裁掉。
const props = defineProps<{ pref?: string | null }>()
const explore = useExploreStore()
const marks = useMarksStore()
const userStore = useUserStore()
const { shown, count, empty } = usePackChips(() => props.pref)
const showFavorites = computed(() => Boolean(userStore.user && marks.favorites.length))

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const settingsBtn = ref<HTMLButtonElement | null>(null)
useDismiss(root, menuOpen, () => (menuOpen.value = false), () => settingsBtn.value)

// 點擊區撐到 44（觸控），看得到的膠囊維持 36（決定事項 B2）
const hit = 'pointer-events-auto flex h-9 shrink-0 items-center active:not-disabled:translate-y-px pointer-coarse:h-tap'
const pill = 'flex h-9 items-center gap-1.5 rounded-full px-3.5 text-label font-bold whitespace-nowrap shadow-float'
</script>

<template>
  <div ref="root" class="pointer-events-none relative">
    <!-- 上下多留 12px 給膠囊的陰影（捲動區會裁掉超出的部分），再用負 margin 收回 -->
    <div class="scroll-quiet -mx-4 -my-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 py-3">
      <button
        v-if="showFavorites"
        type="button"
        :class="hit"
        :aria-pressed="explore.onlyFavorites"
        @click="explore.onlyFavorites = !explore.onlyFavorites"
      >
        <span :class="[pill, explore.onlyFavorites ? 'bg-ink text-paper' : 'bg-paper text-ink']">
          <svg width="16" height="16" viewBox="0 0 24 24" :fill="explore.onlyFavorites ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
          </svg>
          收藏<RollingNumber :value="marks.favorites.length" class="font-latin" />
        </span>
      </button>
      <button
        v-for="p in shown"
        :key="p.key"
        type="button"
        :class="[hit, empty(p.key) ? 'opacity-50' : '']"
        :style="{ '--pack': `var(--color-t-${p.color})` }"
        :aria-pressed="explore.pack === p.key"
        :disabled="empty(p.key)"
        @click="explore.togglePack(p.key)"
      >
        <span :class="[pill, explore.pack === p.key ? 'bg-(--pack) text-white' : 'bg-paper text-ink']">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            :class="explore.pack === p.key ? '' : 'text-(--pack)'"
            aria-hidden="true"
          >
            <path :d="p.icon" />
          </svg>
          {{ p.label }}
          <RollingNumber v-if="count(p.key) !== null" :value="count(p.key) ?? 0" class="font-latin font-semibold" />
        </span>
      </button>
      <button
        ref="settingsBtn"
        type="button"
        :class="hit"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        @click="menuOpen = !menuOpen"
      >
        <span :class="[pill, menuOpen ? 'bg-ink text-paper' : 'bg-paper text-ink']">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
            <circle cx="16" cy="7" r="2" />
            <circle cx="10" cy="17" r="2" />
          </svg>
          設定
        </span>
      </button>
    </div>
    <!-- 點選單外面只收起選單，不會連帶點到底下的清單或地圖（和帳號選單一樣） -->
    <div v-if="menuOpen" class="pointer-events-auto fixed inset-0 z-10" aria-hidden="true" @click="menuOpen = false"></div>
    <PackSettings v-if="menuOpen" class="pointer-events-auto absolute top-full right-0 z-20 mt-1 max-w-full origin-top-right" />
  </div>
</template>
