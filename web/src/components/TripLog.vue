<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { showToast } from '../services/toast'
import type { Trip } from '../services/trip'
import { collapseLog, type LogItem, logText, readSeen, writeSeen } from '../services/tripLog'
import { useTripsStore } from '../stores/trips'
import { useUserStore } from '../stores/user'
import MemberAvatar from './MemberAvatar.vue'

// 共編的行程：上次看過之後旅伴改了什麼（services/tripLog.ts）。「知道了」或離開頁面就算看過（記在這台裝置）。
// 開著頁面時旅伴一改，底部跳一行提示。自己的修改不列。
const props = defineProps<{ trip: Trip }>()
const trips = useTripsStore()
const userStore = useUserStore()

const uid = computed(() => userStore.user?.uid)
const items = ref<LogItem[]>([])
// 第一次打開這個行程（這台裝置沒有記錄）：從現在算起，不倒出以前的紀錄
const since = ref(readSeen(props.trip.id) ?? Date.now())
if (readSeen(props.trip.id) === null) writeSeen(props.trip.id, since.value)

const SHOW = 6
const all = ref(false)
const others = computed(() => collapseLog(items.value.filter((x) => x.by !== uid.value && x.at > since.value)))
const shown = computed(() => (all.value ? others.value : others.value.slice(0, SHOW)))

const who = (by: string) => props.trip.member_info[by]?.name || '旅伴'
function when(at: number): string {
  const d = new Date(at)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

let stop: (() => void) | null = null
let gone = false
// 提示只給打開頁面之後才發生的（第一次讀到的可能是離線快取，之後伺服器補來的舊紀錄不算新的）
const opened = Date.now()
const toasted = new Set<string>()
onMounted(async () => {
  const off = await trips.watchLog(props.trip.id, since.value, (list, added) => {
    items.value = list
    const fresh = list.filter((x) => added.includes(x.id) && x.by !== uid.value && x.at > opened && !toasted.has(x.id))
    fresh.forEach((x) => toasted.add(x.id))
    if (fresh.length === 1) showToast(`${who(fresh[0]!.by)} ${logText(fresh[0]!)}`)
    else if (fresh.length > 1) showToast(`${who(fresh[0]!.by)} 改了 ${fresh.length} 個地方`)
  })
  if (gone) off()
  else stop = off
})
onBeforeUnmount(() => {
  gone = true
  stop?.()
  writeSeen(props.trip.id, Date.now())
})

function dismiss() {
  since.value = Date.now()
  writeSeen(props.trip.id, since.value)
  all.value = false
}
</script>

<template>
  <section v-if="others.length" class="flex flex-col gap-1.5 rounded-control border border-line bg-surface px-3 py-2.5" aria-labelledby="trip-log-title">
    <div class="flex items-center gap-2">
      <h2 id="trip-log-title" class="flex items-baseline gap-1.5 text-caption font-bold tracking-section text-sub">
        旅伴的修改<span class="font-num font-normal tracking-normal">{{ others.length }}</span>
      </h2>
      <button
        type="button"
        class="ml-auto min-h-8 rounded-control px-2 text-caption font-bold text-sub hover:bg-paper hover:text-ink active:not-disabled:translate-y-px pointer-coarse:min-h-tap"
        @click="dismiss"
      >
        知道了
      </button>
    </div>
    <ul class="flex flex-col gap-1">
      <li v-for="x in shown" :key="x.id" class="flex items-start gap-2 text-body-sm">
        <MemberAvatar :member="trip.member_info[x.by]" :size="20" class="mt-0.5" />
        <span class="min-w-0 flex-1 break-words">
          <span class="font-bold">{{ who(x.by) }}</span>
          <span class="ml-1">{{ logText(x) }}</span>
        </span>
        <span class="shrink-0 font-num text-caption text-sub">{{ when(x.at) }}</span>
      </li>
    </ul>
    <button
      v-if="others.length > SHOW"
      type="button"
      class="w-fit text-caption font-bold text-sub hover:text-ink pointer-coarse:min-h-tap"
      :aria-expanded="all"
      @click="all = !all"
    >
      {{ all ? '收起' : `還有 ${others.length - SHOW} 筆` }}
    </button>
  </section>
</template>
