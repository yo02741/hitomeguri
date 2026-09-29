<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import ExportButtons from '../components/ExportButtons.vue'
import MarkedSpotList from '../components/MarkedSpotList.vue'
import { useMarkedSpots } from '../composables/markedSpots'
import { LIST_NAME_MAX, useMarksStore } from '../stores/marks'
import { useUserStore } from '../stores/user'

// 我的：收藏、清單、帳號（UX-FLOW.md §5.2 /me）
const userStore = useUserStore()
const marks = useMarksStore()
const router = useRouter()

const { rows: favorites, loading } = useMarkedSpots(() => marks.favorites)

const listCounts = computed(() => {
  const counts = new Map<string, number>()
  for (const m of Object.values(marks.marks)) for (const id of m.lists ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  return counts
})

const newName = ref('')
async function addList() {
  const name = newName.value.trim()
  if (!name) return
  newName.value = ''
  const id = await marks.createList(name)
  if (id) await router.push(`/me/lists/${id}`)
}

async function logOut() {
  await userStore.logOut()
  await router.push('/')
}
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-9">
    <h1 class="text-h2 font-black tracking-[2px]">收藏與清單</h1>

    <template v-if="userStore.user">
      <section class="flex flex-col gap-3" aria-labelledby="fav-title">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 id="fav-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
            收藏<span class="font-latin text-body font-normal tracking-normal text-sub">{{ favorites.length }}</span>
          </h2>
          <ExportButtons class="ml-auto" title="ひとめぐり 收藏" :rows="favorites" />
        </div>
        <MarkedSpotList v-if="favorites.length" :rows="favorites" :loading="loading" />
        <p v-else-if="marks.loaded" class="text-body-sm text-sub">還沒有收藏的地方</p>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="lists-title">
        <h2 id="lists-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-[2px]">
          清單<span class="font-latin text-body font-normal tracking-normal text-sub">{{ marks.lists.length }}</span>
        </h2>
        <ul v-if="marks.lists.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <li v-for="l in marks.lists" :key="l.id">
            <RouterLink
              :to="`/me/lists/${l.id}`"
              class="flex min-h-tap items-center gap-3 rounded-card border border-line bg-paper px-4 py-3 text-ink no-underline hover:bg-surface"
            >
              <span class="min-w-0 truncate text-body font-bold">{{ l.name }}</span>
              <span class="ml-auto shrink-0 font-latin text-body-sm text-sub">{{ listCounts.get(l.id) ?? 0 }}</span>
            </RouterLink>
          </li>
        </ul>
        <form class="flex max-w-md gap-2" @submit.prevent="addList">
          <input
            v-model="newName"
            type="text"
            :maxlength="LIST_NAME_MAX"
            placeholder="新清單名稱"
            aria-label="新清單名稱"
            class="h-11 min-w-0 flex-1 rounded-control border border-line bg-paper px-3 text-body-sm text-ink outline-none placeholder:text-sub focus:border-region-strong"
          />
          <button
            type="submit"
            class="h-11 shrink-0 rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="!newName.trim()"
          >
            新增清單
          </button>
        </form>
      </section>

      <section class="flex flex-col gap-3" aria-labelledby="account-title">
        <h2 id="account-title" class="text-h3 font-black tracking-[2px]">帳號</h2>
        <div class="flex flex-col">
          <span class="text-body">{{ userStore.user.displayName }}</span>
          <span v-if="userStore.user.email" class="text-body-sm text-sub">{{ userStore.user.email }}</span>
        </div>
        <button
          type="button"
          class="h-11 w-fit rounded-control border border-line bg-paper px-3.5 text-body-sm text-ink hover:bg-surface active:translate-y-px"
          @click="logOut"
        >
          登出
        </button>
      </section>
      <p v-if="marks.error" class="text-caption text-danger" role="alert">{{ marks.error }}</p>
    </template>

    <div v-else class="flex flex-col gap-4">
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
