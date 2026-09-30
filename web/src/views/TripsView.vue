<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import DateRangePicker from '../components/DateRangePicker.vue'
import TripCard from '../components/TripCard.vue'
import { TRIP_NAME_MAX, tripStatus } from '../services/trip'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'

// 行程列表（UX-FLOW.md C1）：還沒結束的行程；結束的在「紀錄」。
const userStore = useUserStore()
const trips = useTripsStore()
const router = useRouter()

const upcoming = computed(() => trips.sorted.filter((t) => tripStatus(t, trips.today) !== 'done'))
const doneCount = computed(() => trips.trips.length - upcoming.value.length)

const name = ref('')
const start = ref('')
const end = ref('')
async function create() {
  const s = start.value || undefined
  const e = end.value && (!s || end.value >= s) ? end.value : s
  const id = await trips.create({ name: name.value.trim(), start_date: s, end_date: e })
  if (id) await router.push(`/trips/${id}`)
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-9">
    <h1 class="text-h2 font-black tracking-[2px]">行程</h1>

    <template v-if="userStore.user">
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="create">
        <label class="flex min-w-[200px] flex-1 flex-col gap-1 text-caption text-sub">
          名稱
          <input
            v-model="name"
            type="text"
            :maxlength="TRIP_NAME_MAX"
            placeholder="例：京都・宇治 3 天"
            class="h-11 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
          />
        </label>
        <div class="flex flex-col gap-1 text-caption text-sub">
          <span>日期</span>
          <DateRangePicker label="日期" size="lg" :start="start" :end="end" @change="(s, e) => ((start = s), (end = e))" />
        </div>
        <button type="submit" class="h-11 rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:translate-y-px">
          新增行程
        </button>
      </form>

      <ul v-if="upcoming.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li v-for="t in upcoming" :key="t.id"><TripCard :trip="t" /></li>
      </ul>
      <p v-else-if="trips.loaded" class="text-body-sm text-sub">還沒有行程</p>
      <RouterLink v-if="doneCount" to="/log" class="w-fit text-body-sm text-sub">已結束的旅行 {{ doneCount }}</RouterLink>
      <p v-if="trips.error" class="text-caption text-danger" role="alert">{{ trips.error }}</p>
    </template>
    <p v-else class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
  </section>
</template>
