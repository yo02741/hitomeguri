<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ChainSearch from '../components/ChainSearch.vue'
import FindGallery from '../components/FindGallery.vue'
import TimedList from '../components/TimedList.vue'
import { currentTimed } from '../services/timed'
import { todayIso } from '../services/userdb'
import { useCatalogStore } from '../stores/catalog'
import { useFindsStore } from '../stores/finds'
import { useUserStore } from '../stores/user'

// 期間限定（UX-FLOW.md A6、D5）：連鎖店的 Google 搜尋、自己存的截圖、全國目前的季節觀測。
const userStore = useUserStore()
const finds = useFindsStore()
const catalog = useCatalogStore()
onMounted(() => void catalog.loadTimed())
const timed = computed(() => currentTimed(catalog.timed ?? [], todayIso()))

const brand = ref<string | null>(null)
const shown = computed(() => (brand.value ? finds.finds.filter((f) => f.brand === brand.value) : finds.finds))
const gallery = ref<InstanceType<typeof FindGallery> | null>(null)
</script>

<template>
  <section class="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pt-9 pb-24">
    <h1 class="text-h2 font-black tracking-title">期間限定</h1>

    <section class="flex flex-col gap-3" aria-labelledby="chain-title">
      <h2 id="chain-title" class="text-h3 font-black tracking-title">連鎖店</h2>
      <ChainSearch />
    </section>

    <section class="flex flex-col gap-4" aria-labelledby="finds-title">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="finds-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-title">
          截圖<span v-if="finds.finds.length" class="font-num text-body font-normal tracking-normal text-sub">{{ finds.finds.length }}</span>
        </h2>
        <!-- 截圖存在帳號裡：未登入時不放「新增」，下面那一行寫需要登入 -->
        <button
          v-if="userStore.user"
          type="button"
          class="ml-auto h-10 rounded-control bg-region-strong px-4 text-body-sm font-bold text-white active:translate-y-px pointer-coarse:h-tap"
          @click="gallery?.add()"
        >
          新增
        </button>
      </div>
      <nav v-if="finds.brands.length > 1" class="flex flex-wrap gap-x-3.5 gap-y-1 pointer-coarse:-mx-1.5 pointer-coarse:-my-2.5 pointer-coarse:gap-x-0.5 pointer-coarse:gap-y-0" aria-label="品牌">
        <button
          type="button"
          class="text-body-sm pointer-coarse:px-1.5 pointer-coarse:py-2.5"
          :class="brand === null ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
          :aria-pressed="brand === null"
          @click="brand = null"
        >
          <span class="block border-b-2 border-inherit pb-0.5">全部</span>
        </button>
        <button
          v-for="b in finds.brands"
          :key="b"
          type="button"
          class="text-body-sm pointer-coarse:px-1.5 pointer-coarse:py-2.5"
          :class="brand === b ? 'border-region-strong font-bold text-ink' : 'border-transparent text-sub hover:text-ink active:text-ink'"
          :aria-pressed="brand === b"
          @click="brand = brand === b ? null : b"
        >
          <span class="block border-b-2 border-inherit pb-0.5">{{ b }}</span>
        </button>
      </nav>
      <FindGallery ref="gallery" :finds="shown" />
      <p v-if="userStore.user && finds.loaded && !finds.finds.length" class="text-body-sm text-sub">還沒有截圖</p>
      <p v-if="!userStore.user" class="text-body-sm text-sub">截圖存在自己的帳號裡，需要登入。</p>
    </section>

    <section v-if="timed.length" class="flex flex-col gap-3" aria-labelledby="season-title">
      <h2 id="season-title" class="flex items-baseline gap-1.5 text-h3 font-black tracking-title">
        季節<span class="font-num text-body font-normal tracking-normal text-sub">{{ timed.length }}</span>
      </h2>
      <TimedList :items="timed" detailed />
    </section>
  </section>
</template>
