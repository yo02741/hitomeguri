<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useDismiss } from '../composables/floating'
import type { Trip } from '../services/trip'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'
import MemberAvatar from './MemberAvatar.vue'

// 行程的共編成員（UX-FLOW.md C7）：頭像列＋「共編」選單。選單裡是邀請連結（複製、重新產生）與成員名單；
// 建立者可以移除成員，其他成員可以離開。成員都能編輯。
const props = defineProps<{ trip: Trip }>()
const trips = useTripsStore()
const userStore = useUserStore()
const router = useRouter()

const uid = computed(() => userStore.user?.uid)
const isOwner = computed(() => uid.value === props.trip.owner)
// 建立者排第一，自己第二
const members = computed(() =>
  [...props.trip.members].sort(
    (a, b) => Number(b === props.trip.owner) - Number(a === props.trip.owner) || Number(b === uid.value) - Number(a === uid.value),
  ),
)

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const toggleBtn = ref<HTMLButtonElement | null>(null)
useDismiss(root, open, () => (open.value = false), () => toggleBtn.value)

const busy = ref(false)
const copied = ref(false)
const link = computed(() => {
  const code = props.trip.invite
  return code ? new URL(router.resolve(`/join/${code}`).href, location.origin).href : ''
})

async function toggle() {
  open.value = !open.value
  // 第一次打開時產生邀請連結
  if (open.value && !props.trip.invite) {
    busy.value = true
    await trips.invite(props.trip.id)
    busy.value = false
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // 不能寫入剪貼簿時選取文字讓使用者自己複製
    root.value?.querySelector<HTMLInputElement>('input[readonly]')?.select()
  }
}
async function renew() {
  if (!window.confirm('重新產生連結？舊的連結會失效。')) return
  busy.value = true
  await trips.invite(props.trip.id, true)
  busy.value = false
}
async function remove(m: string) {
  const name = props.trip.member_info[m]?.name || '這位成員'
  if (!window.confirm(`把 ${name} 移出這個行程？`)) return
  await trips.removeMember(props.trip.id, m)
}
async function leave() {
  if (!uid.value || !window.confirm(`離開「${props.trip.name || '未命名行程'}」？離開後就看不到這個行程。`)) return
  await trips.removeMember(props.trip.id, uid.value)
  await router.push('/trips')
}
</script>

<template>
  <div ref="root" class="relative flex items-center gap-2">
    <button
      ref="toggleBtn"
      type="button"
      class="flex h-9 items-center gap-2 rounded-control border border-line bg-paper pr-3 pl-1.5 text-label text-ink hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
      aria-haspopup="true"
      :aria-expanded="open"
      @click="toggle"
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
      v-if="open"
      class="absolute top-full left-0 z-30 mt-2 flex w-[min(340px,calc(100vw-40px))] flex-col gap-3 rounded-card bg-paper p-3.5 shadow-float"
      role="group"
      aria-label="共編"
    >
      <div class="flex flex-col gap-1.5">
        <span class="text-caption text-sub">邀請連結</span>
        <div class="flex gap-1.5">
          <input
            readonly
            :value="busy && !link ? '' : link"
            aria-label="邀請連結"
            class="h-9 min-w-0 flex-1 rounded-control border border-line bg-surface px-2.5 font-latin text-caption text-ink outline-none pointer-coarse:h-tap"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <button
            type="button"
            class="h-9 shrink-0 rounded-control bg-region-strong px-3 text-label font-bold text-white active:translate-y-px disabled:opacity-40 pointer-coarse:h-tap"
            :disabled="!link"
            @click="copy"
          >
            {{ copied ? '已複製' : '複製' }}
          </button>
        </div>
        <button
          type="button"
          class="w-fit text-caption text-sub hover:text-ink disabled:opacity-40 active:text-ink pointer-coarse:min-h-tap"
          :disabled="busy || !link"
          @click="renew"
        >
          重新產生連結
        </button>
      </div>

      <ul class="flex flex-col border-t border-line-soft pt-2">
        <li v-for="m in members" :key="m" class="flex min-h-tap items-center gap-2.5">
          <MemberAvatar :member="trip.member_info[m]" />
          <span class="min-w-0 flex-1 truncate text-body-sm">
            {{ trip.member_info[m]?.name || '成員' }}
            <span v-if="m === uid" class="text-caption text-sub">（你）</span>
          </span>
          <span v-if="m === trip.owner" class="shrink-0 text-caption text-sub">建立者</span>
          <button
            v-else-if="isOwner"
            type="button"
            class="h-8 shrink-0 rounded-control px-2.5 text-caption text-sub hover:bg-surface hover:text-danger active:not-disabled:translate-y-px pointer-coarse:h-tap"
            @click="remove(m)"
          >
            移除
          </button>
          <button
            v-else-if="m === uid"
            type="button"
            class="h-8 shrink-0 rounded-control px-2.5 text-caption text-danger hover:bg-surface active:not-disabled:translate-y-px pointer-coarse:h-tap"
            @click="leave"
          >
            離開
          </button>
        </li>
      </ul>
      <p v-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
    </div>
  </div>
</template>
