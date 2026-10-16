<script setup lang="ts">
import { useAvatarStore } from '../stores/avatar'
import { useWalletStore } from '../stores/wallet'
import DollBackdrop from './DollBackdrop.vue'
import PaperDoll from './PaperDoll.vue'

// 帳號選單裡的旅人（DESIGN.md §7.24）：hover 的小卡片內容（peek）、選單上方的半身像（bust）。
// 紙娃娃要用全部服裝的 SVG，UserMenu 以 defineAsyncComponent 載入這個元件，沒登入的人不下載。
// 換了地區背景（§7.24b）時兩處都畫在背景前面：小卡片是一扇小展示窗，半身像的框整個換成風景。
defineProps<{ kind: 'peek' | 'bust' }>()
const avatar = useAvatarStore()
const wallet = useWalletStore()
</script>

<template>
  <template v-if="kind === 'peek'">
    <!-- 小展示窗：上面留一點，高的帽子不會被切到 -->
    <span v-if="avatar.worn.bg" class="relative block w-32 overflow-hidden rounded-control pt-3">
      <DollBackdrop :id="avatar.worn.bg" />
      <PaperDoll :parts="avatar.parts" :equipped="avatar.worn" animate class="relative h-auto w-full" />
    </span>
    <PaperDoll v-else :parts="avatar.parts" :equipped="avatar.worn" animate class="h-auto w-32" />
    <span class="text-body-sm font-black tracking-[2px]">旅人</span>
    <span class="text-caption text-sub">服裝 <span class="font-num font-bold text-ink">{{ avatar.ownedIds.size }}</span>　抽獎券 <span class="font-num font-bold text-ink">{{ wallet.left }}</span></span>
  </template>
  <template v-else>
    <DollBackdrop :id="avatar.worn.bg" />
    <PaperDoll :parts="avatar.parts" :equipped="{ ...avatar.worn, buddy: undefined }" crop="40 12 160 190" class="absolute inset-0 size-full" />
  </template>
</template>
