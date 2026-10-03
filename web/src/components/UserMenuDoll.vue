<script setup lang="ts">
import { useAvatarStore } from '../stores/avatar'
import { useWalletStore } from '../stores/wallet'
import PaperDoll from './PaperDoll.vue'

// 帳號選單裡的旅人（DESIGN.md §7.24）：hover 的小卡片內容（peek）、選單上方的半身像（bust）。
// 紙娃娃要用全部服裝的 SVG，UserMenu 以 defineAsyncComponent 載入這個元件，沒登入的人不下載。
defineProps<{ kind: 'peek' | 'bust' }>()
const avatar = useAvatarStore()
const wallet = useWalletStore()
</script>

<template>
  <template v-if="kind === 'peek'">
    <PaperDoll :parts="avatar.parts" :equipped="avatar.equipped" animate class="h-auto w-32" />
    <span class="text-body-sm font-black tracking-[2px]">旅人</span>
    <span class="text-caption text-sub">服裝 <span class="font-latin font-bold text-ink">{{ avatar.ownedIds.size }}</span>　抽獎券 <span class="font-latin font-bold text-ink">{{ wallet.left }}</span></span>
  </template>
  <PaperDoll v-else :parts="avatar.parts" :equipped="{ ...avatar.equipped, buddy: undefined }" crop="40 12 160 190" class="absolute inset-0 size-full" />
</template>
