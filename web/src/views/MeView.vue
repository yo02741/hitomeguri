<script setup lang="ts">
import { useRouter } from 'vue-router'

import { useUserStore } from '../stores/user'

const userStore = useUserStore()
const router = useRouter()

async function logOut() {
  await userStore.logOut()
  await router.push('/')
}
</script>

<template>
  <section class="mx-auto w-full max-w-5xl px-6 py-9">
    <h1 class="text-h2 font-black tracking-[2px]">我的</h1>
    <div v-if="userStore.user" class="mt-6 flex flex-col gap-4">
      <p class="text-body">{{ userStore.user.displayName }}</p>
      <button
        type="button"
        class="h-11 w-fit rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink active:translate-y-px"
        @click="logOut"
      >
        登出
      </button>
    </div>
    <div v-else class="mt-6 flex flex-col gap-4">
      <p class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
      <button
        type="button"
        class="h-11 w-fit rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!userStore.ready || !userStore.canSignIn"
        @click="userStore.signIn()"
      >
        用 Google 登入
      </button>
    </div>
  </section>
</template>
