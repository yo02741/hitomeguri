<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { LIST_NAME_MAX, type SpotRef, useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 景點卡片的收藏、去過、清單（UX-FLOW.md B4、§3）。未登入時按下去先登入，登入後完成動作。
const props = defineProps<{ spot: SpotRef }>()
const marks = useMarksStore()
const userStore = useUserStore()

const mark = computed(() => marks.markOf(props.spot.id))
const disabled = computed(() => !userStore.canSignIn)

// 清單選單
const listOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const newName = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

function onPointerDown(e: PointerEvent) {
  if (root.value && !root.value.contains(e.target as Node)) listOpen.value = false
}
watch(listOpen, (o) => {
  if (o) document.addEventListener('pointerdown', onPointerDown)
  else document.removeEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
watch(
  () => props.spot.id,
  () => {
    listOpen.value = false
    newName.value = ''
  },
)

async function openLists() {
  if (listOpen.value) {
    listOpen.value = false
    return
  }
  // 未登入：先登入再打開
  if (!userStore.user) {
    try {
      await userStore.signIn()
    } catch {
      return
    }
  }
  listOpen.value = true
  await nextTick()
  if (!marks.lists.length) nameInput.value?.focus()
}

async function addList() {
  const name = newName.value.trim()
  if (!name) return
  newName.value = ''
  await marks.createList(name, props.spot)
}

const inLists = computed(() => mark.value?.lists?.length ?? 0)
const today = new Date().toISOString().slice(0, 10)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div ref="root" class="relative grid grid-cols-3 gap-2">
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :class="
          mark?.favorite
            ? 'border-[1.5px] border-region-strong bg-region-tint font-bold text-ink'
            : 'border border-line bg-paper text-ink hover:bg-surface'
        "
        :aria-pressed="Boolean(mark?.favorite)"
        :disabled="disabled"
        @click="marks.toggleFavorite(spot)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" :fill="mark?.favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
        收藏
      </button>
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :class="
          mark?.visited
            ? 'border-[1.5px] border-visited bg-visited-tint font-bold text-visited'
            : 'border border-line bg-paper text-ink hover:bg-surface'
        "
        :aria-pressed="Boolean(mark?.visited)"
        :disabled="disabled"
        @click="marks.toggleVisited(spot)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
        </svg>
        去過
      </button>
      <button
        type="button"
        class="flex h-11 items-center justify-center gap-1.5 rounded-control text-body-sm active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        :class="inLists ? 'border-[1.5px] border-ink bg-surface font-bold text-ink' : 'border border-line bg-paper text-ink hover:bg-surface'"
        aria-haspopup="true"
        :aria-expanded="listOpen"
        :disabled="disabled"
        @click="openLists"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" />
        </svg>
        清單<span v-if="inLists" class="font-latin">{{ inLists }}</span>
      </button>

      <!-- 清單選單：勾選加入或移出；最下面新增清單 -->
      <div
        v-if="listOpen"
        class="absolute right-0 bottom-13 left-0 z-30 flex max-h-[50dvh] flex-col rounded-card bg-paper p-1.5 shadow-float"
        role="group"
        aria-label="加入清單"
      >
        <div class="scroll-quiet flex flex-col overflow-y-auto">
          <label
            v-for="l in marks.lists"
            :key="l.id"
            class="flex min-h-tap cursor-pointer items-center gap-2.5 rounded-control px-2.5 text-body-sm hover:bg-surface"
          >
            <input
              type="checkbox"
              class="size-4 accent-(--region-strong)"
              :checked="mark?.lists?.includes(l.id) ?? false"
              @change="marks.toggleInList(spot, l.id)"
            />
            <span class="min-w-0 truncate">{{ l.name }}</span>
          </label>
        </div>
        <form class="mt-1 flex gap-1.5 border-t border-line-soft px-1 pt-2" @submit.prevent="addList">
          <input
            ref="nameInput"
            v-model="newName"
            type="text"
            :maxlength="LIST_NAME_MAX"
            placeholder="新清單名稱"
            aria-label="新清單名稱"
            class="h-10 min-w-0 flex-1 rounded-control border border-line bg-paper px-2.5 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
          />
          <button
            type="submit"
            class="h-10 shrink-0 rounded-control border border-line bg-paper px-3 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!newName.trim()"
          >
            新增
          </button>
        </form>
      </div>
    </div>

    <label v-if="mark?.visited" class="flex items-center gap-2.5 text-body-sm text-sub">
      <span class="w-[72px] shrink-0">去過日期</span>
      <input
        type="date"
        :value="mark.visited_on ?? ''"
        :max="today"
        class="h-9 rounded-control border border-line bg-paper px-2 font-latin text-body-sm text-ink outline-none focus:border-region-strong"
        @change="marks.setVisitedOn(spot, ($event.target as HTMLInputElement).value)"
      />
    </label>
    <p v-if="marks.error" class="text-caption text-danger" role="alert">{{ marks.error }}</p>
  </div>
</template>
