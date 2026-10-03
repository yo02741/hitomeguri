<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { confirmDialog } from '../services/confirm'
import { withLineExternal } from '../services/inApp'
import type { Trip } from '../services/trip'
import { coarse, wide } from '../services/viewport'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'
import MemberAvatar from './MemberAvatar.vue'

// 共編選單的內容（TripMembers：桌機是浮動卡，手機是下方對話框）：邀請連結（傳送或複製、重新產生）與成員名單；
// 建立者可以移除成員，其他成員可以離開。
// 邀請連結帶 LINE 的外部瀏覽器參數（services/inApp.ts，決定事項 J3）。
// 觸控或窄螢幕有系統分享（navigator.share）時「複製」換成「傳送」；分享失敗（使用者取消除外）改成複製。
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

const root = ref<HTMLElement | null>(null)
const busy = ref(false)
const copied = ref(false)
const link = computed(() => {
  const code = props.trip.invite
  return code ? withLineExternal(new URL(router.resolve(`/join/${code}`).href, location.origin).href) : ''
})
const canShare = computed(() => typeof navigator.share === 'function' && (coarse.value || !wide.value))

// 第一次打開時產生邀請連結
onMounted(async () => {
  if (props.trip.invite) return
  busy.value = true
  await trips.invite(props.trip.id)
  busy.value = false
})

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
async function send() {
  try {
    // 要在點擊的同一個事件裡呼叫（transient activation），前面不能先 await
    await navigator.share({ title: props.trip.name || '共編行程', url: link.value })
  } catch (e) {
    if ((e as DOMException | null)?.name !== 'AbortError') await copy()
  }
}
async function renew() {
  if (!(await confirmDialog({ title: '重新產生連結？', body: '舊的連結會失效。', ok: '重新產生' }))) return
  busy.value = true
  await trips.invite(props.trip.id, true)
  busy.value = false
}
async function remove(m: string) {
  const name = props.trip.member_info[m]?.name || '這位成員'
  if (!(await confirmDialog({ title: `把 ${name} 移出這個行程？`, ok: '移出', danger: true }))) return
  await trips.removeMember(props.trip.id, m)
}
async function leave() {
  if (!uid.value) return
  const ok = await confirmDialog({
    title: `離開「${props.trip.name || '未命名行程'}」？`,
    body: '離開後就看不到這個行程。',
    ok: '離開',
    danger: true,
  })
  if (!ok || !uid.value) return
  await trips.removeMember(props.trip.id, uid.value)
  await router.push('/trips')
}
</script>

<template>
  <div ref="root" class="flex flex-col gap-3">
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
          class="h-9 shrink-0 rounded-control bg-region-strong px-3 text-body-sm font-bold text-white active:translate-y-px disabled:opacity-40 pointer-coarse:h-tap"
          :disabled="!link"
          @click="canShare ? send() : copy()"
        >
          {{ copied ? '已複製' : canShare ? '傳送' : '複製' }}
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
</template>
