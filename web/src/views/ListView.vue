<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'

import ExportButtons from '../components/ExportButtons.vue'
import MarkedSpotList from '../components/MarkedSpotList.vue'
import { type MarkedSpot, useMarkedSpots } from '../composables/markedSpots'
import { markRow } from '../services/export'
import { LIST_NAME_MAX, useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 一個清單：景點、改名、匯出、刪除
const props = defineProps<{ id: string }>()
const userStore = useUserStore()
const marks = useMarksStore()
const router = useRouter()

const list = computed(() => marks.lists.find((l) => l.id === props.id))
const { rows, loading } = useMarkedSpots(() => marks.listEntries(props.id))

const editing = ref(false)
const draft = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
async function startEdit() {
  draft.value = list.value?.name ?? ''
  editing.value = true
  await nextTick()
  nameInput.value?.select()
}
async function saveName() {
  const name = draft.value.trim()
  editing.value = false
  if (name && name !== list.value?.name) await marks.renameList(props.id, name)
}

function remove(r: MarkedSpot) {
  void marks.toggleInList({ id: r.id, pref: r.pref, name: r.name }, props.id)
}

async function del() {
  if (!list.value || !window.confirm(`刪除清單「${list.value.name}」？清單裡景點的收藏與去過不受影響。`)) return
  await marks.deleteList(props.id)
  await router.push('/me')
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-9">
    <RouterLink to="/me" class="flex w-fit items-center gap-1 text-label text-sub no-underline hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      收藏與清單
    </RouterLink>

    <template v-if="list">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-3">
        <form v-if="editing" class="flex min-w-0 flex-1 gap-2" @submit.prevent="saveName">
          <input
            ref="nameInput"
            v-model="draft"
            type="text"
            :maxlength="LIST_NAME_MAX"
            aria-label="清單名稱"
            class="h-11 min-w-0 flex-1 rounded-control border border-region-strong bg-paper px-3 text-body text-ink outline-none"
            @keydown.esc="editing = false"
          />
          <button type="submit" class="h-11 shrink-0 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface">
            儲存
          </button>
        </form>
        <h1 v-else class="flex min-w-0 items-baseline gap-2 text-h2 font-black tracking-[2px]">
          <span class="truncate">{{ list.name }}</span>
          <span class="font-latin text-body font-normal tracking-normal text-sub">{{ rows.length }}</span>
        </h1>
        <div v-if="!editing" class="ml-auto flex flex-wrap gap-2">
          <ExportButtons :title="list.name" :rows="rows.map(markRow)" />
          <button type="button" class="h-9 rounded-control border border-line bg-paper px-3 text-label text-ink hover:bg-surface" @click="startEdit">
            改名
          </button>
          <button type="button" class="h-9 rounded-control border border-line bg-paper px-3 text-label text-danger hover:bg-surface" @click="del">
            刪除
          </button>
        </div>
      </div>
      <MarkedSpotList v-if="rows.length" :rows="rows" :loading="loading" remove-label="從清單移除" @remove="remove" />
      <p v-else class="text-body-sm text-sub">清單裡還沒有景點</p>
    </template>
    <p v-else-if="!userStore.user" class="text-body-sm text-sub">收藏、行程與紀錄需要登入。</p>
    <p v-else-if="marks.loaded" class="text-body-sm text-sub">找不到這個清單</p>
    <p v-if="marks.error" class="text-caption text-danger" role="alert">{{ marks.error }}</p>
  </section>
</template>
