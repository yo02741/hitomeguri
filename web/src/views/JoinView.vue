<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import SkeletonRows from '../components/SkeletonRows.vue'
import { type InviteInfo, useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 用邀請連結加入共編（UX-FLOW.md C7）：登入 → 看到行程名稱與邀請人 → 加入後進到行程頁。
// 加入後這個行程就在自己帳號的「我的行程」（結束後在紀錄）。
const props = defineProps<{ code: string }>()
const userStore = useUserStore()
const trips = useTripsStore()
const router = useRouter()

const invite = ref<InviteInfo | null>(null)
const state = ref<'idle' | 'loading' | 'ready' | 'invalid'>('idle')
const joining = ref(false)

watch(
  () => [userStore.user?.uid, props.code] as const,
  async ([uid, code]) => {
    invite.value = null
    if (!uid) {
      state.value = 'idle'
      return
    }
    state.value = 'loading'
    const inv = await trips.readInvite(code)
    invite.value = inv
    state.value = inv ? 'ready' : 'invalid'
  },
  { immediate: true },
)

async function signIn() {
  try {
    await userStore.signIn()
  } catch {
    // 取消登入
  }
}

async function join() {
  if (!invite.value) return
  joining.value = true
  const id = await trips.join(invite.value)
  joining.value = false
  if (id) await router.replace(`/trips/${id}`)
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-md flex-col items-start gap-5 px-6 py-16">
    <h1 class="text-h2 font-black tracking-[2px]">共編行程</h1>

    <template v-if="!userStore.user">
      <p class="text-body text-ink-2">登入後加入這個行程。</p>
      <button
        type="button"
        class="h-11 rounded-control bg-region-strong px-5 text-body-sm font-bold text-white active:translate-y-px disabled:opacity-40"
        :disabled="!userStore.ready || !userStore.canSignIn"
        @click="signIn"
      >
        登入
      </button>
    </template>

    <SkeletonRows v-else-if="state === 'loading'" :rows="2" />

    <template v-else-if="state === 'ready' && invite">
      <div class="flex flex-col gap-1">
        <span v-if="invite.inviter" class="text-body-sm text-sub">{{ invite.inviter }} 邀請你加入</span>
        <span class="text-h3 font-black">{{ invite.trip_name || '未命名行程' }}</span>
      </div>
      <RouterLink
        v-if="trips.get(invite.trip_id)"
        :to="`/trips/${invite.trip_id}`"
        class="flex h-11 items-center rounded-control bg-region-strong px-5 text-body-sm font-bold text-white no-underline"
      >
        打開行程
      </RouterLink>
      <button
        v-else
        type="button"
        class="h-11 rounded-control bg-region-strong px-5 text-body-sm font-bold text-white active:translate-y-px disabled:opacity-40"
        :disabled="joining || !trips.loaded"
        @click="join"
      >
        加入
      </button>
      <p v-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
    </template>

    <template v-else-if="state === 'invalid'">
      <p class="text-body text-ink-2">這個邀請連結已經失效。</p>
      <RouterLink to="/trips" class="text-body-sm text-sub">我的行程</RouterLink>
    </template>
  </section>
</template>
