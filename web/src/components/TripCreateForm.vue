<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { TRIP_NAME_MAX } from '../services/trip'
import { useTripsStore } from '../stores/trips'
import DateRangePicker from './DateRangePicker.vue'

// 新增行程的表單（/trips）。focus：手機按「新增行程」展開時把焦點放進名稱欄。
const props = defineProps<{ focus?: boolean }>()
const trips = useTripsStore()
const router = useRouter()

const name = ref('')
const start = ref('')
const end = ref('')
// 送出中不能再按（雙擊會建兩個同名行程）；離線時要等連線恢復才寫得進去，按鈕就停用到那時候
const busy = ref(false)
async function create() {
  if (busy.value) return
  busy.value = true
  try {
    const s = start.value || undefined
    const e = end.value && (!s || end.value >= s) ? end.value : s
    const id = await trips.create({ name: name.value.trim(), start_date: s, end_date: e })
    if (id) await router.push(`/trips/${id}`)
  } finally {
    busy.value = false
  }
}
const nameInput = ref<HTMLInputElement | null>(null)
onMounted(() => {
  if (props.focus) nameInput.value?.focus()
})
</script>

<template>
  <form class="flex flex-wrap items-end gap-3" @submit.prevent="create">
    <label class="flex min-w-[200px] flex-1 flex-col gap-1 text-caption text-sub max-lg:basis-full">
      名稱
      <input
        ref="nameInput"
        v-model="name"
        type="text"
        :maxlength="TRIP_NAME_MAX"
        placeholder="例：京都・宇治 3 天"
        enterkeyhint="go"
        class="h-11 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
      />
    </label>
    <div class="flex flex-col gap-1 text-caption text-sub">
      <span>日期</span>
      <DateRangePicker label="日期" size="lg" :start="start" :end="end" @change="(s, e) => ((start = s), (end = e))" />
    </div>
    <button
      type="submit"
      class="h-11 rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="busy"
      :aria-busy="busy"
    >
      新增行程
    </button>
  </form>
</template>
