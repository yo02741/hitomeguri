<script setup lang="ts">
import { computed, onMounted } from 'vue'

import { hasProgress } from '../data/achievements'
import { regionOf } from '../data/regions'
import { type AchvState, type Contrib, dotDate, type PrefStampState } from '../services/achievements'
import { useAchievementsStore } from '../stores/achievements'
import { achvKey, useFreshStore } from '../stores/fresh'
import AchvSeal from './AchvSeal.vue'
import PrefStamp from './PrefStamp.vue'
import RulesDialog from './RulesDialog.vue'

// 成就的詳細（DESIGN.md §7.25）：章、條件、日期或進度、抽獎券、有關的景點／旅行／縣（最多 12 筆）。
// 打開就算看過（拿掉 NEW）。外框是 RulesDialog（原生 <dialog>：Esc、點外面關閉）；關閉後焦點回到觸發的格子由頁面處理（Safari 點按鈕不會給焦點，瀏覽器歸還不一定回得去）。
const props = defineProps<{ state?: AchvState | null; stamp?: PrefStampState | null }>()
const emit = defineEmits<{ close: [] }>()
const fresh = useFreshStore()
const achv = useAchievementsStore()

const MAX = 12
const region = computed(() => (props.stamp ? regionOf(props.stamp.pref) : undefined))
const title = computed(() => (props.state ? props.state.def.name : `${region.value?.name.zh_tw ?? ''}　初訪`))
const items = computed<Contrib[]>(() => (props.state ? achv.items(props.state.def) : props.stamp ? achv.prefItems(props.stamp.pref) : []))
const at = computed(() => props.state?.at ?? props.stamp?.at ?? null)
const done = computed(() => (props.state ? props.state.status === 'done' : Boolean(props.stamp?.done)))
const undated = computed(() => props.state?.undated ?? props.stamp?.undated ?? 0)
const kind = computed(() => items.value[0]?.kind ?? 'spot')
const HEADING = { spot: '有關的地方', trip: '有關的旅行', pref: '有關的縣' } as const
const UNIT = { spot: '處', trip: '趟', pref: '縣' } as const
const progress = computed(() => {
  const s = props.state
  if (!s || done.value || !hasProgress(s.def)) return null
  return s.note ?? `${Math.min(s.have, s.need)} / ${s.need}`
})

onMounted(() => {
  const id = props.state ? props.state.def.id : props.stamp ? `pref-${props.stamp.pref}` : null
  if (id) fresh.seen([achvKey(id)])
})
</script>

<template>
  <RulesDialog :title="title" @close="emit('close')">
    <div class="flex items-center gap-5 max-sm:flex-col max-sm:items-start">
      <div class="w-[132px] shrink-0">
        <AchvSeal v-if="state" :def="state.def" :status="state.status" :at="state.at" class="w-full" />
        <div v-else-if="stamp?.done" :data-pref="stamp.pref"><PrefStamp :pref="stamp.pref" :date="stamp.at" /></div>
        <span v-else class="grid aspect-square w-full place-items-center rounded-full border-2 border-dashed border-line text-h3 font-black text-sub" lang="ja" aria-hidden="true">{{ region?.name.ja }}</span>
      </div>
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-sm">
        <dt class="text-sub">條件</dt>
        <dd>{{ state ? state.def.hint : `去過${region?.name.zh_tw ?? ''}` }}</dd>
        <template v-if="done">
          <template v-if="at">
            <dt class="text-sub">日期</dt>
            <dd class="font-num">{{ dotDate(at) }}</dd>
          </template>
        </template>
        <template v-else-if="progress">
          <dt class="text-sub">進度</dt>
          <dd :class="state?.note ? '' : 'font-num'">{{ progress }}</dd>
        </template>
        <template v-if="state && state.def.tickets > 0">
          <dt class="text-sub">抽獎券</dt>
          <dd><span class="font-num">{{ state.def.tickets }}</span> 張</dd>
        </template>
      </dl>
    </div>

    <p v-if="done && !at && undated > 0" class="text-body-sm text-sub">
      沒有日期 <span class="font-num">{{ undated }}</span> 處
      <RouterLink to="/log?fill=1" class="ml-2 font-bold text-ink underline-offset-2 hover:underline" @click="emit('close')">補日期</RouterLink>
    </p>

    <section v-if="items.length" class="flex flex-col gap-2" aria-labelledby="achv-items">
      <h3 id="achv-items" class="text-body-sm font-bold text-sub">{{ HEADING[kind] }}</h3>
      <ul class="flex flex-col">
        <li v-for="c in items.slice(0, MAX)" :key="c.key" class="border-b border-line-soft last:border-b-0">
          <RouterLink :to="c.to" class="flex min-h-11 items-center gap-3 py-1.5 text-body-sm text-ink no-underline hover:text-region-strong active:text-region-strong" @click="emit('close')">
            <span class="line-clamp-2 min-w-0 flex-1 break-words" :lang="c.lang">{{ c.label }}</span>
            <span v-if="c.date" class="shrink-0 font-num text-caption text-sub">{{ dotDate(c.date) }}</span>
          </RouterLink>
        </li>
      </ul>
      <p v-if="items.length > MAX" class="text-caption text-sub">還有 <span class="font-num">{{ items.length - MAX }}</span> {{ UNIT[kind] }}</p>
    </section>
  </RulesDialog>
</template>
