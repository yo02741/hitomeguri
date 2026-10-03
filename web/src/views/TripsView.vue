<script setup lang="ts">
import { computed, ref } from 'vue'

import TripCard from '../components/TripCard.vue'
import TripCreateForm from '../components/TripCreateForm.vue'
import { tripStatus } from '../services/trip'
import { wide } from '../services/viewport'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 行程列表（UX-FLOW.md C1）：還沒結束的行程；結束的在「紀錄」。
const userStore = useUserStore()
const trips = useTripsStore()

const upcoming = computed(() => trips.sorted.filter((t) => tripStatus(t, trips.today) !== 'done'))
const doneCount = computed(() => trips.trips.length - upcoming.value.length)

// 手機（<1024）：已有的行程排在前面，新增表單收成一顆「新增行程」，按了才展開並把焦點放進名稱欄。
// DOM 順序跟畫面一致（桌機表單在上面，手機在清單後面），讀螢幕與 Tab 的順序才對。
const formOpen = ref(false)
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pt-9 pb-24">
    <h1 class="text-h2 font-black tracking-title">行程</h1>

    <template v-if="userStore.user">
      <TripCreateForm v-if="wide" />

      <ul v-if="upcoming.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="t in upcoming" :key="t.id"><TripCard :trip="t" /></li>
      </ul>
      <p v-else-if="trips.loaded" class="text-body-sm text-sub">還沒有行程</p>
      <button
        v-if="!wide && !formOpen"
        type="button"
        class="h-11 w-fit rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:not-disabled:translate-y-px"
        @click="formOpen = true"
      >
        新增行程
      </button>
      <TripCreateForm v-else-if="!wide" focus />
      <RouterLink v-if="doneCount" to="/log" class="w-fit text-body-sm text-sub active:text-ink pointer-coarse:-my-3 pointer-coarse:py-3">已結束的旅行 {{ doneCount }}</RouterLink>
      <p v-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
    </template>
    <div v-else class="flex flex-col items-start gap-4">
      <p class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
      <button
        type="button"
        class="h-11 rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:not-disabled:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!userStore.ready || !userStore.canSignIn"
        @click="userStore.signIn()"
      >
        登入
      </button>
    </div>
  </section>
</template>
