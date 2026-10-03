<script setup lang="ts">
import { computed, ref } from 'vue'

import { useDismiss } from '../composables/floating'
import type { Trip } from '../services/trip'
import { wide } from '../services/viewport'
import { useUserStore } from '../stores/user'
import BottomDialog from './BottomDialog.vue'
import MemberAvatar from './MemberAvatar.vue'
import TripMembersPanel from './TripMembersPanel.vue'

// 行程的共編成員（UX-FLOW.md C7）：頭像列＋「共編」選單（內容見 TripMembersPanel）。成員都能編輯。
// 桌機是按鈕下面的浮動卡；手機（<1024）是從下方出現的 <dialog>，在最上層，不被底部分頁列蓋住。
const props = defineProps<{ trip: Trip }>()
const userStore = useUserStore()

const uid = computed(() => userStore.user?.uid)
// 建立者排第一，自己第二
const members = computed(() =>
  [...props.trip.members].sort(
    (a, b) => Number(b === props.trip.owner) - Number(a === props.trip.owner) || Number(b === uid.value) - Number(a === uid.value),
  ),
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const toggleBtn = ref<HTMLButtonElement | null>(null)
// 浮動卡：點外面、Esc 收起。下方對話框自己處理 Esc 與點遮罩
useDismiss(root, computed(() => open.value && wide.value), () => (open.value = false), () => toggleBtn.value)
</script>

<template>
  <div ref="root" class="relative flex items-center gap-2">
    <button
      ref="toggleBtn"
      type="button"
      class="flex h-9 items-center gap-2 rounded-control border border-line bg-paper pr-3 pl-1.5 text-body-sm text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
      :aria-haspopup="wide ? 'true' : 'dialog'"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="flex -space-x-1.5">
        <MemberAvatar
          v-for="m in members.slice(0, 4)"
          :key="m"
          :member="trip.member_info[m]"
          :size="24"
          class="ring-2 ring-paper"
        />
      </span>
      共編<span v-if="members.length > 1" class="font-latin">{{ members.length }}</span>
    </button>

    <div
      v-if="open && wide"
      class="absolute top-full left-0 z-30 mt-2 w-[min(340px,calc(100vw-40px))] rounded-card bg-paper p-3.5 shadow-float"
      role="group"
      aria-label="共編"
    >
      <TripMembersPanel :trip="trip" />
    </div>
    <BottomDialog v-else-if="open" title="共編" @close="open = false">
      <TripMembersPanel :trip="trip" />
    </BottomDialog>
  </div>
</template>
