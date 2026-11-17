<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useModal } from '../composables/modal'
import { packOfId } from '../data/packs'
import type { PackItem, Spot } from '../services/bundles'
import { useCatalogStore } from '../stores/catalog'
import PackPanel from './PackPanel.vue'
import SpotPanel from './SpotPanel.vue'

// 行程頁點停留點（清單或地圖）時的介紹：景點用景點卡片，擴充包的點（人孔蓋、角色商店…）用擴充包卡片。
// 桌機放在地圖左上（位置由行程頁決定）；手機（sheet）是從下方出現的對話框，Esc、點遮罩、卡片的關閉收起。
const props = defineProps<{ id: string; pref: string; sheet?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const catalog = useCatalogStore()

// 城的擴充包卡片可以打開對應的景點介紹
const shownId = ref(props.id)
watch(() => props.id, (id) => (shownId.value = id))
const pack = computed(() => packOfId(shownId.value))

const spot = ref<Spot | null>(null)
const item = ref<PackItem | null>(null)
const loading = ref(false)
watch(
  shownId,
  async (id) => {
    loading.value = true
    spot.value = null
    item.value = null
    try {
      const key = packOfId(id)
      if (key) {
        const list = await catalog.loadPack(key)
        if (shownId.value === id) item.value = list.find((x) => x.id === id) ?? null
      } else {
        const d = await catalog.loadDetail(props.pref)
        const s = d[id] ?? (await catalog.getSpot(id))
        if (shownId.value === id) spot.value = s
      }
    } catch {
      // 讀不到：只顯示「沒有這個地點的介紹」
    } finally {
      if (shownId.value === id) loading.value = false
    }
  },
  { immediate: true },
)

const { cancel, closed } = useModal(() => emit('close'))
</script>

<template>
  <dialog
    v-if="sheet"
    ref="dlg"
    class="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-ink backdrop:animate-scrim-in backdrop:bg-ink/60"
    aria-label="介紹"
    @cancel="cancel"
    @close="closed"
  >
    <div class="flex size-full flex-col justify-end pt-12" @click.self="emit('close')">
      <div data-reduce="fade" class="mx-auto flex max-h-full w-full max-w-[560px] animate-sheet-in flex-col overflow-hidden rounded-t-sheet bg-paper pb-[env(safe-area-inset-bottom)] shadow-sheet">
        <PackPanel v-if="pack && item" :item="item" :pack="pack" class="max-h-[85dvh]" @close="emit('close')" @open-spot="shownId = $event" />
        <SpotPanel v-else-if="!pack && (spot || loading)" :spot="spot" :loading="loading" class="max-h-[85dvh]" @close="emit('close')" />
        <div v-else class="flex items-center gap-3 px-5 py-4">
          <p class="text-body-sm text-sub">{{ loading ? '載入中' : '沒有這個地點的介紹' }}</p>
          <button type="button" class="ml-auto min-h-tap rounded-control px-3 text-body-sm font-bold text-sub hover:bg-surface hover:text-ink" @click="emit('close')">關閉</button>
        </div>
      </div>
    </div>
  </dialog>
  <div v-else class="flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-float">
    <PackPanel v-if="pack && item" :item="item" :pack="pack" class="min-h-0 flex-1" @close="emit('close')" @open-spot="shownId = $event" />
    <SpotPanel v-else-if="!pack && (spot || loading)" :spot="spot" :loading="loading" class="min-h-0 flex-1" @close="emit('close')" />
    <div v-else class="flex items-center gap-3 px-5 py-4">
      <p class="text-body-sm text-sub">{{ loading ? '載入中' : '沒有這個地點的介紹' }}</p>
      <button type="button" class="ml-auto min-h-tap rounded-control px-3 text-body-sm font-bold text-sub hover:bg-surface hover:text-ink" @click="emit('close')">關閉</button>
    </div>
  </div>
</template>
